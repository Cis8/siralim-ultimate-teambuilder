<script lang="ts">
  import type { MemberIndex, SlotPosition, Trait } from '@atlas/core';
  import { copy } from '../copy';
  import type { SlotChoice } from '../slot-choices';
  import BottomSheet from './bottom-sheet.svelte';

  /**
   * Where to put a trait the target slot refuses (SPEC §8.2): a modal sheet, on the page and not in the result's row (the rows
   * are virtualised and a row can be gone while it is open), that lists the slots of the target's creature that take the trait,
   * one button each. It is open while there is a `trait`. Each button says what it does to the slot: add to an empty one,
   * replace what is in it, or nothing (the trait is there already). `reason` is the sentence the card shows under its button.
   */
  const {
    trait,
    member,
    reason,
    choices,
    onchoose,
    onclose,
  }: {
    trait: Trait | undefined;
    member: MemberIndex;
    reason: string;
    choices: readonly SlotChoice[];
    onchoose: (position: SlotPosition) => void;
    onclose: () => void;
  } = $props();
</script>

<BottomSheet
  open={trait !== undefined}
  title={trait === undefined ? '' : copy.chooseSlotTitle(trait.name, member)}
  closeLabel={copy.cancel}
  variant="choice"
  {onclose}
>
  <p class="reason">{reason}</p>
  <ul>
    {#each choices as choice (choice.position.slot)}
      <li>
        <button
          type="button"
          onclick={() => {
            onchoose(choice.position);
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
            {#if choice.holds.kind === 'empty'}
              <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
            {:else if choice.holds.kind === 'other'}
              <path
                d="M4 9h13l-3-3M20 15H7l3 3"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            {:else}
              <path
                d="M5 12.5 10 17.5 19 7"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            {/if}
          </svg>
          {copy.slotChoice(choice)}
        </button>
      </li>
    {/each}
  </ul>
</BottomSheet>

<style>
  .reason {
    margin: 0 0 12px;
    color: var(--text-muted);
    font-size: 13.5px;
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: var(--target-min);
    padding: 8px 14px;
    border: 1px solid var(--accent-border);
    border-radius: var(--radius);
    background: var(--accent-surface);
    color: var(--text-strong);
    font: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }

  button:hover {
    background: var(--surface-3);
  }

  svg {
    flex: none;
  }
</style>
