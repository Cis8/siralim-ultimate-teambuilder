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

/** The badge inside the search field that says how many issues the query has (“2 issues”), and opens and shuts their list. */
export const issuesBadge = (page: Page) => page.getByRole('button', { name: /^[\d,]+ issues?$/ });
/** The list under the field of what is wrong with the query. While it is shut it is on the page, hidden. */
export const issuesList = (page: Page) => page.getByRole('list', { name: 'Query issues' });
export const issueRows = (page: Page) => issuesList(page).getByRole('listitem');
/** The button of the list that mends one issue; `label` is what it says (“Change to “class:””). */
export const fixButton = (page: Page, label: string | RegExp) => issuesList(page).getByRole('button', { name: label });
/** The polite line that tells a screen reader how many issues there are and what a fix did. It has no role: a live region needs none. */
export const issuesAnnouncement = (page: Page) => page.locator('.query [aria-live="polite"]');
/** Where the caret of the search field is. */
export const caretOf = (page: Page): Promise<number | null> =>
  searchBox(page).evaluate((field: HTMLInputElement) => field.selectionStart);
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

/** A class or a mechanic in the panel: its name, then the number of traits it would show. */
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

/**
 * The button that opens and closes a section of the panel (Class, Debuffs, Buffs, Effects, Events, Mechanics, Flags). It
 * says how many filters are on inside while the section is shut ("Debuffs 2 on").
 */
export const section = (page: Page, name: string): Locator =>
  filters(page).getByRole('button', { name: new RegExp(`^${name}(\\s|$)`), includeHidden: true });

/** What a section's button opens and closes: the part of the panel that is hidden while the section is shut. */
export async function sectionBody(page: Page, name: string): Promise<Locator> {
  const id = await section(page, name).getAttribute('aria-controls');
  if (id === null) throw new Error(`the section ${name} does not say what it controls`);
  return filters(page).locator(`[id="${id}"]`);
}

/** One of the two sides of a keyword in the panel: Applies and Relies on for a buff, a debuff or an effect, Causes and Reacts for an event. */
export const side = (page: Page, keyword: string, which: 'Applies' | 'Relies on' | 'Causes' | 'Reacts'): Locator =>
  filters(page)
    .getByRole('group', { name: keyword, exact: true, includeHidden: true })
    .getByRole('button', { name: new RegExp(`^${which}\\s`), includeHidden: true });

/** One choice of the "Who" control of the Events section. */
export const who = (page: Page, choice: 'Any' | 'This creature' | 'Your creatures' | 'Enemies'): Locator =>
  filters(page)
    .getByRole('group', { name: 'Who acts', includeHidden: true })
    .getByRole('button', { name: choice, exact: true, includeHidden: true });

export const mode = (page: Page, label: 'Match all' | 'Match any'): Locator =>
  filters(page)
    .getByRole('group', { name: 'Keyword match mode', includeHidden: true })
    .getByRole('button', { name: label, includeHidden: true });

/** One of the two flags of the panel. */
export const flag = (page: Page, label: string): Locator =>
  filters(page).getByRole('checkbox', { name: label, includeHidden: true });
