<script lang="ts">
  import type { Trait } from '@atlas/core';
  import { copy } from '../copy';
  import { synergiesOfHref } from '../synergy-links';
  import BarIcon from './bar-icon.svelte';

  /**
   * The way from a trait met in Explore to its Synergy page (13.7): a result, a filled slot of the party. The address carries the
   * party, so Back finds Explore as it was left. A result has room for the words; a slot has not, and draws the icon alone, with
   * the words as its name.
   */
  const { trait, variant }: { trait: Pick<Trait, 'id' | 'name'>; variant: 'row' | 'slot' } = $props();

  const name = $derived(copy.synergiesOf(trait.name));
  const href = $derived(synergiesOfHref(trait.id));
</script>

{#if variant === 'row'}
  <a class="synergies row" {href}><BarIcon name="synergies" size={14} /><span>{name}</span></a>
{:else}
  <a class="synergies slot" {href} aria-label={name} title={name}><BarIcon name="synergies" size={14} /></a>
{/if}

<style>
  .synergies {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }

  .row {
    gap: 6px;
    min-height: 28px;
    color: var(--accent);
    font-size: 12.5px;
  }

  .row:hover span {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .slot {
    flex: none;
    justify-content: center;
    width: 32px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-2);
    color: var(--text-muted);
  }

  .slot:hover {
    background: var(--surface-3);
  }

  @media (pointer: coarse) {
    .row {
      min-height: var(--target-min);
    }

    .slot {
      width: var(--target-min);
    }
  }
</style>
