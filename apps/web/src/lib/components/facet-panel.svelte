<script lang="ts">
  import {
    activeFilterCounts,
    clearFilters,
    eventActors,
    FACET_KEYWORD_KINDS,
    filterChips,
    hasClass,
    hasKeywordFilter,
    hasRole,
    KEYWORD_MODES,
    setEventActors,
    toggleClass,
    toggleKeywordFilter,
    type ActorSet,
    type ExploreState,
    type Facets,
    type FilterSection,
    type KeywordMode,
  } from '@atlas/core';
  import { classColour } from '../class-colour';
  import { copy } from '../copy';
  import { eventWho, pressChoice, type WhoChoice } from '../event-who';
  import EventFacets from './event-facets.svelte';
  import FacetButton from './facet-button.svelte';
  import KeywordRow from './keyword-row.svelte';
  import SectionToggle from './section-toggle.svelte';
  import Segmented from './segmented.svelte';

  /**
   * The filters of the Explore view (SPEC §8.1): the classes (any of them), the keywords (what a trait applies or relies
   * on, or mentions, all of them or any), and the two flags, under a button that takes them all off. Every other button
   * is a toggle with the number of traits it would show; what a press changes is worked out by `core`, and the owner of
   * the state gets the new one. The classes, each kind of keyword and the flags are sections that open and close; which
   * are shut (`shut`) is the owner's too, since this panel is built again whenever the window crosses the width where the
   * filters change from a column to a sheet. So is `who`, the actors last chosen with the "Who" control of the Events
   * section, which is what the next event filter turned on gets while none is on.
   */
  const {
    facets,
    explore,
    shut,
    who: chosenWho,
    onchange,
    ontoggle,
    onwho,
  }: {
    facets: Facets;
    explore: ExploreState;
    shut: readonly FilterSection[];
    who: ActorSet;
    onchange: (state: ExploreState) => void;
    ontoggle: (section: FilterSection) => void;
    onwho: (actors: ActorSet) => void;
  } = $props();

  /** The two sides of a buff, a debuff or an effect that have a filter, in the order the row shows them. */
  const SIDES = ['applies', 'uses'] as const;

  const uid = $props.id();
  const classHint = `${uid}-class-hint`;

  const groups = $derived(
    FACET_KEYWORD_KINDS.map((kind) => ({ kind, keywords: facets.keywords.filter((facet) => facet.kind === kind) })),
  );
  const modes = KEYWORD_MODES.map((value) => ({ value, label: copy.keywordModes[value] }));

  /** The five classes of a creature, then the others (`core` puts them in that order): two runs with a rule between. */
  const classRuns = $derived(
    [facets.classes.filter(({ standard }) => standard), facets.classes.filter(({ standard }) => !standard)].filter(
      (run) => run.length > 0,
    ),
  );

  const who = $derived(eventWho(eventActors(explore, facets.keywords), chosenWho));
  const active = $derived(filterChips(explore).length);
  const counts = $derived(activeFilterCounts(explore, facets.keywords));
  const isOpen = (section: FilterSection): boolean => !shut.includes(section);
  /** The content of a section: what its button controls. */
  const bodyId = (section: FilterSection): string => `${uid}-${section}`;
  /** What a screen reader is told after the button was pressed. It is only said while no filter is on again. */
  let cleared = $state('');
  const clearedAnnouncement = $derived(active === 0 ? cleared : '');

  /** The actors a press leaves are kept, and the event filters that are on are set to them: one step of the history, or none if nothing changes. */
  function chooseWho(choice: WhoChoice): void {
    const actors = pressChoice(who, choice);
    onwho(actors);
    const next = setEventActors(explore, facets.keywords, actors);
    if (next !== explore) onchange(next);
  }

  /** It stays in the tab order with nothing to clear (`aria-disabled`, not `disabled`): the focus is not lost with the last press. */
  function clear(): void {
    if (active === 0) return;
    cleared = copy.clearedFilters(active);
    onchange(clearFilters(explore));
  }
