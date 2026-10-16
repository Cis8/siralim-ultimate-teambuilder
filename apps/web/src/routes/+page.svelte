<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    clickKeyword,
    initialExploreState,
    isClickOn,
    SORT_KEYS,
    type ExploreState,
    type SearchService,
    type SortKey,
  } from '@atlas/core';
  import QueryInput from '../lib/components/query-input.svelte';
  import ResultCount from '../lib/components/result-count.svelte';
  import ResultsList from '../lib/components/results-list.svelte';
  import { loadSearchService } from '../lib/composition-root';
  import { copy } from '../lib/copy';
  import type { KeywordActions } from '../lib/keyword-actions';

  let service = $state.raw<SearchService>();
  let failed = $state(false);
  let explore = $state.raw<ExploreState>(initialExploreState);
  let resultsHeading = $state<HTMLHeadingElement>();

  /**
   * A click on a keyword far down the list swaps the list for another: it is shown from its first trait, and the focus,
   * which the row it was on may not outlive, goes to the start of it.
   */
  async function showResultsFromTheStart(): Promise<void> {
    await tick();
    window.scrollTo({ top: 0 });
    resultsHeading?.focus({ preventScroll: true });
  }

  const keywordActions: KeywordActions = {
    isOn: (keyword) => isClickOn(explore, keyword),
    click: (keyword) => {
      explore = clickKeyword(explore, keyword);
      void showResultsFromTheStart();
    },
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

<h1 class="visually-hidden">{copy.exploreHeading}</h1>

<div class="query-section">
  <search>
    <QueryInput
      value={explore.query}
      onchange={(query: string) => {
        explore = { ...explore, query };
      }}
    />
  </search>
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
            if (isSortKey(sort)) explore = { ...explore, sort };
          }}
        >
          {#each SORT_KEYS as key (key)}
            <option value={key}>{copy.sortOptions[key]}</option>
          {/each}
        </select>
      </label>
    {/if}
  </div>
</div>

<div class="columns">
  <section class="panel filters" aria-labelledby="filters-heading">
    <h2 id="filters-heading">{copy.filtersHeading}</h2>
    <p class="soon">{copy.comingSoon}</p>
  </section>

  <section class="results" aria-labelledby="results-heading">
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
      <ResultsList traits={loaded.outcome.traits} highlight={loaded.outcome.highlight} actions={keywordActions} />
    {/if}
  </section>

  <section class="panel party" aria-labelledby="party-heading">
    <h2 id="party-heading">{copy.partyHeading}</h2>
    <p class="soon">{copy.comingSoon}</p>
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
  }

  @media (pointer: coarse) {
    select {
      min-height: var(--target-min);
    }
  }
</style>
