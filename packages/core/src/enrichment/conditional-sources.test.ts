import { describe, expect, it } from 'vitest';
import { extractKeywords } from '../extraction/extract-keywords';
import { detectConditionalSources } from './conditional-sources';

const sourcesOf = (description: string) => detectConditionalSources(description, extractKeywords(description));

// Texts are quoted from compendium v2.0.
describe('detectConditionalSources (GAME_RULES R10)', () => {
  it.each([
    [
      'Flesh Rot',
      "After an enemy is afflicted with either Weak or Vulnerable, this creature afflicts them with whichever of these debuffs the target doesn't already have.",
      ['weak', 'vulnerable'],
    ],
    [
      'Here to Die',
      "After an enemy is afflicted with either Bleeding or Poisoned, this creature afflicts them with whichever of these debuffs the target doesn't already have.",
      ['bleeding', 'poisoned'],
    ],
    [
      'Scared Stiff',
      "After an enemy is afflicted with Snared or Feared, this creature afflicts them with whichever of these debuffs the target doesn't already have.",
      ['snared', 'feared'],
    ],
    [
      'Kindling',
      "After an enemy is afflicted with Bleeding or Burning, this creature afflicts them with whichever of these debuffs the target doesn't already have.",
      ['bleeding', 'burning'],
    ],
  ])('finds the pair of %s', (_name, description, keys) => {
    expect(sourcesOf(description)).toEqual(keys);
  });

  it('also reads buffs', () => {
    expect(
      sourcesOf(
        'After an enemy gains Shelled or Barrier, this creature gives them whichever of these buffs they do not have.',
      ),
    ).toEqual(['shelled', 'barrier']);
  });

  it('only takes the statuses of the sentence that says it', () => {
    const description =
      'This creature always has Berserk. After an enemy is afflicted with Weak or Vulnerable, it afflicts them with whichever of these debuffs the target does not already have. Enemies with Snared take more damage.';
    expect(sourcesOf(description)).toEqual(['weak', 'vulnerable']);
  });

  it('counts each status once', () => {
    const description =
      'After an enemy is afflicted with Weak or Weak, it afflicts them with whichever of these debuffs the target does not have.';
    expect(sourcesOf(description)).toEqual(['weak']);
  });

  it.each([
    ['an ordinary application', 'After this creature attacks, it afflicts the target with Weak or Vulnerable.'],
    ['whichever about something else', 'Their Attack and Intelligence are set equal to whichever is highest.'],
    ['no text', ''],
  ])('finds nothing in %s', (_label, description) => {
    expect(sourcesOf(description)).toEqual([]);
  });

  it('finds nothing when there are no keywords to name', () => {
    expect(detectConditionalSources('It afflicts them with whichever of these debuffs they lack.', [])).toEqual([]);
  });
});
