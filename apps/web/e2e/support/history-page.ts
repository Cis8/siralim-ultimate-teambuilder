import { expect, type Locator, type Page } from '@playwright/test';
import { searchBox } from './explore-page';

/** Where the browser keeps the recent and saved searches (`search-history-store.ts`). */
const HISTORY_KEY = 'trait-atlas:search-history';

/** The searches a person has made and kept. */
export interface KeptSearches {
  readonly recent: readonly string[];
  readonly saved: readonly { readonly name: string; readonly query: string }[];
}

/** The text of a file of searches, as Export writes it. */
export const searchesFile = ({ recent, saved }: KeptSearches): string =>
  JSON.stringify({ app: 'trait-atlas', kind: 'search-history', version: 1, recent, saved }, null, 2);

/** Saved searches whose name is their query, as a star makes them. */
export const savedAs = (...queries: readonly string[]): KeptSearches['saved'] =>
  queries.map((query) => ({ name: query, query }));

/**
 * Starts every page this test opens with these searches already kept in the browser, as an earlier visit would have left them. They
 * are put there once: a page opened again later (a reload) finds what the person did meanwhile, not the start.
 */
export async function keepSearches(page: Page, searches: KeptSearches): Promise<void> {
  await page.addInitScript(
    ([key, text]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, text);
    },
    [HISTORY_KEY, searchesFile(searches)] as const,
  );
}

/** What the browser keeps now, read as the page left it. */
export async function keptSearches(page: Page): Promise<unknown> {
  const text = await page.evaluate((key) => localStorage.getItem(key), HISTORY_KEY);
  return text === null ? null : JSON.parse(text);
}

/** The star beside the search field; it is there while the field holds something to keep. */
export const saveSearchButton = (page: Page): Locator => page.getByRole('button', { name: 'Save this search' });

/** The button inside the search field that opens the sheet of searches (a refusal to save may offer another beside the field). */
export const manageSearchesButton = (page: Page): Locator =>
  page.locator('.query .field').getByRole('button', { name: 'Manage searches' });

/** The list a blank field offers, while it is showing; its rows are `historyRows`. */
export const historyList = (page: Page): Locator => page.getByRole('listbox', { name: 'Recent and saved searches' });
export const historyRows = (page: Page): Locator => historyList(page).getByRole('option');

/** The line under the field that says why the star did nothing. */
export const saveRefusal = (page: Page): Locator => page.locator('.query .refusal');

/** The sheet where the searches are managed, while it is open. */
export const searchesSheet = (page: Page): Locator => page.getByRole('dialog', { name: 'Manage searches' });

/** The rows of one list of the sheet: the button of each search that puts it in the field. */
export const sheetSearches = (page: Page, list: 'Saved' | 'Recent'): Locator =>
  searchesSheet(page)
    .getByRole('region', { name: new RegExp(`^${list} \\(`) })
    .locator('button.use');

/** The buttons that forget a search, in either list. */
export const forgetButtons = (page: Page): Locator => searchesSheet(page).getByRole('button', { name: /^Remove / });

/**
 * Shows the list a blank field offers, in the page, without a press: on a touch screen a press on the field opens the search sheet
 * instead (its list is the subject of `search-sheet.test.ts`), so a test about the list of the page asks with Alt+Down, which opens
 * the list without choosing and is the same on every screen.
 */
export async function openHistoryList(page: Page): Promise<void> {
  await searchBox(page).focus();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(historyList(page)).toBeVisible();
}

export async function openSearchesSheet(page: Page): Promise<void> {
  await manageSearchesButton(page).click();
  await expect(searchesSheet(page)).toBeVisible();
}
