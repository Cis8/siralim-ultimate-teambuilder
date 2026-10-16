import type { SortKey, TraitKind } from '@atlas/core';

const numberFormat = new Intl.NumberFormat('en-US');
const formatCount = (count: number): string => numberFormat.format(count);

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
