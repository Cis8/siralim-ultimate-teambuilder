import { expect, type Locator, type Page } from '@playwright/test';

/** The count a screen reader is told; it follows the typing once it pauses. */
export const announcedCount = (page: Page) => page.getByRole('status');

/** The results of the search; the party beside them has lists of its own. */
export const results = (page: Page) => page.getByRole('region', { name: 'Results' });

export const rows = (page: Page) => results(page).getByRole('listitem');

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

/** Scrolls the page down by `screens` heights of the window (a fraction too), as a person does with a long list. */
export async function scrollScreens(page: Page, screens: number): Promise<void> {
  await page.evaluate((count) => {
    window.scrollTo(0, window.innerHeight * count);
  }, screens);
}

/** How far the page is scrolled. */
export const scrolledBy = (page: Page): Promise<number> => page.evaluate(() => window.scrollY);

/** The button fixed at the top right of a page that is scrolled more than a screen into the list. */
export const backToTopButton = (page: Page) => page.getByRole('button', { name: 'Back to top' });

/** The heading of the page, where the focus goes when the page is taken back to its top. */
export const pageHeading = (page: Page) => page.getByRole('heading', { level: 1, name: 'Explore traits' });

export const searchBox = (page: Page) => page.getByRole('textbox', { name: 'Search traits' });
export const chips = (page: Page) => page.getByRole('group', { name: 'Filters and query terms' });

/** Below this width (the `compact` query of the page) the filters are a sheet to open, not a column beside the list. */
const COMPACT_BELOW = 700;
export const isCompact = (page: Page): boolean => (page.viewportSize()?.width ?? COMPACT_BELOW) < COMPACT_BELOW;

/** Below this width (the `tabbed` query of the page) Explore and Party are tabs, not a column beside the list. */
const TABBED_BELOW = 1100;
export const isTabbed = (page: Page): boolean => (page.viewportSize()?.width ?? TABBED_BELOW) < TABBED_BELOW;

/** The button that opens the filters on a narrow screen. */
export const filtersButton = (page: Page) => page.getByRole('button', { name: /^Filters/ });
export const filtersSheet = (page: Page) => page.getByRole('dialog', { name: 'Filters', includeHidden: true });

/**
 * The filters, wherever the screen puts them. Their state can be read with the sheet shut (they are hidden, not gone, and
 * `includeHidden` finds them); a press needs them in view, so a test opens the sheet first (`openFilters`).
 */
export const filters = (page: Page) =>
  isCompact(page) ? filtersSheet(page) : page.getByRole('region', { name: 'Filters' });

/** Shows the filters: on a narrow screen the sheet is opened, on a wide one they are there already. */
export async function openFilters(page: Page): Promise<void> {
  if (!isCompact(page)) return;
  await filtersButton(page).click();
  await expect(filtersSheet(page)).toBeVisible();
}

/** Puts the filters away, as a person does with the page behind the sheet: its close button says what they show. */
export async function closeFilters(page: Page): Promise<void> {
  if (!isCompact(page)) return;
  await filtersSheet(page)
    .getByRole('button', { name: /^Show / })
    .click();
  await expect(filtersSheet(page)).toBeHidden();
}

export const format = (count: number) => count.toLocaleString('en-US');
export const countText = (shown: number, all: readonly unknown[]) => `${format(shown)} of ${format(all.length)} traits`;

/** A class or a trigger in the panel: its name, then the number of traits it would show. */
export const facet = (page: Page, label: string, count?: number): Locator =>
  filters(page).getByRole('button', {
    name: new RegExp(`^${label}\\s*${count === undefined ? '[\\d,]+' : format(count)}\\s*traits$`),
    includeHidden: true,
  });

/** The names of the classes in the panel, in the order it lists them. */
export const classFacetNames = (page: Page): Locator =>
  filters(page)
    .getByRole('group', { name: 'Class', exact: true, includeHidden: true })
    .getByRole('button', { includeHidden: true })
    .locator('.label');

/** The button that takes every filter off; it says how many are on, and is `aria-disabled` when none is. */
export const clearFiltersButton = (page: Page): Locator =>
  filters(page).getByRole('button', { name: /^Clear filters/, includeHidden: true });

/** One of the two sides of a buff, a debuff or an effect in the panel. */
export const side = (page: Page, keyword: string, which: 'Applies' | 'Relies on'): Locator =>
  filters(page)
    .getByRole('group', { name: keyword, exact: true, includeHidden: true })
    .getByRole('button', { name: new RegExp(`^${which}\\s`), includeHidden: true });

export const mode = (page: Page, label: 'Match all' | 'Match any'): Locator =>
  filters(page)
    .getByRole('group', { name: 'Keyword match mode', includeHidden: true })
    .getByRole('button', { name: label, includeHidden: true });

/** One of the two flags of the panel. */
export const flag = (page: Page, label: string): Locator =>
  filters(page).getByRole('checkbox', { name: label, includeHidden: true });
