import { expect, type Locator, type Page } from '@playwright/test';

/** The count a screen reader is told; it follows the typing once it pauses. */
export const announcedCount = (page: Page) => page.getByRole('status');

export const rows = (page: Page) => page.getByRole('listitem');

/**
 * Opens Explore, at `address` when the test comes from a link, and waits for the first row. The traits are fetched once
 * the page is hydrated, so a field typed in before that is lost to the hydration (WebKit gets there last).
 */
export async function openExplore(page: Page, address = './'): Promise<void> {
  await page.goto(address);
  await expect(rows(page).first()).toBeVisible();
}

/** The total the build published: the tests read it so that a data refresh does not break them. */
export async function publishedCount(page: Page): Promise<number> {
  const manifest = (await (await page.request.get('./data/manifest.json')).json()) as { count: number };
  return manifest.count;
}

export const searchBox = (page: Page) => page.getByRole('textbox', { name: 'Search traits' });
export const filters = (page: Page) => page.getByRole('region', { name: 'Filters' });
export const chips = (page: Page) => page.getByRole('group', { name: 'Filters and query terms' });

export const format = (count: number) => count.toLocaleString('en-US');
export const countText = (shown: number, all: readonly unknown[]) => `${format(shown)} of ${format(all.length)} traits`;

/** A class or a trigger in the panel: its name, then the number of traits it would show. */
export const facet = (page: Page, label: string, count?: number): Locator =>
  filters(page).getByRole('button', {
    name: new RegExp(`^${label}\\s*${count === undefined ? '[\\d,]+' : format(count)}\\s*traits$`),
  });

/** One of the two sides of a buff, a debuff or an effect in the panel. */
export const side = (page: Page, keyword: string, which: 'Applies' | 'Relies on'): Locator =>
  filters(page)
    .getByRole('group', { name: keyword, exact: true })
    .getByRole('button', { name: new RegExp(`^${which}\\s`) });

export const mode = (page: Page, label: 'Match all' | 'Match any'): Locator =>
  filters(page).getByRole('group', { name: 'Keyword match mode' }).getByRole('button', { name: label });
