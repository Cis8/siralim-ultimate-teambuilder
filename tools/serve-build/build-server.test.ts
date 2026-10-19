import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { request, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBuildServer } from './build-server';

const FILES: Record<string, string> = {
  'index.html': '<h1>home</h1>',
  'synergy.html': '<h1>picker</h1>',
  '404.html': '<h1>shell</h1>',
  '_app/immutable/entry/start.A.js': 'export const start = 1;',
  'data/manifest.json': '{"hash":"x"}',
  'font.woff2': 'wOF2',
};

interface Answer {
  readonly status: number;
  readonly headers: IncomingHttpHeaders;
  /** The body as it came on the wire: not decompressed. */
  readonly body: Buffer;
}

describe('createBuildServer', () => {
  let buildDir: string;
  let port: number;
  let close: () => Promise<void>;

  /** A raw request: `fetch` would tidy `..` out of the path and unzip the body, and the tests want to see both. */
  const ask = (path: string, { method = 'GET', gzip = false } = {}): Promise<Answer> =>
    new Promise((resolve, reject) => {
      const headers = gzip ? { 'accept-encoding': 'gzip' } : {};
      request({ host: '127.0.0.1', port, path, method, headers }, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) });
        });
        response.on('error', reject);
      })
        .on('error', reject)
        .end();
    });

  const textAt = async (path: string): Promise<string> => (await ask(path)).body.toString();

  beforeEach(async () => {
    // The build is inside a folder of its own, so that a path which climbs out of it finds a file there.
    buildDir = join(await mkdtemp(join(tmpdir(), 'serve-build-')), 'build');
    for (const [path, text] of Object.entries(FILES)) {
      await mkdir(dirname(join(buildDir, path)), { recursive: true });
      await writeFile(join(buildDir, path), text);
    }
    await writeFile(join(dirname(buildDir), 'secret.txt'), 'outside the build');

    const server = createBuildServer(buildDir);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
    close = () =>
      new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      });
  });

  afterEach(async () => {
    await close();
    await rm(dirname(buildDir), { recursive: true, force: true });
  });

  it('serves a file of the build with its type', async () => {
    const answer = await ask('/_app/immutable/entry/start.A.js');
    expect(answer.status).toBe(200);
    expect(answer.headers['content-type']).toContain('text/javascript');
    expect(answer.body.toString()).toBe(FILES['_app/immutable/entry/start.A.js']);
  });

  it('serves the page of the root, and the page that a path without an extension names, as GitHub Pages does', async () => {
    expect(await textAt('/')).toBe('<h1>home</h1>');
    expect(await textAt('/synergy')).toBe('<h1>picker</h1>');
  });

  it('answers a page the build does not have with 404.html and status 200, so that Lighthouse measures it', async () => {
    // A path with a slash after a page's name and a folder are not that page either: Pages has no `synergy/index.html`.
    for (const path of ['/synergy/some-trait', '/synergy/kw/vulnerable', '/synergy/', '/_app']) {
      const answer = await ask(path);
      expect(answer.status, path).toBe(200);
      expect(answer.body.toString(), path).toBe('<h1>shell</h1>');
    }
  });

  it('answers a file the build does not have with 404.html and status 404, as Pages does', async () => {
    // Lighthouse reads a 404 for robots.txt as "none"; the page of a 200 it would take for a robots.txt and find 46 errors in.
    for (const path of ['/robots.txt', '/missing.js', '/synergy/sitemap.xml']) {
      const answer = await ask(path);
      expect(answer.status, path).toBe(404);
      expect(answer.body.toString(), path).toBe('<h1>shell</h1>');
    }
  });

  it('does not leave the build directory', async () => {
    for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '/data/../../secret.txt']) {
      expect(await textAt(path), path).toBe('<h1>shell</h1>');
    }
  });

  it('answers a path that is not valid UTF-8 percent-encoding with the fallback, not an error', async () => {
    const answer = await ask('/%E0%A4%A');
    expect(answer.status).toBe(200);
    expect(answer.body.toString()).toBe('<h1>shell</h1>');
  });

  it('compresses text for a client that accepts gzip, and leaves a font alone', async () => {
    const page = await ask('/synergy', { gzip: true });
    expect(page.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(page.body).toString()).toBe('<h1>picker</h1>');

    const font = await ask('/font.woff2', { gzip: true });
    expect(font.headers['content-encoding']).toBeUndefined();
    expect(font.body.toString()).toBe('wOF2');
  });

  it('sends text as it is to a client that does not ask for gzip', async () => {
    const answer = await ask('/data/manifest.json');
    expect(answer.headers['content-encoding']).toBeUndefined();
    expect(answer.body.toString()).toBe('{"hash":"x"}');
  });

  it('answers a HEAD request with the headers and no body', async () => {
    const answer = await ask('/', { method: 'HEAD' });
    expect(answer.status).toBe(200);
    expect(answer.headers['content-type']).toContain('text/html');
    expect(answer.body).toHaveLength(0);
  });

  it('refuses a method that reads nothing', async () => {
    expect((await ask('/', { method: 'POST' })).status).toBe(405);
  });
});
