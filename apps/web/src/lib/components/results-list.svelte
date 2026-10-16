<script lang="ts">
  import type { Highlighter, Trait } from '@atlas/core';
  import { copy } from '../copy';
  import ResultRow from './result-row.svelte';
  import VirtualList from './virtual-list.svelte';

  /** About what a row of a few lines of description takes; the real heights are measured as rows are drawn. */
  const ESTIMATED_ROW_HEIGHT = 150;

  const { traits, highlight }: { traits: readonly Trait[]; highlight: Highlighter } = $props();

  const keys = $derived(traits.map(({ id }) => id));
</script>

{#if traits.length === 0}
  <div class="empty">
    <p class="title">{copy.noResultsTitle}</p>
    <p>{copy.noResultsHint}</p>
  </div>
{:else}
  <VirtualList {keys} estimatedHeight={ESTIMATED_ROW_HEIGHT}>
    {#snippet row(index: number)}
      {@const trait = traits[index]}
      {#if trait !== undefined}<ResultRow {trait} {highlight} />{/if}
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
