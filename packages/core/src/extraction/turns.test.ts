import { describe, expect, it } from 'vitest';
import { findTurns } from './turns';

/** `edge: text → actor` for every turn found, as a test reads them. */
function turnsIn(text: string): string[] {
  return findTurns(text).map(
    ({ edge, span, actor }) => `${edge}: ${text.slice(span[0], span[1])} → ${actor ?? 'nobody'}`,
  );
}

// The forms are quoted from compendium v2.0.
describe('findTurns', () => {
  it.each([
    ["At the start of this creature's turn, it casts Fireball.", "start: start of this creature's turn → self"],
    ['At the end of its turn, it gains a Barrier.', 'end: end of its turn → self'],
    ["At the end of each enemy's turn, this creature deals damage.", "end: end of each enemy's turn → enemy"],
    ["At the start of each creature's turn, it recovers health.", "start: start of each creature's turn → any"],
    ["At the end of each creature's turn, this creature stops defending.", "end: end of each creature's turn → any"],
    ["At the start of your creatures' turns, they gain a Barrier.", "start: start of your creatures' turns → ally"],
    [
      "At the start of each of your creature's turns, all of your creatures heal.",
      "start: start of each of your creature's turns → ally",
    ],
    ["At the start of your creature' turns, their health is set to 1.", "start: start of your creature' turns → ally"],
    [
      "At the end of your other creatures' turns, this creature has a 10% chance.",
      "end: end of your other creatures' turns → ally",
    ],
    ["At the start of each creatures' turn, it activates.", "start: start of each creatures' turn → any"],
    ["At the start of an enemy's turn, it is Weak.", "start: start of an enemy's turn → enemy"],
  ])('reads %s', (text, expected) => {
    expect(turnsIn(text)).toEqual([expected]);
  });

  // The possessive can be a family or a status, so no list of phrases covers it.
  it.each([
    ["At the start of your Phoenixes' turns, they heal.", "start: start of your Phoenixes' turns → ally"],
    ["At the end of your Valkyries' turns, they attack.", "end: end of your Valkyries' turns → ally"],
    ["At the start of your Uralos creatures' turns, they heal.", "start: start of your Uralos creatures' turns → ally"],
    [
      "At the start of your Godspawn creatures' third turns, they transform.",
      "start: start of your Godspawn creatures' third turns → ally",
    ],
    ["At the start of each Cursed enemy's turn, it takes damage.", "start: start of each Cursed enemy's turn → enemy"],
  ])('reads a turn whose owner is a family or a status: %s', (text, expected) => {
    expect(turnsIn(text)).toEqual([expected]);
  });

  it.each([
    ['It takes 90% less damage until the start of its first turn.', 'start: start of its first turn → self'],
    [
      "At the start of this creature's second turn, it recovers 100% health.",
      "start: start of this creature's second turn → self",
    ],
    ['It takes 75% less damage until the start of their first turn.', 'start: start of their first turn → nobody'],
    ['Enemies take damage at the end of their turns.', 'end: end of their turns → nobody'],
    ['At the start of each turn, enemies are Weak.', 'start: start of each turn → any'],
    ['The effect ends at the end of every turn.', 'end: end of every turn → any'],
  ])('reads an ordinal, a possessive that names nobody, and "each turn": %s', (text, expected) => {
    expect(turnsIn(text)).toEqual([expected]);
  });

  it.each([
    ['It defends and then its turn ends.', 'end: its turn ends → self'],
    ["Then this creature's turn ends.", "end: this creature's turn ends → self"],
    ["When your creatures' turns end, they rest.", "end: your creatures' turns end → ally"],
  ])('reads "turn ends": %s', (text, expected) => {
    expect(turnsIn(text)).toEqual([expected]);
  });

  it('reads "start of turn" with no owner at all', () => {
    expect(turnsIn('Triggers at the start of turn.')).toEqual(['start: start of turn → nobody']);
  });

  it('is not case sensitive', () => {
    expect(turnsIn("START OF THIS CREATURE'S TURN")).toEqual(["start: START OF THIS CREATURE'S TURN → self"]);
  });

  it('reads "the start and end of their turn" as the two edges, each with the words that name it', () => {
    const text = 'Enemies take damage at the start and end of their turn.';
    expect(turnsIn(text)).toEqual(['start: start and → nobody', 'end: end of their turn → nobody']);
  });

  it('reads both edges when the end is named first', () => {
    expect(turnsIn("The end and start of this creature's turn")).toEqual([
      'end: end and → self',
      "start: start of this creature's turn → self",
    ]);
  });

  it('finds every turn of a text, in order', () => {
    const text = "At the start of this creature's turn, it defends. At the end of its turn, it attacks.";
    expect(turnsIn(text)).toEqual(["start: start of this creature's turn → self", 'end: end of its turn → self']);
  });

  it.each([
    'At the start of battle, this creature gains a Barrier.',
    'Creatures start battles with 3 charges.',
    'This creature can take an additional turn.',
    'This effect can only activate once per turn.',
    "This creature's turn counter starts at 3.",
    'At the end of the battle, all creatures are healed.',
    'This creature has a 50% chance to lose its turn.',
    'Between each of its turns, this creature takes damage.',
    'At the start of the first round, this creature heals.',
  ])('finds no edge of a turn in: %s', (text) => {
    expect(findTurns(text)).toEqual([]);
  });

  it('gives spans that cut the words out of the original text', () => {
    const text = "Then at the end of your creatures' turns, they rest.";
    const [turn] = findTurns(text);
    expect(turn && text.slice(turn.span[0], turn.span[1])).toBe("end of your creatures' turns");
  });
});
