<script lang="ts">
  import { copy } from '../copy';
  import { PAGE_TABS, panelId, tabForKey, tabId, type PageTab } from '../page-tab';

  /**
   * The views of a narrow screen as tabs at the foot of the window (DESIGN § Layout, ARIA tabs pattern): the selected tab is
   * the one in the tab order, the arrows, Home and End move along them and select as they go, and each tab names the panel it
   * shows. The page keeps the panels; this says which is on screen and asks for another. It leaves room for itself at the
   * foot of the page (`--tab-bar-height`).
   */
  const {
    selected,
    partyFilled,
    onselect,
  }: { selected: PageTab; partyFilled: number; onselect: (tab: PageTab) => void } = $props();

  const buttons: Partial<Record<PageTab, HTMLButtonElement>> = {};

  function onkeydown(event: KeyboardEvent): void {
    const next = tabForKey(event.key, selected);
    if (next === undefined) return;
    event.preventDefault();
    buttons[next]?.focus();
    onselect(next);
  }
</script>

<div class="tab-bar" role="tablist" aria-label={copy.sectionsLabel}>
  {#each PAGE_TABS as tab (tab)}
    <button
      type="button"
      role="tab"
      id={tabId(tab)}
      aria-selected={tab === selected}
      aria-controls={panelId(tab)}
      tabindex={tab === selected ? 0 : -1}
      bind:this={buttons[tab]}
      {onkeydown}
      onclick={() => {
        onselect(tab);
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        {#if tab === 'explore'}
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        {:else}
          <g fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="4" width="7" height="7" rx="1.5" />
            <rect x="14" y="4" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </g>
        {/if}
      </svg>
      <span class="name">
        {copy.tabs[tab]}
        {#if tab === 'party'}
          <span class="count" aria-hidden="true">{copy.partyTabCount(partyFilled)}</span>
          <span class="visually-hidden">{copy.partyTabCountSpoken(partyFilled)}</span>
        {/if}
      </span>
    </button>
  {/each}
</div>

<style>
  /* The bar covers the foot of the window: the root takes its height into the room it leaves at the foot (see base.css). */
  :global(:root:has(.tab-bar)) {
    --tab-bar-height: 64px;
  }

  .tab-bar {
    position: fixed;
    inset: auto 0 0;
    z-index: 6;
    display: flex;
    height: var(--tab-bar-height);
    border-top: 1px solid var(--border);
    background: var(--bg-bar);
  }

  button {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: var(--target-min);
    border: 0;
    border-top: 2px solid transparent;
    background: none;
    color: var(--text-faint);
    font: inherit;
    font-size: 11.5px;
    cursor: pointer;
  }

  /* Each tab fills the width of the bar to its edge: the ring goes inside it. */
  button:focus-visible {
    outline-offset: -4px;
  }

  /* Colour is not all that tells the tab apart: it has a rule above it and its name is heavier. */
  button[aria-selected='true'] {
    border-top-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }

  .count {
    font-family: var(--font-mono);
    font-size: 11px;
  }
</style>
