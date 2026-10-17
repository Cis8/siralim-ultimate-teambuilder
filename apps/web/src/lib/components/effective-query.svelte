<script lang="ts">
  import { copy } from '../copy';
  import CopyButton from './copy-button.svelte';

  /**
   * The query the whole state stands for, filters included, as text to read and to copy (SPEC §8.1): typed in the query
   * bar anywhere, it finds the same traits. Nothing is shown while there is no filter and no query.
   */
  const { query }: { query: string } = $props();
</script>

{#if query !== ''}
  <div class="effective">
    <span class="label">{copy.effectiveQueryLabel}</span>
    <code>{query}</code>
    <CopyButton text={query} label={copy.copyQuery} copied={copy.copiedQuery} failed={copy.copyFailed} />
  </div>
{/if}

<style>
  .effective {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    font-size: 12.5px;
  }

  .label {
    color: var(--text-faint);
  }

  code {
    flex: 1 1 280px;
    min-width: 0;
    color: var(--text);
    font-size: 12px;
    overflow-wrap: anywhere;
  }
</style>
