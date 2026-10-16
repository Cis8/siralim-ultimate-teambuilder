import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { queryChips, removeChip, toggleChipNot, type QueryChip } from './chips';
import { MAX_NESTING, parseQuery } from './parser';

/** A chip as a query would write it: `-class:life`. */
const written = ({ field, negated, value }: QueryChip): string =>
  `${negated ? '-' : ''}${field === undefined ? '' : `${field}:`}${value}`;

const chipsOf = (source: string): string[] => queryChips(source).map(written);

describe('queryChips', () => {
  it('has none for a query with no term', () => {
    expect(queryChips('')).toEqual([]);
    expect(queryChips('   ')).toEqual([]);
    expect(queryChips('AND ( ) OR')).toEqual([]);
  });

  it('is one chip per term, in the order of the text', () => {
    expect(chipsOf('weak class:life "two words" applies:snared')).toEqual([
      'weak',
      'class:life',
      'two words',
      'applies:snared',
    ]);
  });

  it('keeps the field as written, the value without its quotes, and a value that is not there yet', () => {
    expect(queryChips('Class:Life kw:"start of battle" applies:')).toEqual([
      { field: 'Class', value: 'Life', negated: false },
      { field: 'kw', value: 'start of battle', negated: false },
      { field: 'applies', value: '', negated: false },
    ]);
  });

  it('finds the terms inside groups, whatever the operators', () => {
    expect(chipsOf('(a OR b) AND (c d)')).toEqual(['a', 'b', 'c', 'd']);
  });

  describe('negated: a trait found has not got the term', () => {
    it.each([
      ['-weak', ['-weak']],
      ['NOT weak', ['-weak']],
      ['not  weak', ['-weak']],
      ['- weak', ['-weak']],
      ['--weak', ['weak']],
      ['NOT -weak', ['weak']],
      ['---weak', ['-weak']],
      ['-(weak)', ['-weak']],
      ['-(weak OR snared)', ['-weak', '-snared']],
      ['-(weak -snared)', ['-weak', 'snared']],
      ['-(a OR -(b c))', ['-a', 'b', 'c']],
      ['a -b c', ['a', '-b', 'c']],
    ])('reads %j as %j', (source, expected) => {
      expect(chipsOf(source)).toEqual(expected);
    });
  });

  it('reads a query that needed repairs as the query it was read as', () => {
    expect(chipsOf('(a OR b')).toEqual(['a', 'b']);
    expect(chipsOf('a ) OR -')).toEqual(['a']);
    expect(chipsOf('"two words')).toEqual(['two words']);
  });
});

