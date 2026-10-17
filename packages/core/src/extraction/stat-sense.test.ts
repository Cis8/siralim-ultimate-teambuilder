import { describe, expect, it } from 'vitest';
import { isStatSense } from './stat-sense';

/** Whether the first `[word]` in the text, marked by the brackets, is read as a stat. */
function readsAsStat(marked: string): boolean {
  const start = marked.indexOf('[');
  const end = marked.indexOf(']');
  const text = marked.slice(0, start) + marked.slice(start + 1, end) + marked.slice(end + 1);
  return isStatSense(text, start, end - 1);
}

// The contexts are quoted from compendium v2.0 (the matcher gives straight apostrophes).
describe('isStatSense', () => {
  it.each([
    'it has 200% more [attack] and 100% more speed',
    'This creature has 15% more [attack] and intelligence.',
    'Enemies attack as if they have 40% less [attack]',
    "it reduces the enemies' [attack] by 15% of this creature's attack",
    "At the start of battle, this creature's [attack] is added to its health",
    "40% of this creature's [attack] is added to that of your others",
    'it gains [Attack] equal to 50% of the potency',
    'they gain [Attack] equal to 20% of the damage',
    "equal to 7% of the ally's [attack]",
    'it gains 12% [Attack] and speed',
    'it has 25% less [attack]',
    'their highest of [attack], defense and speed',
    'based on their lowest stat rather than [attack].',
    'creatures gain a stat other than [attack], they gain 50% of that stat as [attack] as well',
    "equal to 25% of this creature's [Attack]. This trait does not stack.",
    "damage is based on this creature's [Attack].",
    "the total [attack] bonus on this creature's Artifact",
    'the [Attack] increases granted by its Artifact',
    'it gains 10% [attack], intelligence and defense',
    "hasn't gained or lost [attack], it has 200% more attack",
    'twice the [attack] stat',
  ])('reads the stat in: %s', (marked) => {
    expect(readsAsStat(marked)).toBe(true);
  });

  it.each([
    'After your creatures dodge an [attack], they counter-attack',
    'After this creature dodges an [attack], it casts one of its spells.',
    'When your creatures [attack], they deal 20% more damage',
    'Your creatures [attack] 1 additional time',
    'it has a 75% chance to [attack] again',
    'it cannot manually [attack], cast, defend, or provoke',
    'takes damage from an [attack] or spell, it gains 5% stats',
    'This [attack] deals 50% more damage',
    'Each [attack] deals 200% normal damage.',
    "damage equal to 35% of the [attack]'s damage",
    'a 50% chance to stop after each [attack].',
    '200% of the damage dealt by the [attack].',
    "This creature's first [attack] each battle deals 300% more damage",
    "the enemies' first [attack] per turn",
    'Enemies can only [attack] once at a time.',
    '[Attack] a random enemy',
  ])('reads the action in: %s', (marked) => {
    expect(readsAsStat(marked)).toBe(false);
  });
});
