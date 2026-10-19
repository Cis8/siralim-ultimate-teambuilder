import { describe, expect, it } from 'vitest';
import type { Trait } from '../model/trait';
import { eligibleTraits } from './relation-options';

const traitWith = (material: string | null) => ({ material }) as Trait;

describe('eligibleTraits', () => {
  it('accepts every trait by default and when the artifact filter is off', () => {
    for (const options of [{}, { artifactOnly: false }]) {
      expect(eligibleTraits(options)(traitWith(null))).toBe(true);
      expect(eligibleTraits(options)(traitWith('Ferrous Ore'))).toBe(true);
    }
  });

  it('accepts only the traits that have material when the artifact filter is on', () => {
    const eligible = eligibleTraits({ artifactOnly: true });

    expect(eligible(traitWith('Ferrous Ore'))).toBe(true);
    expect(eligible(traitWith(null))).toBe(false);
  });
});
