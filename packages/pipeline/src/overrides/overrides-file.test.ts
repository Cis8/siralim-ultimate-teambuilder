import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseOverrides } from './parse-overrides';

const OVERRIDES_FILE = new URL('../../overrides.yaml', import.meta.url);

describe('overrides.yaml', () => {
  it('is valid', () => {
    expect(() => parseOverrides(readFileSync(OVERRIDES_FILE, 'utf8'))).not.toThrow();
  });

  it('documents the format it accepts: its examples, uncommented, are valid', () => {
    const example = readFileSync(OVERRIDES_FILE, 'utf8')
      .split('\n')
      .filter((line) => line.startsWith('#   ') || line.startsWith('# roles:') || line.startsWith('# randomDebuff:'))
      .map((line) => line.replace(/^# ?/, ''))
      .map((line) => line.replace(/^(roles|randomDebuff):.*/, '$1:'))
      .join('\n');
    const parsed = parseOverrides(example);
    expect(parsed.roles).toHaveLength(1);
    expect(parsed.randomDebuff).toHaveLength(1);
  });
});
