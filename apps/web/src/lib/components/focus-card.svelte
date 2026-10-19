<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import { taxonomy, traitFacts, type KeywordKey, type Trait, type Trigger } from '@atlas/core';
  import { classColour } from '../class-colour';
  import { copy } from '../copy';
  import type { PartyActions } from '../party-actions';
  import AddButton from './add-button.svelte';
  import FocusDescription from './focus-description.svelte';
  import PartyNotes from './party-notes.svelte';

  /**
   * The trait in focus (DESIGN § Synergy pages): its name, where it comes from, its description with the keywords that lead to
   * their pages, what it relies on, applies and waits for, its material, and what can be done with it: add it to the party, or look
   * for it in Explore. The `h1` takes the focus when the page re-centres, which the page does through `heading`.
   */
  let {
    trait,
    party,
    keywordHref,
    exploreHref,
    heading = $bindable(),
  }: {
    trait: Trait;
    party: PartyActions;
    keywordHref: (key: KeywordKey) => ResolvedPathname;
    exploreHref: ResolvedPathname;
    heading?: HTMLHeadingElement | undefined;
  } = $props();

  const uid = $props.id();
  const reasonId = $derived(`${uid}-reason`);
  const facts = $derived(traitFacts(trait));

  const labelOf = (key: KeywordKey): string => taxonomy.get(key)?.label ?? key;
  const keysText = (keys: readonly KeywordKey[]): string =>
    keys.length === 0 ? copy.factNone : keys.map(labelOf).join(', ');
  const triggerText = ({ event, actor }: Trigger): string =>
    actor === undefined ? labelOf(event) : copy.triggerWithActor(labelOf(event), actor);
  const triggersText = $derived(
    facts.triggers.length === 0 ? copy.factNone : facts.triggers.map(triggerText).join(', '),
  );
</script>

<section class="focus" aria-label={copy.focusLabel}>
  <p class="caption" aria-hidden="true">{copy.focusCaption}</p>
  <header>
    <h1 tabindex="-1" bind:this={heading}>
      <span class="dot" style:background={classColour(trait.class)} aria-hidden="true"></span>
      {trait.name}
    </h1>
    <p class="origin">{copy.traitOrigin(trait.creature, trait.family, trait.class, trait.kind)}</p>
  </header>

  <p class="description"><FocusDescription {trait} hrefOf={keywordHref} /></p>

  <dl>
    <dt>{copy.factRelies}</dt>
    <dd>{keysText(facts.relies)}</dd>
    <dt>{copy.factApplies}</dt>
    <dd>{keysText(facts.applies)}</dd>
    {#if facts.guards.length > 0}
      <dt>{copy.factGuards}</dt>
      <dd>{keysText(facts.guards)}</dd>
    {/if}
    <dt>{copy.factTriggers}</dt>
    <dd>{triggersText}</dd>
    <dt>{copy.factMaterial}</dt>
    <dd class="material" class:missing={trait.material === null}>
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" focusable="false">
        <path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M4 7.5 12 12l8-4.5M12 12v9" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
      {trait.material ?? copy.noMaterial}
    </dd>
  </dl>

  <div class="actions">
    <AddButton {trait} {party} variant="focus" {reasonId} />
    <a class="explore" href={exploreHref}>{copy.openInExplore}</a>
  </div>
  <div class="notes-cell"><PartyNotes {trait} {party} {reasonId} /></div>
</section>

<style>
  .focus {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    padding: 18px;
    border: 1px solid var(--accent-border);
    border-radius: 12px;
    background: var(--surface-1);
  }

  p {
    margin: 0;
  }

  .caption {
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  h1:focus-visible {
    outline-offset: 4px;
  }

  .dot {
    display: inline-block;
    width: 11px;
    height: 11px;
    margin-inline-end: 6px;
    border-radius: 3px;
  }

  .origin {
    color: var(--text-muted);
    font-size: 13.5px;
  }

  .description {
    max-width: 62ch;
    color: var(--text);
    font-size: 14.5px;
    line-height: 1.65;
    text-wrap: pretty;
  }

  dl {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px 14px;
    margin: 0;
    font-size: 13px;
  }

  dt {
    color: var(--text-faint);
  }

  dd {
    margin: 0;
    color: var(--text);
  }

  .material {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .material.missing {
    color: var(--status-crit);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .explore {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-3);
    color: var(--text-strong);
    font-size: 12.5px;
    text-decoration: none;
  }

  .explore:hover {
    background: var(--surface-2);
  }

  .notes-cell {
    --notes-align: flex-start;
    --notes-text-align: left;
  }

  .notes-cell:empty {
    display: none;
  }

  @media (pointer: coarse) {
    .explore {
      min-height: var(--target-min);
    }
  }
</style>
