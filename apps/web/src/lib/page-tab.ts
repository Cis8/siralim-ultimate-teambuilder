import type { ParamReader, UrlParams } from '@atlas/core';

/**
 * The views of the page (DESIGN § Layout). Where the screen is wide they sit side by side; where it is narrow one is shown
 * at a time, picked by a tab. The Synergies tab of Phase 2 joins them here.
 */
export const PAGE_TABS = ['explore', 'party'] as const;
export type PageTab = (typeof PAGE_TABS)[number];

/** The tab a page opens on, and the one an address that names none stands for. */
export const initialTab: PageTab = 'explore';

/** The parameters of the tab (SPEC §7). A page that shares its address with other views clears these before it writes. */
export const TAB_PARAMS = ['tab'] as const;

const isPageTab = (name: string): name is PageTab => PAGE_TABS.some((tab) => tab === name);

/** Reads the tab an address stands for. Any address is one: a name that is no tab is the initial tab. */
export function decodeTab(params: ParamReader): PageTab {
  const name = params.get('tab')?.trim().toLowerCase() ?? '';
  return isPageTab(name) ? name : initialTab;
}

/** The parameters that make an address stand for `tab`: none for the initial tab, so that its address is the plain one. */
export function encodeTab(tab: PageTab): UrlParams {
  return tab === initialTab ? [] : [['tab', tab]];
}

/** The tab a key of the tab list moves to (ARIA tabs pattern): the arrows go round, Home and End to the ends. */
export function tabForKey(key: string, current: PageTab): PageTab | undefined {
  const at = PAGE_TABS.indexOf(current);
  switch (key) {
    case 'ArrowRight':
      return PAGE_TABS[(at + 1) % PAGE_TABS.length];
    case 'ArrowLeft':
      return PAGE_TABS[(at - 1 + PAGE_TABS.length) % PAGE_TABS.length];
    case 'Home':
      return PAGE_TABS[0];
    case 'End':
      return PAGE_TABS.at(-1);
    default:
      return undefined;
  }
}

/** What a tab and its panel are called in the page, so that each names the other (`aria-controls`, `aria-labelledby`). */
export const tabId = (tab: PageTab): string => `${tab}-tab`;
export const panelId = (tab: PageTab): string => `${tab}-panel`;
