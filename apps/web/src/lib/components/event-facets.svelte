<script lang="ts">
  import {
    EVENT_GROUPS,
    facetCount,
    hasKeywordSide,
    toggleKeywordSide,
    type ExploreState,
    type KeywordFacet,
    type KeywordSide,
  } from '@atlas/core';
  import { copy } from '../copy';
  import { WHO_CHOICES, type EventWho, type WhoChoice } from '../event-who';
  import KeywordRow from './keyword-row.svelte';
  import Segmented from './segmented.svelte';

  /**
   * The body of the Events section (SPEC §8.1): one "Who" control that narrows every event filter to who acts, then the events
   * in five groups, each with a button for the traits that cause it and one for those that react to it. The buttons are
   * pressed for an event by any actor, and what they turn on has the actor `who` says (`eventWho`); their counts are the
   * traits whose text names that actor.
   */
  const {
    events,
    explore,
    who,
    onchange,
    onwho,
  }: {
    events: readonly KeywordFacet[];
    explore: ExploreState;
    who: EventWho;
    onchange: (state: ExploreState) => void;
    onwho: (choice: WhoChoice) => void;
  } = $props();

  const SIDES = ['applies', 'uses'] as const satisfies readonly KeywordSide[];

  const choices = WHO_CHOICES.map((value) => ({ value, label: copy.whoChoices[value] }));
  const groups = $derived(
    EVENT_GROUPS.map((group) => ({ group, events: events.filter((event) => event.group === group) })).filter(
      ({ events: listed }) => listed.length > 0,
    ),
  );
</script>

<div class="events">
  <div class="who">
    <span class="caption" aria-hidden="true">{copy.whoLabel}</span>
    <Segmented label={copy.whoLabel} options={choices} value={who.shown} columns={2} onchange={onwho} />
  </div>
  {#each groups as { group, events: listed } (group)}
    <h5>{copy.eventGroups[group]}</h5>
    <div class="list">
      {#each listed as event (event.key)}
        <KeywordRow
          label={event.label}
          widths="76px 76px"
          sides={SIDES.map((side) => ({
            name: copy.eventSides[side],
            count: facetCount(event, side, who.actor),
            pressed: hasKeywordSide(explore, { field: side, key: event.key }),
            press: () => {
              onchange(toggleKeywordSide(explore, { field: side, key: event.key }, who.actor));
            },
          }))}
        />
      {/each}
    </div>
  {/each}
</div>

<style>
  .events {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .who {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 6px;
  }

  .caption,
  h5 {
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 600;
  }

  h5 {
    margin: 8px 0 2px;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
</style>
