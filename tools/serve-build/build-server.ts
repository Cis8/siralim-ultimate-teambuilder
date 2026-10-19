import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

// What GitHub Pages does with the static site `pnpm build` makes, for the tools that need to browse it (Lighthouse CI): `/x` is
// `x.html` when there is one, and a path the build does not have is answered by `404.html`, which boots the app and lets its router
// draw the page (`/synergy/<trait>` and `/synergy/kw/<key>` are served that way, ADR-0011).

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const UNKNOWN_TYPE = 'application/octet-stream';
/** The extensions of the files that gzip makes smaller; a font is compressed already. */
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg']);
const FALLBACK = '404.html';

/** The path of a request with its percent-encoding undone, or `undefined` when that cannot be read. */
function pathnameOf(url: string | undefined): string | undefined {
  try {
    return decodeURIComponent(new URL(url ?? '/', 'http://localhost').pathname);
  } catch {
    return undefined;
  }
}

/**
 * The files a path may mean, in the order Pages tries them: a folder's `index.html` for a path that ends with a slash, else the file
 * itself and then the page it names without its extension. None when the path climbs out of the build.
 */
function namesFor(root: string, pathname: string): string[] {
  const path = resolve(root, `.${pathname}`);
  if (path !== root && !path.startsWith(root + sep)) return [];
  return pathname.endsWith('/') ? [resolve(path, 'index.html')] : [path, `${path}.html`];
}

/** The first of these names that is a file of the build. */
async function firstFile(names: readonly string[]): Promise<{ path: string; content: Buffer } | undefined> {
  for (const name of names) {
    try {
      return { path: name, content: await readFile(name) };
    } catch {
      // Not a file (or a folder): the next name, then the fallback.
    }
  }
  return undefined;
}

async function respond(root: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' }).end();
    return;
  }

  const pathname = pathnameOf(request.url);
  const asked = pathname === undefined ? undefined : await firstFile(namesFor(root, pathname));
  const file = asked ?? (await firstFile([resolve(root, FALLBACK)]));
  if (file === undefined) {
    response.writeHead(500).end(`${FALLBACK} is not in the build: has it been made?`);
    return;
  }
  // A path with an extension asks for a file (`/robots.txt`) and has none: that is a 404, as it is on Pages. A path without one asks
  // for a page, which the fallback draws.
  const status = asked !== undefined || extname(pathname ?? '') === '' ? 200 : 404;

  const extension = extname(file.path);
  const gzip = COMPRESSIBLE.has(extension) && /\bgzip\b/u.test(request.headers['accept-encoding'] ?? '');
  const body = gzip ? gzipSync(file.content) : file.content;
  response.writeHead(status, {
    'content-type': TYPES[extension] ?? UNKNOWN_TYPE,
    'content-length': body.length,
    ...(COMPRESSIBLE.has(extension) ? { vary: 'accept-encoding' } : {}),
    ...(gzip ? { 'content-encoding': 'gzip' } : {}),
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

/**
 * Serves `buildDir` (not listening yet). A page the build does not have is answered by `404.html` with status 200, where Pages says
 * 404: Lighthouse will not measure a page whose document was a 404, and the page that matters is the one the router draws.
 */
export function createBuildServer(buildDir: string): Server {
  const root = resolve(buildDir);
  return createServer((request, response) => {
    respond(root, request, response).catch((failure: unknown) => {
      if (!response.headersSent) response.writeHead(500);
      response.end(failure instanceof Error ? failure.message : 'Something went wrong.');
    });
  });
}
