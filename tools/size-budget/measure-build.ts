import { readFile, readdir } from 'node:fs/promises';
import { join, posix, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

export interface FileSize {
  /** Relative to the build directory, with forward slashes. */
  readonly path: string;
  /** What the file weighs on the wire: GitHub Pages serves text gzipped. */
  readonly gzipBytes: number;
}

export interface BuildSizes {
  /** The scripts the page preloads: what a first visit downloads before the app can run. */
  readonly initialJs: readonly FileSize[];
  /** The other scripts of the app: what it fetches later, as the query assist or a route that is visited (ADR-0010). */
  readonly lazyJs: readonly FileSize[];
  /** Every file under `data/`: the manifest and the dataset the app loads. */
  readonly data: readonly FileSize[];
}

const DATA_DIRECTORY = 'data';
/** Where SvelteKit puts the scripts of the app. */
const APP_DIRECTORY = '_app';

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

/** The scripts a page preloads, in the order it names them. SvelteKit preloads every chunk the first screen needs. */
export function modulePreloads(html: string): string[] {
  const hrefs = (html.match(/<link\b[^>]*>/gu) ?? [])
    .filter((tag) => /\srel="modulepreload"/u.test(tag))
    .flatMap((tag) => /\shref="([^"]*)"/u.exec(tag)?.[1] ?? []);
  return [...new Set(hrefs)];
}

async function gzipSizeOf(buildDir: string, path: string, notFound: string): Promise<FileSize> {
  try {
    return { path, gzipBytes: gzipSync(await readFile(join(buildDir, path))).length };
  } catch (cause) {
    if (isMissing(cause)) throw new Error(notFound, { cause });
    throw cause;
  }
}

async function dataFiles(buildDir: string): Promise<string[]> {
  try {
    const entries = await readdir(join(buildDir, DATA_DIRECTORY), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => `${DATA_DIRECTORY}/${entry.name}`)
      .toSorted();
  } catch (cause) {
    if (isMissing(cause)) return [];
    throw cause;
  }
}

/** Every script of the app, as paths relative to the build directory with forward slashes, sorted. */
async function appScripts(buildDir: string): Promise<string[]> {
  try {
    const entries = await readdir(join(buildDir, APP_DIRECTORY), { withFileTypes: true, recursive: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
      .map((entry) => posix.join(...relative(buildDir, join(entry.parentPath, entry.name)).split(sep)))
      .toSorted();
  } catch (cause) {
    if (isMissing(cause)) return [];
    throw cause;
  }
}

/** Measures the output of `pnpm build` (the static site in `buildDir`). Fails rather than measure nothing. */
export async function measureBuild(buildDir: string): Promise<BuildSizes> {
  let html: string;
  try {
    html = await readFile(join(buildDir, 'index.html'), 'utf8');
  } catch (cause) {
    if (isMissing(cause)) throw new Error(`There is no build in ${buildDir}: run pnpm build first.`, { cause });
    throw cause;
  }

  const scripts = modulePreloads(html).map((href) => posix.normalize(href));
  if (scripts.length === 0) {
    throw new Error(
      'The page preloads no script, so there is no initial JavaScript to measure: has the build changed?',
    );
  }
  const initialJs = await Promise.all(
    scripts.map((path) => gzipSizeOf(buildDir, path, `The page preloads ${path}, which the build does not contain.`)),
  );

  const preloaded = new Set(scripts);
  const lazyPaths = (await appScripts(buildDir)).filter((path) => !preloaded.has(path));
  const lazyJs = await Promise.all(lazyPaths.map((path) => gzipSizeOf(buildDir, path, `${path} has gone.`)));

  const dataPaths = await dataFiles(buildDir);
  if (dataPaths.length === 0) throw new Error(`The build has no data to measure under ${DATA_DIRECTORY}/.`);
  const data = await Promise.all(dataPaths.map((path) => gzipSizeOf(buildDir, path, `${path} has gone.`)));

  return { initialJs, lazyJs, data };
}
