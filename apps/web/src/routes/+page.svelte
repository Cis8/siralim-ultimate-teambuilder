<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { onMount, tick } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import {
    addTrait,
    addTraitAt,
    allowedSlots,
    chooseTarget,
    clearParty,
    clearSlot,
    clickKeyword,
    createLintContext,
    createPlanner,
    decodeExploreState,
    decodePartyState,
    filledSlots,
    filterChips,
    initialExploreState,
    isClickOn,
    lintQuery,
    lostTraitSearch,
    redoEdit,
    samePartyState,
    slotRules,
    SLOT_POSITIONS,
    SORT_KEYS,
    traitAt,
    undoEdit,
    type ActorSet,
    type ClickedKeyword,
    type ExploreState,
    type FilterSection,
    type Planner,
    type SearchService,
    type SlotPosition,
    type SortKey,
    type Trait,
    type TraitId,
    type TraitLookup,
  } from '@atlas/core';
  import BackToTop from '../lib/components/back-to-top.svelte';
  import ChipRow from '../lib/components/chip-row.svelte';
  import EffectiveQuery from '../lib/components/effective-query.svelte';
  import FacetPanel from '../lib/components/facet-panel.svelte';
  import FiltersRegion from '../lib/components/filters-region.svelte';
  import PartyPanel from '../lib/components/party-panel.svelte';
  import QueryInput from '../lib/components/query-input.svelte';
  import ResultCount from '../lib/components/result-count.svelte';
  import ResultsList from '../lib/components/results-list.svelte';
  import SlotChooser from '../lib/components/slot-chooser.svelte';
  import TabBar from '../lib/components/tab-bar.svelte';
  import { showsBackToTop } from '../lib/back-to-top';
  import { loadSearchService } from '../lib/composition-root';
  import { copy } from '../lib/copy';
  import type { KeywordActions } from '../lib/keyword-actions';
  import { createLastPartyStore } from '../lib/last-party-store';
  import { pageAddress } from '../lib/page-address';
  import { pageScroll } from '../lib/page-scroll';
  import type { PageState } from '../lib/page-state';
  import { isSearchShortcut } from '../lib/search-shortcut';
  import { timeAssist } from '../lib/search-timing';
  import type { ShortcutEvent } from '../lib/shortcut-event';
  import { decodeTab, initialTab, panelId, tabId, type PageTab } from '../lib/page-tab';
  import { createPageUrlWriter } from '../lib/page-url-writer';
  import type { PartyActions } from '../lib/party-actions';
  import { slotChoices } from '../lib/slot-choices';
  import { undoShortcut } from '../lib/undo-shortcut';
  import { trackViewportOffset } from '../lib/viewport-offset';

  let service = $state.raw<SearchService>();
  let failed = $state(false);
  let explore = $state.raw<ExploreState>(initialExploreState);
  let planner = $state.raw<Planner>(createPlanner());
  /** The view a narrow screen shows. A wide one shows them all, and the tab then only rides along in the address. */
  let tab = $state<PageTab>(initialTab);
  /** What the party panel tells a screen reader about the last change. */
  let partyMessage = $state('');
  /** The version of the dataset the address stated for its party: written back as it was while the data loads. */
  let linkedVersion = $state<string | null>(null);
  let pageHeading = $state<HTMLHeadingElement>();
  let resultsHeading = $state<HTMLHeadingElement>();
  let resultsSection = $state<HTMLElement>();
  let queryField = $state<HTMLInputElement>();
  /** Whether the page is scrolled more than a screen from its top: the Back to top button is then on offer. */
  let scrolledAway = $state(false);
  /**
   * The sections of the filter panel the person shut. They are open to begin with, and this lasts as long as the page: it is no
   * part of the address or of the local storage. It is kept here because the panel is built again whenever the window crosses
   * the width where the filters change between a column and a sheet.
   */
  let shutSections = $state.raw<readonly FilterSection[]>([]);

  /**
   * The actors last chosen with the "Who" control of the Events section (none: the event whoever acts). While an event filter
   * is on, the control shows who the filters name; with none on it shows this, and the next event filter turned on is made for
   * it. It lives as long as the page, like the sections, and is no part of the address: the filters carry the actors themselves.
   */
  let eventActorsChosen = $state.raw<ActorSet>([]);

  function toggleSection(section: FilterSection): void {
    shutSections = shutSections.includes(section)
      ? shutSections.filter((shut) => shut !== section)
      : [...shutSections, section];
  }

  /**
   * Where the views stop sharing a row (the stylesheet of the page asks for the opposite, `width >= 1100px`, in its media
   * query: it cannot read this one, and the two leave no width between them). From here down the party is no longer beside
   * the list, and the views are tabs.
   */
  const tabbed = new MediaQuery('width < 1100px');
  const exploreOnScreen = $derived(!tabbed.current || tab === 'explore');
  const partyOnScreen = $derived(!tabbed.current || tab === 'party');

  /** Where the page was scrolled to when each tab was left: the tabs share the window, and each has its place in it. */
  const scrolledTo: Record<PageTab, number> = { explore: 0, party: 0 };

  function leaveTab(): void {
    if (tabbed.current) scrolledTo[tab] = window.scrollY;
  }

  /** Brings `next` forward, with the page where that tab was left (at its top the first time). */
  function showTab(next: PageTab): void {
    leaveTab();
    tab = next;
    if (!tabbed.current) return;
    void tick().then(() => {
      window.scrollTo({ top: scrolledTo[next] });
    });
  }

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
   * Back to the top of the page, and the focus with it: the button goes away as the page leaves the list, and the focus would
   * be lost with it. It goes to the heading of the page and not to the search field, which would raise the keyboard on a phone.
   * The page jumps: the list corrects the scroll as it measures the rows it passes, which stops a smooth scroll within pixels.
   */
  function backToTop(): void {
    window.scrollTo({ top: 0 });
    pageHeading?.focus({ preventScroll: true });
  }

  /** The skip link: the focus goes to the head of the results, the next stop of the tab key is the first trait. */
  function skipFilters(event: MouseEvent): void {
    event.preventDefault();
    resultsHeading?.focus();
  }

  /**
   * A filter or a chip changed beside a list that the page is scrolled into: the new list starts over, so the page goes
   * back to where it begins. The focus stays on the control that was pressed, and a page that is not past the list (the
   * filters are above it on a narrow screen) stays where it is, so that the control does not move under the pointer.
   */
  async function showResultsFromTheTop(): Promise<void> {
    await tick();
    if (!exploreOnScreen) return;
    const top = (resultsSection?.getBoundingClientRect().top ?? 0) + window.scrollY;
    if (window.scrollY > top) window.scrollTo({ top });
  }

  /** The party of the last visit (ADR-0005): a convenience, used only when the address names no party of its own. */
  const lastParty = createLastPartyStore(() => (typeof localStorage === 'undefined' ? undefined : localStorage));

  /** Everything the address stands for: the search, the party and the tab, under the version of the dataset in use. */
  function pageState(): PageState {
    return {
      explore,
      party: { party: planner.history.party, target: planner.target },
      tab,
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
    // A page that has just opened is where the browser puts it; going back to a tab finds the page as it was left.
    const arrivedAt = decodeTab(to.url.searchParams);
    const tabChanged = type !== 'enter' && arrivedAt !== tab;
    if (tabChanged) showTab(arrivedAt);
    else tab = arrivedAt;
    const shared = decodePartyState(to.url.searchParams);
    linkedVersion = shared.datasetVersion;
    // The same party as before (back to an entry that differed in the search only) keeps what can be undone.
    if (!samePartyState({ party: planner.history.party, target: planner.target }, shared)) {
      planner = createPlanner(shared);
    }
    // A visit to an address with no party starts from the one of the last visit, which the address then says.
    if (type === 'enter' && !to.url.searchParams.has('party')) {
      const remembered = lastParty.load();
      if (remembered !== undefined) {
        planner = createPlanner(remembered);
        linkedVersion = remembered.datasetVersion;
        urlWriter.refined(pageState());
      }
    }
    if (type !== 'enter' && !tabChanged) void showResultsFromTheTop();
  });

  /** A press on a tab, or a key that moves along them: a step of the history of its own. */
  function selectTab(next: PageTab): void {
    if (next === tab) return;
    showTab(next);
    urlWriter.chosen(pageState());
  }

  /** A search made from the party panel (a missing dependency, a lost trait): its results are on the Explore tab, from their start. */
  function searchFromParty(next: ExploreState): void {
    leaveTab();
    tab = 'explore';
    chosen(next);
    void showResultsFromTheStart();
  }

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

  /** Keeps the party for the next visit. */
  function remember(): void {
    lastParty.save(
      { party: planner.history.party, target: planner.target },
      service?.datasetVersion ?? linkedVersion ?? '',
    );
  }

  /** An edit of the party, told to the address as a step of its own and to a screen reader in words. */
  function edited(next: Planner, announcement: string): void {
    planner = next;
    partyMessage = announcement;
    urlWriter.chosen(pageState());
    remember();
  }

  /** What the player is told a slot held before a trait took its place: its name, or its id when the dataset has no such trait. */
  const nameOfReplaced = (id: TraitId | null): string | undefined =>
    id === null ? undefined : (service?.trait(id)?.name ?? id);

  function addToParty(trait: Trait): void {
    const placedAt = planner.target;
    const result = addTrait(planner, trait);
    if (!result.ok) {
      partyMessage = result.reason;
      return;
    }
    if (result.planner !== planner) {
      edited(result.planner, copy.partyAnnouncements.added(trait.name, placedAt, nameOfReplaced(result.replaced)));
    }
  }

  /** The trait whose slot is being chosen, while the sheet is open, and the button that opened it (the focus goes back to it). */
  let choosing = $state.raw<Trait>();
  let chooserOpener: HTMLElement | undefined;

  function openSlotChooser(trait: Trait, opener: HTMLElement): void {
    chooserOpener = opener;
    choosing = trait;
  }

  /** The sheet is shut, however: the focus goes back to the button that opened it, if its row is still on the page. */
  function chooserClosed(): void {
    choosing = undefined;
    if (chooserOpener?.isConnected === true) chooserOpener.focus();
    chooserOpener = undefined;
  }

  /**
   * The trait goes in the slot that was chosen, and the target stays where it was. The sheet is shut first and the player told
   * after: while it is open the page behind it, the live region with it, is inert and would not be heard.
   */
  async function addToChosenSlot(position: SlotPosition): Promise<void> {
    const trait = choosing;
    if (trait === undefined) return;
    choosing = undefined;
    await tick();
    const result = addTraitAt(planner, trait, position);
    if (!result.ok) {
      partyMessage = result.reason;
      return;
    }
    if (result.planner !== planner) {
      edited(result.planner, copy.partyAnnouncements.added(trait.name, position, nameOfReplaced(result.replaced)));
    }
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
    remember();
  }

  /** The slash takes the person to the search field, from the Party tab too (it is brought forward first). */
  async function focusSearch(): Promise<void> {
    if (!exploreOnScreen) {
      selectTab('explore');
      await tick();
    }
    queryField?.focus();
  }

  /**
   * Ctrl+Z / Ctrl+Shift+Z undo and redo the party, but not in a field where the keys undo the typing; the slash focuses the
   * search, but not in a field where it is a character. The key is kept from being typed into the field it has just reached.
   */
  function onKeydown(event: KeyboardEvent): void {
    const press: ShortcutEvent = {
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      target: event.target instanceof HTMLElement ? event.target : null,
    };
    if (isSearchShortcut(press)) {
      event.preventDefault();
      void focusSearch();
      return;
    }
    const shortcut = undoShortcut(press);
    if (shortcut === undefined) return;
    event.preventDefault();
    if (shortcut === 'undo') undoParty();
    else redoParty();
  }

  /** A click on a missing dependency of the party shows the traits that apply it, as a click on a keyword does. */
  function findAppliers(keyword: ClickedKeyword): void {
    searchFromParty(clickKeyword(explore, keyword));
  }

  /** The party and the search as one address, to copy: what the address bar says, without waiting for the typing to pause. */
  const shareAddress = $derived(pageAddress(new URL(page.url.href), pageState()).href);

  /** A slot holds an id the dataset has no trait for: a fresh search for the name its id keeps. */
  function findLostTrait(id: TraitId): void {
    searchFromParty({ ...initialExploreState, query: lostTraitSearch(id).query });
  }

  const lookup: TraitLookup = (id) => service?.trait(id);

  /** Why the rules refuse `trait` in the target slot, or `null`. */
  function refusalOf(trait: Trait): string | null {
    const placement = slotRules.canPlace(trait, planner.target.slot);
    return placement.ok ? null : placement.reason;
  }

  const partyActions: PartyActions = {
    get target() {
      return planner.target;
    },
    refusal: refusalOf,
    add: addToParty,
    canChooseSlot: (trait) => allowedSlots(trait).length > 0,
    chooseSlot: openSlotChooser,
    placesOf: (trait) => SLOT_POSITIONS.filter((at) => traitAt(planner.history.party, at) === trait.id),
  };

  /** The slots the sheet offers: those of the target's creature that take the trait, and what each holds now. */
  const choices = $derived(
    choosing === undefined ? [] : slotChoices(planner.history.party, planner.target.member, choosing, lookup),
  );

  /** What the page shows once the data is loaded: the search of the current state, and the dataset it ran on. */
  const loaded = $derived(
    service && { outcome: service.search(explore), total: service.traitCount, version: service.datasetVersion },
  );

  /** What is wrong with a query, once the data is there to say (QUERY_LANGUAGE §5): timed beside the search (`atlas:assist`). */
  const lint = $derived.by(() => {
    if (service === undefined) return undefined;
    const context = createLintContext(service);
    return timeAssist((source: string, caret: number | undefined) =>
      lintQuery(source, context, caret === undefined ? {} : { caret }),
    );
  });

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

    // A reload leaves the page where it was scrolled to: the button is read before the first scroll.
    const readScroll = (): void => {
      scrolledAway = showsBackToTop(window.scrollY, window.innerHeight);
    };
    readScroll();
    return pageScroll().subscribe(readScroll);
  });