describe('toggleChipNot', () => {
  describe('excludes a term that is included, and includes one that is excluded', () => {
    it.each([
      ['weak', 0, '-weak'],
      ['-weak', 0, 'weak'],
      ['NOT weak', 0, 'weak'],
      ['not  weak', 0, 'weak'],
      ['- weak', 0, 'weak'],
      ['class:life', 0, '-class:life'],
      ['Class:Life', 0, '-Class:Life'],
      ['"two words"', 0, '-"two words"'],
      ['class:"rodian master"', 0, '-class:"rodian master"'],
      ['applies:', 0, '-applies:'],
    ])('%j, chip %i: %j', (source, index, expected) => {
      expect(toggleChipNot(source, index)).toBe(expected);
    });
  });

  describe('touches only the chip it is asked for', () => {
    it.each([
      ['a b c', 1, 'a -b c'],
      ['a -b c', 1, 'a b c'],
      ['a NOT b c', 1, 'a b c'],
      ['a OR b', 1, 'a OR -b'],
      ['class:life weak', 1, 'class:life -weak'],
      ['class:life weak', 0, '-class:life weak'],
      ['applies: weak', 1, 'applies: -weak'],
    ])('%j, chip %i: %j', (source, index, expected) => {
      expect(toggleChipNot(source, index)).toBe(expected);
    });
  });

  describe('flips the term, not the group around it', () => {
    it.each([
      ['(a OR b)', 1, '(a OR -b)'],
      ['(a)', 0, '(-a)'],
      ['(-a)', 0, '(a)'],
      ['-(a)', 0, '(a)'],
      ['x -(a)', 1, 'x (a)'],
      ['-(a OR b)', 0, '-(-a OR b)'],
      ['-(a OR b)', 1, '-(a OR -b)'],
      ['-(-a OR b)', 0, '-(a OR b)'],
      ['--a', 0, '-a'],
      ['-(-a)', 0, '-(a)'],
      ['NOT (NOT a)', 0, 'NOT (a)'],
    ])('%j, chip %i: %j', (source, index, expected) => {
      expect(toggleChipNot(source, index)).toBe(expected);
    });
  });

  it('twice reads as the query it started from', () => {
    for (const source of ['weak', '-weak', 'a NOT b', '-(a OR b) c', '(a)', '-(a)', '--a']) {
      for (const [index] of queryChips(source).entries()) {
        expect(chipsOf(toggleChipNot(toggleChipNot(source, index), index)), `${source} ${index}`).toEqual(
          chipsOf(source),
        );
      }
    }
  });

  it('leaves the rest of the text as typed', () => {
    expect(toggleChipNot('  Class:Life   AND  weak | "x"  ', 1)).toBe('  Class:Life   AND  -weak | "x"  ');
    expect(toggleChipNot('  Class:Life   AND  -weak | "x"  ', 1)).toBe('  Class:Life   AND  weak | "x"  ');
  });

  it('keeps the text apart where the NOT was the only thing between two tokens', () => {
    expect(toggleChipNot('NOT(a)', 0)).toBe('(a)');
    expect(toggleChipNot('"a"-b', 1)).toBe('"a"b');
    expect(toggleChipNot('(a)-b', 1)).toBe('(a)b');
  });

  it('keeps a new NOT from running into the word in front of it', () => {
    // A phrase can start right after a word, and `life-"and"` would be one word.
    expect(chipsOf('class:life"and"')).toEqual(['class:life', 'and']);
    expect(toggleChipNot('class:life"and"', 1)).toBe('class:life -"and"');
    expect(toggleChipNot('(a)"b"', 1)).toBe('(a)-"b"');
    expect(toggleChipNot('"a""b"', 1)).toBe('"a" -"b"');
  });

  it('does nothing for a chip the query does not have', () => {
    expect(toggleChipNot('weak', 1)).toBe('weak');
    expect(toggleChipNot('weak', -1)).toBe('weak');
    expect(toggleChipNot('', 0)).toBe('');
    expect(toggleChipNot('a OR', 5)).toBe('a OR');
  });

  it('does nothing where the NOT would be nested too deeply to be read', () => {
    const deepest = `${'('.repeat(MAX_NESTING)}a${')'.repeat(MAX_NESTING)}`;
    expect(toggleChipNot(deepest, 0)).toBe(deepest);
    const almost = `${'('.repeat(MAX_NESTING - 1)}a${')'.repeat(MAX_NESTING - 1)}`;
    expect(chipsOf(toggleChipNot(almost, 0))).toEqual(['-a']);
  });
});

