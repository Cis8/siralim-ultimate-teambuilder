import { DATASET_SCHEMA_VERSION, DatasetLoadError, type TraitDataset } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { createStaticTraitRepository } from './static-trait-repository';

const manifest = { datasetVersion: '2.0', hash: '0123456789abcdef', count: 0, generatedAt: '2026-10-16T15:12:03.032Z' };
const dataset: TraitDataset = { schemaVersion: DATASET_SCHEMA_VERSION, datasetVersion: '2.0', traits: [] };

const urlOf = (fileName: string) => `/atlas/data/${fileName}`;

/** A fetch over a few files: `files` maps a URL to its JSON; any other URL is a 404. */
function fakeFetch(files: Readonly<Record<string, unknown>>) {
  const requests: { url: string; init: RequestInit | undefined }[] = [];
  const fetch = (url: string, init?: RequestInit): Promise<Response> => {
    requests.push({ url, init });
    return Promise.resolve(url in files ? Response.json(files[url]) : new Response('Not found', { status: 404 }));
  };
  return { fetch, requests };
}

describe('createStaticTraitRepository', () => {
  it('reads the manifest, then the dataset file it names', async () => {
    const { fetch, requests } = fakeFetch({
      '/atlas/data/manifest.json': manifest,
      '/atlas/data/traits.0123456789abcdef.json': dataset,
    });

    await expect(createStaticTraitRepository({ fetch, urlOf }).load()).resolves.toEqual(dataset);
    expect(requests.map(({ url }) => url)).toEqual([
      '/atlas/data/manifest.json',
      '/atlas/data/traits.0123456789abcdef.json',
    ]);
  });

  it('asks the server whether the manifest changed: it is the one file whose name does not change with its content', async () => {
    const { fetch, requests } = fakeFetch({
      '/atlas/data/manifest.json': manifest,
      '/atlas/data/traits.0123456789abcdef.json': dataset,
    });

    await createStaticTraitRepository({ fetch, urlOf }).load();

    expect(requests[0]?.init?.cache).toBe('no-cache');
  });

  it('fails, naming the file and the status, when a file is not there', async () => {
    const { fetch } = fakeFetch({ '/atlas/data/manifest.json': manifest });

    const loading = createStaticTraitRepository({ fetch, urlOf }).load();

    await expect(loading).rejects.toThrow(DatasetLoadError);
    await expect(loading).rejects.toThrow('/atlas/data/traits.0123456789abcdef.json (404)');
  });

  it('fails with the cause when the network does', async () => {
    const offline = new TypeError('Failed to fetch');
    const fetch = () => Promise.reject(offline);

    const loading = createStaticTraitRepository({ fetch, urlOf }).load();

    await expect(loading).rejects.toThrow(DatasetLoadError);
    await expect(loading).rejects.toMatchObject({ cause: offline });
  });

  it('fails when a file is not JSON', async () => {
    const fetch = () => Promise.resolve(new Response('<!doctype html>', { status: 200 }));

    await expect(createStaticTraitRepository({ fetch, urlOf }).load()).rejects.toThrow(DatasetLoadError);
  });

  it('fails when the manifest is not a manifest', async () => {
    const { fetch } = fakeFetch({ '/atlas/data/manifest.json': { hash: '../../etc' } });

    await expect(createStaticTraitRepository({ fetch, urlOf }).load()).rejects.toThrow(DatasetLoadError);
  });

  it('fails when the dataset is of a format the app does not read', async () => {
    const { fetch } = fakeFetch({
      '/atlas/data/manifest.json': manifest,
      '/atlas/data/traits.0123456789abcdef.json': { ...dataset, schemaVersion: DATASET_SCHEMA_VERSION + 1 },
    });

    await expect(createStaticTraitRepository({ fetch, urlOf }).load()).rejects.toThrow(DatasetLoadError);
  });
});
