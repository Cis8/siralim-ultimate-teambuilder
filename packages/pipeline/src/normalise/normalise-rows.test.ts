import { describe, expect, it } from 'vitest';
import type { RawTraitRow } from '../sheet/parse-traits-csv';
import { SheetFormatError } from '../sheet/sheet-format-error';
import { normaliseRows } from './normalise-rows';

function raw(overrides: Partial<RawTraitRow> = {}): RawTraitRow {
  return {
    class: 'Death',
    family: 'Abomination',
    creature: 'Abomination Brute',
    name: 'Flesh Rot',
    description: 'Afflicts a debuff.',
    material: 'Brute Stitches',
    ...overrides,
  };
}

function failureOf(rows: readonly RawTraitRow[]): Error {
  try {
    normaliseRows(rows);
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error('Expected normaliseRows to throw');
}

describe('normaliseRows', () => {
  it('returns the rows in order, unchanged when they are already clean', () => {
    const rows = [raw(), raw({ name: 'Quell', material: 'Volatile Gland' })];
    expect(normaliseRows(rows)).toEqual(rows);
  });

  it('returns nothing for no rows', () => {
    expect(normaliseRows([])).toEqual([]);
  });

  describe('cleaning', () => {
    it('trims, collapses spaces and straightens quotes in every field', () => {
      const [row] = normaliseRows([
        raw({
          class: ' Death ',
          family: ' Abomination',
          creature: 'Abomination  Brute',
          name: 'Flesh Rot ',
          description: 'It’s  “bad”.',
          material: ' Brute  Stitches ',
        }),
      ]);
      expect(row).toEqual({
        class: 'Death',
        family: 'Abomination',
        creature: 'Abomination Brute',
        name: 'Flesh Rot',
        description: 'It\'s "bad".',
        material: 'Brute Stitches',
      });
    });

    it('turns "No Material Exists" into no material, whatever its spacing or case', () => {
      const materials = ['No Material Exists', ' no  material exists ', 'NO MATERIAL EXISTS'].map(
        (material) => normaliseRows([raw({ material })])[0]?.material,
      );
      expect(materials).toEqual([null, null, null]);
    });

    it('keeps a material that merely looks like the marker', () => {
      expect(normaliseRows([raw({ material: 'Non-Existent Blade' })])[0]?.material).toBe('Non-Existent Blade');
    });

    it('leaves the Creature column alone: Mastery Trait and Backer Trait are read later', () => {
      expect(normaliseRows([raw({ creature: 'Mastery Trait' })])[0]?.creature).toBe('Mastery Trait');
    });
  });

  describe('validation', () => {
    it.each([
      ['class', 'Class'],
      ['family', 'Family'],
      ['creature', 'Creature'],
      ['name', 'Trait Name'],
      ['description', 'Trait Description'],
      ['material', 'Material Name'],
    ] as const)('rejects an empty %s', (field, column) => {
      const failure = failureOf([raw(), raw({ [field]: '' })]);
      expect(failure).toBeInstanceOf(SheetFormatError);
      expect(failure.message).toContain(`${column} is empty`);
      expect(failure.message).toContain('trait row 2');
    });

    it('counts a cell with only blanks as empty', () => {
      expect(failureOf([raw({ name: '  \t' })]).message).toContain('Trait Name is empty');
    });

    it('says which trait the row is', () => {
      const message = failureOf([raw({ description: '' })]).message;
      expect(message).toContain('Abomination / Flesh Rot');
    });

    it('reports every problem at once, row by row', () => {
      const message = failureOf([raw({ name: '' }), raw(), raw({ description: '', material: '' })]).message;
      expect(message).toContain('trait row 1');
      expect(message).not.toContain('trait row 2');
      expect(message).toContain('trait row 3');
      expect(message).toContain('Trait Description is empty');
      expect(message).toContain('Material Name is empty');
    });

    it('lists the first twenty problems and counts the rest', () => {
      const message = failureOf(Array.from({ length: 25 }, () => raw({ name: '' }))).message;
      expect(message).toContain('trait row 20');
      expect(message).not.toContain('trait row 21');
      expect(message).toMatch(/and 5 more/);
    });
  });
});
