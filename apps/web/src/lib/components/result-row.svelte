<script lang="ts">
  import { descriptionParts, type Highlighter, type Trait } from '@atlas/core';
  import { classColour } from '../class-colour';
  import { copy } from '../copy';
  import DescriptionText from './description-text.svelte';

  const { trait, highlight }: { trait: Trait; highlight: Highlighter } = $props();

  const parts = $derived(descriptionParts(trait.description, trait.keywords, highlight(trait.description)));
</script>

<article>
  <h3>
    <span class="dot" style:background={classColour(trait.class)} aria-hidden="true"></span>
    {trait.name}
  </h3>
  <p class="byline">
    <span class="creature">{trait.creature ?? copy.traitKind[trait.kind]}</span>
    <span class="origin">{trait.family} · {trait.class}</span>
  </p>
  <p class="description"><DescriptionText {parts} /></p>
  <p class="material" class:missing={trait.material === null}>
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" focusable="false">
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" fill="none" stroke="currentColor" stroke-width="2" />
    </svg>
    {trait.material ?? copy.noMaterial}
  </p>
</article>

<style>
  article {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--surface-3);
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
</style>
