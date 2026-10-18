import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { closestMatch, editDistance } from './closest-match';

describe('editDistance', () => {
  it.each([
    ['kitten', 'sitting', 3],
    ['flaw', 'lawn', 2],
    ['class', 'clas', 1],
    ['vulnerable', 'vulnrable', 1],
    ['abc', 'abc', 0],
    ['', '', 0],
    ['', 'abc', 3],
    ['abc', '', 3],
    ['ab', 'ba', 2],
  ])('%j to %j is %i edits', (from, to, expected) => {
    expect(editDistance(from, to)).toBe(expected);
  });

  it('counts the letter case: it is the caller that folds', () => {
    expect(editDistance('Life', 'life')).toBe(1);
  });

  describe('with a limit', () => {
    it('gives the distance when it is within the limit, and something above the limit when it is not', () => {
      expect(editDistance('kitten', 'sitting', 3)).toBe(3);
      expect(editDistance('kitten', 'sitting', 2)).toBeGreaterThan(2);
      expect(editDistance('abc', 'xyz', 0)).toBeGreaterThan(0);
      expect(editDistance('abc', 'abc', 0)).toBe(0);
    });

    it('gives something above the limit for texts whose lengths are further apart than the limit', () => {
      expect(editDistance('a', 'abcdef', 2)).toBeGreaterThan(2);
      expect(editDistance('abcdef', '', 2)).toBeGreaterThan(2);
    });

    it('agrees with the distance without a limit, on whether it is within it and on what it is when it is', () => {
      const text = fc.string({ unit: fc.constantFrom('a', 'b', 'c'), maxLength: 10 });
      fc.assert(
        fc.property(text, text, fc.nat(6), (a, b, limit) => {
          const exact = editDistance(a, b);
          const bounded = editDistance(a, b, limit);

          expect(bounded <= limit).toBe(exact <= limit);
          if (exact <= limit) expect(bounded).toBe(exact);
        }),
      );
    });
  });

  const word = fc.string({ maxLength: 12 });

  it('is a distance: nothing from itself, the same both ways, never past the longer text, and a detour never saves an edit', () => {
    fc.assert(
      fc.property(word, word, word, (a, b, c) => {
        expect(editDistance(a, a)).toBe(0);
        expect(editDistance(a, b)).toBe(editDistance(b, a));
        expect(editDistance(a, b)).toBeGreaterThanOrEqual(Math.abs(a.length - b.length));
        expect(editDistance(a, b)).toBeLessThanOrEqual(Math.max(a.length, b.length));
        expect(editDistance(a, c)).toBeLessThanOrEqual(editDistance(a, b) + editDistance(b, c));
      }),
    );
  });
});