describe('removeChip', () => {
  describe('the only term', () => {
    it.each([
      ['weak'],
      ['  weak '],
      ['-weak'],
      ['NOT NOT weak'],
      ['(weak)'],
      ['-(weak)'],
      ['((weak'],
      ['weak OR'],
      ['class:"two words"'],
    ])('leaves no query at all for %j', (source) => {
      expect(removeChip(source, 0)).toBe('');
    });
  });

  describe('a term and the operator next to it', () => {
    it.each([
      ['a b', 0, 'b'],
      ['a b', 1, 'a'],
      ['a AND b', 0, 'b'],
      ['a AND b', 1, 'a'],
      ['a & b', 1, 'a'],
      ['a OR b', 0, 'b'],
      ['a OR b', 1, 'a'],
      ['a | b', 0, 'b'],
      ['a OR b OR c', 0, 'b OR c'],
      ['a OR b OR c', 1, 'a OR c'],
      ['a OR b OR c', 2, 'a OR b'],
      ['a b c', 1, 'a c'],
      ['a AND b AND c', 1, 'a AND c'],
    ])('%j, chip %i: %j', (source, index, expected) => {
      expect(removeChip(source, index)).toBe(expected);
    });
  });

  describe('a term in a mix of operators', () => {
    it.each([
      ['a b OR c', 0, 'b OR c'],
      ['a b OR c', 1, 'a OR c'],
      ['a b OR c', 2, 'a b'],
      ['a OR b c', 0, 'b c'],
      ['a OR b c', 1, 'a OR c'],
      ['a OR b c', 2, 'a OR b'],
      ['a OR b c OR d', 2, 'a OR b OR d'],
      ['a b OR c d', 3, 'a b OR c'],
    ])('%j, chip %i: %j', (source, index, expected) => {
      expect(removeChip(source, index)).toBe(expected);
    });
  });

  describe('a term with its NOT', () => {
    it.each([
      ['a -b c', 1, 'a c'],
      ['a NOT b c', 1, 'a c'],
      ['a NOT b', 1, 'a'],
      ['a --b', 1, 'a'],
      ['a - - b', 1, 'a'],
      ['-a b', 0, 'b'],
      ['a OR -b', 1, 'a'],
      ['-a OR b', 0, 'b'],
    ])('%j, chip %i: %j', (source, index, expected) => {
      expect(removeChip(source, index)).toBe(expected);
    });
  });

  describe('a term in a group', () => {
    it.each([
      // a group left with one term is that term
      ['(a OR b) c', 0, 'b c'],
      ['(a OR b) c', 1, 'a c'],
      ['x (a b)', 2, 'x a'],
      ['x OR (a b)', 1, 'x OR b'],
      ['-(a OR b)', 0, '-b'],
      ['-(a OR b)', 1, '-a'],
      ['-(a b) c', 1, '-a c'],
      ['x ( a OR b )', 2, 'x a'],
      ['(a OR b', 1, 'a'],
      ['((a OR b))', 0, 'b'],
      // a group left with more stays a group
      ['(a OR b OR c)', 1, '(a OR c)'],
      ['x (a b c)', 2, 'x (a c)'],
      ['-(a OR b OR c)', 2, '-(a OR b)'],
      ['( a OR b OR c )', 2, '( a OR b )'],
      // so does one whose last term is not a plain term
      ['(a OR -b)', 0, '(-b)'],
      ['(a OR b c)', 0, '(b c)'],
      ['(a OR b c)', 2, '(a OR b)'],
      // a group that is a term of its own goes with it
      ['x (a)', 1, 'x'],
      ['(a) x', 0, 'x'],
      ['x OR (-a)', 1, 'x'],
      ['(a OR b) (c d)', 2, '(a OR b) d'],
      ['(a OR b) c', 2, '(a OR b)'],
    ])('%j, chip %i: %j', (source, index, expected) => {
      expect(removeChip(source, index)).toBe(expected);
    });
  });

  it('leaves the rest of the text as typed', () => {
    expect(removeChip('  Class:Life   AND  weak | "x"  ', 1)).toBe('  Class:Life   | "x"  ');
    expect(removeChip('  Class:Life   AND  weak | "x"  ', 2)).toBe('  Class:Life   AND  weak  ');
    expect(removeChip('Class:Life weak ', 0)).toBe('weak ');
  });

  it('keeps the text apart where the removed text was the only thing between two tokens', () => {
    expect(removeChip('a(b)c', 1)).toBe('a c');
    expect(removeChip('NOT(a b)', 1)).toBe('NOT a');
    expect(removeChip('-(a b)', 1)).toBe('-a');
    expect(removeChip('(a b)c', 1)).toBe('a c');
  });

  it('takes the repairs out with the operator they belonged to', () => {
    expect(removeChip('a OR OR b', 0)).toBe('b');
    expect(removeChip('a OR OR b', 1)).toBe('a');
    expect(removeChip('a b )', 1)).toBe('a )');
  });

  it('does nothing for a chip the query does not have', () => {
    expect(removeChip('a b', 2)).toBe('a b');
    expect(removeChip('a b', -1)).toBe('a b');
    expect(removeChip('', 0)).toBe('');
    expect(removeChip('AND', 0)).toBe('AND');
  });

  it('removes the chips one after the other, down to no query', () => {
    let source = '(a OR -b) c OR d';
    const seen: string[] = [];
    while (queryChips(source).length > 0) {
      source = removeChip(source, 0);
      seen.push(source);
    }
    expect(seen).toEqual(['(-b) c OR d', 'c OR d', 'd', '']);
  });
});

