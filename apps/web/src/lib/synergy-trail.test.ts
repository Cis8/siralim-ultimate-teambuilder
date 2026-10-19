import { describe, expect, it } from 'vitest';
import { extendTrail, TRAIL_LENGTH } from './synergy-trail';

describe('extendTrail', () => {
  it('adds the trait the person centres on at the end', () => {
    expect(extendTrail(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });

  it('starts from nothing: a deep link has a trail of the one trait it opens', () => {
    expect(extendTrail([], 'a')).toEqual(['a']);
  });

  it('cuts the trail back to a trait that is on it already: the way on from there is a new one', () => {
    expect(extendTrail(['a', 'b', 'c', 'd'], 'b')).toEqual(['a', 'b']);
  });

  it('leaves the trail as it is when the trait is the last of it, as a change of the party on the page does', () => {
    expect(extendTrail(['a', 'b'], 'b')).toEqual(['a', 'b']);
  });

  it('keeps the last few traits only, the oldest going first', () => {
    const trail = ['t1', 't2', 't3', 't4', 't5', 't6'];

    expect(trail).toHaveLength(TRAIL_LENGTH);
    expect(extendTrail(trail, 't7')).toEqual(['t2', 't3', 't4', 't5', 't6', 't7']);
  });

  it('can be cut back to the oldest trait of a full trail', () => {
    expect(extendTrail(['t1', 't2', 't3', 't4', 't5', 't6'], 't1')).toEqual(['t1']);
  });

  it('does not change the trail it is given', () => {
    const trail = ['a', 'b', 'c'];

    extendTrail(trail, 'a');
    extendTrail(trail, 'd');

    expect(trail).toEqual(['a', 'b', 'c']);
  });
});
