<script lang="ts">
  import type { Snippet } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { copy } from '../copy';
  import BottomSheet from './bottom-sheet.svelte';

  /**
   * Where the filters are (DESIGN § Layout). On a wide screen a column beside the list, which stays in view while the long
   * list scrolls; on a narrow one a sheet over the page, opened by a button at the foot of the window so that it is at hand
   * wherever the list is scrolled to. The panel is the same one, handed over as `children`; `closeLabel` and `status` say what
   * it shows now, on the sheet's close button and to a screen reader. The button comes first in the page (the tab key reaches
   * it before the list), and the page leaves room for it. The button is offered only while `onScreen`: the filters are those
   * of the Explore view, and a view that is not shown has no use for them. It sits above the tabs when there are tabs.
   */
  const {
    activeCount,
    closeLabel,
    status,
    onScreen,
    children,
  }: { activeCount: number; closeLabel: string; status: string; onScreen: boolean; children: Snippet } = $props();

  /** The stylesheet of the page has the same width in its media queries: it cannot read this one. */
  const compact = new MediaQuery('max-width: 699px');
  const uid = $props.id();
  let open = $state(false);
  let button = $state<HTMLButtonElement>();

  // A sheet is gone when the window widens past it; it must not come back open when the window narrows again.
  $effect(() => {
    if (!compact.current) open = false;
  });

  /** The sheet is shut, however: the focus goes back to the button that opened it. */
  function closed(): void {
    open = false;
    button?.focus();
  }
</script>

{#if compact.current}
  {#if onScreen}
    <div class="filters-bar">
      <button
        type="button"
        aria-haspopup="dialog"
        bind:this={button}
        onclick={() => {
          open = true;
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        {copy.openFilters}
        {#if activeCount > 0}
          <span class="badge">{activeCount}<span class="visually-hidden">{copy.openFiltersActiveUnit}</span></span>
        {/if}
      </button>
    </div>
  {/if}
  <BottomSheet {open} title={copy.filtersHeading} {closeLabel} {status} onclose={closed}>
    {@render children()}
  </BottomSheet>
{:else}
  <section class="column" aria-labelledby="{uid}-heading">
    <div class="filters-body">
      <h2 id="{uid}-heading" class="panel-heading">{copy.filtersHeading}</h2>
      {@render children()}
    </div>
  </section>
{/if}

<style>
  .column {
    border-right: 1px solid var(--border);
  }

  /*
   * The page is prerendered before it knows how wide the window is, so it holds the column. Where a sheet takes the filters'
   * place (`compact`, the same width) the stylesheet drops it at once: otherwise it is drawn, and the list under it moves up
   * when the page starts running (cumulative layout shift).
   */
  @media (max-width: 699px) {
    .column {
      display: none;
    }
  }

  /*
   * The list is long and the page scrolls, so the filters stay in view beside it, with a scroll of their own when they are
   * taller than what the window shows of them (the part under the query section until the page is scrolled past it, see
   * `trackViewportOffset`). The rule between the columns is on the column, which is as tall as the list.
   */
  .filters-body {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: calc(100dvh - var(--viewport-offset, 0px));
    padding: 16px;
    overflow-y: auto;
  }

  /* The bar covers the foot of the window: the root takes its height into the room it leaves at the foot (see base.css). */
  :global(:root:has(.filters-bar)) {
    --filters-bar-height: 61px;
  }

  .filters-bar {
    position: fixed;
    inset: auto 0 var(--tab-bar-height, 0px);
    z-index: 5;
    display: flex;
    align-items: center;
    height: var(--filters-bar-height);
    padding: 0 16px;
    border-top: 1px solid var(--border);
    background: var(--bg-bar);
  }

  .filters-bar button {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: var(--target-min);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--surface-3);
    color: var(--text-strong);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }

  .badge {
    padding: 1px 7px;
    border-radius: 9px;
    background: var(--accent);
    color: var(--bg-bar);
    font-family: var(--font-mono);
    font-size: 11px;
  }
</style>
