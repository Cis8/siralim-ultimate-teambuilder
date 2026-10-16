import { describe, expect, it } from 'vitest';
import { doesStack } from './does-stack';

describe('doesStack (GAME_RULES R4)', () => {
  it('is false when the text says the trait does not stack', () => {
    expect(doesStack('Your Bats have a 50% chance to attack 1 additional time. This trait does not stack.')).toBe(
      false,
    );
  });

  it('ignores capitalisation', () => {
    expect(doesStack('THIS TRAIT DOES NOT STACK.')).toBe(false);
  });

  it('is true when the text does not say it', () => {
    expect(doesStack("Your Dryads' buffs and minions last forever.")).toBe(true);
  });

  it('is true when the text only talks about stacking', () => {
    expect(doesStack("This creature's buffs stack up to 3 times.")).toBe(true);
  });

  it('is true for an empty text', () => {
    expect(doesStack('')).toBe(true);
  });
});
