import type { Locator, Page } from '@playwright/test';
import type { Trait } from '@atlas/core';
import { searchBox } from './explore-page';

export const partyPanel = (page: Page) => page.getByRole('region', { name: 'Party' });

/** The slot button of the panel, by the slot it stands for ("Creature 1 · Innate"): it makes the slot the target. */
export const slot = (page: Page, label: string): Locator =>
  partyPanel(page).getByRole('button', { name: new RegExp(`^Target slot: ${label},`) });

export const clearButton = (page: Page, label: string): Locator =>
  partyPanel(page).getByRole('button', { name: new RegExp(`^Clear ${label} \\(`) });

export const toolbarButton = (page: Page, name: 'Undo' | 'Redo' | 'Clear party'): Locator =>
  partyPanel(page).getByRole('button', { name, exact: true });

/** The text of the polite line that tells a screen reader what changed in the party. */
export const partyAnnouncement = (page: Page): Locator => partyPanel(page).locator('p[aria-live="polite"]');

/** Traits the tests can find by name alone: no other trait of the dataset is called the same. */
export function withUniqueName(traits: readonly Trait[]): Trait[] {
  const counts = new Map<string, number>();
  for (const { name } of traits) counts.set(name, (counts.get(name) ?? 0) + 1);
  return traits.filter(({ name }) => counts.get(name) === 1);
}

/** Searches for exactly this trait and returns its row. */
export async function findRow(page: Page, trait: Trait): Promise<Locator> {
  await searchBox(page).fill(`trait:"${trait.name}" family:"${trait.family}"`);
  const row = page
    .getByRole('region', { name: 'Results' })
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { level: 3, name: trait.name, exact: true }) });
  await row.first().waitFor();
  return row.first();
}

export const addButton = (row: Locator): Locator => row.getByRole('button', { name: /^Add to / });

/** Finds the trait and presses its "add" button. */
export async function addToParty(page: Page, trait: Trait): Promise<void> {
  await addButton(await findRow(page, trait)).click();
}
