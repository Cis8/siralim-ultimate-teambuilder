<script lang="ts">
  import type { Trait } from '@atlas/core';
  import { copy } from '../copy';
  import ResultRow from './result-row.svelte';

  /** Until the list is virtualised (M5.6) it draws this many rows, enough to scroll while the search narrows. */
  const ROW_LIMIT = 100;

  const { traits }: { traits: readonly Trait[] } = $props();

  const rows = $derived(traits.slice(0, ROW_LIMIT));
</script>

{#if traits.length === 0}
  <div class="empty">
    <p class="title">{copy.noResultsTitle}</p>
    <p>{copy.noResultsHint}</p>
  </div>
{:else}
  <ul>
    {#each rows as trait (trait.id)}
      <li><ResultRow {trait} /></li>
    {/each}
  </ul>
  {#if traits.length > rows.length}
    <p class="limited">{copy.resultsLimited(rows.length, traits.length)}</p>
  {/if}
{/if}

<style>
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

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

  .limited {
    margin: 0;
    padding: 16px 20px;
    color: var(--text-faint);
    font-size: 13px;
  }
</style>
