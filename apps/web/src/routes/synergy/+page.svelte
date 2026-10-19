<script lang="ts">
  import { keywordSlug, SLOT_POSITIONS, traitAt, type KeywordKey, type Trait } from '@atlas/core';
  import KeywordPicker from '../../lib/components/keyword-picker.svelte';
  import LoadStatus from '../../lib/components/load-status.svelte';
  import TraitPicker from '../../lib/components/trait-picker.svelte';
  import { carriedSearch } from '../../lib/carried-search';
  import { partySession } from '../../lib/composition-root';
  import { copy } from '../../lib/copy';
  import { useSynergy } from '../../lib/synergy-context';
  import { carriedNow, exploreHref, openTrait, synergyHref } from '../../lib/synergy-links';

  const synergy = useSynergy();
  const relations = $derived(synergy.relations);
  const search = $derived(carriedSearch(carriedNow()));

  /** The filled slots of the party, in reading order: where each trait sits and the id it holds. */
  const members = $derived(
    SLOT_POSITIONS.flatMap((at) => {
      const id = traitAt(partySession.planner.history.party, at);
      return id === null ? [] : [{ at, id }];
    }),
  );
</script>

<svelte:head>
  <title>{copy.synergyPageTitle}</title>
</svelte:head>

<h1>{copy.synergyHeading}</h1>
<p class="intro">{copy.synergyIntro}</p>

{#if relations === undefined}
  <LoadStatus failed={synergy.failed} />
{:else}
  <TraitPicker
    {relations}
    onpick={(trait: Trait) => {
      void openTrait(trait.id);
    }}
  />

  <section aria-labelledby="from-party">
    <h2 id="from-party">{copy.startFromParty}</h2>
    {#if members.length === 0}
      <p class="note">{copy.emptyPartyForSynergy}</p>
      <a class="action" href={exploreHref(search)}>{copy.goToExplore}</a>
    {:else}
      <p class="note">{copy.partyForSynergy}</p>
      <ul class="party">
        {#each members as { at, id } (`${String(at.member)}-${at.slot}`)}
          {@const trait = relations.trait(id)}
          <li>
            <span class="slot">{copy.slotLabel(at)}</span>
            {#if trait === undefined}
              <span class="lost">{id}</span>
              <span class="slot">{copy.notFoundIn(relations.datasetVersion)}</span>
            {:else}
              <a href={synergyHref({ page: 'trait', traitId: trait.id }, search)}>{trait.name}</a>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section aria-labelledby="from-keyword">
    <h2 id="from-keyword">{copy.startFromKeyword}</h2>
    <p class="note">{copy.keywordPickerIntro}</p>
    <KeywordPicker
      keys={relations.keys}
      hrefOf={(key: KeywordKey) => synergyHref({ page: 'keyword', slug: keywordSlug(key) }, search)}
    />
  </section>
{/if}

<style>
  .intro {
    max-width: 62ch;
    color: var(--text-muted);
  }

  section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .note {
    color: var(--text-muted);
  }

  .action {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
  }

  .party {
    display: flex;
    flex-direction: column;
    gap: 6px;
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

  .slot {
    min-width: 11ch;
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .lost {
    color: var(--status-warn);
  }

  @media (pointer: coarse) {
    .action,
    li a {
      display: inline-flex;
      align-items: center;
      min-height: var(--target-min);
    }
  }
</style>
