<script lang="ts">
  import { descriptionParts, type Highlighter, type Trait } from '@atlas/core';
  import { classColour } from '../class-colour';
  import { copy } from '../copy';
  import type { KeywordActions } from '../keyword-actions';
  import type { PartyActions } from '../party-actions';
  import AddButton from './add-button.svelte';
  import DescriptionText from './description-text.svelte';
  import PartyNotes from './party-notes.svelte';

  const {
    trait,
    highlight,
    actions,
    party,
  }: { trait: Trait; highlight: Highlighter; actions: KeywordActions; party: PartyActions } = $props();

  const parts = $derived(descriptionParts(trait.description, trait.keywords, highlight(trait.description)));

  /** A trait is on the page once in Explore, so its id is the one the note that gives a refusal can be told by. */
  const reasonId = $derived(`add-reason-${trait.id}`);
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
    <div class="add-cell"><AddButton {trait} {party} variant="row" {reasonId} /></div>
    <div class="notes-cell"><PartyNotes {trait} {party} {reasonId} /></div>
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

  /* No notes, no cell: it would leave a gap of its own where the card has nothing to say. */
  .notes-cell:empty {
    display: none;
  }

  /*
   * A phone has no column for the party: the button is a square beside the name (a plus, as the prototype has it: its name
   * says the rest), and what the party says about the trait is under the text. `display: contents` hands the two cells to the
   * card's own grid.
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

    .add-cell {
      grid-area: add;
      align-self: start;
    }

    .notes-cell {
      --notes-align: flex-start;
      --notes-text-align: left;

      grid-area: notes;
    }
  }
</style>
