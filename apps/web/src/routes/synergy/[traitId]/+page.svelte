<script lang="ts">
  import { lostTraitSearch, type Trait } from '@atlas/core';
  import { classColour } from '../../../lib/class-colour';
  import LoadStatus from '../../../lib/components/load-status.svelte';
  import TraitPicker from '../../../lib/components/trait-picker.svelte';
  import { carriedSearch } from '../../../lib/carried-search';
  import { copy } from '../../../lib/copy';
  import { useSynergy } from '../../../lib/synergy-context';
  import { carriedNow, openTrait, synergyHref } from '../../../lib/synergy-links';
  import type { PageData } from './$types';

  /** How many traits with a name like the one in a dead link are offered. */
  const SIMILAR_TRAITS = 8;

  const { data }: { data: PageData } = $props();

  const synergy = useSynergy();
  const relations = $derived(synergy.relations);
  const trait = $derived(relations?.trait(data.traitId));
  const lost = $derived(lostTraitSearch(data.traitId));
  const similar = $derived(lost.name === '' ? [] : (relations?.findTraits(lost.name, SIMILAR_TRAITS) ?? []));
  const search = $derived(carriedSearch(carriedNow()));
</script>

<svelte:head>
  <title>{copy.synergyDocument(trait === undefined ? copy.traitNotFoundTitle : trait.name)}</title>
</svelte:head>

{#if relations === undefined}
  <LoadStatus failed={synergy.failed} />
{:else if trait === undefined}
  <!-- An id the dataset does not know (SPEC §5): a state of the page, with a way on, not an error. -->
  <h1>{copy.traitNotFoundTitle}</h1>
  <p class="note">{copy.traitNotFound(data.traitId, relations.datasetVersion)}</p>

  <section aria-labelledby="similar">
    <h2 id="similar">{copy.similarTraits}</h2>
    {#if similar.length === 0}
      <p class="note">{copy.noSimilarTraits}</p>
    {:else}
      <ul class="similar">
        {#each similar as candidate (candidate.id)}
          <li>
            <a href={synergyHref({ page: 'trait', traitId: candidate.id }, search)}>{candidate.name}</a>
            <span class="origin">
              {copy.traitOrigin(candidate.creature, candidate.family, candidate.class, candidate.kind)}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section aria-labelledby="again">
    <h2 id="again">{copy.searchAgain}</h2>
    {#key data.traitId}
      <TraitPicker
        {relations}
        initial={lost.name}
        onpick={(picked: Trait) => {
          void openTrait(picked.id);
        }}
      />
    {/key}
  </section>
{:else}
  <header class="focus">
    <h1>
      <span class="dot" style:background={classColour(trait.class)} aria-hidden="true"></span>
      {trait.name}
    </h1>
    <p class="origin">{copy.traitOrigin(trait.creature, trait.family, trait.class, trait.kind)}</p>
  </header>
  <p class="description">{trait.description}</p>
  <TraitPicker
    {relations}
    onpick={(picked: Trait) => {
      void openTrait(picked.id);
    }}
  />
{/if}

<style>
  .focus {
    display: flex;
    flex-direction: column;
    gap: 4px;
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
  }

  .description {
    max-width: 62ch;
    color: var(--text);
    font-size: 15px;
    line-height: 1.65;
  }

  .note {
    max-width: 62ch;
    color: var(--text-muted);
  }

  section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .similar {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 12px;
  }

  @media (pointer: coarse) {
    li a {
      display: inline-flex;
      align-items: center;
      min-height: var(--target-min);
    }
  }
</style>
