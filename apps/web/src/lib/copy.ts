import type {
  ClickGoal,
  DiagnosticSeverity,
  EventGroup,
  FacetKeywordKind,
  KeywordActor,
  KeywordHit,
  KeywordMode,
  KeywordRole,
  MemberIndex,
  PartyCommand,
  SlotName,
  SlotPosition,
  SortKey,
  SuggestionKind,
  TraitKind,
} from '@atlas/core';
import type { WhoChoice } from './event-who';
import type { PageTab } from './page-tab';
import type { SlotChoice } from './slot-choices';

const numberFormat = new Intl.NumberFormat('en-US');
const formatCount = (count: number): string => numberFormat.format(count);

const issueCount = (count: number): string => `${formatCount(count)} ${count === 1 ? 'issue' : 'issues'}`;

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

/** The same for an event, in the words of its filters (GAME_RULES R12): a trait causes an event, reacts to it or prevents it. */
const eventRole = {
  applies: 'Causes',
  uses: 'Reacts to',
  resists: 'Prevents',
} as const satisfies Record<KeywordRole, string>;

const eventGoal = {
  ...keywordGoal,
  appliers: 'show traits that cause it',
  users: 'show traits that react to it',
} as const satisfies Record<ClickGoal, string>;

/** Who acts in the mention of an event, as the words of the "Who" control say it, for a sentence. */
const actorName = {
  self: 'this creature',
  ally: 'your creatures',
  enemy: 'enemies',
  any: 'any creature',
} as const satisfies Record<KeywordActor, string>;

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
  /** The badge inside the search field: it opens and shuts the list of what is wrong with the query. */
  issueCount,
  issuesLabel: 'Query issues',
  issueSeverity: { error: 'Error', warning: 'Warning' } as const satisfies Record<DiagnosticSeverity, string>,
  /** The line under the list when it leaves some issues out. */
  moreIssues: (count: number) => `and ${formatCount(count)} more`,
  /** What a screen reader is told (a polite line): the count after a pause in the typing, and the result of a fix at once. */
  noIssues: 'No issues',
  issuesFixed: (left: number) => (left === 0 ? 'Fixed. No issues left.' : `Fixed. ${issueCount(left)} left.`),
  /** The list of suggestions under a field (QUERY_LANGUAGE §6): its name, and what a screen reader is told of its size (a polite line). */
  suggestionsLabel: 'Suggestions',
  suggestionCount: (count: number) => `${formatCount(count)} ${count === 1 ? 'suggestion' : 'suggestions'}`,
  /** The word in the badge of a suggestion: what it is, so that its colour never says it alone. */
  suggestionKinds: {
    debuff: 'Debuff',
    buff: 'Buff',
    effect: 'Effect',
    event: 'Event',
    mechanic: 'Mechanic',
    flag: 'Flag',
    class: 'Class',
    family: 'Family',
    creature: 'Creature',
    trait: 'Trait',
    value: 'Value',
    field: 'Field',
    operator: 'Operator',
    actor: 'Actor',
    text: 'Text',
  } as const satisfies Record<SuggestionKind, string>,
  /** How many traits a suggestion finds: the number as it is drawn at the end of the row, and the unit a screen reader reads after it. */
  suggestionFinds: (count: number) => ({ number: formatCount(count), unit: count === 1 ? 'trait' : 'traits' }),
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
  /** The header of a wide screen, and the foot of a narrow one on the Synergy pages: the same three places (ADR-0011). */
  pagesLabel: 'Pages',
  pages: { explore: 'Explore', synergies: 'Synergies', party: 'Party' } as const,

  /** The Synergy explorer (M13). */
  synergyPageTitle: 'Synergies — Trait Atlas',
  synergyHeading: 'Synergies',
  synergyIntro:
    'Pick a trait to see what it relies on and which traits can supply it, or start from a keyword to see who applies it and who relies on it.',
  loadingSynergies: 'Loading the traits…',
  /** The field that picks the trait to look at (the list under it is a combobox, like the search's). */
  findTraitLabel: 'Find a trait',
  findTraitPlaceholder: 'A trait, a creature or a family',
  findTraitSuggestions: 'Matching traits',
  /** The detail beside a trait in that list: what tells two traits of one name apart. */
  traitOrigin: (creature: string | null, family: string, className: string, kind: TraitKind): string =>
    `${creature ?? copy.traitKind[kind]} · ${family} · ${className}`,
  startFromParty: 'Start from your party',
  partyForSynergy: 'Pick a trait of your party:',
  emptyPartyForSynergy: 'Your party is empty. Add traits in Explore, and they are listed here.',
  goToExplore: 'Go to Explore',
  startFromKeyword: 'Start from a keyword',
  keywordPickerIntro: 'The buffs, debuffs and effects that traits give and rely on:',
  keywordGroups: { debuff: 'Debuffs', buff: 'Buffs', effect: 'Effects' } as const,
  traitNotFoundTitle: 'Trait not found',
  traitNotFound: (id: string, version: string) =>
    `Compendium v${version} has no trait with the id “${id}”. It may have been renamed or removed since this link was made.`,
  similarTraits: 'Traits with a similar name',
  noSimilarTraits: 'No trait has a similar name.',
  searchAgain: 'Search again',
  keywordNotFoundTitle: 'Keyword not found',
  keywordNotFound: (slug: string) =>
    `“${slug}” is not a buff, debuff or effect that traits give or rely on. Pick one from the list.`,
  /** The title of a page under Synergies, which a screen reader hears when the page changes. */
  synergyDocument: (title: string) => `${title} — Synergies — Trait Atlas`,
  keywordKindName: { debuff: 'Debuff', buff: 'Buff', effect: 'Effect' } as const,
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
  /** The two sides of an event: a trait causes it, or pays off when it happens (GAME_RULES R12 has a third, not a filter). */
  eventSides: { applies: 'Causes', uses: 'Reacts' } as const,
  /** The headings of the five groups of events (the semicolons of the list in GAME_RULES R12). */
  eventGroups: {
    battle: 'Battle and turns',
    actions: 'Actions',
    hits: 'Hits',
    life: 'Life and death',
    buffs: 'Buffs and debuffs',
  } as const satisfies Record<EventGroup, string>,
  /** The control that sets who acts in the event filters (a toggle for each actor and "Any"), and its four choices. */
  whoLabel: 'Who acts',
  whoChoices: {
    anyone: 'Any',
    self: 'This creature',
    ally: 'Your creatures',
    enemy: 'Enemies',
  } as const satisfies Record<WhoChoice, string>,
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
  /**
   * The name of a keyword in a description, a button: what the trait does with it, who acts if the text says (an event), then
   * what a click shows. `text` is what the description says there.
   */
  keywordButton: (
    { kind, role, actor }: Pick<KeywordHit, 'kind' | 'role' | 'actor'>,
    text: string,
    goal: ClickGoal,
  ) => {
    const isEvent = kind === 'event';
    const roleName = role === undefined ? '' : `${(isEvent ? eventRole : keywordRole)[role]} `;
    const who = actor === undefined ? '' : ` (${actorName[actor]})`;
    return `${roleName}${text}${who} — ${(isEvent ? eventGoal : keywordGoal)[goal]}`;
  },
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