</script>

<div class="facets">
  <button type="button" class="clear" aria-disabled={active === 0 ? 'true' : undefined} onclick={clear}
    >{copy.clearFilters(active)}</button
  >
  <p class="visually-hidden" aria-live="polite">{clearedAnnouncement}</p>

  <div class="group">
    <div class="heading">
      <h3 class="grows">
        <SectionToggle
          controls={bodyId('class')}
          open={isOpen('class')}
          active={counts.class}
          ontoggle={() => {
            ontoggle('class');
          }}>{copy.classHeading}</SectionToggle
        >
      </h3>
      <span id={classHint} class="hint" hidden={!isOpen('class')}>{copy.classHint}</span>
    </div>
    <div id={bodyId('class')} hidden={!isOpen('class')}>
      <div class="list" role="group" aria-label={copy.classHeading} aria-describedby={classHint}>
        {#each classRuns as run, at (at)}
          {#if at > 0}<div class="rule" aria-hidden="true"></div>{/if}
          {#each run as facet (facet.name)}
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
        {/each}
      </div>
    </div>
  </div>

  <div class="group">
    <div class="heading">
      <h3>{copy.keywordsHeading}</h3>
      <Segmented
        label={copy.keywordModeLabel}
        options={modes}
        pressed={[explore.keywordMode]}
        onchange={(keywordMode: KeywordMode) => {
          onchange({ ...explore, keywordMode });
        }}
      />
    </div>
    {#each groups as group (group.kind)}
      <h4 data-kind={group.kind}>
        <SectionToggle
          controls={bodyId(group.kind)}
          open={isOpen(group.kind)}
          active={counts[group.kind]}
          ontoggle={() => {
            ontoggle(group.kind);
          }}>{copy.keywordKinds[group.kind]}</SectionToggle
        >
      </h4>
      <div id={bodyId(group.kind)} hidden={!isOpen(group.kind)}>
        {#if group.kind === 'event'}
          <EventFacets events={group.keywords} {explore} {who} {onchange} onwho={chooseWho} />
        {:else}
          <div class="list">
            {#each group.keywords as facet (facet.key)}
              {#if hasRole(group.kind)}
                <KeywordRow
                  label={facet.label}
                  widths="80px 92px"
                  sides={SIDES.map((side) => ({
                    name: copy.keywordSides[side],
                    count: facet[side],
                    pressed: hasKeywordFilter(explore, { field: side, key: facet.key }),
                    press: () => {
                      onchange(toggleKeywordFilter(explore, { field: side, key: facet.key }));
                    },
                  }))}
                />
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
        {/if}
      </div>
    {/each}
  </div>

  <div class="group">
    <h3>
      <SectionToggle
        controls={bodyId('flags')}
        open={isOpen('flags')}
        active={counts.flags}
        ontoggle={() => {
          ontoggle('flags');
        }}>{copy.flagsHeading}</SectionToggle
      >
    </h3>
    <div id={bodyId('flags')} hidden={!isOpen('flags')}>
      <div class="flags">
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

  .clear {
    align-self: flex-start;
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-3);
    color: var(--text);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .clear:hover {
    background: var(--surface-2);
  }

  .clear[aria-disabled='true'] {
    border-color: var(--border);
    color: var(--text-faint);
    cursor: default;
  }

  .clear[aria-disabled='true']:hover {
    background: var(--surface-3);
  }

  .heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px 8px;
  }

  /* The heading of the classes shares its row with the hint, and the button in it fills what the hint leaves. */
  .grows {
    flex: 1;
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

  h4[data-kind='event'] {
    color: var(--kw-event);
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

  /* Between the classes of a creature and the others. */
  .rule {
    margin: 4px 8px;
    border-top: 1px solid var(--border);
  }

  .dot {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 2px;
  }

  .flags {
    display: flex;
    flex-direction: column;
    gap: 6px;
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
    .clear,
    .flag {
      min-height: var(--target-min);
    }
  }
</style>
