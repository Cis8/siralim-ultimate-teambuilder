import {
  initialExploreState,
  KEYWORD_MODES,
  SORT_KEYS,
  type ExploreState,
  type KeywordFilter,
  type KeywordFilterField,
} from './explore-state';

/** Where an address is read from. A browser's `URLSearchParams` is one; `core` knows no URL type of its own. */
export interface ParamReader {
  /** The first value of the parameter, `null` when there is none. */
  get(name: string): string | null;
}

/** Name and value, ready to be written into an address. `URLSearchParams` takes them as they are. */
export type ExploreParams = readonly (readonly [name: string, value: string])[];

/**
 * The parameters of the Explore state, in the order they are written (SPEC §7). A page that shares its address with other
 * views (the party) clears these and adds what `encodeExploreState` returns.
 */
export const EXPLORE_PARAMS = ['q', 'class', 'kw', 'mode', 'mat', 'stack', 'sort'] as const;

/** The letter of each keyword filter in `kw`: the alias the query language gives to its field (QUERY_LANGUAGE §2). */
const KEYWORD_CODES: Readonly<Record<KeywordFilterField, string>> = { applies: 'a', uses: 'u', kw: 'k' };
const KEYWORD_FIELDS = new Map(
  Object.entries(KEYWORD_CODES).map(([field, code]) => [code, field as KeywordFilterField]),
);

/**
 * Reads the state an address stands for. Any address is one: a parameter that is missing or says nothing usable (an
 * unknown choice, an empty class or keyword) leaves that part of the state at its initial value.
 */
export function decodeExploreState(params: ParamReader): ExploreState {
  return {
    query: params.get('q') ?? initialExploreState.query,
    classes: canonicalNames(readList(params.get('class'))),
    keywords: canonicalKeywords(readList(params.get('kw')).flatMap((item) => keywordOf(item) ?? [])),
    keywordMode: choice(params.get('mode'), KEYWORD_MODES) ?? initialExploreState.keywordMode,
    artifactEligible: spelled(params.get('mat')) === 'yes',
    doesNotStack: spelled(params.get('stack')) === 'no',
    sort: choice(params.get('sort'), SORT_KEYS) ?? initialExploreState.sort,
  };
}

/**
 * The parameters that make an address stand for `state`: only those that differ from the initial state, so that it has
 * none. Classes and keywords are written in lower case, trimmed and once, as `decodeExploreState` reads them.
 */
export function encodeExploreState(state: ExploreState): ExploreParams {
  const classes = canonicalNames(state.classes);
  const keywords = canonicalKeywords(state.keywords);
  const params: readonly (readonly [string, string | undefined])[] = [
    ['q', state.query === initialExploreState.query ? undefined : state.query],
    ['class', classes.length === 0 ? undefined : writeList(classes)],
    [
      'kw',
      keywords.length === 0 ? undefined : writeList(keywords.map(({ field, key }) => `${KEYWORD_CODES[field]}:${key}`)),
    ],
    ['mode', state.keywordMode === initialExploreState.keywordMode ? undefined : state.keywordMode],
    ['mat', state.artifactEligible ? 'yes' : undefined],
    ['stack', state.doesNotStack ? 'no' : undefined],
    ['sort', state.sort === initialExploreState.sort ? undefined : state.sort],
  ];
  return params.flatMap(([name, value]) => (value === undefined ? [] : [[name, value] as const]));
}

const spelled = (value: string | null): string | undefined => value?.trim().toLowerCase();

/** The choice `value` spells, whatever its letter case. */
const choice = <Choice extends string>(value: string | null, choices: readonly Choice[]): Choice | undefined =>
  choices.find((candidate) => candidate === spelled(value));

/** Lower case, trimmed, once, in the order given; an empty name is no name. */
function canonicalNames(names: readonly string[]): string[] {
  return [...new Set(names.map((name) => name.trim().toLowerCase()).filter((name) => name !== ''))];
}

/** The same for the key of each filter; a field and a key make a filter once. */
function canonicalKeywords(filters: readonly KeywordFilter[]): KeywordFilter[] {
  const byId = new Map<string, KeywordFilter>();
  for (const { field, key } of filters) {
    const canonicalKey = key.trim().toLowerCase();
    const id = `${field}:${canonicalKey}`;
    if (canonicalKey !== '' && !byId.has(id)) byId.set(id, { field, key: canonicalKey });
  }
  return [...byId.values()];
}

/** The filter an item like `a:vulnerable` stands for; nothing when its letter is not one of a field. */
function keywordOf(item: string): KeywordFilter | undefined {
  const colon = item.indexOf(':');
  if (colon < 0) return undefined;
  const field = KEYWORD_FIELDS.get(item.slice(0, colon).trim().toLowerCase());
  return field === undefined ? undefined : { field, key: item.slice(colon + 1) };
}

/**
 * Items are told apart by commas, so a comma inside one is written `%2C`, and a percent sign `%25`. The classes and
 * keywords of the compendium have neither; they are escaped so that a name never splits in two, whatever a dataset holds.
 */
const writeList = (items: readonly string[]): string =>
  items.map((item) => item.replace(/[%,]/gu, (character) => (character === '%' ? '%25' : '%2C'))).join(',');

const readList = (text: string | null): string[] =>
  text === null || text === ''
    ? []
    : text.split(',').map((item) => item.replace(/%2C|%25/giu, (escape) => (escape === '%25' ? '%' : ',')));
