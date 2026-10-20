import { expect, type Locator, type Page } from '@playwright/test';
import { searchBox } from './explore-page';

/**
 * Whether a press on the search field opens the search sheet in this page: a narrow screen that is touched (`SEARCH_SHEET_MEDIA`,
 * `search-sheet.ts`). The phone projects of Playwright are touch screens of 412 and 390 px; the desktop project has a mouse.
 */
export const sheetApplies = (page: Page): Promise<boolean> =>
  page.evaluate(() => matchMedia('(max-width: 699px) and (pointer: coarse)').matches);

/** The full-screen dialog a press on the search field opens, while it is open. */
export const searchSheet = (page: Page): Locator => page.getByRole('dialog', { name: 'Search', exact: true });

/** The field in the sheet (the one in the page is behind it, and inert). */
export const sheetField = (page: Page): Locator => searchSheet(page).getByRole('combobox', { name: 'Search traits' });

export const backButton = (page: Page): Locator => searchSheet(page).getByRole('button', { name: 'Back to results' });
export const clearButton = (page: Page): Locator => searchSheet(page).getByRole('button', { name: 'Clear search' });

/** The button at the foot that closes the sheet and says how many traits the search shows. */
export const showTraitsButton = (page: Page): Locator => searchSheet(page).getByRole('button', { name: /^Show / });

/** The list under the field: suggestions, or the searches of a blank field that has a history. */
export const sheetOptions = (page: Page): Locator => searchSheet(page).getByRole('listbox').getByRole('option');

/** The line that says the first thing wrong with the query, and the button that mends it. */
export const issueBanner = (page: Page): Locator => searchSheet(page).locator('.banner');
export const bannerFix = (page: Page, name: string | RegExp): Locator =>
  issueBanner(page).getByRole('button', { name });

/** "Reads as", the query in plain language. */
export const readsAs = (page: Page): Locator => searchSheet(page).locator('.reads');

export const syntaxToolbar = (page: Page): Locator =>
  searchSheet(page).getByRole('toolbar', { name: 'Insert query syntax' });

/** A button of the toolbar, by what it shows on its face (`(`, `OR`, `mat:yes`). */
export const syntaxButton = (page: Page, label: string): Locator =>
  syntaxToolbar(page)
    .getByRole('button')
    .filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`, 'u') });

/** The star and the button of searches that the sheet has beside its list. */
export const sheetSaveButton = (page: Page): Locator =>
  searchSheet(page).getByRole('button', { name: 'Save this search' });
export const sheetManageButton = (page: Page): Locator =>
  searchSheet(page).getByRole('button', { name: 'Manage searches' });

/** Where the caret of the field of the sheet is. */
export const sheetCaret = (page: Page): Promise<number | null> =>
  sheetField(page).evaluate((field: HTMLInputElement) => field.selectionStart);

/** Presses the search field of the page the way a finger does, and waits for the sheet with the focus in its field. */
export async function openSearchSheet(page: Page): Promise<void> {
  await searchBox(page).tap();
  await expect(searchSheet(page)).toBeVisible();
  await expect(sheetField(page)).toBeFocused();
}
