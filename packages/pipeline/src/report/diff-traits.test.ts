import { describe, expect, it } from 'vitest';
import { diffTraits, type TraitRecord } from './diff-traits';

const record = (id: string, fields: Record<string, unknown> = {}): TraitRecord => ({
  id,
  name: id,
  description: 'Text.',
  material: 'Stitches',
  keywords: [],
  ...fields,
});

describe('diffTraits', () => {
  it('finds nothing between identical builds', () => {
    const traits = [record('a'), record('b')];
    expect(
      diffTraits(
        traits,
        traits.map((t) => ({ ...t })),
      ),
    ).toEqual({ added: [], removed: [], changed: [] });
  });

  it('lists the ids that appeared and the ones that went, sorted', () => {
    const diff = diffTraits(
      [record('keep'), record('z-gone'), record('a-gone')],
      [record('keep'), record('y-new'), record('b-new')],
    );
    expect(diff.added).toEqual(['b-new', 'y-new']);
    expect(diff.removed).toEqual(['a-gone', 'z-gone']);
  });

  it('lists the fields that differ in a trait present in both, sorted', () => {
    const diff = diffTraits(
      [record('x', { description: 'Old.', material: 'Stitches' })],
      [record('x', { description: 'New.', material: null })],
    );
    expect(diff.changed).toEqual([{ id: 'x', fields: ['description', 'material'] }]);
  });

  it('compares nested values by content', () => {
    const before = record('x', { keywords: [{ key: 'weak', span: [0, 4] }], randomDebuff: { target: 'enemy' } });
    const same = record('x', { keywords: [{ key: 'weak', span: [0, 4] }], randomDebuff: { target: 'enemy' } });
    const moved = record('x', { keywords: [{ key: 'weak', span: [1, 5] }], randomDebuff: { target: 'enemy' } });
    expect(diffTraits([before], [same]).changed).toEqual([]);
    expect(diffTraits([before], [moved]).changed).toEqual([{ id: 'x', fields: ['keywords'] }]);
  });

  it('counts a field that exists on one side only as changed', () => {
    const diff = diffTraits([record('x')], [record('x', { extra: 1 })]);
    expect(diff.changed).toEqual([{ id: 'x', fields: ['extra'] }]);
  });

  it('lists changed traits sorted by id', () => {
    const diff = diffTraits([record('b'), record('a')], [record('b', { name: 'B' }), record('a', { name: 'A' })]);
    expect(diff.changed.map((change) => change.id)).toEqual(['a', 'b']);
  });
});
