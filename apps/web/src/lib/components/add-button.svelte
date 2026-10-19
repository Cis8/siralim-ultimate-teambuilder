<script lang="ts">
  import type { Trait } from '@atlas/core';
  import type { PartyActions } from '../party-actions';
  import { addControl, pressAdd } from '../party-add';

  /**
   * The "add" button of a trait: it puts the trait in the target slot of the party, or opens the choice of slot when the target
   * refuses it and another slot takes it (`PartyNotes` says why and where it is). Its name says the slot and the trait; the
   * variants differ in how much of it is drawn:
   * - `row`: the words from 700 px, a 44 px square with a plus under it (a result card, whose column of notes is gone there);
   * - `compact`: a square with a plus, always (the small card of a lane);
   * - `focus`: always the words (the card of the trait in focus).
   * `reasonId` is the id of the note that gives the refusal, which the button points at.
   */
  const {
    trait,
    party,
    variant,
    reasonId,
  }: { trait: Trait; party: PartyActions; variant: 'row' | 'compact' | 'focus'; reasonId: string } = $props();

  const add = $derived(addControl(trait, party));
</script>

<button
  type="button"
  class="add {variant}"
  class:chooses={add.chooses}
  aria-label={add.name}
  title={add.name}
  aria-haspopup={add.chooses ? 'dialog' : undefined}
  aria-disabled={add.refusal === null || add.chooses ? undefined : 'true'}
  aria-describedby={add.refusal === null ? undefined : reasonId}
  onclick={(event) => {
    pressAdd(trait, party, event.currentTarget);
  }}
>
  <svg class="plus" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
  </svg>
  <!-- Where there are no words, dots stand for "somewhere else" where the plus would say "here". -->
  <svg class="dots" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
    <circle cx="5" cy="12" r="2.2" fill="currentColor" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    <circle cx="19" cy="12" r="2.2" fill="currentColor" />
  </svg>
  {#if variant !== 'compact'}<span class="label">{add.label}</span>{/if}
</button>

<style>
  .add {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid var(--accent-border);
    border-radius: var(--radius);
    background: var(--accent-surface);
    color: var(--text-strong);
    font: inherit;
    font-size: 12.5px;
    cursor: pointer;
  }

  .add:hover {
    background: var(--surface-3);
  }

  .add[aria-disabled='true'] {
    border-color: var(--border-strong);
    background: var(--surface-2);
    color: var(--text-faint);
    cursor: default;
  }

  .dots {
    display: none;
  }

  /* A button with no words is a square: the plus, or the dots where the choice of slot is on offer. */
  .compact {
    flex: none;
    width: 30px;
    height: 30px;
    padding: 0;
  }

  .compact.chooses .plus {
    display: none;
  }

  .compact.chooses .dots {
    display: block;
  }

  @media (max-width: 699px) {
    .row {
      width: var(--target-min);
      height: var(--target-min);
      padding: 0;
    }

    .row svg {
      width: 18px;
      height: 18px;
    }

    .row.chooses .plus {
      display: none;
    }

    .row.chooses .dots {
      display: block;
    }

    .row .label {
      display: none;
    }
  }

  @media (pointer: coarse) {
    .add {
      min-height: var(--target-min);
    }

    .compact {
      width: var(--target-min);
    }
  }
</style>
