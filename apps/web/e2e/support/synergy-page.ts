import { expect, type Locator, type Page } from '@playwright/test';

/** The heading of a Synergy page. */
export const synergyHeading = (page: Page): Locator => page.getByRole('heading', { level: 1 });

/**
 * The field that picks a trait to look at. It is a plain text field until the list under it is attached (as the search's is):
 * asking for the combobox waits for it, so a test never types into a field that is about to change under it.
 */
export const traitPicker = (page: Page): Locator => page.getByRole('combobox', { name: 'Find a trait' });

/** The list under that field while it is open. */
export const traitSuggestions = (page: Page): Locator =>
  page.getByRole('listbox', { name: 'Matching traits' }).getByRole('option');

/** The row of that list for exactly this trait name (a name can begin another's: the row is found by its label). */
export const suggestionFor = (page: Page, name: string): Locator =>
  traitSuggestions(page).filter({
    has: page.locator('.label').filter({ hasText: new RegExp(`^${escapeRegExp(name)}$`) }),
  });

/** The sections of the picker page. */
export const fromParty = (page: Page): Locator => page.getByRole('region', { name: 'Start from your party' });
export const fromKeyword = (page: Page): Locator => page.getByRole('region', { name: 'Start from a keyword' });

/** The places of the app, in the header of a wide screen and in the bar of a narrow one: the same links (ADR-0011). */
export const placeLink = (page: Page, name: 'Explore' | 'Synergies' | 'Party'): Locator =>
  page.getByRole('link', { name: name === 'Party' ? /^Party/ : name, exact: name !== 'Party' });

/** The path of the page, from the root of the site the tests run under (`/synergy/...`), without the base path. */
export function pathOf(page: Page): string {
  const { pathname } = new URL(page.url());
  const base = new URL(process.env.BASE_PATH ?? '', 'http://localhost').pathname.replace(/\/$/u, '');
  return pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
}

/** A parameter of the address of the page. */
export const paramOf = (page: Page, name: string): string | null => new URL(page.url()).searchParams.get(name);

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Waits until the page has the dataset: the picker is a field, and so the words of loading are gone. */
export async function whenLoaded(page: Page): Promise<void> {
  await expect(page.getByText('Loading the traits…')).toHaveCount(0);
}