describe('for any query', () => {
  const piece = fc.constantFrom(
    '(',
    ')',
    '"',
    '-',
    'weak',
    'snared',
    'Class:life',
    'class:',
    'class:"rodian master"',
    '"two words"',
    '"and"',
    'OR',
    'AND',
    'NOT',
    '|',
    '&',
    'é',
  );
  // Mostly a blank between two pieces, sometimes none or more, so that pieces also touch: `(a)b`, `NOT(a`.
  const joined = fc.array(fc.tuple(piece, fc.constantFrom(' ', ' ', ' ', '', '  ')), { maxLength: 24 });
  const anyQuery = joined.map((parts) => parts.map(([text, blank]) => text + blank).join(''));
  const anyText = fc.oneof(anyQuery, anyQuery, fc.string({ unit: 'binary' }));

  /** The chips of a text, whatever the query was read as. */
  const shape = (source: string) => queryChips(source).map(({ field, value, negated }) => ({ field, value, negated }));
  const problems = (source: string) => parseQuery(source).diagnostics.length;

  it('removes exactly the chip it is asked for, and no query is made worse', () => {
    fc.assert(
      fc.property(anyText, (source) => {
        const before = shape(source);
        for (const [index] of before.entries()) {
          const after = removeChip(source, index);
          expect(shape(after), `${JSON.stringify(source)} chip ${index}`).toEqual(
            before.filter((_, at) => at !== index),
          );
          expect(problems(after), `${JSON.stringify(source)} chip ${index}`).toBeLessThanOrEqual(problems(source));
        }
      }),
      { numRuns: 500 },
    );
  });

  it('flips exactly the chip it is asked for, or leaves the text alone', () => {
    fc.assert(
      fc.property(anyText, (source) => {
        const before = shape(source);
        for (const [index, chip] of before.entries()) {
          const after = toggleChipNot(source, index);
          const expected = before.map((each, at) => (at === index ? { ...chip, negated: !chip.negated } : each));
          const flipped = JSON.stringify(shape(after)) === JSON.stringify(expected);
          expect(flipped || after === source, `${JSON.stringify(source)} chip ${index}`).toBe(true);
          expect(problems(after), `${JSON.stringify(source)} chip ${index}`).toBeLessThanOrEqual(problems(source));
        }
      }),
      { numRuns: 500 },
    );
  });

  it('always flips a query the parser reads without repairs', () => {
    fc.assert(
      fc.property(anyQuery, (source) => {
        fc.pre(parseQuery(source).diagnostics.length === 0);
        for (const [index] of queryChips(source).entries()) {
          expect(toggleChipNot(source, index), `${JSON.stringify(source)} chip ${index}`).not.toBe(source);
        }
      }),
      { numRuns: 500 },
    );
  });
});
