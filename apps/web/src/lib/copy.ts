import type { ClickGoal, KeywordRole, SortKey, TraitKind } from '@atlas/core';

const numberFormat = new Intl.NumberFormat('en-US');
const formatCount = (count: number): string => numberFormat.format(count);

/** What a trait does with a keyword, which the shape of its token says to the eye (DESIGN § Keyword tokens). */
const keywordRole = {
  applies: 'Applies',
  uses: 'Relies on',
  resists: 'Guards against',
} as const satisfies Record<KeywordRole, string>;

const keywordGoal = {
  appliers: 'show traits that apply it',
  users: 'show traits that rely on it',
  mentions: 'show traits that mention it',
  nonStacking: 'show only traits that do not stack',
} as const satisfies Record<ClickGoal, string>;

/** Every user-facing string lives here so the UI stays i18n-ready (DESIGN § Copy). */
export const copy = {
  appName: 'Trait Atlas',
  appTagline: 'Siralim Ultimate trait search and party planner',
  pageTitle: 'Trait Atlas — Siralim Ultimate trait search and party planner',
  skipToContent: 'Skip to content',
  exploreHeading: 'Explore traits',
  loadingTraits: 'Loading the traits…',
  traitsFailed: 'The trait data could not be loaded. Check your connection and reload the page.',

  searchLabel: 'Search traits',
  searchPlaceholder: 'vulnerable OR weak  ·  applies:snared  ·  "start of battle"  ·  -stack:no',
  resultCount: (shown: number, total: number) => `${formatCount(shown)} of ${formatCount(total)} traits`,
  datasetVersion: (version: string) => `Compendium v${version}`,
  sortLabel: 'Sort',
  sortOptions: {
    book: 'Family, then trait name',
    class: 'Class, then family',
    az: 'Trait name A–Z',
  } as const satisfies Record<SortKey, string>,

  filtersHeading: 'Filters',
  resultsHeading: 'Results',
  partyHeading: 'Party',
  comingSoon: 'Coming soon.',
  noResultsTitle: 'No trait matches.',
  noResultsHint: 'Check the spelling, swap an AND for an OR, or remove a term.',
  noMaterial: 'No material — not artifact-eligible',
  /** The name of a keyword in a description, a button: what the trait does with it, then what a click shows. */
  keywordButton: (text: string, role: KeywordRole | undefined, goal: ClickGoal) =>
    `${role === undefined ? '' : `${keywordRole[role]} `}${text} — ${keywordGoal[goal]}`,
  /** What stands in the creature's place for a trait that has no creature. */
  traitKind: {
    creature: 'Creature trait',
    avatar: 'Avatar trait',
    mastery: 'Mastery trait',
    backer: 'Backer trait',
    other: 'Special trait',
  } as const satisfies Record<TraitKind, string>,

  unofficial: 'Unofficial fan project, not affiliated with Thylacine Studios.',
  dataCreditBefore: 'Trait data comes from the community ',
  compendiumName: 'Siralim Ultimate Compendium',
  dataCreditAfter: '. All credit to its authors and contributors.',
  compendiumUrl: 'https://docs.google.com/spreadsheets/d/1qvWwf1fNB5jN8bJ8dFGAVzC7scgDCoBO-hglwjTT4iY/',
} as const;
