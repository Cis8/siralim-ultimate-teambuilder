<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import type { TraitId } from '@atlas/core';
  import type { PartyActions } from '../party-actions';
  import type { RelatedCard } from '../related-sections';
  import TraitCard from './trait-card.svelte';

  /** The cards of a list of the Synergy pages that are worded already (`RelatedCard`): a real list, in the order it was ranked. */
  const {
    cards,
    party,
    hrefOf,
    linkNameOf,
    id,
  }: {
    cards: readonly RelatedCard[];
    party: PartyActions;
    hrefOf: (id: TraitId) => ResolvedPathname;
    /** What a card's link is called; none: the card's own ("Re-centre on X"). */
    linkNameOf?: ((name: string) => string) | undefined;
    /** For the button that opens the list to name what it controls. */
    id?: string | undefined;
  } = $props();
</script>

<ul {id}>
  {#each cards as card (card.trait.id)}
    <TraitCard
      trait={card.trait}
      {party}
      href={hrefOf(card.trait.id)}
      badge={card.badge}
      tier={card.tier}
      detail={card.detail}
      linkName={linkNameOf?.(card.trait.name)}
    />
  {/each}
</ul>

<style>
  ul {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
