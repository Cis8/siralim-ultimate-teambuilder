import type {
  ClickGoal,
  FacetKeywordKind,
  KeywordMode,
  KeywordRole,
  MemberIndex,
  PartyCommand,
  SlotName,
  SlotPosition,
  SortKey,
  TraitKind,
} from '@atlas/core';
import type { PageTab } from './page-tab';
import type { SlotChoice } from './slot-choices';

const numberFormat = new Intl.NumberFormat('en-US');
const formatCount = (count: number): string => numberFormat.format(count);

const creatureLabel = (member: MemberIndex): string => `Creature ${String(member + 1)}`;
const slotNames = { innate: 'Innate', fused: 'Fused', artifact: 'Artifact' } as const satisfies Record<
  SlotName,
  string
>;
/** A slot as the page names it: the creature, then the slot ("Creature 2 · Fused"). */
const slotLabel = ({ member, slot }: SlotPosition): string => `${creatureLabel(member)} · ${slotNames[slot]}`;

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
  /** After the query, before the filters: a keyboard passes the filters button by button, a hundred and more of them. */
  skipFilters: 'Skip filters',
  exploreHeading: 'Explore traits',
  /** The button fixed at the top right of a page scrolled well into the list: drawn as an arrow, so this is its name. */
  backToTop: 'Back to top',
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
  loadingParty: 'Loading the party…',
  /** The tabs that stand where the party is stacked under the list (DESIGN § Layout): one view at a time. */
  sectionsLabel: 'Sections',
  tabs: { explore: 'Explore', party: 'Party' } as const satisfies Record<PageTab, string>,
  /** The count beside the Party tab: written short for the eye, in words for a screen reader. */
  partyTabCount: (filled: number) => `${String(filled)}/18`,
  partyTabCountSpoken: (filled: number) => `${String(filled)} of 18 slots filled`,
  noResultsTitle: 'No trait matches.',
  noResultsHint: 'Check the spelling, swap an AND for an OR, or remove a chip.',
  noResultsMatchAny: 'Or switch the keywords to “Match any”.',

  /** The button that opens the filters as a sheet on a narrow screen; the count says how many are on. */
  openFilters: 'Filters',
  openFiltersActiveUnit: ' active',
  /** The button that closes the sheet: it says what the filters now show. */
  showTraits: (count: number) => `Show ${formatCount(count)} ${count === 1 ? 'trait' : 'traits'}`,
  closeSheet: 'Close',
  loadingFilters: 'Loading the filters…',
  /** Takes off every filter, and leaves the query bar, the sort and the match mode (SPEC §8.1); the count is of the filters on. */
  clearFilters: (count: number) => (count === 0 ? 'Clear filters' : `Clear filters (${String(count)})`),
  clearedFilters: (count: number) => `Cleared ${String(count)} ${count === 1 ? 'filter' : 'filters'}.`,
  classHeading: 'Class',
  classHint: 'any of',
  keywordsHeading: 'Keywords',
  keywordModeLabel: 'Keyword match mode',
  keywordModes: { all: 'Match all', any: 'Match any' } as const satisfies Record<KeywordMode, string>,
  keywordKinds: {
    debuff: 'Debuffs',
    buff: 'Buffs',
    effect: 'Effects',
    event: 'Events',
    mechanic: 'Mechanics',
  } as const satisfies Record<FacetKeywordKind, string>,
  /** The two sides of a buff, a debuff or an effect: what a trait does with it (GAME_RULES R9 has a third, not a filter). */
  keywordSides: { applies: 'Applies', uses: 'Relies on' } as const,
  flagsHeading: 'Flags',
  /** On a shut section of the filter panel, beside its name: how many of the filters inside are on. */
  sectionActive: (count: number) => `${String(count)} on`,
  flagArtifactEligible: 'Artifact-eligible (has material)',
  flagDoesNotStack: 'Only “does not stack”',
  /** What follows a count in a facet button for a screen reader: the number alone does not say what it counts. */
  facetCount: (count: number) => formatCount(count),
  facetCountUnit: ' traits',

  chipsLabel: 'Filters and query terms',
  noChips: 'No filters yet. Type a query or pick filters.',
  removeChip: (term: string) => `Remove ${term}`,
  /** A query term is a button: it flips the term between included and excluded, and its name says what a press does. */
  toggleChip: (term: string, excluded: boolean) => `${term} — ${excluded ? 'include it again' : 'exclude it'}`,
  excludedTag: 'NOT',

  effectiveQueryLabel: 'Effective query',
  copyQuery: 'Copy query',
  copiedQuery: 'Copied',
  copyFailed: 'Could not copy — select the text instead',
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

  creatureLabel,
  slotNames,
  slotLabel,
  partyFilled: (filled: number) => `${String(filled)}/18 slots`,
  partyToolbarLabel: 'Party actions',
  undo: 'Undo',
  redo: 'Redo',
  clearParty: 'Clear party',
  noCreatureYet: 'No creature yet',
  emptySlot: 'Empty',
  targetTag: 'Target',
  /** A slot that holds an id the dataset has no trait for (SPEC §5): the version it was looked for in. */
  notFoundIn: (version: string) => `Not found in v${version}`,
  searchForLost: (name: string) => `Search for “${name}”`,
  copyLink: 'Copy link',
  linkCopied: 'Link copied',
  copyLinkFailed: 'Could not copy — select the link instead',
  /** A slot is a toggle that makes it the target; its name says which slot and what it holds. */
  targetSlot: (at: SlotPosition, held: string | undefined) => `Target slot: ${slotLabel(at)}, ${held ?? 'empty'}`,
  clearSlot: (at: SlotPosition, held: string) => `Clear ${slotLabel(at)} (${held})`,
  /** The "add" button of a result: it puts the trait in the target slot. */
  addTo: (at: SlotPosition) => `Add to ${slotLabel(at)}`,
  /** The name of that button, which says the trait too (a phone shows no words on it, and a list of them must tell them apart). */
  addToTrait: (at: SlotPosition, name: string) => `Add to ${slotLabel(at)} — ${name}`,
  /**
   * The "add" button of a trait the target slot refuses but another slot of the creature takes: it opens the choice of slot
   * (the sentence under the card says why the target will not do). A phone draws dots, so its name carries the words.
   */
  addToElsewhere: 'Add to…',
  addToElsewhereTrait: (name: string) => `Add to… — ${name}`,
  /** The sheet that opens: the creature is the target's, and the slots listed are its own. */
  chooseSlotTitle: (name: string, member: MemberIndex) => `Add ${name} to ${creatureLabel(member)}`,
  /** One slot of that sheet: what pressing it does, and what is in the slot now (it would be replaced). */
  slotChoice: ({ position, holds }: SlotChoice) => {
    const slot = slotNames[position.slot];
    switch (holds.kind) {
      case 'empty':
        return `Add to ${slot} (empty)`;
      case 'other':
        return `Replace ${holds.name} in ${slot}`;
      case 'this':
        return `Already in ${slot}`;
    }
  },
  cancel: 'Cancel',
  inParty: (places: readonly string[]) => `In party: ${places.join(', ')}`,
  partyAnnouncements: {
    /** `replaced` is the name of the trait the slot held, when it held one: every add says it. */
    added: (name: string, at: SlotPosition, replaced?: string) =>
      `Added ${name} to ${slotLabel(at)}${replaced === undefined ? '' : `, replacing ${replaced}`}.`,
    undid: (edit: string) => `Undid: ${edit}.`,
    redid: (edit: string) => `Redid: ${edit}.`,
  },
  /** An edit of the party in the past tense, for the announcement of an undo or a redo. */
  partyEdit: (command: PartyCommand) => {
    switch (command.type) {
      case 'place-trait':
        return `added ${command.trait.name} to ${slotLabel(command.at)}`;
      case 'clear-slot':
        return `cleared ${slotLabel(command.at)}`;
      case 'clear-party':
        return 'cleared the party';
    }
  },
  clearedSlot: (at: SlotPosition) => `Cleared ${slotLabel(at)}.`,
  clearedParty: 'Cleared the party.',

  coverageHeading: 'Coverage',
  coverageApplies: 'Applies',
  coverageRelies: 'Relies on',
  coverageNothing: 'Nothing yet',
  covered: 'covered',
  missing: 'missing',
  /** A dependency of the party: a button that shows the traits that could apply the keyword. */
  dependency: (label: string, status: 'covered' | 'missing') => `${label} — ${status} — show traits that apply it`,
  duplicatesHeading: 'Duplicate non-stacking traits',
  duplicate: (name: string, places: readonly string[]) =>
    `${name} (${places.join(', ')}) — only one copy has an effect`,

  unofficial: 'Unofficial fan project, not affiliated with Thylacine Studios.',
  dataCreditBefore: 'Trait data comes from the community ',
  compendiumName: 'Siralim Ultimate Compendium',
  dataCreditAfter: '. All credit to its authors and contributors.',
  compendiumUrl: 'https://docs.google.com/spreadsheets/d/1qvWwf1fNB5jN8bJ8dFGAVzC7scgDCoBO-hglwjTT4iY/',
} as const;
