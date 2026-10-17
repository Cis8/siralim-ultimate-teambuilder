<script lang="ts">
  import {
    FACET_KEYWORD_KINDS,
    hasClass,
    hasKeywordFilter,
    hasRole,
    KEYWORD_MODES,
    toggleClass,
    toggleKeywordFilter,
    type ExploreState,
    type Facets,
    type KeywordMode,
  } from '@atlas/core';
  import { classColour } from '../class-colour';
  import { copy } from '../copy';
  import FacetButton from './facet-button.svelte';
  import Segmented from './segmented.svelte';

  /**
   * The filters of the Explore view (SPEC §8.1): the classes (any of them), the keywords (what a trait applies or relies
   * on, or mentions, all of them or any), and the two flags. Every button is a toggle with the number of traits it would
   * show; what a press changes is worked out by `core`, and the owner of the state gets the new one.
   */
  const {
    facets,
    explore,
    onchange,
  }: { facets: Facets; explore: ExploreState; onchange: (state: ExploreState) => void } = $props();

  /** The two sides of a buff, a debuff or an effect that have a filter, in the order the row shows them. */
  const SIDES = ['applies', 'uses'] as const;

  const uid = $props.id();
  const classHint = `${uid}-class-hint`;

  const groups = $derived(
    FACET_KEYWORD_KINDS.map((kind) => ({ kind, keywords: facets.keywords.filter((facet) => facet.kind === kind) })),
  );
  const modes = KEYWORD_MODES.map((value) => ({ value, label: copy.keywordModes[value] }));
</script>

<div class="facets">
  <div class="group">
    <div class="heading">
      <h3>{copy.classHeading}</h3>
      <span id={classHint} class="hint">{copy.classHint}</span>
    </div>
    <div class="list" role="group" aria-label={copy.classHeading} aria-describedby={classHint}>
      {#each facets.classes as facet (facet.name)}
        <FacetButton
          pressed={hasClass(explore, facet.name)}
          count={facet.count}
          onclick={() => {
            onchange(toggleClass(explore, facet.name));
          }}
        >
          <span class="dot" style:background={classColour(facet.name)} aria-hidden="true"></span>
          {facet.name}
        </FacetButton>
      {/each}
    </div>
  </div>

  <div class="group">
    <div class="heading">
      <h3>{copy.keywordsHeading}</h3>
      <Segmented
        label={copy.keywordModeLabel}
        options={modes}
        value={explore.keywordMode}
        onchange={(keywordMode: KeywordMode) => {
          onchange({ ...explore, keywordMode });
        }}
      />
    </div>
    {#each groups as group (group.kind)}
      <h4 data-kind={group.kind}>{copy.keywordKinds[group.kind]}</h4>
      <div class="list">
        {#each group.keywords as facet (facet.key)}
          {#if hasRole(group.kind)}
            <div class="keyword" role="group" aria-label={facet.label}>
              <span class="name">{facet.label}</span>
              {#each SIDES as side (side)}
                {@const filter = { field: side, key: facet.key }}
                <FacetButton
                  size="compact"
                  pressed={hasKeywordFilter(explore, filter)}
                  count={facet[side]}
                  onclick={() => {
                    onchange(toggleKeywordFilter(explore, filter));
                  }}>{copy.keywordSides[side]}</FacetButton
                >
              {/each}
            </div>
          {:else}
            <FacetButton
              pressed={hasKeywordFilter(explore, { field: 'kw', key: facet.key })}
              count={facet.mentions}
              onclick={() => {
                onchange(toggleKeywordFilter(explore, { field: 'kw', key: facet.key }));
              }}>{facet.label}</FacetButton
            >
          {/if}
        {/each}
      </div>
    {/each}
  </div>

  <div class="group">
    <h3>{copy.flagsHeading}</h3>
    <label class="flag">
      <input
        type="checkbox"
        checked={explore.artifactEligible}
        onchange={(event) => {
          onchange({ ...explore, artifactEligible: event.currentTarget.checked });
        }}
      />
      {copy.flagArtifactEligible}
    </label>
    <label class="flag">
      <input
        type="checkbox"
        checked={explore.doesNotStack}
        onchange={(event) => {
          onchange({ ...explore, doesNotStack: event.currentTarget.checked });
        }}
      />
      {copy.flagDoesNotStack}
    </label>
  </div>
</div>

<style>
  .facets {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px 8px;
  }

  h3 {
    margin: 0;
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h4 {
    margin: 8px 0 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--kw-mechanic);
  }

  h4[data-kind='debuff'] {
    color: var(--kw-debuff);
  }

  h4[data-kind='buff'] {
    color: var(--kw-buff);
  }

  h4[data-kind='trigger'] {
    color: var(--kw-trigger);
  }

  .hint {
    color: var(--text-faint);
    font-size: 11px;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .dot {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 2px;
  }

  /* The two sides are columns of their own, so that the buttons of every keyword line up. */
  .keyword {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 80px 92px;
    align-items: center;
    gap: 6px;
  }

  .name {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .flag {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 28px;
    font-size: 13px;
    cursor: pointer;
  }

  input[type='checkbox'] {
    flex: none;
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--accent);
  }

  @media (pointer: coarse) {
    .flag {
      min-height: var(--target-min);
    }
  }
</style>
