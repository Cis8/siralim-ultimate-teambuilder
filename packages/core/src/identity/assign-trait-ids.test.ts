import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { TraitRow } from '../model/trait';
import { assignTraitIds } from './assign-trait-ids';

function row(overrides: Partial<TraitRow> = {}): TraitRow {
  return {
    class: 'Death',
    family: 'Abomination',
    creature: 'Abomination Brute',
    name: 'Flesh Rot',
    description: 'Does something.',
    material: 'Brute Stitches',
    ...overrides,
  };
}

const idsOf = (rows: readonly TraitRow[]) => assignTraitIds(rows).map((identified) => identified.id);

describe('assignTraitIds', () => {
  it('builds the id from the slugs of family and trait name', () => {
    const [identified] = assignTraitIds([row({ family: 'Abomination', name: 'Sin and Sentence' })]);
    expect(identified?.id).toBe('abomination--sin-and-sentence');
  });

  it('returns every row unchanged, in input order, with its id', () => {
    const rows = [row({ name: 'Zeta' }), row({ name: 'Alpha' }), row({ name: 'Mid' })];
    const expectedIds = ['abomination--zeta', 'abomination--alpha', 'abomination--mid'];
    expect(assignTraitIds(rows)).toEqual(rows.map((original, i) => ({ ...original, id: expectedIds[i] })));
  });

  it('returns nothing for no rows', () => {
    expect(assignTraitIds([])).toEqual([]);
  });

  it('does not mutate its input', () => {
    const rows = [row()];
    assignTraitIds(rows);
    expect(rows[0]).not.toHaveProperty('id');
  });

  it('separates family and name with a double hyphen that slugs never contain', () => {
    const [a, b] = idsOf([row({ family: 'Fire Ant', name: 'Bite' }), row({ family: 'Fire', name: 'Ant Bite' })]);
    expect(a).toBe('fire-ant--bite');
    expect(b).toBe('fire--ant-bite');
  });

  describe('when several rows would get the same id', () => {
    const death = row({ class: 'Death', description: 'Death text.' });
    const life = row({ class: 'Life', description: 'Life text.' });

    it('gives the first, by content, the plain slug and the others a numeric suffix', () => {
      expect(idsOf([death, life])).toEqual(['abomination--flesh-rot', 'abomination--flesh-rot-2']);
    });

    it('does not depend on the order of the rows', () => {
      expect(idsOf([life, death])).toEqual(['abomination--flesh-rot-2', 'abomination--flesh-rot']);
    });

    it('also separates different spellings that slugify to the same text', () => {
      const [withApostrophe, without] = idsOf([row({ name: "Mother's Love" }), row({ name: 'Mothers Love' })]);
      expect(new Set([withApostrophe, without]).size).toBe(2);
      expect(idsOf([row({ name: 'Mothers Love' }), row({ name: "Mother's Love" })])).toEqual([without, withApostrophe]);
    });

    it('never hands out a suffix that another trait already owns', () => {
      const natural = row({ name: 'Foo 2', description: 'natural' });
      const first = row({ name: 'Foo', description: 'a' });
      const second = row({ name: 'Foo', description: 'b' });
      expect(idsOf([first, second, natural])).toEqual(['abomination--foo', 'abomination--foo-3', 'abomination--foo-2']);
      expect(idsOf([natural, second, first])).toEqual(['abomination--foo-2', 'abomination--foo-3', 'abomination--foo']);
    });

    it('treats identical rows as interchangeable but still gives them distinct ids', () => {
      expect(idsOf([death, death, death]).toSorted()).toEqual([
        'abomination--flesh-rot',
        'abomination--flesh-rot-2',
        'abomination--flesh-rot-3',
      ]);
    });

    it('orders a missing material before a present one', () => {
      expect(idsOf([row({ material: 'Brute Stitches' }), row({ material: null })])).toEqual([
        'abomination--flesh-rot-2',
        'abomination--flesh-rot',
      ]);
    });
  });

  describe('invalid names', () => {
    it('fails loudly when the family leaves nothing to build an id from', () => {
      expect(() => assignTraitIds([row({ family: '???' })])).toThrow(/family/i);
    });

    it('fails loudly when the trait name leaves nothing to build an id from', () => {
      expect(() => assignTraitIds([row({ name: '!!!' })])).toThrow(/trait name.*!!!/i);
    });
  });

  describe('properties', () => {
    // Few distinct values per field so that collisions are the norm, not the exception.
    const rowArbitrary: fc.Arbitrary<TraitRow> = fc.record({
      class: fc.constantFrom('Death', 'Life'),
      family: fc.constantFrom('Dragon', "Dragon's", 'Dragons', 'Ant'),
      creature: fc.constantFrom('Whelp', 'Drake'),
      name: fc.constantFrom('Bite', 'Bite!', 'bite', 'Bite 2', 'Bite-2', 'Claw'),
      description: fc.constantFrom('x', 'y', 'z'),
      material: fc.constantFrom('Scale', 'Fang', null),
    });

    const rowsWithShuffle = fc
      .array(rowArbitrary, { maxLength: 25 })
      .chain((rows) =>
        fc
          .shuffledSubarray(rows, { minLength: rows.length, maxLength: rows.length })
          .map((shuffled) => ({ rows, shuffled })),
      );

    // Identical rows are interchangeable, so compare the ids each distinct row received as a multiset.
    function idsByContent(rows: readonly TraitRow[]): Map<string, string[]> {
      const byContent = new Map<string, string[]>();
      for (const { id, ...content } of assignTraitIds(rows)) {
        const key = JSON.stringify(content);
        byContent.set(key, [...(byContent.get(key) ?? []), id].toSorted());
      }
      return byContent;
    }

    it('gives every row a distinct, well-formed id', () => {
      fc.assert(
        fc.property(fc.array(rowArbitrary, { maxLength: 25 }), (rows) => {
          const ids = idsOf(rows);
          expect(new Set(ids).size).toBe(ids.length);
          for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+--[a-z0-9-]+$/);
        }),
      );
    });

    it('gives every row the same id however the rows are ordered', () => {
      fc.assert(
        fc.property(rowsWithShuffle, ({ rows, shuffled }) => {
          expect(idsByContent(shuffled)).toEqual(idsByContent(rows));
        }),
      );
    });
  });
});
