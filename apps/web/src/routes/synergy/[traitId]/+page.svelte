<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { keywordSlug, lostTraitSearch, type KeywordKey, type Trait, type TraitId } from '@atlas/core';
  import { tick } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import ArtifactFilter from '../../../lib/components/artifact-filter.svelte';
  import ExplorationTrail from '../../../lib/components/exploration-trail.svelte';
  import FocusCard from '../../../lib/components/focus-card.svelte';
  import LoadStatus from '../../../lib/components/load-status.svelte';
  import PickerSheet from '../../../lib/components/picker-sheet.svelte';
  import RelatedSection from '../../../lib/components/related-section.svelte';
  import RelationSide from '../../../lib/components/relation-side.svelte';
  import SectionTabs from '../../../lib/components/section-tabs.svelte';
  import TraitPicker from '../../../lib/components/trait-picker.svelte';
  import { carriedSearch } from '../../../lib/carried-search';
  import { partySession } from '../../../lib/composition-root';
  import { copy } from '../../../lib/copy';
  import { keyLabel } from '../../../lib/key-label';
  import { relatedSections } from '../../../lib/related-sections';
  import { decodeSynergyView, type SynergySection } from '../../../lib/synergy-address';
  import { useSynergy } from '../../../lib/synergy-context';
  import { carriedNow, exploreTraitHref, openTrait, synergyHref, synergyLinkSearch } from '../../../lib/synergy-links';
  import {
    distinctTraits,
    panelAttributes,
    sectionInAddress,
    shownSection,
    TRAIT_SECTIONS,
  } from '../../../lib/synergy-sections';
  import type { PageData } from './$types';

  /** How many traits with a name like the one in a dead link are offered. */
  const SIMILAR_TRAITS = 8;

  const { data }: { data: PageData } = $props();

  const synergy = useSynergy();
  /** Where the lists are tabs and the pickers are sheets. The stylesheet of the page asks for the opposite (`width >= 700px`). */
  const narrow = new MediaQuery('width < 700px');
  const relations = $derived(synergy.relations);
  const trait = $derived(relations?.trait(data.traitId));
  const lost = $derived(lostTraitSearch(data.traitId));
  const similar = $derived(lost.name === '' ? [] : (relations?.findTraits(lost.name, SIMILAR_TRAITS) ?? []));
  const search = $derived(carriedSearch(carriedNow()));

  const artifactOnly = $derived(synergy.view.matOnly);
  const sides = $derived(trait === undefined ? undefined : relations?.relationsOf(trait.id, { artifactOnly }));
  /** Alternatives, Same trigger and Same family, worded; the relation service remembers each answer, so the filter's two states are cheap. */
  const related = $derived.by(() => {
    if (trait === undefined || relations === undefined) return undefined;
    const options = { artifactOnly };
    const alternatives = relations.alternativesOf(trait.id, options);
    const sameTrigger = relations.sameTriggerOf(trait.id, options);
    const sameFamily = relations.sameFamilyOf(trait.id, options);
    if (alternatives === undefined || sameTrigger === undefined || sameFamily === undefined) return undefined;
    return relatedSections({ trait, alternatives, sameTrigger, sameFamily, artifactOnly }, keyLabel);
  });
  /** The list a narrow screen has on show, and the tabs that bring the others forward. */
  const section = $derived(shownSection(synergy.view.section, TRAIT_SECTIONS));
  const alternatives = $derived((related ?? []).filter(({ id }) => id === 'alternatives'));
  const triggerAndFamily = $derived((related ?? []).filter(({ id }) => id !== 'alternatives'));
  const tabs = $derived(
    sides === undefined
      ? []
      : ([
          { section: 'enabled-by', label: copy.enabledBy, count: sides.enabledBy.count },
          { section: 'enables', label: copy.enables, count: sides.enables.count },
          { section: 'alternatives', label: copy.alternatives, count: distinctTraits(alternatives) },
          { section: 'related', label: copy.related, count: distinctTraits(triggerAndFamily) },
        ] as const),
  );
  const panel = (of: SynergySection) => panelAttributes(of, narrow.current, section);
  // The links of a trait page carry the party and the artifact filter: the person keeps both as they go from trait to trait.
  const linkSearch = $derived(synergyLinkSearch(artifactOnly));
  const traitHref = (id: TraitId) => synergyHref({ page: 'trait', traitId: id }, linkSearch);
  const keywordHref = (key: KeywordKey) => synergyHref({ page: 'keyword', slug: keywordSlug(key) }, linkSearch);
  /** The trail by name; a step the dataset has no trait for (a dead link visited earlier) has nothing to show. */
  const steps = $derived(
    synergy.trail.flatMap((id) => {
      const step = relations?.trait(id);
      return step === undefined ? [] : [{ id, name: step.name }];
    }),
  );

  let heading = $state<HTMLHeadingElement>();
  /** What a screen reader is told when the artifact filter is turned on or off: nothing else about the page moves in front of it. */
  let filterNote = $state('');

  afterNavigate(({ type, from, to }) => {
    // The first visit of the app is left alone.
    if (type === 'enter' || to === null || from === null) return;
    if (to.params?.traitId !== from.params?.traitId) {
      // A move to another trait (a card, a step of the trail, the picker, Back) lands on its name: the focus would otherwise be
      // wherever the page left it, and a screen reader would not learn that the page is another.
      filterNote = '';
      void tick().then(() => {
        heading?.focus({ preventScroll: true });
      });
    } else if (decodeSynergyView(from.url.searchParams).matOnly !== decodeSynergyView(to.url.searchParams).matOnly) {
      void tick().then(() => {
        filterNote =
          sides === undefined
            ? ''
            : copy.artifactFilterNow(artifactOnly, [
                { name: copy.enabledBy, count: sides.enabledBy.count },
                { name: copy.enables, count: sides.enables.count },
                ...(related ?? []).flatMap(({ title, cards, counted }) =>
                  counted ? [{ name: title, count: cards.length }] : [],
                ),
              ]);
      });
    }
  });
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
{:else if sides !== undefined}
  <div class="toolbar">
    {#if narrow.current}
      <!-- On a phone the list of matches wants the room the keyboard leaves, which a sheet gives it. -->
      <PickerSheet
        label={copy.findTraitLabel}
        title={copy.findTraitLabel}
        closeLabel={copy.closePicker}
        icon="search"
        focusField
      >
        <TraitPicker
          {relations}
          onpick={(picked: Trait) => {
            void openTrait(picked.id, artifactOnly);
          }}
        />
      </PickerSheet>
    {:else}
      <TraitPicker
        {relations}
        onpick={(picked: Trait) => {
          void openTrait(picked.id, artifactOnly);
        }}
      />
    {/if}
    <ArtifactFilter
      checked={artifactOnly}
      onchange={(matOnly: boolean) => {
        synergy.choose({ matOnly });
      }}
    />
  </div>

  <p class="visually-hidden" aria-live="polite">{filterNote}</p>

  <ExplorationTrail {steps} hrefOf={traitHref} />

  <!--
    The focus comes first in the page; from 1100 px it stands between the two sides, which the grid places. Under 700 px the four
    lists are tabs under the focus, and the page scrolls: one list at a time, never a list within the page.
  -->
  <div class="explorer">
    <div class="focus-cell">
      <FocusCard
        {trait}
        party={partySession.actions}
        {keywordHref}
        exploreHref={exploreTraitHref(trait)}
        compact={narrow.current}
        bind:heading
      />
    </div>
    {#if narrow.current}
      <SectionTabs
        label={copy.traitTabsLabel}
        {tabs}
        selected={section}
        onselect={(next: SynergySection) => {
          synergy.choose({ section: sectionInAddress(next, TRAIT_SECTIONS) });
        }}
      />
    {/if}
    <div class="enabled-by-cell" {...panel('enabled-by')}>
      <RelationSide
        side={sides.enabledBy}
        direction="enabledBy"
        focus={trait}
        {artifactOnly}
        party={partySession.actions}
        hrefOf={traitHref}
        titleHidden={narrow.current}
      />
    </div>
    <div class="enables-cell" {...panel('enables')}>
      <RelationSide
        side={sides.enables}
        direction="enables"
        focus={trait}
        {artifactOnly}
        party={partySession.actions}
        hrefOf={traitHref}
        titleHidden={narrow.current}
      />
    </div>

    {#if related !== undefined}
      <!-- A trait starts with its lists shut: the key forgets what the last one had opened. -->
      {#key trait.id}
        <div class="related">
          <!-- Alternatives is a tab of its own; Same trigger and Same family share the last one, one above the other. -->
          <div class="alternatives-panel" {...panel('alternatives')}>
            {#each alternatives as list (list.id)}
              <RelatedSection
                section={list}
                {artifactOnly}
                party={partySession.actions}
                hrefOf={traitHref}
                titleHidden={narrow.current}
              />
            {/each}
          </div>
          <div class="related-panel" {...panel('related')}>
            {#each triggerAndFamily as list (list.id)}
              <RelatedSection section={list} {artifactOnly} party={partySession.actions} hrefOf={traitHref} />
            {/each}
          </div>
        </div>
      {/key}
    {/if}
  </div>
{/if}

<style>
  .origin {
    color: var(--text-muted);
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

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 20px;
  }

  /*
   * One column in the order of the page (the focus, what enables it, what it enables, the three lists under them); from 1100 px the
   * focus stands between the sides and the lists have a row of their own. Under 700 px the lists are tabs: one is on show.
   */
  .explorer {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 28px 24px;
  }

  /* Under the sides: the three lists that are not a side, in one column in the order of the page, side by side from 1100 px. */
  .related {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 28px 24px;
    padding-top: 22px;
    border-top: 1px solid var(--border);
  }

  /* From 700 px the boxes of the lists are only a way to name them (the tab panels of a phone): the lists are the grid's items. */
  @media (width >= 700px) {
    .alternatives-panel,
    .related-panel {
      display: contents;
    }
  }

  @media (width < 700px) {
    .explorer {
      gap: 12px;
    }

    /* The panels are the grid's items, and the rule and the room above the lists have no place between tabs. */
    .related {
      display: contents;
    }

    /* `:not([hidden])`: a rule that sets `display` would otherwise show the panel of a tab that is not selected. */
    .related-panel:not([hidden]) {
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
  }

  @media (width >= 1100px) {
    .related {
      grid-area: related;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      align-items: start;
    }

    .explorer {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr) minmax(0, 1fr);
      grid-template-areas:
        'enabled-by focus enables'
        'related related related';
      align-items: start;
    }

    .focus-cell {
      grid-area: focus;
    }

    .enabled-by-cell {
      grid-area: enabled-by;
    }

    .enables-cell {
      grid-area: enables;
    }
  }

  @media (pointer: coarse) {
    li a {
      display: inline-flex;
      align-items: center;
      min-height: var(--target-min);
    }
  }
</style>
