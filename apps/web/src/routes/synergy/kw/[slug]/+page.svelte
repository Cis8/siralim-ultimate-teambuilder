<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { keywordFromSlug, keywordSlug, taxonomy, type KeywordKey, type TraitId } from '@atlas/core';
  import { tick } from 'svelte';
  import ArtifactFilter from '../../../../lib/components/artifact-filter.svelte';
  import KeywordPicker from '../../../../lib/components/keyword-picker.svelte';
  import KeywordSummary from '../../../../lib/components/keyword-summary.svelte';
  import LoadStatus from '../../../../lib/components/load-status.svelte';
  import RelatedSection from '../../../../lib/components/related-section.svelte';
  import { carriedSearch } from '../../../../lib/carried-search';
  import { partySession } from '../../../../lib/composition-root';
  import { copy } from '../../../../lib/copy';
  import { keywordSections } from '../../../../lib/keyword-sections';
  import { liveSummary, togetherWith, verdictLine } from '../../../../lib/keyword-summary';
  import { decodeSynergyView } from '../../../../lib/synergy-address';
  import { useSynergy } from '../../../../lib/synergy-context';
  import { carriedNow, exploreKeywordHref, synergyHref, synergyLinkSearch } from '../../../../lib/synergy-links';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  const synergy = useSynergy();
  const relations = $derived(synergy.relations);
  // Only the keys that can be a dependency have a page (an event's key is a slug that opens nothing).
  const key = $derived(relations === undefined ? undefined : keywordFromSlug(data.slug, relations.keys));
  const entry = $derived(key === undefined ? undefined : taxonomy.get(key));
  const kind = $derived(
    entry?.kind === 'debuff' || entry?.kind === 'buff' || entry?.kind === 'effect' ? entry.kind : undefined,
  );
  const search = $derived(carriedSearch(carriedNow()));

  const artifactOnly = $derived(synergy.view.matOnly);
  const view = $derived(key === undefined ? undefined : relations?.keywordView(key, { artifactOnly }));
  /** The chips of the other keywords say their counts under the same filter as the page. */
  const stats = $derived(relations?.keywordStats({ artifactOnly }));
  const verdict = $derived(view === undefined ? undefined : verdictLine(view.verdict, view.stats, artifactOnly));
  const sections = $derived(
    view === undefined || entry === undefined ? undefined : keywordSections(view, entry.label, artifactOnly),
  );

  // The links of a keyword page carry the party and the artifact filter, as those of a trait page do.
  const linkSearch = $derived(synergyLinkSearch(artifactOnly));
  const traitHref = (id: TraitId) => synergyHref({ page: 'trait', traitId: id }, linkSearch);
  const keywordHref = (other: KeywordKey) => synergyHref({ page: 'keyword', slug: keywordSlug(other) }, linkSearch);
  const together = $derived(view === undefined ? [] : togetherWith(view.coApplied, keywordHref));

  let heading = $state<HTMLHeadingElement>();
  /** What a screen reader is told when the page moves to another keyword or the artifact filter changes the counts. */
  let note = $state('');

  afterNavigate(({ type, from, to }) => {
    // The first visit of the app is left alone.
    if (type === 'enter' || to === null || from === null) return;
    if (to.params?.slug !== from.params?.slug) {
      // A move to another keyword lands on its name, and the page says how well it is supported: the counts and the verdict are what
      // the person came for, and nothing else tells them that the page changed beyond its title.
      void tick().then(() => {
        heading?.focus({ preventScroll: true });
        note =
          view === undefined || verdict === undefined || entry === undefined
            ? ''
            : liveSummary(entry.label, view.stats, verdict);
      });
    } else if (decodeSynergyView(from.url.searchParams).matOnly !== decodeSynergyView(to.url.searchParams).matOnly) {
      void tick().then(() => {
        note =
          view === undefined || verdict === undefined || sections === undefined
            ? ''
            : `${copy.artifactFilterNow(
                artifactOnly,
                sections.map(({ title, cards }) => ({ name: title, count: cards.length })),
              )} ${verdict.title}.`;
      });
    }
  });
</script>

<svelte:head>
  <title>{copy.synergyDocument(entry === undefined ? copy.keywordNotFoundTitle : entry.label)}</title>
</svelte:head>

{#if relations === undefined}
  <LoadStatus failed={synergy.failed} />
{:else if entry === undefined || key === undefined || kind === undefined || view === undefined || verdict === undefined || sections === undefined}
  <!-- A slug that is no keyword's: a state of the page, with the list of the ones there are. -->
  <h1>{copy.keywordNotFoundTitle}</h1>
  <p class="note">{copy.keywordNotFound(data.slug)}</p>

  <section aria-labelledby="keywords">
    <h2 id="keywords">{copy.startFromKeyword}</h2>
    <KeywordPicker
      keys={relations.keys}
      hrefOf={(each: KeywordKey) => synergyHref({ page: 'keyword', slug: keywordSlug(each) }, search)}
      {stats}
    />
  </section>
{:else}
  <div class="toolbar">
    <ArtifactFilter
      checked={artifactOnly}
      onchange={(matOnly: boolean) => {
        synergy.choose({ matOnly });
      }}
    />
  </div>

  <p class="visually-hidden" aria-live="polite">{note}</p>

  <KeywordSummary label={entry.label} {kind} stats={view.stats} {verdict} {together} bind:heading />

  <div class="lists">
    <RelatedSection
      section={sections[0]}
      {artifactOnly}
      party={partySession.actions}
      hrefOf={traitHref}
      exploreHref={exploreKeywordHref(key, 'applies', artifactOnly)}
      linkNameOf={copy.openTrait}
    />
    <RelatedSection
      section={sections[1]}
      {artifactOnly}
      party={partySession.actions}
      hrefOf={traitHref}
      exploreHref={exploreKeywordHref(key, 'uses', artifactOnly)}
      linkNameOf={copy.openTrait}
    />
  </div>

  <section aria-labelledby="keywords">
    <h2 id="keywords">{copy.keywordPickerHeading}</h2>
    <KeywordPicker keys={relations.keys} current={key} hrefOf={keywordHref} {stats} />
  </section>
{/if}

<style>
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

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 20px;
  }

  /* Who applies the keyword and who relies on it, side by side as soon as there is room for two columns of cards. */
  .lists {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 28px 24px;
  }

  @media (width >= 700px) {
    .lists {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
    }
  }
</style>
