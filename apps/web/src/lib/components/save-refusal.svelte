<script lang="ts">
  import { copy } from '../copy';
  import type { SaveRefusalLine } from '../search-sheet';

  /**
   * Why the star did nothing (the fifty places are taken, say): plain words under the field, with the way out when there is one. It is
   * not a live region of its own: the page says the sentence through the polite line of the field.
   */
  const { refusal, onmanage }: { refusal: SaveRefusalLine; onmanage: () => void } = $props();
</script>

<p class="refusal">
  {refusal.message}
  {#if refusal.full}
    <button type="button" onclick={onmanage}>{copy.manageSearches}</button>
  {/if}
</p>

<style>
  .refusal {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    margin: 0;
    padding: 8px 12px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-2);
    color: var(--text);
    font-size: 13px;
  }

  button {
    min-height: var(--target-min);
    padding: 0 14px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--surface-3);
    color: var(--text-strong);
    font: inherit;
    cursor: pointer;
  }

  button:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
</style>
