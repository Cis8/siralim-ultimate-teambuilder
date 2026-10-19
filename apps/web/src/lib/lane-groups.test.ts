import type { RelatedTrait, SourceStrength, Trait } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { FOLD_ABOVE, groupLane } from './lane-groups';

const entry = (id: string, strength: SourceStrength): RelatedTrait => ({
  trait: { id, name: id } as Trait,
  links: [],
  score: 1,
  strength,
});

const ids = (entries: readonly RelatedTrait[]) => entries.map(({ trait }) => trait.id);

describe('groupLane', () => {
  it('keeps the traits that give the key by name or conditionally together, and sets the random sources apart', () => {
    const lane = groupLane([
      entry('a', 'specific'),
      entry('b', 'conditional'),
      entry('c', 'random'),
      entry('d', 'random'),
    ]);

    expect(ids(lane.certain)).toEqual(['a', 'b']);
    expect(ids(lane.random)).toEqual(['c', 'd']);
  });

  it('keeps the order of the lane inside each group: it was ranked already', () => {
    const lane = groupLane([
      entry('z', 'random'),
      entry('y', 'specific'),
      entry('x', 'random'),
      entry('w', 'conditional'),
    ]);

    expect(ids(lane.certain)).toEqual(['y', 'w']);
    expect(ids(lane.random)).toEqual(['z', 'x']);
  });

  it('has no random group for a lane with no random source, and nothing to fold', () => {
    const lane = groupLane([entry('a', 'specific')]);

    expect(lane.random).toEqual([]);
    expect(lane.folded).toBe(false);
  });

  it('is empty for an empty lane', () => {
    expect(groupLane([])).toEqual({ certain: [], random: [], folded: false });
  });

  it('leaves a few random sources open and folds more than that away', () => {
    const randoms = (count: number) => Array.from({ length: count }, (_, at) => entry(`r${String(at)}`, 'random'));

    expect(groupLane(randoms(FOLD_ABOVE)).folded).toBe(false);
    expect(groupLane(randoms(FOLD_ABOVE + 1)).folded).toBe(true);
  });

  it('folds by the count of random sources alone: the traits that are certain do not count', () => {
    const certain = Array.from({ length: 10 }, (_, at) => entry(`c${String(at)}`, 'specific'));

    expect(groupLane([...certain, entry('r', 'random')]).folded).toBe(false);
  });
});
