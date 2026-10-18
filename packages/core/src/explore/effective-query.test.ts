import { describe, expect, it } from 'vitest';
import { parseQuery } from '../query/parser';
import { initialExploreState, type ExploreState } from './explore-state';
import { effectiveQuery, filterQuery } from './effective-query';

const stateWith = (overrides: Partial<ExploreState>): ExploreState => ({ ...initialExploreState, ...overrides });

/** The classes of the compendium that matter here: `boss` is part of the name `nether boss`. */
const KNOWN_CLASSES = ['boss', 'death', 'life', 'nature', 'nether boss', 'rodian master'];

describe('filterQuery', () => {
  const filters = (overrides: Partial<ExploreState>, known: readonly string[] = KNOWN_CLASSES) =>
    filterQuery(stateWith(overrides), known);

  it('is empty for the initial state', () => {
    expect(filters({})).toEqual({ classes: '', rest: '' });
  });

  describe('classes', () => {
    it('writes one class as a term of the query language', () => {
      expect(filters({ classes: ['life'] }).classes).toBe('class:life');
    });

    it('writes several as any of them, in the order they were chosen', () => {
      expect(filters({ classes: ['nature', 'life'] }).classes).toBe('(class:nature OR class:life)');
    });

    it('quotes a name of more than one word', () => {
      expect(filters({ classes: ['rodian master'] }).classes).toBe('class:"rodian master"');
    });

    it('leaves out the classes that the name of a chosen one is part of: Boss is not Nether Boss', () => {
      expect(filters({ classes: ['boss'] }).classes).toBe('class:boss -class:"nether boss"');
    });

    it('leaves out a class once, however many chosen ones are part of it', () => {
      expect(filters({ classes: ['boss', 'nether'] }, ['boss', 'nether', 'nether boss']).classes).toBe(
        '(class:boss OR class:nether) -class:"nether boss"',
      );
    });

    it('does not leave out a class that is chosen too', () => {
      expect(filters({ classes: ['boss', 'nether boss'] }).classes).toBe('(class:boss OR class:"nether boss")');
    });

    it('leaves out nothing for a class that is no part of another', () => {
      expect(filters({ classes: ['nether boss'] }).classes).toBe('class:"nether boss"');
      expect(filters({ classes: ['life', 'death'] }).classes).toBe('(class:life OR class:death)');
    });

    it('finds no trait for a name that is only part of a class: Lif is not Life', () => {
      expect(filters({ classes: ['lif'] }).classes).toBe('class:lif -class:life');
    });

    it('is the same for a name in any letter case', () => {
      expect(filters({ classes: ['Boss'] }).classes).toBe('class:Boss -class:"nether boss"');
    });

    it('does not put the classes in the rest', () => {
      expect(filters({ classes: ['life'] }).rest).toBe('');
    });
  });

  describe('keywords', () => {
    const vulnerable = { field: 'applies', key: 'vulnerable' } as const;
    const weak = { field: 'uses', key: 'weak' } as const;

    it('writes each one with its field', () => {
      expect(filters({ keywords: [vulnerable] }).rest).toBe('applies:vulnerable');
      expect(filters({ keywords: [{ field: 'kw', key: 'timeline' }] }).rest).toBe('kw:timeline');
    });

    it('writes all of them when all are needed', () => {
      expect(filters({ keywords: [vulnerable, weak], keywordMode: 'all' }).rest).toBe('applies:vulnerable uses:weak');
    });

    it('writes any of them when one is enough', () => {
      expect(filters({ keywords: [vulnerable, weak], keywordMode: 'any' }).rest).toBe(
        '(applies:vulnerable OR uses:weak)',
      );
    });

    it('needs no parentheses for one keyword, whichever the mode', () => {
      expect(filters({ keywords: [weak], keywordMode: 'any' }).rest).toBe('uses:weak');
    });

    it('quotes a key of more than one word', () => {
      expect(filters({ keywords: [{ field: 'kw', key: 'start of battle' }] }).rest).toBe('kw:"start of battle"');
    });

    it('does not put the keywords in the classes', () => {
      expect(filters({ keywords: [vulnerable] }).classes).toBe('');
    });

    it('writes the actor of an event after a slash, inside the quotes of a key of several words', () => {
      expect(filters({ keywords: [{ field: 'uses', key: 'attack', actor: 'self' }] }).rest).toBe('uses:attack/self');
      expect(filters({ keywords: [{ field: 'kw', key: 'start of turn', actor: 'enemy' }] }).rest).toBe(
        'kw:"start of turn/enemy"',
      );
    });

    it('writes the same event by two actors as two terms', () => {
      const attack = { field: 'uses', key: 'attack' } as const;
      expect(filters({ keywords: [{ ...attack, actor: 'self' }, attack], keywordMode: 'any' }).rest).toBe(
        '(uses:attack/self OR uses:attack)',
      );
    });
  });

  describe('flags', () => {
    it('writes the material and the stacking', () => {
      expect(filters({ artifactEligible: true }).rest).toBe('mat:yes');
      expect(filters({ doesNotStack: true }).rest).toBe('stack:no');
      expect(filters({ artifactEligible: true, doesNotStack: true }).rest).toBe('mat:yes stack:no');
    });

    it('writes them after the keywords', () => {
      expect(
        filters({
          keywords: [{ field: 'applies', key: 'weak' }],
          artifactEligible: true,
          doesNotStack: true,
        }).rest,
      ).toBe('applies:weak mat:yes stack:no');
    });
  });

  it('writes a query that reads without a repair', () => {
    const { classes, rest } = filters({
      classes: ['boss', 'rodian master'],
      keywords: [
        { field: 'applies', key: 'weak' },
        { field: 'kw', key: "start of this creature's turn" },
        { field: 'uses', key: 'start of turn', actor: 'enemy' },
      ],
      keywordMode: 'any',
      artifactEligible: true,
      doesNotStack: true,
    });

    expect(parseQuery(classes).diagnostics).toEqual([]);
    expect(parseQuery(rest).diagnostics).toEqual([]);
  });
});

