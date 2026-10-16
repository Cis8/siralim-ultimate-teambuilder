import { DATASET_SCHEMA_VERSION } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { emittedSchemaVersion } from './index';

describe('@atlas/pipeline', () => {
  it('emits the schema version defined by core', () => {
    expect(emittedSchemaVersion).toBe(DATASET_SCHEMA_VERSION);
  });
});
