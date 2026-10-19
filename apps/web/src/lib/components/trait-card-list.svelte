<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import type { KeyLink, KeywordKey, RelatedTrait, TraitId } from '@atlas/core';
  import { copy } from '../copy';
  import type { PartyActions } from '../party-actions';
  import TraitCard from './trait-card.svelte';

  /**
   * The cards of a lane, in the order they were ranked: a real list. A card says what ties its trait to the focus: "×2 links" when
   * it is more than one key, how it gives the key when that is not by name, and (`namesKeys`, in the lane of several keys) which keys.
   */
  const {
    entries,
    party,
    hrefOf,
    keyLabel,
    namesKeys,
  }: {
    entries: readonly RelatedTrait[];
    party: PartyActions;
    hrefOf: (id: TraitId) => ResolvedPathname;
    keyLabel: (key: KeywordKey) => string;
    namesKeys: boolean;
  } = $props();

  const badgeOf = ({ score }: RelatedTrait): string | undefined => (score > 1 ? copy.links(score) : undefined);
  const tierOf = ({ strength }: RelatedTrait): 'conditional' | 'random' | undefined =>
    strength === 'specific' ? undefined : strength;

  /** A key of the card, and how the card gives it when that is weaker than how the card gives the rest. */
  const nameOfLink = ({ key, strength }: KeyLink, card: RelatedTrait): string =>
    strength === 'specific' || strength === card.strength ? keyLabel(key) : copy.keyAs(keyLabel(key), strength);
  const detailOf = (entry: RelatedTrait): string | undefined =>
    namesKeys ? copy.linkedThrough(entry.links.map((link) => nameOfLink(link, entry)).join(' · ')) : undefined;
</script>

<ul>
  {#each entries as entry (entry.trait.id)}
    <TraitCard
      trait={entry.trait}
      {party}
      href={hrefOf(entry.trait.id)}
      badge={badgeOf(entry)}
      tier={tierOf(entry)}
      detail={detailOf(entry)}
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
