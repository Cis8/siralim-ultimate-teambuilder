<script lang="ts">
  import type { Trait } from '@atlas/core';
  import { copy } from '../copy';
  import type { PartyActions } from '../party-actions';
  import { addControl } from '../party-add';

  /**
   * What the party says about a trait under its "add" button: why the target slot refuses it (the sentence `AddButton` points
   * at with `reasonId`), and where the party holds it already. Nothing at all when it has neither to say.
   */
  const { trait, party, reasonId }: { trait: Trait; party: PartyActions; reasonId: string } = $props();

  const add = $derived(addControl(trait, party));
</script>

{#if add.refusal !== null || add.places.length > 0}
  <div class="notes">
    {#if add.refusal !== null}
      <p class="reason" id={reasonId}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M3.9 12.1 12.1 3.9" stroke="currentColor" stroke-width="1.5" />
        </svg>
        {add.refusal}
      </p>
    {/if}
    {#if add.places.length > 0}
      <p class="in-party">
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
          <path
            d="M3 8.5 6.5 12 13 4.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        {copy.inParty(add.places.map(copy.slotLabel))}
      </p>
    {/if}
  </div>
{/if}

<style>
  /* Against the right edge, as a column beside the text does; whoever places the notes under the text sets `--notes-align` and `--notes-text-align` to the left. */
  .notes {
    display: flex;
    flex-direction: column;
    align-items: var(--notes-align, flex-end);
    gap: 6px;
  }

  p {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    margin: 0;
    font-size: 11.5px;
    text-align: var(--notes-text-align, right);
  }

  svg {
    flex: none;
    margin-top: 2px;
  }

  .reason {
    color: var(--status-crit);
  }

  .in-party {
    color: var(--status-good);
  }
</style>
