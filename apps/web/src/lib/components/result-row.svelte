<script lang="ts">
  import { descriptionParts, type Highlighter, type Trait } from '@atlas/core';
  import { classColour } from '../class-colour';
  import { copy } from '../copy';
  import type { KeywordActions } from '../keyword-actions';
  import type { PartyActions } from '../party-actions';
  import DescriptionText from './description-text.svelte';

  const {
    trait,
    highlight,
    actions,
    party,
  }: { trait: Trait; highlight: Highlighter; actions: KeywordActions; party: PartyActions } = $props();

  const parts = $derived(descriptionParts(trait.description, trait.keywords, highlight(trait.description)));

  /**
   * Why the trait cannot go in the target slot, or `null`. The reason is on the page and tied to the button, so that a keyboard
   * or screen reader user learns why too (SPEC §8.2).
   */
  const refusal = $derived(party.refusal(trait));
  /**
   * A trait the target refuses but another slot of the creature takes: the button stays active, opens the choice of slot, and
   * says so ("Add to…"). With no slot to offer it stays in the tab order with `aria-disabled`, and a press only says why.
   */
  const chooses = $derived(refusal !== null && party.canChooseSlot(trait));
  const places = $derived(party.placesOf(trait));
  const reasonId = $derived(`add-reason-${trait.id}`);
  const addName = $derived(chooses ? copy.addToElsewhereTrait(trait.name) : copy.addToTrait(party.target, trait.name));
</script>

<!--
  A card: the name and where the trait comes from, the button that adds it, then what it does. The button comes before the
  description in the page as it does on the screen, so that the keyboard reaches it first and the keywords after it.
-->
<article>
  <div class="head">
    <h3>
      <span class="dot" style:background={classColour(trait.class)} aria-hidden="true"></span>
      {trait.name}
    </h3>
    <p class="byline">
      <span class="creature">{trait.creature ?? copy.traitKind[trait.kind]}</span>
      <span class="origin">{trait.family} · {trait.class}</span>
    </p>
  </div>

  <div class="party">
    <!-- The name says what the words on a wide screen say and the trait they are about; a phone shows the plus alone. -->
    <button
      type="button"
      class="add"
      class:chooses
      aria-label={addName}
      title={addName}
      aria-haspopup={chooses ? 'dialog' : undefined}
      aria-disabled={refusal === null || chooses ? undefined : 'true'}
      aria-describedby={refusal === null ? undefined : reasonId}
      onclick={(event) => {
        if (chooses) party.chooseSlot(trait, event.currentTarget);
        else party.add(trait);
      }}
    >
      <svg class="plus" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      </svg>
      <!-- A phone draws no words: dots stand for "somewhere else" where the plus would say "here". -->
      <svg class="dots" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
        <circle cx="5" cy="12" r="2.2" fill="currentColor" />
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        <circle cx="19" cy="12" r="2.2" fill="currentColor" />
      </svg>
      <span class="label">{chooses ? copy.addToElsewhere : copy.addTo(party.target)}</span>
    </button>
    {#if refusal !== null || places.length > 0}
      <div class="notes">
        {#if refusal !== null}
          <p class="reason" id={reasonId}>
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
              <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5" />
              <path d="M3.9 12.1 12.1 3.9" stroke="currentColor" stroke-width="1.5" />
            </svg>
            {refusal}
          </p>
        {/if}
        {#if places.length > 0}
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
            {copy.inParty(places.map(copy.slotLabel))}
          </p>
        {/if}
      </div>
    {/if}
  </div>

  <p class="description"><DescriptionText {parts} {actions} /></p>
  <p class="material" class:missing={trait.material === null}>
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" focusable="false">
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" fill="none" stroke="currentColor" stroke-width="2" />
    </svg>
    {trait.material ?? copy.noMaterial}
  </p>
</article>

<style>
  /* The party's column is as tall as the text beside it; on a phone it is gone, and the button is beside the name. */
  article {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'head party'
      'description party'
      'material party';
    gap: 6px 16px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--surface-3);
  }

  .head {
    display: flex;
    flex-direction: column;
    grid-area: head;
    gap: 6px;
    min-width: 0;
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: var(--text-strong);
    font-size: 15px;
    font-weight: 600;
  }

  .dot {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 2px;
  }

  p {
    margin: 0;
  }

  .byline {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    font-size: 13px;
  }

  .creature {
    color: var(--text);
  }

  .origin {
    color: var(--text-faint);
  }

  .description {
    grid-area: description;
    max-width: 80ch;
    font-size: 13.5px;
    line-height: 1.65;
    text-wrap: pretty;
  }

  .material {
    display: flex;
    grid-area: material;
    align-items: center;
    gap: 6px;
    color: var(--text-faint);
    font-size: 12px;
  }

  .material.missing {
    color: var(--status-crit);
  }

  .party {
    display: flex;
    flex-direction: column;
    grid-area: party;
    align-items: flex-end;
    gap: 6px;
    max-width: 22ch;
  }

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

  .notes {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }

  .add:hover {
    background: var(--surface-3);
  }

  .dots {
    display: none;
  }

  .add[aria-disabled='true'] {
    border-color: var(--border-strong);
    background: var(--surface-2);
    color: var(--text-faint);
    cursor: default;
  }

  .reason,
  .in-party {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    font-size: 11.5px;
    text-align: right;
  }

  .reason svg,
  .in-party svg {
    flex: none;
    margin-top: 2px;
  }

  .reason {
    color: var(--status-crit);
  }

  .in-party {
    color: var(--status-good);
  }

  /*
   * A phone has no column for the party: the button is a square beside the name (a plus, as the prototype has it: its name
   * says the rest), and what the party says about the trait is under the text. `display: contents` hands the button and the
   * notes to the card's own grid.
   */
  @media (max-width: 699px) {
    article {
      grid-template-areas:
        'head add'
        'description description'
        'material material'
        'notes notes';
      padding: 14px 16px;
    }

    .party {
      display: contents;
    }

    .add {
      grid-area: add;
      align-self: start;
      width: var(--target-min);
      height: var(--target-min);
      padding: 0;
    }

    .add svg {
      width: 18px;
      height: 18px;
    }

    .chooses .plus {
      display: none;
    }

    .chooses .dots {
      display: block;
    }

    .label {
      display: none;
    }

    .notes {
      grid-area: notes;
      align-items: flex-start;
    }

    .reason,
    .in-party {
      text-align: left;
    }
  }

  @media (pointer: coarse) {
    .add {
      min-height: var(--target-min);
    }
  }
</style>
