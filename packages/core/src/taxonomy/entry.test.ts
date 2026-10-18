import { describe, expect, it } from 'vitest';
import { canHaveActor } from './entry';
import { taxonomy } from './taxonomy';

describe('canHaveActor', () => {
  it('is true for the events that somebody does or suffers', () => {
    for (const key of ['attack', 'death', 'start of turn', 'cast spell']) {
      const entry = taxonomy.get(key);
      expect(entry && canHaveActor(entry), key).toBe(true);
    }
  });

  it('is false for the start of the battle, which nobody makes', () => {
    const entry = taxonomy.get('start of battle');

    expect(entry && canHaveActor(entry)).toBe(false);
  });

  it('is false for every keyword that is no event: a buff, debuff, effect, mechanic or flag is done by no one', () => {
    for (const entry of taxonomy.entries.filter(({ kind }) => kind !== 'event')) {
      expect(canHaveActor(entry), entry.key).toBe(false);
    }
  });

  it('is true for every event but the moments of the battle', () => {
    for (const entry of taxonomy.ofKind('event')) expect(canHaveActor(entry), entry.key).toBe(entry.moment !== true);
  });
});
