<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import { copy } from '../copy';
  import { PAGE_TABS, panelId, tabForKey, tabId, type PageTab } from '../page-tab';
  import BarIcon from './bar-icon.svelte';
  import BarLink from './bar-link.svelte';
  import BottomBar from './bottom-bar.svelte';

  /**
   * The views of a narrow screen as tabs at the foot of the window (DESIGN § Layout, ARIA tabs pattern): the selected tab is
   * the one in the tab order, the arrows, Home and End move along them and select as they go, and each tab names the panel it
   * shows. The page keeps the panels; this says which is on screen and asks for another. Beside the tabs, outside the tab
   * list, is the link to the Synergies, a page of its own (ADR-0011).
   */
  const {
    selected,
    partyFilled,
    synergiesHref,
    onselect,
  }: { selected: PageTab; partyFilled: number; synergiesHref: ResolvedPathname; onselect: (tab: PageTab) => void } =
    $props();

  const buttons: Partial<Record<PageTab, HTMLButtonElement>> = {};

  function onkeydown(event: KeyboardEvent): void {
    const next = tabForKey(event.key, selected, PAGE_TABS);
    if (next === undefined) return;
    event.preventDefault();
    buttons[next]?.focus();
    onselect(next);
  }
</script>

<BottomBar>
  <div class="tabs" role="tablist" aria-label={copy.sectionsLabel}>
    {#each PAGE_TABS as tab (tab)}
      <button
        type="button"
        class="bar-item"
        role="tab"
        id={tabId(tab)}
        aria-selected={tab === selected}
        aria-controls={panelId(tab)}
        tabindex={tab === selected ? 0 : -1}
        bind:this={buttons[tab]}
        {onkeydown}
        onclick={() => {
          onselect(tab);
        }}
      >
        <BarIcon name={tab} />
        <span>
          {copy.tabs[tab]}
          {#if tab === 'party'}
            <span class="count" aria-hidden="true">{copy.partyTabCount(partyFilled)}</span>
            <span class="visually-hidden">{copy.partyTabCountSpoken(partyFilled)}</span>
          {/if}
        </span>
      </button>
    {/each}
  </div>
  <BarLink href={synergiesHref} icon="synergies">{copy.pages.synergies}</BarLink>
</BottomBar>

<style>
  /* The tabs take two thirds of the bar, the link the rest: three items of one width. */
  .tabs {
    display: flex;
    flex: 2;
  }

  .count {
    font-family: var(--font-mono);
    font-size: 11px;
  }
</style>
