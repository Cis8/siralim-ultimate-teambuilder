import type { APIRequestContext } from '@playwright/test';
import { datasetFileName, type DatasetManifest, type TraitDataset } from '@atlas/core';

/** The dataset the build published, read from the preview server: tests compare the page with the data, not with a copy. */
export async function publishedDataset(request: APIRequestContext): Promise<TraitDataset> {
  const manifest = (await (await request.get('./data/manifest.json')).json()) as DatasetManifest;
  return (await (await request.get(`./data/${datasetFileName(manifest.hash)}`)).json()) as TraitDataset;
}
