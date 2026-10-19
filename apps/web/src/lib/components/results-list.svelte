<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import type { Highlighter, Trait } from '@atlas/core';
  import { copy } from '../copy';
  import type { KeywordActions } from '../keyword-actions';
  import type { PartyActions } from '../party-actions';
  import ResultRow from './result-row.svelte';
  import VirtualList from './virtual-list.svelte';

  /**
   * About what a row takes: the mean of the rows of the published sheet, drawn at 1280 and at 390 px wide (the card is narrower on a
   * phone and its link to the Synergies is a finger-sized row of its own). The real heights are measured as rows are drawn; an estimate
   * far off makes the scroll bar lie and each jump to the end of the list take several rounds of measuring.
   */
  const ESTIMATED_ROW_HEIGHT = { wide: 175, narrow: 200 } as const;

  const narrow = new MediaQuery('width < 700px');

  const {
    traits,
    highlight,
    actions,
    party,
    suggestMatchAny,
  }: {
    traits: readonly Trait[];
    highlight: Highlighter;
    actions: KeywordActions;
    party: PartyActions;
    /** Several keywords must all be found: with none to show, matching any of them is the way out the empty state offers. */
    suggestMatchAny: boolean;
  } = $props();

  const keys = $derived(traits.map(({ id }) => id));
</script>

{#if traits.length === 0}
  <div class="empty">
    <p class="title">{copy.noResultsTitle}</p>
    <p>{copy.noResultsHint}{suggestMatchAny ? ` ${copy.noResultsMatchAny}` : ''}</p>
  </div>
{:else}
  <VirtualList {keys} estimatedHeight={narrow.current ? ESTIMATED_ROW_HEIGHT.narrow : ESTIMATED_ROW_HEIGHT.wide}>
    {#snippet row(index: number)}
      {@const trait = traits[index]}
      {#if trait !== undefined}<ResultRow {trait} {highlight} {actions} {party} />{/if}
    {/snippet}
  </VirtualList>
{/if}

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 48px 20px;
    color: var(--text-muted);
    text-align: center;
  }

  .empty p {
    margin: 0;
  }

  .title {
    color: var(--text-strong);
    font-size: 15px;
  }
</style>
