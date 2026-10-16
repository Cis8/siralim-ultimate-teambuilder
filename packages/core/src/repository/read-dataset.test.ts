import { describe, expect, it } from 'vitest';
import { DATASET_SCHEMA_VERSION } from '../model/dataset';
import { DatasetLoadError } from './trait-repository';
import { readDataset, readManifest } from './read-dataset';

const dataset = { schemaVersion: DATASET_SCHEMA_VERSION, datasetVersion: '2.0', traits: [] };
const manifest = {
  datasetVersion: '2.0',
  hash: '0123456789abcdef',
  count: 1780,
  generatedAt: '2026-10-16T15:12:03.032Z',
};

describe('readDataset', () => {
  it('reads a dataset of the format this app reads', () => {
    expect(readDataset(dataset)).toEqual(dataset);
  });

  it.each([
    ['null', null],
    ['text', 'traits'],
    ['a list', []],
    ['a dataset without traits', { schemaVersion: DATASET_SCHEMA_VERSION, datasetVersion: '2.0' }],
    ['traits that are not a list', { ...dataset, traits: {} }],
    ['a dataset without a version', { schemaVersion: DATASET_SCHEMA_VERSION, traits: [] }],
  ])('rejects %s', (_name, json) => {
    expect(() => readDataset(json)).toThrow(DatasetLoadError);
  });

  it('names both format versions when the file is of another one', () => {
    const newer = { ...dataset, schemaVersion: DATASET_SCHEMA_VERSION + 1 };
    expect(() => readDataset(newer)).toThrow(
      new RegExp(`version ${String(DATASET_SCHEMA_VERSION + 1)}.*version ${String(DATASET_SCHEMA_VERSION)}`, 'u'),
    );
  });

  it('rejects a file with no format version before it looks at anything else', () => {
    expect(() => readDataset({ datasetVersion: '2.0', traits: [] })).toThrow(DatasetLoadError);
  });
});

describe('readManifest', () => {
  it('reads a well-formed manifest', () => {
    expect(readManifest(manifest)).toEqual(manifest);
  });

  it.each([
    ['null', null],
    ['text', 'manifest'],
    ['a manifest without a hash', { ...manifest, hash: undefined }],
    ['a manifest without a version', { ...manifest, datasetVersion: undefined }],
    ['a count that is not a whole number', { ...manifest, count: 1.5 }],
    ['a negative count', { ...manifest, count: -1 }],
    ['a time that is not text', { ...manifest, generatedAt: 0 }],
  ])('rejects %s', (_name, json) => {
    expect(() => readManifest(json)).toThrow(DatasetLoadError);
  });

  it.each(['', '../secret', 'abc/def', 'ABCDEF', 'abc def', 'abc.json'])(
    'rejects the hash %j: it is a file name, so only hex digits can be in it',
    (hash) => {
      expect(() => readManifest({ ...manifest, hash })).toThrow(DatasetLoadError);
    },
  );
});
