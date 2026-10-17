import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  initialExploreState,
  KEYWORD_FILTER_FIELDS,
  KEYWORD_MODES,
  SORT_KEYS,
  type ExploreState,
} from './explore-state';
import type { ParamReader } from '../url/url-params';
import { decodeExploreState, encodeExploreState, EXPLORE_PARAMS } from './explore-url';

/** The way an address reads: `name=value` pairs, `+` for a blank, percent escapes, the first of a name wins. */
function paramsOf(search: string): ParamReader {
  const values = new Map<string, string>();
  for (const pair of search.split('&')) {
    const at = pair.indexOf('=');
    const [name, value] = at < 0 ? [pair, ''] : [pair.slice(0, at), pair.slice(at + 1)];
    const read = (text: string) => decodeURIComponent(text.replaceAll('+', ' '));
    if (!values.has(read(name))) values.set(read(name), read(value));
  }
  return { get: (name) => values.get(name) ?? null };
}

const decodeSearch = (search: string): ExploreState => decodeExploreState(paramsOf(search));

/** The address an encoded state is written as, every name and value escaped as a browser does. */
const searchOf = (state: ExploreState): string =>
  encodeExploreState(state)
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&');

describe('decodeExploreState', () => {
  it('reads an address with no parameter as the initial state', () => {
    expect(decodeSearch('')).toEqual(initialExploreState);
  });

  it('reads every parameter', () => {
    const search =
      'q=weak+OR+snared&class=life,nature&kw=a:vulnerable,u:weak,k:start+of+battle&mode=any&mat=yes&stack=no&sort=az';

    expect(decodeSearch(search)).toEqual({
      query: 'weak OR snared',
      classes: ['life', 'nature'],
      keywords: [
        { field: 'applies', key: 'vulnerable' },
        { field: 'uses', key: 'weak' },
        { field: 'kw', key: 'start of battle' },
      ],
      keywordMode: 'any',
      artifactEligible: true,
      doesNotStack: true,
      sort: 'az',
    });
  });

  it('keeps the query exactly as typed, blanks and letter case included', () => {
    expect(decodeSearch('q=%20Class%3ALife%20%20').query).toBe(' Class:Life  ');
  });

  describe('a parameter that says nothing usable is left out, the others still count', () => {
    it.each([
      ['mode=most', 'keywordMode', 'all'],
      ['mode=', 'keywordMode', 'all'],
      ['sort=random', 'sort', 'book'],
      ['sort=', 'sort', 'book'],
      ['mat=maybe', 'artifactEligible', false],
      ['mat=no', 'artifactEligible', false],
      ['mat=', 'artifactEligible', false],
      ['stack=yes', 'doesNotStack', false],
      ['stack=maybe', 'doesNotStack', false],
      ['class=', 'classes', []],
      ['class=,,%20,', 'classes', []],
      ['kw=', 'keywords', []],
      ['kw=weak', 'keywords', []],
      ['kw=x:weak', 'keywords', []],
      ['kw=a:', 'keywords', []],
      ['kw=:weak', 'keywords', []],
      ['kw=a:%20', 'keywords', []],
      ['kw=applies:weak', 'keywords', []],
    ])('%s: %s stays %j', (search, property, expected) => {
      expect(decodeSearch(`${search}&q=weak`)).toEqual({ ...initialExploreState, query: 'weak', [property]: expected });
    });

    it('ignores a parameter nobody knows', () => {
      expect(decodeSearch('party=abc&target=3&tab=party&q=weak')).toEqual({ ...initialExploreState, query: 'weak' });
    });

    it('keeps the good items of a list that has bad ones', () => {
      expect(decodeSearch('kw=a:weak,nonsense,x:y,u:snared&class=life,,nature').keywords).toEqual([
        { field: 'applies', key: 'weak' },
        { field: 'uses', key: 'snared' },
      ]);
      expect(decodeSearch('class=life,,nature').classes).toEqual(['life', 'nature']);
    });

    it('reads the first of a name given twice, as a browser does', () => {
      expect(decodeSearch('mode=any&mode=all&q=a&q=b')).toMatchObject({ keywordMode: 'any', query: 'a' });
    });
  });

  describe('spelling', () => {
    it('reads classes and keywords in lower case, trimmed and once', () => {
      const state = decodeSearch('class=Life,%20NATURE%20,life&kw=A:Vulnerable,a:vulnerable,U:Vulnerable');

      expect(state.classes).toEqual(['life', 'nature']);
      expect(state.keywords).toEqual([
        { field: 'applies', key: 'vulnerable' },
        { field: 'uses', key: 'vulnerable' },
      ]);
    });

    it('keeps the order in which classes and keywords were chosen', () => {
      expect(decodeSearch('class=nature,death,life').classes).toEqual(['nature', 'death', 'life']);
    });

    it('reads the choices whatever their letter case', () => {
      expect(decodeSearch('mode=ANY&sort=Class&mat=YES&stack=No')).toMatchObject({
        keywordMode: 'any',
        sort: 'class',
        artifactEligible: true,
        doesNotStack: true,
      });
    });

    it('reads a comma or a percent sign escaped inside an item', () => {
      expect(decodeSearch('class=a%252Cb,100%2525').classes).toEqual(['a,b', '100%']);
    });

    it('reads a percent sign that escapes nothing as itself', () => {
      expect(decodeSearch('class=100%25,%25x%25zz').classes).toEqual(['100%', '%x%zz']);
    });
  });
});

