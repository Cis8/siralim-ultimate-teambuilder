<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { onMount, tick } from 'svelte';
  import {
    addTrait,
    chooseTarget,
    clearParty,
    clearSlot,
    clickKeyword,
    createPlanner,
    decodeExploreState,
    decodePartyState,
    initialExploreState,
    isClickOn,
    redoEdit,
    samePartyState,
    slotRules,
    SLOT_POSITIONS,
    SORT_KEYS,
    traitAt,
    undoEdit,
    type ClickedKeyword,
    type ExploreState,
    type Planner,
    type SearchService,
    type SlotPosition,
    type SortKey,
    type Trait,
    type TraitLookup,
  } from '@atlas/core';
  import ChipRow from '../lib/components/chip-row.svelte';
  import EffectiveQuery from '../lib/components/effective-query.svelte';
  import FacetPanel from '../lib/components/facet-panel.svelte';
  import PartyPanel from '../lib/components/party-panel.svelte';
  import QueryInput from '../lib/components/query-input.svelte';
  import ResultCount from '../lib/components/result-count.svelte';
  import ResultsList from '../lib/components/results-list.svelte';
  import { loadSearchService } from '../lib/composition-root';
  import { copy } from '../lib/copy';
  import type { KeywordActions } from '../lib/keyword-actions';
  import type { PageState } from '../lib/page-state';
  import { createPageUrlWriter } from '../lib/page-url-writer';
  import type { PartyActions } from '../lib/party-actions';
  import { undoShortcut } from '../lib/undo-shortcut';
  import { trackViewportOffset } from '../lib/viewport-offset';

  let service = $state.raw<SearchService>();
  let failed = $state(false);
  let explore = $state.raw<ExploreState>(initialExploreState);
  let planner = $state.raw<Planner>(createPlanner());
  /** What the party panel tells a screen reader about the last change. */
  let partyMessage = $state('');
  /** The version of the dataset the address stated for its party: written back as it was while the data loads. */
  let linkedVersion = $state<string | null>(null);
  let resultsHeading = $state<HTMLHeadingElement>();
  let resultsSection = $state<HTMLElement>();

  /**
   * A click on a keyword far down the list swaps the list for another: it is shown from its first trait, and the focus,
   * which the row it was on may not outlive, goes to the start of it.
   */
  async function showResultsFromTheStart(): Promise<void> {
    await tick();
    window.scrollTo({ top: 0 });
    resultsHeading?.focus({ preventScroll: true });
  }

  /**
   * A filter or a chip changed beside a list that the page is scrolled into: the new list starts over, so the page goes
   * back to where it begins. The focus stays on the control that was pressed, and a page that is not past the list (the
   * filters are above it on a narrow screen) stays where it is, so that the control does not move under the pointer.
   */
  async function showResultsFromTheTop(): Promise<void> {
    await tick();
    const top = (resultsSection?.getBoundingClientRect().top ?? 0) + window.scrollY;
    if (window.scrollY > top) window.scrollTo({ top });
  }

  /** Everything the address stands for: the search and the party, under the version of the dataset in use. */
  function pageState(): PageState {
    return {
      explore,
      party: { party: planner.history.party, target: planner.target },
      datasetVersion: service?.datasetVersion ?? linkedVersion,
    };
  }

  /**
   * The address is the source of truth (ADR-0005): the state is read from it when the page opens and when the browser
   * goes to another address, and every change of the state is written to it. A write is a navigation to the same page,
   * so it leaves the scroll and the focus where they are (`reset: false`).
   */
  const urlWriter = createPageUrlWriter({
    current: () => new URL(page.url.href),
    go: (url, entry) =>
      goto(resolve(url.search === '' ? '/' : `/?${url.search.slice(1)}`), {
        replace: entry === 'replace',
        reset: false,
      }),
  });

  afterNavigate(({ type, to }) => {
    // The page wrote that address itself (`goto`): the state is already what it says.
    if (type === 'goto' || to === null) return;
    urlWriter.arrived(to.url);
    explore = decodeExploreState(to.url.searchParams);
    const shared = decodePartyState(to.url.searchParams);
    linkedVersion = shared.datasetVersion;
    // The same party as before (back to an entry that differed in the search only) keeps what can be undone.
    if (!samePartyState({ party: planner.history.party, target: planner.target }, shared)) {
      planner = createPlanner(shared);
    }
    if (type !== 'enter') void showResultsFromTheTop();
  });

  /** The state changed by a choice (a facet, a chip, a keyword, the sort): a history entry of its own. */
  function chosen(next: ExploreState): void {
    explore = next;
    urlWriter.chosen(pageState());
  }

  function exploreChanged(next: ExploreState): void {
    chosen(next);
    void showResultsFromTheTop();
  }

  const keywordActions: KeywordActions = {
    isOn: (keyword) => isClickOn(explore, keyword),
    click: (keyword) => {
      chosen(clickKeyword(explore, keyword));
      void showResultsFromTheStart();
    },
  };

  /** An edit of the party, told to the address as a step of its own and to a screen reader in words. */
  function edited(next: Planner, announcement: string): void {
    planner = next;
    partyMessage = announcement;
    urlWriter.chosen(pageState());
  }

  function addToParty(trait: Trait): void {
    const placedAt = planner.target;
    const result = addTrait(planner, trait);
    if (!result.ok) {
      partyMessage = result.reason;
      return;
    }
    if (result.planner !== planner) edited(result.planner, copy.partyAnnouncements.added(trait.name, placedAt));
  }

  function clearPartySlot(at: SlotPosition): void {
    const next = clearSlot(planner, at);
    if (next !== planner) edited(next, copy.clearedSlot(at));
  }

  function clearWholeParty(): void {
    const next = clearParty(planner);
    if (next !== planner) edited(next, copy.clearedParty);
  }

  function undoParty(): void {
    const edit = planner.history.done.at(-1);
    if (edit !== undefined) edited(undoEdit(planner), copy.partyAnnouncements.undid(copy.partyEdit(edit.command)));
  }

  function redoParty(): void {
    const edit = planner.history.undone.at(-1);
    if (edit !== undefined) edited(redoEdit(planner), copy.partyAnnouncements.redid(copy.partyEdit(edit.command)));
  }

  /** Choosing the slot results go to is part of the address, but no step of its own: the entry is replaced. */
  function chooseSlot(at: SlotPosition): void {
    const next = chooseTarget(planner, at);
    if (next === planner) return;
    planner = next;
    urlWriter.refined(pageState());
  }

  /** Ctrl+Z / Ctrl+Shift+Z undo and redo the party, but not in a field where the keys undo the typing. */
  function onKeydown(event: KeyboardEvent): void {
    const shortcut = undoShortcut({
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      target: event.target instanceof HTMLElement ? event.target : null,
    });
    if (shortcut === undefined) return;
    event.preventDefault();
    if (shortcut === 'undo') undoParty();
    else redoParty();
  }

  /** A click on a missing dependency of the party shows the traits that apply it, as a click on a keyword does. */
  function findAppliers(keyword: ClickedKeyword): void {
    chosen(clickKeyword(explore, keyword));
    void showResultsFromTheStart();
  }

  const lookup: TraitLookup = (id) => service?.trait(id);

  const partyActions: PartyActions = {
    get target() {
      return planner.target;
    },
    refusal: (trait) => {
      const placement = slotRules.canPlace(trait, planner.target.slot);
      return placement.ok ? null : placement.reason;
    },
    add: addToParty,
    placesOf: (trait) => SLOT_POSITIONS.filter((at) => traitAt(planner.history.party, at) === trait.id),
  };

  /** What the page shows once the data is loaded: the search of the current state, and the dataset it ran on. */
  const loaded = $derived(
    service && { outcome: service.search(explore), total: service.traitCount, version: service.datasetVersion },
  );

  const isSortKey = (value: string): value is SortKey => SORT_KEYS.some((key) => key === value);

  onMount(() => {
    loadSearchService().then(
      (searchService) => {
        service = searchService;
      },
      () => {
        failed = true;
      },
    );
  });
