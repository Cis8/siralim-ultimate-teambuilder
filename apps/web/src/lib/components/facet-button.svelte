<script lang="ts">
  import type { Snippet } from 'svelte';
  import { copy } from '../copy';

  /**
   * A facet of the filter panel: a toggle button with the number of traits it would show. `row` fills the line (a class, a
   * mechanic), `compact` is one of the two sides of a keyword. The state is `aria-pressed` and a filled, outlined button;
   * the count carries its unit for a screen reader, which would hear a bare number.
   */
  const {
    pressed,
    count,
    size = 'row',
    onclick,
    children,
  }: { pressed: boolean; count: number; size?: 'row' | 'compact'; onclick: () => void; children: Snippet } = $props();
</script>

<button type="button" class={size} aria-pressed={pressed} {onclick}>
  <span class="label">{@render children()}</span>
  <span class="count">{copy.facetCount(count)}<span class="visually-hidden">{copy.facetCountUnit}</span></span>
</button>

<style>
  button {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: none;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }

  .row,
  .compact {
    width: 100%;
  }

  .compact {
    gap: 4px;
    padding: 0 6px;
    border-color: var(--border-strong);
    background: var(--surface-3);
    font-size: 12px;
  }

  button:hover {
    border-color: var(--border-strong);
  }

  button[aria-pressed='true'] {
    border-color: var(--accent-border);
    background: var(--accent-surface);
    color: var(--text-strong);
  }

  .label {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .count {
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 11.5px;
  }

  button[aria-pressed='true'] .count {
    color: var(--text-muted);
  }

  @media (pointer: coarse) {
    button {
      min-height: var(--target-min);
    }
  }
</style>
