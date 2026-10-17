<script lang="ts">
  import { filterChips, queryChips, removeChip, removeFilterChip, toggleChipNot, type ExploreState } from '@atlas/core';
  import { tick } from 'svelte';
  import { copy } from '../copy';

  /**
   * The filters that are on and the terms of the query bar, a chip each (SPEC §8.1). A filter chip can be removed. A term
   * can be removed and flipped between included and excluded; both edit the text of the bar in place, which `core` does,
   * and the owner of the state gets the new state. The chips are named by their place in the lists, which `core` gives
   * again after every change, so nothing here outlives an edit.
   */
  const { explore, onchange }: { explore: ExploreState; onchange: (state: ExploreState) => void } = $props();

  let row = $state<HTMLDivElement>();

  const filters = $derived(filterChips(explore));
  const terms = $derived(queryChips(explore.query));

  const termText = (field: string | undefined, value: string): string =>
    field === undefined ? value : `${field}:${value}`;

  /**
   * A chip that goes takes the focus with it when it was the last of its list: the next chip's button gets it, or the last
   * one's, or the row itself when there is none left, so that the keyboard does not start over from the top of the page.
   */
  async function removed(at: number): Promise<void> {
    await tick();
    const buttons = row?.querySelectorAll<HTMLButtonElement>('button.remove') ?? [];
    (buttons[Math.min(at, buttons.length - 1)] ?? row)?.focus();
  }
</script>

<div class="chips" role="group" aria-label={copy.chipsLabel} tabindex="-1" bind:this={row}>
  {#each filters as chip, at (at)}
    {@const text = termText(chip.field, chip.value)}
    <span class="chip">
      <span class="body"><span class="field">{chip.field}:</span>{chip.value}</span>
      <button
        type="button"
        class="remove"
        aria-label={copy.removeChip(text)}
        title={copy.removeChip(text)}
        onclick={() => {
          onchange(removeFilterChip(explore, at));
          void removed(at);
        }}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        </svg>
      </button>
    </span>
  {/each}
  {#each terms as chip, at (at)}
    {@const text = termText(chip.field, chip.value)}
    <span class="chip" class:excluded={chip.negated}>
      <button
        type="button"
        class="body"
        aria-label={copy.toggleChip(text, chip.negated)}
        title={copy.toggleChip(text, chip.negated)}
        onclick={() => {
          onchange({ ...explore, query: toggleChipNot(explore.query, at) });
        }}
      >
        {#if chip.negated}<span class="not">{copy.excludedTag}</span>{/if}
        {#if chip.field !== undefined}<span class="field">{chip.field}:</span>{/if}{chip.value}
      </button>
      <button
        type="button"
        class="remove"
        aria-label={copy.removeChip(text)}
        title={copy.removeChip(text)}
        onclick={() => {
          onchange({ ...explore, query: removeChip(explore.query, at) });
          void removed(filters.length + at);
        }}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        </svg>
      </button>
    </span>
  {/each}
  {#if filters.length === 0 && terms.length === 0}
    <span class="none">{copy.noChips}</span>
  {/if}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-height: 30px;
  }

  .chips:focus {
    outline: none;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    height: 30px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-3);
    font-size: 12.5px;
    white-space: nowrap;
  }

  /* An excluded term says NOT in words; the tint only backs it up. */
  .excluded {
    border-color: color-mix(in srgb, var(--status-crit) 45%, var(--border-strong));
    background: color-mix(in srgb, var(--status-crit) 9%, var(--surface-2));
  }

  .body {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 100%;
    /* A one-letter term (`a`) would be narrower than the 24 px that WCAG 2.5.8 asks of a target. */
    min-width: 24px;
    padding: 0 6px 0 10px;
    border: 0;
    border-radius: var(--radius) 0 0 var(--radius);
    background: none;
    color: var(--text);
    font: inherit;
  }

  button.body {
    cursor: pointer;
  }

  button.body:hover {
    background: var(--surface-2);
  }

  .field {
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .not {
    color: var(--status-crit);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
  }

  .remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: stretch;
    width: 28px;
    padding: 0;
    border: 0;
    border-left: 1px solid var(--border-strong);
    border-radius: 0 var(--radius) var(--radius) 0;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }

  .remove:hover {
    background: var(--surface-2);
    color: var(--text-strong);
  }

  .none {
    color: var(--text-faint);
    font-size: 12.5px;
  }

  @media (pointer: coarse) {
    .chip {
      height: var(--target-min);
    }

    .remove {
      width: var(--target-min);
    }
  }
</style>