describe('encodeExploreState', () => {
  it('writes nothing for the initial state', () => {
    expect(encodeExploreState(initialExploreState)).toEqual([]);
  });

  it('writes only what differs from the initial state, in a fixed order', () => {
    expect(encodeExploreState({ ...initialExploreState, sort: 'class', query: 'weak' })).toEqual([
      ['q', 'weak'],
      ['sort', 'class'],
    ]);
  });

  it('writes the example of the specification', () => {
    const state: ExploreState = {
      query: 'weak',
      classes: ['life', 'nature'],
      keywords: [
        { field: 'applies', key: 'vulnerable' },
        { field: 'uses', key: 'weak' },
        { field: 'kw', key: 'start of battle' },
      ],
      keywordMode: 'any',
      artifactEligible: true,
      doesNotStack: true,
      sort: 'az',
    };

    expect(encodeExploreState(state)).toEqual([
      ['q', 'weak'],
      ['class', 'life,nature'],
      ['kw', 'a:vulnerable,u:weak,k:start of battle'],
      ['mode', 'any'],
      ['mat', 'yes'],
      ['stack', 'no'],
      ['sort', 'az'],
    ]);
  });

  it('writes a query of blanks, which is not the initial one', () => {
    expect(encodeExploreState({ ...initialExploreState, query: '  ' })).toEqual([['q', '  ']]);
  });

  it('writes classes and keywords the way they are read: lower case, trimmed, once', () => {
    const written = encodeExploreState({
      ...initialExploreState,
      classes: ['Life', ' life ', 'Rodian Master'],
      keywords: [
        { field: 'applies', key: 'Weak' },
        { field: 'applies', key: 'weak ' },
      ],
    });

    expect(written).toEqual([
      ['class', 'life,rodian master'],
      ['kw', 'a:weak'],
    ]);
  });

  it('writes only the parameters it names', () => {
    const everything: ExploreState = {
      query: 'a',
      classes: ['life'],
      keywords: [{ field: 'kw', key: 'x' }],
      keywordMode: 'any',
      artifactEligible: true,
      doesNotStack: true,
      sort: 'az',
    };

    expect(encodeExploreState(everything).map(([name]) => name)).toEqual(EXPLORE_PARAMS);
  });
});

describe('the address of a state', () => {
  /** Strings with the characters an address treats as its own, and some that are not ASCII. */
  const text = fc.string({
    unit: fc.oneof(
      fc.constantFrom('a', 'B', ' ', '%', ',', '&', '=', '+', '#', '?', ':', '"', '/', 'é', '日', '😀'),
      fc.string({ unit: 'grapheme', minLength: 1, maxLength: 1 }),
    ),
    maxLength: 12,
  });
  /** What a class or a keyword is once written: lower case, trimmed, not empty. */
  const name = text
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value !== '' && value.trim().toLowerCase() === value);

  const state = fc.record({
    query: text,
    classes: fc.uniqueArray(name, { maxLength: 5 }),
    keywords: fc.uniqueArray(fc.record({ field: fc.constantFrom(...KEYWORD_FILTER_FIELDS), key: name }), {
      maxLength: 5,
      selector: ({ field, key }) => `${field}:${key}`,
    }),
    keywordMode: fc.constantFrom(...KEYWORD_MODES),
    artifactEligible: fc.boolean(),
    doesNotStack: fc.boolean(),
    sort: fc.constantFrom(...SORT_KEYS),
  });

  it('gives back the state it was made from, through an address', () => {
    fc.assert(
      fc.property(state, (original) => {
        expect(decodeSearch(searchOf(original))).toEqual(original);
      }),
    );
  });

  it('is the same address for the state it gives back', () => {
    const anyAddress = fc.array(fc.tuple(fc.constantFrom(...EXPLORE_PARAMS, 'other'), text), { maxLength: 8 });

    fc.assert(
      fc.property(anyAddress, (pairs) => {
        const read = decodeSearch(pairs.map(([n, v]) => `${encodeURIComponent(n)}=${encodeURIComponent(v)}`).join('&'));

        expect(decodeSearch(searchOf(read))).toEqual(read);
      }),
    );
  });
});
