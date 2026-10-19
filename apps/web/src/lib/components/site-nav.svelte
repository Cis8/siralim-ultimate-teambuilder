<script lang="ts">
  import { page } from '$app/state';
  import { filledSlots } from '@atlas/core';
  import { partySession } from '../composition-root';
  import { copy } from '../copy';
  import { appLinks, carriedNow } from '../synergy-links';

  /**
   * The places of the app in the header of a wide screen (ADR-0011): Explore, the Synergies, and the party, which on a wide screen
   * is a column of Explore. A narrow screen has the same places at the foot of the window (`BottomBar`) and no header links. Each
   * link carries the party, since the address is the source of truth (ADR-0005). The Party link says how full the party is.
   */
  const links = $derived(appLinks(carriedNow()));
  const onSynergy = $derived(page.route.id?.startsWith('/synergy') ?? false);
  const filled = $derived(filledSlots(partySession.planner.history.party));
</script>

<nav class="site-nav" aria-label={copy.pagesLabel}>
  <a href={links.explore} aria-current={onSynergy ? undefined : 'page'}>{copy.pages.explore}</a>
  <a href={links.synergies} aria-current={onSynergy ? 'page' : undefined}>{copy.pages.synergies}</a>
  <a href={links.party}>
    {copy.pages.party}
    <span class="count" aria-hidden="true">{copy.partyTabCount(filled)}</span>
    <span class="visually-hidden">{copy.partyTabCountSpoken(filled)}</span>
  </a>
</nav>

<style>
  /* Wide screens only: under 1100 px the bar at the foot of the window has these places. */
  .site-nav {
    display: none;
    gap: 4px;
    margin-inline-start: auto;
  }

  a {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 0 12px;
    border-radius: var(--radius);
    color: var(--text-muted);
    text-decoration: none;
  }

  a:hover {
    color: var(--text-strong);
  }

  /* The current page has a fill and is heavier: colour is not all that tells it apart. */
  a[aria-current='page'] {
    background: var(--surface-3);
    color: var(--text-strong);
    font-weight: 600;
  }

  .count {
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 12px;
  }

  @media (width >= 1100px) {
    .site-nav {
      display: flex;
    }
  }

  @media (pointer: coarse) {
    a {
      min-height: var(--target-min);
    }
  }
</style>
