<script lang="ts">
  /**
   * One search of the sheet that manages them: pressing it puts it in the search field, and the button beside it forgets it. A name that
   * is not the search itself (a file may carry one) is written above it.
   */
  const {
    query,
    name,
    removeLabel,
    onuse,
    onremove,
  }: {
    query: string;
    name: string;
    /** What the button that forgets the search is called. */
    removeLabel: string;
    onuse: () => void;
    onremove: () => void;
  } = $props();
</script>

<li>
  <button type="button" class="use" onclick={onuse}>
    {#if name !== query}<span class="name">{name}</span>{/if}
    <span class="query">{query}</span>
  </button>
  <button type="button" class="remove" aria-label={removeLabel} title={removeLabel} onclick={onremove}>
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    </svg>
  </button>
</li>

<style>
  li {
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid var(--border);
  }

  button {
    border: 0;
    background: none;
    color: var(--text-strong);
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background: var(--surface-3);
  }

  button:focus-visible {
    outline: var(--focus-ring);
    outline-offset: -2px;
  }

  .use {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    min-height: var(--target-min);
    padding: 8px 4px;
    text-align: left;
  }

  .name {
    color: var(--text-muted);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .query {
    font-family: var(--font-mono);
    font-size: 13.5px;
    overflow-wrap: anywhere;
  }

  .remove {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: var(--target-min);
    min-height: var(--target-min);
    color: var(--text-muted);
  }
</style>