</script>

<svelte:head>
  <title>{copy.pageTitle}</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<h1 class="visually-hidden" tabindex="-1" bind:this={pageHeading}>{copy.exploreHeading}</h1>

<div class="views">
  <div
    class="view explore-view"
    class:away={!exploreOnScreen}
    id={panelId('explore')}
    role={tabbed.current ? 'tabpanel' : undefined}
    aria-labelledby={tabbed.current ? tabId('explore') : undefined}
  >
    <div class="query-section">
      <search>
        <QueryInput
          bind:input={queryField}
          value={explore.query}
          {lint}
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
      <!-- Last of the query section, so that the tab key meets it before the filters (from 700 px: below it they are a sheet). -->
      {#if loaded}
        <a class="skip-filters" href="#results-heading" onclick={skipFilters}>{copy.skipFilters}</a>
      {/if}
    </div>

    <div class="columns" {@attach trackViewportOffset}>
      <FiltersRegion
        activeCount={filterChips(explore).length}
        closeLabel={loaded ? copy.showTraits(loaded.outcome.traits.length) : copy.closeSheet}
        status={loaded ? copy.resultCount(loaded.outcome.traits.length, loaded.total) : ''}
        onScreen={exploreOnScreen}
      >
        {#if loaded}
          <FacetPanel
            facets={loaded.outcome.facets}
            {explore}
            shut={shutSections}
            who={eventActorsChosen}
            onchange={exploreChanged}
            ontoggle={toggleSection}
            onwho={(actors: ActorSet) => {
              eventActorsChosen = actors;
            }}
          />
        {:else if !failed}
          <p class="soon">{copy.loadingFilters}</p>
        {/if}
      </FiltersRegion>

      <section class="results" aria-labelledby="results-heading" bind:this={resultsSection}>
        <h2 id="results-heading" class="visually-hidden" tabindex="-1" bind:this={resultsHeading}>
          {copy.resultsHeading}
        </h2>
        {#if failed}
          <p class="status failed" role="alert">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
              <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
              <path d="M8 6v4M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            {copy.traitsFailed}
          </p>
        {:else if loaded === undefined}
          <p class="status loading" role="status">{copy.loadingTraits}</p>
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
    </div>
  </div>

  <div
    class="view party-view"
    class:away={!partyOnScreen}
    id={panelId('party')}
    role={tabbed.current ? 'tabpanel' : undefined}
    aria-labelledby={tabbed.current ? tabId('party') : undefined}
  >
    <section class="panel party" aria-labelledby="party-heading">
      <h2 id="party-heading" class="panel-heading">{copy.partyHeading}</h2>
      {#if loaded}
        <PartyPanel
          {planner}
          {lookup}
          datasetVersion={loaded.version}
          address={shareAddress}
          onchoose={chooseSlot}
          onclear={clearPartySlot}
          onclearall={clearWholeParty}
          onundo={undoParty}
          onredo={redoParty}
          onfind={findAppliers}
          onfindlost={findLostTrait}
        />
      {:else if !failed}
        <p class="soon">{copy.loadingParty}</p>
      {/if}
    </section>
  </div>

  <!-- Outside the views: a change of the party made from the results is told while the party is not on screen. -->
  <p class="visually-hidden" aria-live="polite">{partyMessage}</p>
</div>

<!--
  The last control of the page's content: the list is endless to a tab key going forward (it draws more at every press), and
  the party, wide, sits at the top of the page, where the focus would scroll it away. Shift+Tab from the foot finds it here.
-->
{#if exploreOnScreen && scrolledAway}
  <BackToTop onpress={backToTop} />
{/if}

<!-- On the page and not in a row: the rows are virtualised, and a row can be gone while the sheet is open. -->
<SlotChooser
  trait={choosing}
  member={planner.target.member}
  reason={choosing === undefined ? '' : (refusalOf(choosing) ?? '')}
  {choices}
  onchoose={addToChosenSlot}
  onclose={chooserClosed}
/>

{#if tabbed.current}
  <TabBar selected={tab} partyFilled={filledSlots(planner.history.party)} onselect={selectTab} />
{/if}

<style>
  .query-section {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--border);
  }

  /* Out of sight until the tab key reaches it, then over the head of the filters, as the skip link of the page is over the header. */
  .skip-filters {
    position: absolute;
    top: -100px;
    left: 16px;
    z-index: 10;
    padding: 8px 12px;
    border-radius: var(--radius);
    background: var(--surface-3);
    color: var(--text-strong);
  }

  .skip-filters:focus {
    top: calc(100% + 4px);
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

  /*
   * Two views, Explore (the query, the facets and the results) and Party. Narrow, they are tabs: one on screen at a time,
   * one under the other in the page. The order of the sections is the order of the tab key.
   */
  .views {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  .view {
    display: flex;
    flex: 1;
    flex-direction: column;
  }

  /*
   * The view that is not shown stays laid out at its own width but takes no room, and nothing of it can be reached. It is not
   * `display: none`: the results are a virtual list, and one that is not displayed would measure every row it holds as 0 px
   * tall, losing the heights it had learnt.
   */
  .away {
    flex: none;
    height: 0;
    overflow: hidden;
    visibility: hidden;
  }

  /* Facets | results. */
  .columns {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(250px, 300px) minmax(0, 1fr);
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
  }

  .party-view {
    background: var(--bg-bar);
  }

  /* On its own the party would be as wide as the window: its slots stay a readable width. */
  .party {
    width: min(100%, 520px);
    margin-inline: auto;
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

  /*
   * The list will fill the rest of the window. Holding that room while the traits load keeps the footer below the fold, so
   * it does not jump out of view when they arrive (cumulative layout shift). The offset is set once the page is running.
   */
  .loading {
    min-height: calc(100dvh - var(--viewport-offset, 0px));
  }

  .failed {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--status-crit);
  }

  /*
   * From here up the party has a column beside the list, under the query: the views are no tabs (the page asks for the same
   * width, `tabbed`), and the view of Explore gives its parts to the grid of the page.
   */
  @media (width >= 1100px) {
    .views {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(340px, 400px);
      grid-template-rows: auto 1fr;
    }

    .explore-view {
      display: contents;
    }

    .query-section {
      grid-column: 1 / -1;
    }

    .columns {
      grid-column: 1;
      grid-row: 2;
    }

    .party-view {
      grid-column: 2;
      grid-row: 2;
      border-left: 1px solid var(--border);
    }
  }

  /* From here down the filters are a sheet (`FiltersRegion` asks for the same width): the list has the width of the window. */
  @media (max-width: 699px) {
    .columns {
      grid-template-columns: minmax(0, 1fr);
    }

    .skip-filters {
      display: none;
    }
  }

  /* A finger needs a larger target, and iOS zooms the page in when a field of less than 16 px takes the focus. */
  @media (pointer: coarse) {
    select {
      min-height: var(--target-min);
      font-size: 16px;
    }
  }
</style>