describe('effectiveQuery', () => {
  const effective = (filters: { classes?: string; rest?: string }, query: string) =>
    effectiveQuery({ classes: '', rest: '', ...filters }, parseQuery(query).ast);

  it('is no text when there is no filter and no query', () => {
    expect(effective({}, '')).toBe('');
    expect(effective({}, '   ')).toBe('');
  });

  it('is the query alone, written the canonical way', () => {
    expect(effective({}, '  (vulnerable   OR weak)  -stack:no ')).toBe('(vulnerable OR weak) -stack:no');
  });

  it('is the filters alone when the query bar is empty', () => {
    expect(effective({ classes: 'class:life', rest: 'mat:yes' }, '')).toBe('class:life mat:yes');
  });

  it('puts the classes first, then the rest of the filters, then the query', () => {
    expect(effective({ classes: 'class:life', rest: 'applies:weak stack:no' }, 'snared')).toBe(
      'class:life applies:weak stack:no snared',
    );
  });

  it('puts the query in parentheses when it is an OR beside a filter', () => {
    expect(effective({ rest: 'mat:yes' }, 'weak OR snared')).toBe('mat:yes (weak OR snared)');
    expect(effective({ classes: 'class:life' }, 'weak OR snared')).toBe('class:life (weak OR snared)');
  });

  it('does not put an OR in parentheses when it stands alone', () => {
    expect(effective({}, 'weak OR snared')).toBe('weak OR snared');
  });

  it('leaves in the open what already binds tighter than the filters', () => {
    expect(effective({ rest: 'mat:yes' }, 'weak snared')).toBe('mat:yes weak snared');
    expect(effective({ rest: 'mat:yes' }, '-weak')).toBe('mat:yes -weak');
    expect(effective({ rest: 'mat:yes' }, '-(weak OR snared)')).toBe('mat:yes -(weak OR snared)');
    expect(effective({ rest: 'mat:yes' }, '(weak OR snared)')).toBe('mat:yes (weak OR snared)');
  });

  it('writes a query read with repairs as it was repaired', () => {
    expect(effective({ rest: 'mat:yes' }, '(weak')).toBe('mat:yes weak');
    expect(effective({ rest: 'mat:yes' }, 'weak OR')).toBe('mat:yes weak');
  });
});
