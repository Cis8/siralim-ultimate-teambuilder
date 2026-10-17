<script lang="ts">
  import type { Snippet } from 'svelte';
  import { copy } from '../copy';

  /**
   * The button inside the heading of a section of the filter panel, which opens and closes the section (SPEC §8.1). The
   * heading is the panel's, with its level and its colour, which the button takes over. Shut, it says how many filters are on
   * inside, which the section would otherwise hide; open, the filters say it themselves.
   */
  const {
    controls,
    open,
    active,
    ontoggle,
    children,
  }: { controls: string; open: boolean; active: number; ontoggle: () => void; children: Snippet } = $props();
</script>

<button type="button" aria-expanded={open} aria-controls={controls} onclick={ontoggle}>
  <svg class="chevron" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
    <path
      d="M4 6l4 4 4-4"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
  <span class="name">{@render children()}</span>
  {#if !open && active > 0}
    <span class="active"><span aria-hidden="true">·</span><span>{copy.sectionActive(active)}</span></span>
  {/if}
</button>

<style>
  button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 28px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: none;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    text-align: left;
    text-transform: inherit;
    cursor: pointer;
  }

  button:hover {
    border-color: var(--border-strong);
  }

  .chevron {
    flex: none;
  }

  /* A shut section points right, an open one down; nothing moves, so there is no motion to take away. */
  button[aria-expanded='false'] .chevron {
    transform: rotate(-90deg);
  }

  .active {
    display: flex;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    letter-spacing: normal;
    text-transform: none;
  }

  @media (pointer: coarse) {
    button {
      min-height: var(--target-min);
    }
  }
</style>