describe('closestMatch', () => {
  describe('which candidate is meant', () => {
    it('is the one a letter away from a misspelling', () => {
      expect(closestMatch('clas', ['family', 'class', 'creature'])).toBe('class');
      expect(closestMatch('vulnrable', ['Weak', 'Vulnerable', 'Snared'])).toBe('Vulnerable');
    });

    it('is the candidate itself when the input is written as it is, whatever the letter case', () => {
      expect(closestMatch('life', ['Death', 'Life'])).toBe('Life');
      expect(closestMatch('CLASS', ['class'])).toBe('class');
    });

    it('gives the candidate as it was given, not folded', () => {
      expect(closestMatch('rodian mastr', ['Rodian Master'])).toBe('Rodian Master');
    });

    it('is nothing for an input that is like no candidate', () => {
      expect(closestMatch('zzzzzz', ['class', 'family', 'creature'])).toBeUndefined();
    });

    it('is nothing when there are no candidates', () => {
      expect(closestMatch('class', [])).toBeUndefined();
    });
  });

  // QUERY_LANGUAGE §5: at most max(2, ⌊length of the input / 3⌋) edits.
  describe('how far a misspelling may be', () => {
    it('allows two edits to a short input, whatever its length divided by three', () => {
      expect(closestMatch('lfx', ['life'])).toBe('life');
      expect(closestMatch('lxx', ['life'])).toBeUndefined();
    });

    it.each([
      // Eleven letters allow three edits, twelve allow four: one more for each three letters of the input.
      ['abcdefghXYZ', 'abcdefghijk', true],
      ['abcdefgWXYZ', 'abcdefghijk', false],
      ['abcdefghWXYZ', 'abcdefghijkl', true],
      ['abcdefgVWXYZ', 'abcdefghijkl', false],
    ])('compares %j with %j by the ⌊length / 3⌋ edits its length allows: %s', (input, candidate, found) => {
      expect(closestMatch(input, [candidate])).toBe(found ? candidate : undefined);
    });

    it('measures the input, not the candidate', () => {
      // Three edits are what the nine letters of the first allow; the eight letters of the second allow two.
      expect(closestMatch('abcdefghi', ['abcdefghijkl'])).toBe('abcdefghijkl');
      expect(closestMatch('abcdefgh', ['abcdefghijk'])).toBeUndefined();
      expect(closestMatch('vul', ['vulnerable'])).toBeUndefined();
    });
  });

  // Not in §5, which would offer `c:` for any one letter a person mistypes: an input keeps at least one letter of what it is
  // taken for.
  describe('a match must keep a letter of the input', () => {
    it.each([
      ['x', ['c', 'f', 'a']],
      ['xy', ['c']],
      ['ab', ['cd']],
      ['cat', ['c']],
    ])('does not take %j for one of %j', (input, candidates) => {
      expect(closestMatch(input, candidates)).toBeUndefined();
    });

    it('still takes a short input for a short candidate it is a typo of', () => {
      expect(closestMatch('cx', ['cr', 'c'])).toBe('cr');
      expect(closestMatch('c', ['c'])).toBe('c');
      expect(closestMatch('ab', ['abc'])).toBe('abc');
    });

    it('is nothing for an empty input, which is no word to correct', () => {
      expect(closestMatch('', ['', 'a', 'ab'])).toBeUndefined();
    });
  });

  describe('which of several close candidates', () => {
    it('is the nearest', () => {
      expect(closestMatch('abcd', ['abxyd', 'xbcd'])).toBe('xbcd');
    });

    it('is, among equally near ones, the one that shares more of the start with the input', () => {
      expect(closestMatch('cat', ['bat', 'cut'])).toBe('cut');
      expect(closestMatch('catch', ['batch', 'cotch', 'cutch'])).toBe('cotch');
    });

    it('is, among those that tie on both, the first given', () => {
      expect(closestMatch('cat', ['cut', 'cot'])).toBe('cut');
      expect(closestMatch('cat', ['cot', 'cut'])).toBe('cot');
    });

    it('folds the letter case before it compares the start', () => {
      expect(closestMatch('Cat', ['bat', 'CUT'])).toBe('CUT');
    });
  });

  it('only ever gives one of the candidates, within the distance it allows', () => {
    const word = fc.string({ minLength: 1, maxLength: 14 });
    fc.assert(
      fc.property(word, fc.array(word, { maxLength: 8 }), (input, candidates) => {
        const found = closestMatch(input, candidates);
        if (found === undefined) return;
        expect(candidates).toContain(found);
        const allowed = Math.max(2, Math.floor(input.length / 3));
        const distance = editDistance(input.toLowerCase(), found.toLowerCase());
        expect(distance).toBeLessThanOrEqual(allowed);
        expect(distance).toBeLessThan(Math.min(input.length, found.length));
      }),
    );
  });

  it('finds a candidate written exactly as the input, however many others there are', () => {
    const word = fc.string({ minLength: 1, maxLength: 14 });
    fc.assert(
      fc.property(word, fc.array(word, { maxLength: 8 }), fc.nat(8), (input, others, at) => {
        const candidates = [...others];
        candidates.splice(Math.min(at, candidates.length), 0, input);
        expect(closestMatch(input, candidates)?.toLowerCase()).toBe(input.toLowerCase());
      }),
    );
  });
});
