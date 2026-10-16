<script lang="ts">
  import {
    observeWindowOffset,
    observeWindowRect,
    Virtualizer,
    windowScroll,
    type VirtualItem,
  } from '@tanstack/virtual-core';
  import type { Snippet } from 'svelte';

  /**
   * A list that keeps in the document only the rows on screen or near it, so that thousands of them cost no more than a
   * few. The page scrolls it (the results sit among other panels and have no scroll bar of their own); a row is as tall
   * as its content, measured once drawn, and `estimatedHeight` stands in for the rows not seen yet.
   */
  const {
    keys,
    estimatedHeight,
    row,
  }: {
    /** One per row, in order. A row keeps its measured height when it moves, so a key names the same content each time. */
    keys: readonly string[];
    estimatedHeight: number;
    row: Snippet<[index: number]>;
  } = $props();

  /** Rows drawn beyond the screen on each side: enough for a flick of the wheel to find them there. */
  const OVERSCAN = 6;

  let list = $state<HTMLUListElement>();
  /** How far down the document the list begins: what sits above it scrolls with the page. */
  let scrollMargin = $state(0);
  let items = $state.raw<readonly VirtualItem[]>([]);
  let totalHeight = $state(0);

  const options = () => ({
    count: keys.length,
    scrollMargin,
    overscan: OVERSCAN,
    estimateSize: () => estimatedHeight,
    getItemKey: (index: number) => keys[index] ?? index,
    getScrollElement: () => window,
    scrollToFn: windowScroll,
    observeElementRect: observeWindowRect,
    observeElementOffset: observeWindowOffset,
    onChange: publish,
  });

  const virtualizer = new Virtualizer<Window, HTMLLIElement>(options());

  function publish(): void {
    items = virtualizer.getVirtualItems();
    totalHeight = virtualizer.getTotalSize();
  }

  // The two hooks the library gives its framework adapters: one releases what it listens to when the list goes, the other
  // attaches the scroll and size observers and takes in the new options each time they change.
  $effect(() => virtualizer._didMount());

  $effect(() => {
    virtualizer.setOptions(options());
    virtualizer._willUpdate();
    publish();
  });

  // Whatever is above the list can change height (a wrapped line, a panel that opens): the page moves the list, not the
  // other way round, so it has to be asked where the list is.
  $effect(() => {
    const element = list;
    if (element === undefined) return;
    const locate = () => {
      scrollMargin = Math.round(element.getBoundingClientRect().top + window.scrollY);
    };
    locate();
    const observer = new ResizeObserver(locate);
    observer.observe(document.body);
    return () => {
      observer.disconnect();
    };
  });

  const first = $derived(items.at(0));
  const last = $derived(items.at(-1));
  // The rows drawn stay in the flow of the page; what is not drawn above and below them is empty space of its height.
  const spaceAbove = $derived(first === undefined ? 0 : first.start - scrollMargin);
  const spaceBelow = $derived(last === undefined ? totalHeight : totalHeight - (last.end - scrollMargin));

  const measure = (node: HTMLLIElement) => {
    virtualizer.measureElement(node);
  };
</script>

<ul bind:this={list} style:padding-top="{spaceAbove}px" style:padding-bottom="{spaceBelow}px">
  {#each items as item (item.key)}
    <li data-index={item.index} aria-posinset={item.index + 1} aria-setsize={keys.length} {@attach measure}>
      {@render row(item.index)}
    </li>
  {/each}
</ul>

<style>
  ul {
    margin: 0;
    padding-inline: 0;
    list-style: none;
    /* The browser would move the page when rows come and go above the view: the virtualiser already does that. */
    overflow-anchor: none;
  }
</style>
