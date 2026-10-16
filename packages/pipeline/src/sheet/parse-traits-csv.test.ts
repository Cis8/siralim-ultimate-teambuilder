import { describe, expect, it } from 'vitest';
import { parseTraitsCsv } from './parse-traits-csv';
import { SheetFormatError } from './sheet-format-error';

const HEADER = '"Class","Family","Creature","Trait Name","Trait Description","Material Name"';
const FLESH_ROT = '"Death","Abomination","Abomination Brute","Flesh Rot","Afflicts a debuff.","Brute Stitches"';
const QUELL = '"Death","Abomination","Abomination Volatile","Quell","Deals damage.","Volatile Gland"';

const lines = (...rows: string[]) => rows.join('\n');

describe('parseTraitsCsv', () => {
  describe('the sheet as published', () => {
    // Shape of the real export: one preamble record with a multi-line cell, then the header, then the rows.
    const csv = lines(
      '"Siralim Ultimate","","Version 2.0","","Please send any corrections to me.\n2.0 Creatures and Spells have been added.",""',
      HEADER,
      FLESH_ROT,
      QUELL,
    );

    it('reads the dataset version from the preamble', () => {
      expect(parseTraitsCsv(csv).datasetVersion).toBe('2.0');
    });

    it('returns one row per trait, with the columns named', () => {
      expect(parseTraitsCsv(csv).rows).toEqual([
        {
          class: 'Death',
          family: 'Abomination',
          creature: 'Abomination Brute',
          name: 'Flesh Rot',
          description: 'Afflicts a debuff.',
          material: 'Brute Stitches',
        },
        {
          class: 'Death',
          family: 'Abomination',
          creature: 'Abomination Volatile',
          name: 'Quell',
          description: 'Deals damage.',
          material: 'Volatile Gland',
        },
      ]);
    });
  });

  describe('dataset version', () => {
    const withPreamble = (preamble: string) => lines(preamble, HEADER, FLESH_ROT);

    it.each([
      ['in the third cell', '"Siralim Ultimate","","Version 2.0"', '2.0'],
      ['in the first cell', '"Version 2.1","Siralim Ultimate"', '2.1'],
      ['lower case', '"siralim ultimate","version 3.0"', '3.0'],
      ['with a colon', '"Version: 2.0"', '2.0'],
      ['with a leading v', '"Version v2.0"', '2.0'],
      ['with more than two parts', '"Version 2.0.1"', '2.0.1'],
      ['without a minor part', '"Version 3"', '3'],
      ['inside a longer cell', '"Siralim Ultimate Compendium - Version 2.10 (October)"', '2.10'],
    ])('is found %s', (_label, preamble, expected) => {
      expect(parseTraitsCsv(withPreamble(preamble)).datasetVersion).toBe(expected);
    });

    it('takes the first version mentioned', () => {
      const preamble = '"Version 2.0","Previously Version 1.9"';
      expect(parseTraitsCsv(withPreamble(preamble)).datasetVersion).toBe('2.0');
    });

    it('is only looked for above the header', () => {
      const csv = lines('"Siralim Ultimate"', HEADER, '"Death","A","B","Version 9.9","Version 9.9",""');
      expect(() => parseTraitsCsv(csv)).toThrow(SheetFormatError);
    });

    it('fails when the preamble gives no version', () => {
      expect(() => parseTraitsCsv(withPreamble('"Siralim Ultimate","","","","Notes",""'))).toThrow(/version/i);
    });

    it('fails when there is no preamble at all', () => {
      expect(() => parseTraitsCsv(lines(HEADER, FLESH_ROT))).toThrow(/version/i);
    });
  });

  describe('locating the header', () => {
    it('finds it however far down the sheet it is', () => {
      const csv = lines(
        '"Siralim Ultimate","","Version 2.0"',
        '"Added in this version: lots"',
        '',
        '"","","","","",""',
        HEADER,
        FLESH_ROT,
      );
      expect(parseTraitsCsv(csv).rows.map((row) => row.name)).toEqual(['Flesh Rot']);
    });

    it('ignores the case and the padding of the column names', () => {
      const csv = lines(
        '"Version 2.0"',
        '" class ","FAMILY","creature","Trait name","Trait Description","material name"',
        FLESH_ROT,
      );
      expect(parseTraitsCsv(csv).rows).toHaveLength(1);
    });

    it('follows the columns, not their position: reordered and extra columns are fine', () => {
      const csv = lines(
        '"Version 2.0"',
        '"Notes","Trait Name","Material Name","Class","Trait Description","Family","Creature"',
        '"ignore me","Flesh Rot","Brute Stitches","Death","Afflicts a debuff.","Abomination","Abomination Brute"',
      );
      expect(parseTraitsCsv(csv).rows).toEqual([
        {
          class: 'Death',
          family: 'Abomination',
          creature: 'Abomination Brute',
          name: 'Flesh Rot',
          description: 'Afflicts a debuff.',
          material: 'Brute Stitches',
        },
      ]);
    });

    it('names the missing column', () => {
      const csv = lines(
        '"Version 2.0"',
        '"Class","Family","Creature","Trait Name","Trait Description"',
        '"Death","Abomination","Abomination Brute","Flesh Rot","Afflicts a debuff."',
      );
      const failure = catchError(() => parseTraitsCsv(csv));
      expect(failure).toBeInstanceOf(SheetFormatError);
      expect(failure.message).toMatch(/Material Name/);
      expect(failure.message).toMatch(/row 2/);
    });

    it('names every missing column', () => {
      const csv = lines('"Version 2.0"', '"Class","Family","Creature","Trait Name"');
      expect(catchError(() => parseTraitsCsv(csv)).message).toMatch(
        /Trait Description.*Material Name|Material Name.*Trait Description/,
      );
    });

    it('fails when no row looks like the header', () => {
      const csv = lines('"Version 2.0"', '"Foo","Bar"', '"1","2"');
      expect(() => parseTraitsCsv(csv)).toThrow(/header/i);
    });

    it('fails on an empty file', () => {
      expect(() => parseTraitsCsv('')).toThrow(SheetFormatError);
    });
  });

  describe('reading the rows', () => {
    const parse = (...rows: string[]) => parseTraitsCsv(lines('"Version 2.0"', HEADER, ...rows)).rows;

    it('keeps commas, doubled quotes and line breaks inside quoted cells', () => {
      const [only] = parse('"Life","Dryad","Dryad Sprout","Heal, a lot","Says ""hi"".\nThen leaves.","Leaf"');
      expect(only?.name).toBe('Heal, a lot');
      expect(only?.description).toBe('Says "hi".\nThen leaves.');
    });

    it('keeps the text of every cell exactly as written: cleaning is the next stage', () => {
      const [only] = parse('"Life"," Dryad","Dryad  Sprout","Heal ","It’s  fine.","No Material Exists"');
      expect(only).toEqual({
        class: 'Life',
        family: ' Dryad',
        creature: 'Dryad  Sprout',
        name: 'Heal ',
        description: 'It’s  fine.',
        material: 'No Material Exists',
      });
    });

    it('skips rows with nothing in them', () => {
      expect(parse(FLESH_ROT, '', '"","","","","",""', ' ,,,,, ', QUELL)).toHaveLength(2);
    });

    it('reads empty cells as empty strings, including in short rows', () => {
      const [only] = parse('"Death","Abomination","Abomination Brute","Flesh Rot"');
      expect(only?.description).toBe('');
      expect(only?.material).toBe('');
    });

    it('accepts Windows line endings and a byte order mark', () => {
      const byteOrderMark = String.fromCodePoint(0xfeff);
      const body = lines('"Version 2.0"', HEADER, FLESH_ROT, QUELL).replaceAll('\n', '\r\n');
      const csv = `${byteOrderMark}${body}\r\n`;
      expect(parseTraitsCsv(csv).rows.map((row) => row.name)).toEqual(['Flesh Rot', 'Quell']);
    });

    it('returns no rows for a sheet with only a header', () => {
      expect(parse()).toEqual([]);
    });

    it('fails with a sheet error, not a parser error, on malformed CSV', () => {
      const failure = catchError(() => parse('"Death","Abomination","Brute","Flesh Rot","unterminated'));
      expect(failure).toBeInstanceOf(SheetFormatError);
      expect(failure.message).toMatch(/csv/i);
    });
  });
});

function catchError(action: () => unknown): Error {
  try {
    action();
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error('Expected the action to throw');
}
