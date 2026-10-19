<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import type { KeywordKey, RelatedTrait, TraitId } from '@atlas/core';
  import type { Snippet } from 'svelte';
  import { copy } from '../copy';
  import { groupLane } from '../lane-groups';
  import type { PartyActions } from '../party-actions';
  import SectionToggle from './section-toggle.svelte';
  import TraitCardList from './trait-card-list.svelte';

  /**
   * One lane of a side of the page: the traits tied to the focus through one key, or through several of them. The heading is
   * the page's to word (`heading`); the cards come in the order they were ranked, with the random sources last as a group of their
   * own, since a trait that afflicts a random debuff gives any one of them only by chance. A lane of several keys names, on each card,
   * the keys the trait ties through.
   */
  const {
    entries,
    party,
    hrefOf,
    keyLabel,
    namesKeys,
    hint,
    heading,
  }: {
    entries: readonly RelatedTrait[];
    party: PartyActions;
    hrefOf: (id: TraitId) => ResolvedPathname;
    keyLabel: (key: KeywordKey) => string;
    namesKeys: boolean;
    /** A sentence under the heading, for a lane whose heading does not say what ties its traits to the focus. */
    hint?: string | undefined;
    heading: Snippet;
  } = $props();

  const uid = $props.id();
  const { certain, random, folded } = $derived(groupLane(entries));
  let showRandom = $state(false);
</script>

<section class="lane" aria-labelledby="{uid}-heading">
  <h3 id="{uid}-heading">
    {@render heading()}
    <span class="count">{entries.length}<span class="visually-hidden">{copy.countUnit(entries.length)}</span></span>
  </h3>
  {#if hint !== undefined}<p class="hint">{hint}</p>{/if}

  {#if certain.length > 0}
    <TraitCardList entries={certain} {party} {hrefOf} {keyLabel} {namesKeys} />
  {/if}

  {#if random.length > 0}
    <div class="random">
      <h4>
        {#if folded}
          <SectionToggle
            controls="{uid}-random"
            open={showRandom}
            active={0}
            ontoggle={() => {
              showRandom = !showRandom;
            }}>{copy.randomSources(random.length)}</SectionToggle
          >
        {:else}
          {copy.randomSources(random.length)}
        {/if}
      </h4>
      <p class="hint">{copy.randomSourcesHint}</p>
      <!-- A folded group is not drawn at all (a trait that afflicts a random debuff is one of dozens); its wrapper is what the button controls. -->
      <div id="{uid}-random">
        {#if !folded || showRandom}
          <TraitCardList entries={random} {party} {hrefOf} {keyLabel} {namesKeys} />
        {/if}
      </div>
    </div>
  {/if}
</section>

<style>
  .lane {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 13px;
    font-weight: 600;
  }

  .count {
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 400;
  }

  .random {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  h4 {
    margin: 0;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
  }

  .hint {
    margin: 0;
    color: var(--text-faint);
    font-size: 12px;
  }
</style>
