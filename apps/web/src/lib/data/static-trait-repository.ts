import {
  DatasetLoadError,
  MANIFEST_FILE_NAME,
  datasetFileName,
  readDataset,
  readManifest,
  type TraitDataset,
  type TraitRepository,
} from '@atlas/core';

export interface StaticTraitRepositoryOptions {
  readonly fetch: (input: string, init?: RequestInit) => Promise<Response>;
  /** The URL of a file the pipeline emitted, given its name: it knows where the app is served from. */
  readonly urlOf: (fileName: string) => string;
}

/** Reads the dataset the pipeline emitted next to the app: the manifest, then the file it names. */
export function createStaticTraitRepository({ fetch, urlOf }: StaticTraitRepositoryOptions): TraitRepository {
  async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (cause) {
      throw new DatasetLoadError(`Could not reach ${url}.`, { cause });
    }
    if (!response.ok) throw new DatasetLoadError(`Could not read ${url} (${String(response.status)}).`);
    try {
      return (await response.json()) as unknown;
    } catch (cause) {
      throw new DatasetLoadError(`${url} is not JSON.`, { cause });
    }
  }

  return {
    async load(): Promise<TraitDataset> {
      // The manifest keeps its name when its content changes, so a copy the browser kept would name a file that a
      // newer deploy has removed: ask the server every time (a 304 costs no body).
      const manifest = readManifest(await fetchJson(urlOf(MANIFEST_FILE_NAME), { cache: 'no-cache' }));
      return readDataset(await fetchJson(urlOf(datasetFileName(manifest.hash))));
    },
  };
}
