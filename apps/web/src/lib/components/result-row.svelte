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
   * Why the trait cannot go in the target slot, or `null`. The button stays in the tab order with `aria-disabled` and the
   * reason is on the page and tied to it, so that a keyboard or screen reader user learns why too (SPEC §8.2).
   */
  const refusal = $derived(party.refusal(trait));
  const places = $derived(party.placesOf(trait));
  const reasonId = $derived(`add-reason-${trait.id}`);
</script>

<article>
  <div class="trait">
    <h3>
      <span class="dot" style:background={classColour(trait.class)} aria-hidden="true"></span>
      {trait.name}
    </h3>
    <p class="byline">
      <span class="creature">{trait.creature ?? copy.traitKind[trait.kind]}</span>
      <span class="origin">{trait.family} · {trait.class}</span>
    </p>
    <p class="description"><DescriptionText {parts} {actions} /></p>
    <p class="material" class:missing={trait.material === null}>
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" focusable="false">
        <path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M4 7.5 12 12l8-4.5M12 12v9" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
      {trait.material ?? copy.noMaterial}
    </p>
  </div>

  <div class="party">
    <button
      type="button"
      class="add"
      aria-disabled={refusal === null ? undefined : 'true'}
      aria-describedby={refusal === null ? undefined : reasonId}
      onclick={() => {
        party.add(trait);
      }}
    >
      <span aria-hidden="true">+</span>
      {copy.addTo(party.target)}<span class="visually-hidden"> — {trait.name}</span>
    </button>
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
</article>

<style>
  article {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 16px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--surface-3);
  }

  .trait {
    display: flex;
    flex-direction: column;
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
    max-width: 80ch;
    font-size: 13.5px;
    line-height: 1.65;
    text-wrap: pretty;
  }

  .material {
    display: flex;
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
    align-items: flex-end;
    gap: 6px;
    max-width: 22ch;
  }

  .add {
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

  @media (max-width: 699px) {
    article {
      grid-template-columns: minmax(0, 1fr);
    }

    .party {
      align-items: flex-start;
      max-width: none;
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
