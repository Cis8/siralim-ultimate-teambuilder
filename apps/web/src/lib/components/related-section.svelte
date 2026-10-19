<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import type { TraitId } from '@atlas/core';
  import { copy } from '../copy';
  import type { PartyActions } from '../party-actions';
  import { LISTED_AT_MOST, PREVIEW_CARDS, shownCards, type RelatedSectionModel } from '../related-sections';
  import CardGroup from './card-group.svelte';
  import RelatedCardList from './related-card-list.svelte';

  /**
   * One of the lists of the Synergy pages (DESIGN § Synergy pages): a heading with the count, a sentence, the first few cards and,
   * when there are more, a button that opens the rest. The button comes before the cards and stays where it is when the list grows,
   * so the focus stays on it and the tab key goes on into the cards that appeared; plain DOM, up to `LISTED_AT_MOST` cards. A list
   * with nothing to show says why instead. A list of a keyword also has a link to the same traits in Explore (`exploreHref`), and
   * groups of traits that give the key in a weaker way after its cards.
   */
  const {
    section,
    artifactOnly,
    party,
    hrefOf,
    exploreHref,
    linkNameOf,
  }: {
    section: RelatedSectionModel;
    artifactOnly: boolean;
    party: PartyActions;
    hrefOf: (id: TraitId) => ResolvedPathname;
    exploreHref?: ResolvedPathname | undefined;
    linkNameOf?: ((name: string) => string) | undefined;
  } = $props();

  const uid = $props.id();
  let open = $state(false);
  const shown = $derived(shownCards(section.cards, open));
  const hasMore = $derived(shown.total > PREVIEW_CARDS);
  const toggleLabel = $derived(
    open ? copy.showFewer : shown.total > LISTED_AT_MOST ? copy.showFirst(LISTED_AT_MOST) : copy.showAll(shown.total),
  );
</script>

<section class="related" aria-labelledby="{uid}-title">
  <header>
    <div class="title-row">
      <h2 id="{uid}-title">
        {section.title}
        {#if section.counted}
          <span class="count">
            {section.cards.length}<span class="visually-hidden">{copy.countUnit(section.cards.length)}</span>
          </span>
        {/if}
      </h2>
      {#if hasMore}
        <button
          type="button"
          class="toggle"
          aria-expanded={open}
          aria-controls="{uid}-list"
          aria-label={copy.showName(toggleLabel, section.title)}
          onclick={() => {
            open = !open;
          }}>{toggleLabel}</button
        >
      {/if}
      {#if exploreHref !== undefined}
        <a class="explore" href={exploreHref} aria-label={copy.seeInExploreName(section.title)}>{copy.seeInExplore}</a>
      {/if}
    </div>
    <p class="hint">{section.hint}</p>
  </header>

  {#if section.cards.length === 0}
    <p class="note">{section.empty}</p>
  {:else}
    <RelatedCardList id="{uid}-list" cards={shown.cards} {party} {hrefOf} {linkNameOf} />
    {#if shown.capped}
      <p class="note">{copy.cappedNote(LISTED_AT_MOST, shown.total, artifactOnly)}</p>
    {/if}
  {/if}

  {#each section.groups ?? [] as group (group.id)}
    <CardGroup title={group.title} hint={group.hint} folded={group.folded} level={3}>
      <RelatedCardList cards={group.cards} {party} {hrefOf} {linkNameOf} />
    </CardGroup>
  {/each}
</section>

<style>
  .related {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* As tall as the button, so that the headings of the lists side by side line up whether a list has one or not. */
  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 4px 12px;
    min-height: 28px;
  }

  h2 {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .count {
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 400;
  }

  .hint {
    margin: 0;
    color: var(--text-faint);
    font-size: 12.5px;
  }

  .note {
    margin: 0;
    padding: 12px 14px;
    border: 1px dashed var(--border-strong);
    border-radius: 8px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .toggle,
  .explore {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
    font-size: 12.5px;
  }

  .toggle {
    cursor: pointer;
  }

  .explore {
    text-decoration: none;
  }

  .toggle:hover,
  .explore:hover {
    border-color: var(--accent-border);
  }

  @media (pointer: coarse) {
    .toggle,
    .explore {
      min-height: var(--target-min);
    }
  }
</style>