</script>

<svelte:head>
  <title>{copy.pageTitle}</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<h1 class="visually-hidden">{copy.exploreHeading}</h1>

<div class="query-section">
  <search>
    <QueryInput
      value={explore.query}
      onchange={(query: string) => {
        explore = { ...explore, query };
        urlWriter.typed(pageState());
      }}
    />
  </search>
  <ChipRow {explore} onchange={exploreChanged} />
  <div class="meta">
    {#if loaded}
      <ResultCount shown={loaded.outcome.traits.length} total={loaded.total} />
      <span class="dataset">{copy.datasetVersion(loaded.version)}</span>
      <a class="stacked-link" href="#party-heading">{copy.jumpToParty}</a>
      <label class="sort">
        {copy.sortLabel}
        <select
          value={explore.sort}
          onchange={(event) => {
            const sort = event.currentTarget.value;
            if (isSortKey(sort)) chosen({ ...explore, sort });
          }}
        >
          {#each SORT_KEYS as key (key)}
            <option value={key}>{copy.sortOptions[key]}</option>
          {/each}
        </select>
      </label>
    {/if}
  </div>
  {#if loaded}<EffectiveQuery query={loaded.outcome.effectiveQuery} />{/if}
</div>

<div class="columns" {@attach trackViewportOffset}>
  <section class="filters" aria-labelledby="filters-heading">
    <div class="filters-body">
      <h2 id="filters-heading">{copy.filtersHeading}</h2>
      {#if loaded}
        <FacetPanel facets={loaded.outcome.facets} {explore} onchange={exploreChanged} />
      {:else if !failed}
        <p class="soon">{copy.loadingFilters}</p>
      {/if}
    </div>
  </section>

  <section class="results" aria-labelledby="results-heading" bind:this={resultsSection}>
    <h2 id="results-heading" class="visually-hidden" tabindex="-1" bind:this={resultsHeading}>{copy.resultsHeading}</h2>
    {#if failed}
      <p class="status failed" role="alert">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
          <path d="M8 6v4M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        {copy.traitsFailed}
      </p>
    {:else if loaded === undefined}
      <p class="status" role="status">{copy.loadingTraits}</p>
    {:else}
      <ResultsList
        traits={loaded.outcome.traits}
        highlight={loaded.outcome.highlight}
        actions={keywordActions}
        party={partyActions}
        suggestMatchAny={explore.keywordMode === 'all' && explore.keywords.length > 1}
      />
    {/if}
  </section>

  <section class="panel party" aria-labelledby="party-heading">
    <h2 id="party-heading" tabindex="-1">{copy.partyHeading}</h2>
    <a class="stacked-link" href="#results-heading">{copy.backToResults}</a>
    {#if loaded}
      <PartyPanel
        {planner}
        {lookup}
        onchoose={chooseSlot}
        onclear={clearPartySlot}
        onclearall={clearWholeParty}
        onundo={undoParty}
        onredo={redoParty}
        onfind={findAppliers}
      />
    {:else if !failed}
      <p class="soon">{copy.loadingParty}</p>
    {/if}
    <p class="visually-hidden" aria-live="polite">{partyMessage}</p>
  </section>
</div>

<style>
  .query-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--border);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    min-height: 32px;
    color: var(--text-muted);
    font-size: 12.5px;
  }

  .dataset {
    font-family: var(--font-mono);
    color: var(--text-faint);
  }

  /* Only where the party is stacked under the list, which is where it cannot be seen from the results. */
  .stacked-link {
    display: none;
    align-items: center;
    min-height: 28px;
  }

  .sort {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  select {
    min-height: 32px;
    padding: 0 6px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-3);
    color: var(--text);
    font: inherit;
  }

  /* Facets | results | party, wrapping as the window narrows. The order of the sections is the order of the tab key. */
  .columns {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(250px, 300px) minmax(0, 1fr) minmax(340px, 400px);
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
  }

  .filters {
    border-right: 1px solid var(--border);
  }

  /*
   * The list is long and the page scrolls, so the filters stay in view beside it, with a scroll of their own when they are
   * taller than what the window shows of them (the part under the query section until the page is scrolled past it, see
   * `trackViewportOffset`). The rule between the columns is on the column, which is as tall as the list.
   */
  .filters-body {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: calc(100dvh - var(--viewport-offset, 0px));
    padding: 16px;
    overflow-y: auto;
  }

  .party {
    border-left: 1px solid var(--border);
    background: var(--bg-bar);
  }

  h2 {
    margin: 0;
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .soon {
    margin: 0;
    color: var(--text-faint);
  }

  .status {
    margin: 0;
    padding: 16px 20px;
    color: var(--text-faint);
  }

  .failed {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--status-crit);
  }

  @media (max-width: 1099px) {
    .columns {
      grid-template-columns: minmax(250px, 300px) minmax(0, 1fr);
    }

    .stacked-link {
      display: inline-flex;
    }

    .party {
      grid-column: 1 / -1;
      border-top: 1px solid var(--border);
      border-left: 0;
    }
  }

  @media (max-width: 699px) {
    .columns {
      grid-template-columns: minmax(0, 1fr);
    }

    .filters {
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }

    /* Stacked above the list, the filters are part of the page: a bottom sheet replaces them on a phone (M7). */
    .filters-body {
      position: static;
      max-height: none;
      overflow-y: visible;
    }
  }

  @media (pointer: coarse) {
    select,
    .stacked-link {
      min-height: var(--target-min);
    }
  }
</style>
