import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { measureBuild, modulePreloads } from './measure-build';

describe('modulePreloads', () => {
  it('lists the scripts the page preloads, in the order the page names them', () => {
    const html = `<head>
      <link href="./_app/immutable/entry/start.A.js" rel="modulepreload">
      <link href="./_app/immutable/chunks/B.js" rel="modulepreload">
    </head>`;
    expect(modulePreloads(html)).toEqual(['./_app/immutable/entry/start.A.js', './_app/immutable/chunks/B.js']);
  });

  it('reads the link whichever way round its attributes are written', () => {
    expect(modulePreloads('<link rel="modulepreload" crossorigin href="./a.js" />')).toEqual(['./a.js']);
  });

  it('leaves out what is not a script the page preloads', () => {
    const html = `<link href="./icon.svg" rel="icon" type="image/svg+xml">
      <link href="./_app/immutable/assets/0.css" rel="stylesheet">
      <link href="./font.woff2" rel="preload" as="font">
      <script>import("./_app/immutable/entry/app.js")</script>`;
    expect(modulePreloads(html)).toEqual([]);
  });

  it('names a script once when the page preloads it twice', () => {
    const html = '<link href="./a.js" rel="modulepreload"><link href="./a.js" rel="modulepreload">';
    expect(modulePreloads(html)).toEqual(['./a.js']);
  });
});

describe('measureBuild', () => {
  let buildDir: string;

  beforeEach(async () => {
    buildDir = await mkdtemp(join(tmpdir(), 'size-budget-'));
  });

  afterEach(async () => {
    await rm(buildDir, { recursive: true, force: true });
  });

  async function put(path: string, content: string): Promise<void> {
    await mkdir(dirname(join(buildDir, path)), { recursive: true });
    await writeFile(join(buildDir, path), content);
  }

  const page = (...scripts: string[]): string =>
    `<head>${scripts.map((script) => `<link href="${script}" rel="modulepreload">`).join('')}</head>`;

  it('measures the gzipped size of the preloaded scripts and of every data file', async () => {
    const start = 'export const start = 1;\n'.repeat(200);
    const chunk = 'export const chunk = "chunk";\n'.repeat(300);
    const dataset = JSON.stringify({ traits: Array.from({ length: 300 }, (_, id) => ({ id })) });
    await put('index.html', page('./_app/start.js', './_app/chunks/a.js'));
    await put('_app/start.js', start);
    await put('_app/chunks/a.js', chunk);
    await put('data/manifest.json', '{"hash":"abc"}');
    await put('data/traits.abc.json', dataset);

    const sizes = await measureBuild(buildDir);

    expect(sizes.initialJs).toEqual([
      { path: '_app/start.js', gzipBytes: gzipSync(start).length },
      { path: '_app/chunks/a.js', gzipBytes: gzipSync(chunk).length },
    ]);
    expect(sizes.data).toEqual([
      { path: 'data/manifest.json', gzipBytes: gzipSync('{"hash":"abc"}').length },
      { path: 'data/traits.abc.json', gzipBytes: gzipSync(dataset).length },
    ]);
  });

  it('does not count a script the page loads later', async () => {
    await put('index.html', page('./_app/start.js'));
    await put('_app/start.js', 'export const start = 1;\n');
    await put('_app/lazy.js', 'export const lazy = "not on the first screen";\n'.repeat(500));
    await put('data/manifest.json', '{}');

    const sizes = await measureBuild(buildDir);

    expect(sizes.initialJs.map((file) => file.path)).toEqual(['_app/start.js']);
  });

  it('fails when the page preloads nothing, since a budget that measures nothing always passes', async () => {
    await put('index.html', '<head><title>No scripts</title></head>');
    await put('data/manifest.json', '{}');

    await expect(measureBuild(buildDir)).rejects.toThrow(/preloads no script/u);
  });

  it('fails, naming the script, when the page preloads one the build lacks', async () => {
    await put('index.html', page('./_app/gone.js'));
    await put('data/manifest.json', '{}');

    await expect(measureBuild(buildDir)).rejects.toThrow(/_app\/gone\.js/u);
  });

  it('fails when there is no data to measure', async () => {
    await put('index.html', page('./_app/start.js'));
    await put('_app/start.js', 'export {};\n');

    await expect(measureBuild(buildDir)).rejects.toThrow(/no data/u);
  });

  it('fails, saying to build first, when there is no build', async () => {
    await expect(measureBuild(join(buildDir, 'missing'))).rejects.toThrow(/pnpm build/u);
  });
});
