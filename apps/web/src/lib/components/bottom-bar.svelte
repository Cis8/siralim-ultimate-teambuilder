<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The bar fixed to the foot of a narrow screen (DESIGN § Layout) that holds the places of the app: the tabs of Explore and a
   * link to the Synergies, or the three links of the Synergy pages. It is a `nav` when it has a `label` and a plain box when its
   * content names itself (a tab list). It leaves room for itself at the foot of the page (`--tab-bar-height`, see base.css), and is
   * not there from 1100 px, where the header carries the same places. Its items are `.bar-item`s: tabs and links look alike.
   */
  const { label, children }: { label?: string; children: Snippet } = $props();
</script>

<svelte:element this={label === undefined ? 'div' : 'nav'} class="bottom-bar" aria-label={label}>
  {@render children()}
</svelte:element>

<style>
  .bottom-bar {
    display: none;
  }

  @media (width < 1100px) {
    /* The bar covers the foot of the window: the root takes its height into the room it leaves at the foot (see base.css). */
    :global(:root:has(.bottom-bar)) {
      --tab-bar-height: 64px;
    }

    .bottom-bar {
      position: fixed;
      inset: auto 0 0;
      z-index: 6;
      display: flex;
      height: var(--tab-bar-height);
      border-top: 1px solid var(--border);
      background: var(--bg-bar);
    }
  }

  .bottom-bar :global(.bar-item) {
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
    text-decoration: none;
    cursor: pointer;
  }

  /* Each item fills the width of the bar to its edge: the ring goes inside it. */
  .bottom-bar :global(.bar-item:focus-visible) {
    outline-offset: -4px;
  }

  /* Colour is not all that tells the item apart: it has a rule above it and its name is heavier. */
  .bottom-bar :global(.bar-item[aria-selected='true']),
  .bottom-bar :global(.bar-item[aria-current='page']) {
    border-top-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }
</style>
