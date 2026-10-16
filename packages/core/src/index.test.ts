import { describe, expect, it } from 'vitest';
import { DATASET_SCHEMA_VERSION } from './index';

describe('@atlas/core public API', () => {
  it('exposes a positive integer dataset schema version', () => {
    expect(Number.isInteger(DATASET_SCHEMA_VERSION)).toBe(true);
    expect(DATASET_SCHEMA_VERSION).toBeGreaterThan(0);
  });
});
