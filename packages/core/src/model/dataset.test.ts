import { describe, expect, it } from 'vitest';
import { datasetFileName } from './dataset';

describe('datasetFileName', () => {
  it('names the dataset file after its content hash, so a changed dataset is a new URL', () => {
    expect(datasetFileName('0123456789abcdef')).toBe('traits.0123456789abcdef.json');
  });
});
