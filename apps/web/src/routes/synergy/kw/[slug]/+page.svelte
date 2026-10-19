<script lang="ts">
  import { keywordFromSlug, keywordSlug, taxonomy, type KeywordKey } from '@atlas/core';
  import KeywordPicker from '../../../../lib/components/keyword-picker.svelte';
  import LoadStatus from '../../../../lib/components/load-status.svelte';
  import { carriedSearch } from '../../../../lib/carried-search';
  import { copy } from '../../../../lib/copy';
  import { useSynergy } from '../../../../lib/synergy-context';
  import { carriedNow, synergyHref } from '../../../../lib/synergy-links';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  const synergy = useSynergy();
  const relations = $derived(synergy.relations);
  // Only the keys that can be a dependency have a page (an event's key is a slug that opens nothing).
  const key = $derived(relations === undefined ? undefined : keywordFromSlug(data.slug, relations.keys));
  const entry = $derived(key === undefined ? undefined : taxonomy.get(key));
  const search = $derived(carriedSearch(carriedNow()));
  const kindName = $derived(
    entry?.kind === 'debuff' || entry?.kind === 'buff' || entry?.kind === 'effect'
      ? copy.keywordKindName[entry.kind]
      : undefined,
  );
</script>

<svelte:head>
  <title>{copy.synergyDocument(entry === undefined ? copy.keywordNotFoundTitle : entry.label)}</title>
</svelte:head>

{#if relations === undefined}
  <LoadStatus failed={synergy.failed} />
{:else}
  {#if entry === undefined}
    <!-- A slug that is no keyword's: a state of the page, with the list of the ones there are. -->
    <h1>{copy.keywordNotFoundTitle}</h1>
    <p class="note">{copy.keywordNotFound(data.slug)}</p>
  {:else}
    <header class="focus">
      <h1>{entry.label}</h1>
      {#if kindName !== undefined}<p class="kind">{kindName}</p>{/if}
    </header>
  {/if}

  <section aria-labelledby="keywords">
    <h2 id="keywords">{copy.startFromKeyword}</h2>
    <KeywordPicker
      keys={relations.keys}
      current={key}
      hrefOf={(each: KeywordKey) => synergyHref({ page: 'keyword', slug: keywordSlug(each) }, search)}
    />
  </section>
{/if}

<style>
  .focus {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .kind,
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
</style>
