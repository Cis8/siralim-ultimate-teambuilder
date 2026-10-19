<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/state';
  import { filledSlots, type RelationService, type TraitId } from '@atlas/core';
  import { onMount, type Snippet } from 'svelte';
  import { createAddressWriter } from '../../lib/address-writer';
  import BarLink from '../../lib/components/bar-link.svelte';
  import BottomBar from '../../lib/components/bottom-bar.svelte';
  import SessionSlotChooser from '../../lib/components/session-slot-chooser.svelte';
  import { partySession } from '../../lib/composition-root';
  import { copy } from '../../lib/copy';
  import { loadRelationService } from '../../lib/relation-composition';
  import { decodeSynergyView, synergyAddress, type SynergyState, type SynergyView } from '../../lib/synergy-address';
  import { provideSynergy } from '../../lib/synergy-context';
  import { appLinks, carriedNow, synergyHref } from '../../lib/synergy-links';
  import { synergyPlaceOf } from '../../lib/synergy-place';
  import { extendTrail } from '../../lib/synergy-trail';

  /**
   * What the Synergy pages share (ADR-0011): the relations of the dataset, loaded once however many pages the person visits, the
   * party of the session and the keeping of it in the address, the trail of the traits looked at, and the bar at the foot of a
   * narrow screen. The pages under it read their own state from the address; the party and the view are what they change, and this
   * writes them back.
   */
  const { children }: { children: Snippet } = $props();

  let relations = $state.raw<RelationService>();
  let failed = $state(false);
  /** The memory of a session of exploring: it begins empty each time the app opens, and the picker begins it again. */
  let trail = $state.raw<readonly TraitId[]>([]);

  /** Everything the address stands for besides its path: the view it states and the party of the session. */
  const stateNow = (): SynergyState => ({
    ...decodeSynergyView(page.url.searchParams),
    party: partySession.partyState,
    datasetVersion: partySession.datasetVersion,
  });

  /**
   * A change of the party is written to the address of the page in front, in the place it is: the same path, a new query. A write
   * that finds the person gone to another page is dropped, since the state it stands for went with that page.
   */
  const writer = createAddressWriter<SynergyState>(
    {
      current: () => new URL(page.url.href),
      go: (url, entry) => {
        const place = synergyPlaceOf(page.route.id, page.params);
        if (place === undefined || url.pathname !== page.url.pathname) return Promise.resolve();
        return goto(synergyHref(place, url.search.slice(1)), { replace: entry === 'replace', reset: false });
      },
    },
    synergyAddress,
  );

  provideSynergy({
    get relations() {
      return relations;
    },
    get failed() {
      return failed;
    },
    get view() {
      return decodeSynergyView(page.url.searchParams);
    },
    get trail() {
      return trail;
    },
    choose(changes: Partial<SynergyView>) {
      writer.chosen({ ...stateNow(), ...changes });
    },
  });

  /** The page of a trait is wider than the others: its two sides stand beside the focus from 1100 px. */
  const wide = $derived(page.route.id === '/synergy/[traitId]');

  const links = $derived(appLinks(carriedNow()));
  const filled = $derived(filledSlots(partySession.planner.history.party));

  afterNavigate(({ type, from, to }) => {
    if (to === null) return;
    // The trail follows the person from trait to trait; the picker is a new start. Idempotent: a write of the party is the same page.
    const place = synergyPlaceOf(to.route.id, to.params ?? {});
    if (place?.page === 'picker') trail = [];
    else if (place?.page === 'trait') trail = extendTrail(trail, place.traitId);
    // The writer's own write: the same page with a new query, and the party it stands for is the session's already.
    if (type === 'goto' && from?.url.pathname === to.url.pathname) return;
    writer.arrived(to.url);
    // Another page of ours, opened with the party it carries.
    if (type === 'goto') return;
    // A visit to an address with no party starts from the party of the last visit, which the address then says.
    if (partySession.arrive(to.url.searchParams, type === 'enter')) writer.refined(stateNow());
  });

  onMount(() => {
    loadRelationService().then(
      (service) => {
        partySession.useDataset(service);
        relations = service;
      },
      () => {
        failed = true;
      },
    );

    // The party is shared by the pages of the app: this layout is told what its changes ask of the address while it is in front.
    const stopSyncing = partySession.syncAddress((step) => {
      writer[step](stateNow());
    });
    return () => {
      stopSyncing();
      partySession.forgetChooser();
    };
  });
</script>

<div class="synergy" class:wide>
  {@render children()}
</div>

<!-- Outside the page: a change of the party made from a card is told whatever the page is showing. -->
<p class="visually-hidden" aria-live="polite">{partySession.message}</p>

<!-- On the page and not in a card: the cards are drawn again as the focus moves, and a card can be gone while the sheet is open. -->
<SessionSlotChooser />

<BottomBar label={copy.sectionsLabel}>
  <BarLink href={links.explore} icon="explore">{copy.pages.explore}</BarLink>
  <BarLink href={links.party} icon="party">
    {copy.pages.party}
    <span class="count" aria-hidden="true">{copy.partyTabCount(filled)}</span>
    <span class="visually-hidden">{copy.partyTabCountSpoken(filled)}</span>
  </BarLink>
  <BarLink href={links.synergies} icon="synergies" current>{copy.pages.synergies}</BarLink>
</BottomBar>

<style>
  /* The pages of the explorer are a column of sections, as wide as a line of text reads well; the gap is between their sections. */
  .synergy {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 20px;
    width: min(100%, 880px);
    margin-inline: auto;
    padding: 20px 16px 32px;
  }

  /* The page of a trait: from 1100 px the focus stands between the two sides it ties to, which need the room (DESIGN § Synergy pages). */
  @media (width >= 1100px) {
    .synergy.wide {
      width: min(100%, 1280px);
    }
  }

  .synergy :global(h1) {
    margin: 0;
    color: var(--text-strong);
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .synergy :global(h2) {
    margin: 0;
    color: var(--text-strong);
    font-size: 15px;
    font-weight: 600;
  }

  .synergy :global(p) {
    margin: 0;
  }

  .count {
    font-family: var(--font-mono);
    font-size: 11px;
  }
</style>
