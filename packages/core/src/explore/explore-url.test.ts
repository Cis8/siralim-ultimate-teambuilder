import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  initialExploreState,
  KEYWORD_FILTER_FIELDS,
  KEYWORD_MODES,
  SORT_KEYS,
  type ExploreState,
} from './explore-state';
import { KEYWORD_ACTORS } from '../model/trait';
import { parseKeywordReference } from '../query/keyword-reference';
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

    // SPEC §7: a `kw` item is a field and a keyword reference, the key and, after a slash, who acts (QUERY_LANGUAGE §2).
    describe('who acts in a keyword item', () => {
      it('reads the actor after a slash', () => {
        expect(decodeSearch('kw=a:attack/self,u:start+of+turn/enemy,k:dodge/ally').keywords).toEqual([
          { field: 'applies', key: 'attack', actor: 'self' },
          { field: 'uses', key: 'start of turn', actor: 'enemy' },
          { field: 'kw', key: 'dodge', actor: 'ally' },
        ]);
      });

      it('reads the letter case of the actor and the blanks around the slash as it does for the key', () => {
        expect(decodeSearch('kw=A:Attack+/+SELF').keywords).toEqual([
          { field: 'applies', key: 'attack', actor: 'self' },
        ]);
      });

      it('reads an old trigger phrase as the event and the actor it stands for (ADR-0009)', () => {
        expect(
          decodeSearch('kw=k:after+this+creature+attacks,k:is+killed,u:After+an+enemy+dodges,k:start+of+battle')
            .keywords,
        ).toEqual([
          { field: 'kw', key: 'attack', actor: 'self' },
          { field: 'kw', key: 'death' },
          { field: 'uses', key: 'dodge', actor: 'enemy' },
          { field: 'kw', key: 'start of battle' },
        ]);
      });

      it('keeps the event by anyone and by one actor apart, and each once', () => {
        expect(
          decodeSearch('kw=u:attack,u:attack/self,u:Attack/SELF,k:after+this+creature+attacks,u:attack').keywords,
        ).toEqual([
          { field: 'uses', key: 'attack' },
          { field: 'uses', key: 'attack', actor: 'self' },
          { field: 'kw', key: 'attack', actor: 'self' },
        ]);
      });

      it('takes a slash with nobody after it for no actor yet', () => {
        expect(decodeSearch('kw=u:attack/,u:attack//').keywords).toEqual([{ field: 'uses', key: 'attack' }]);
      });

      it('keeps what follows a slash and names nobody in the key, which matches nothing', () => {
        expect(decodeSearch('kw=u:attack/nobody').keywords).toEqual([{ field: 'uses', key: 'attack/nobody' }]);
      });

      it('leaves out an actor with no key to go with it', () => {
        expect(decodeSearch('kw=u:/self,u:+/enemy').keywords).toEqual([]);
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

  it('writes the actor of an event after a slash', () => {
    const written = encodeExploreState({
      ...initialExploreState,
      keywords: [
        { field: 'uses', key: 'attack', actor: 'self' },
        { field: 'kw', key: 'Start of Turn', actor: 'enemy' },
        { field: 'uses', key: 'attack' },
      ],
    });

    expect(written).toEqual([['kw', 'u:attack/self,k:start of turn/enemy,u:attack']]);
  });

  it('writes the same event once per actor, and the same actor once', () => {
    const written = encodeExploreState({
      ...initialExploreState,
      keywords: [
        { field: 'uses', key: 'attack', actor: 'self' },
        { field: 'uses', key: 'Attack ', actor: 'self' },
        { field: 'uses', key: 'attack', actor: 'enemy' },
      ],
    });

    expect(written).toEqual([['kw', 'u:attack/self,u:attack/enemy']]);
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
  /** A key that reads as itself: with no actor, no trailing slash and not an old phrase (`parseKeywordReference`). */
  const keyword = name.filter((value) => {
    const { key, actor } = parseKeywordReference(value);
    return key === value && actor === undefined;
  });

  const state = fc.record({
    query: text,
    classes: fc.uniqueArray(name, { maxLength: 5 }),
    keywords: fc.uniqueArray(
      fc.record(
        { field: fc.constantFrom(...KEYWORD_FILTER_FIELDS), key: keyword, actor: fc.constantFrom(...KEYWORD_ACTORS) },
        { requiredKeys: ['field', 'key'] },
      ),
      { maxLength: 5, selector: ({ field, key, actor }) => `${field}:${key}/${actor ?? ''}` },
    ),
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
