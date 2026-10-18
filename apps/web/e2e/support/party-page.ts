import { expect, type Locator, type Page } from '@playwright/test';
import type { Trait } from '@atlas/core';
import { isTabbed, results, searchBox } from './explore-page';

export const partyPanel = (page: Page) => page.getByRole('region', { name: 'Party' });

/** The tabs of a narrow screen, by the name they start with ("Party" is followed by how many slots are filled). */
export const tab = (page: Page, name: 'Explore' | 'Party'): Locator =>
  page.getByRole('tab', { name: new RegExp(`^${name}`) });

/** Shows the party: on a narrow screen its tab is pressed, on a wide one it is in sight already. */
export async function showParty(page: Page): Promise<void> {
  if (!isTabbed(page)) return;
  await tab(page, 'Party').click();
  await expect(partyPanel(page)).toBeVisible();
}

/** Shows the search and its results, as `showParty` shows the party. */
export async function showExplore(page: Page): Promise<void> {
  if (!isTabbed(page)) return;
  await tab(page, 'Explore').click();
  await expect(results(page)).toBeVisible();
}

/** The slot button of the panel, by the slot it stands for ("Creature 1 · Innate"): it makes the slot the target. */
export const slot = (page: Page, label: string): Locator =>
  partyPanel(page).getByRole('button', { name: new RegExp(`^Target slot: ${label},`) });

export const clearButton = (page: Page, label: string): Locator =>
  partyPanel(page).getByRole('button', { name: new RegExp(`^Clear ${label} \\(`) });

export const toolbarButton = (page: Page, name: 'Undo' | 'Redo' | 'Clear party'): Locator =>
  partyPanel(page).getByRole('button', { name, exact: true });

/**
 * The text of the polite line that tells a screen reader what changed in the party. It sits beside the two views, not in the
 * party's, so that a trait added from the results is announced while the party is not on screen.
 */
export const partyAnnouncement = (page: Page): Locator => page.locator('.views > p[aria-live="polite"]');

/** Traits the tests can find by name alone: no other trait of the dataset is called the same. */
export function withUniqueName(traits: readonly Trait[]): Trait[] {
  const counts = new Map<string, number>();
  for (const { name } of traits) counts.set(name, (counts.get(name) ?? 0) + 1);
  return traits.filter(({ name }) => counts.get(name) === 1);
}

/** Creature traits that stack and have a material, so that they can go in any slot of a creature. */
export const plainTraits = (traits: readonly Trait[]): Trait[] =>
  withUniqueName(traits).filter((trait) => trait.kind === 'creature' && trait.stacks && trait.material !== null);

/** Searches for exactly this trait and returns its row. The search is on the Explore tab, wherever the test was. */
export async function findRow(page: Page, trait: Trait): Promise<Locator> {
  await showExplore(page);
  await searchBox(page).fill(`trait:"${trait.name}" family:"${trait.family}"`);
  const row = page
    .getByRole('region', { name: 'Results' })
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { level: 3, name: trait.name, exact: true }) });
  await row.first().waitFor();
  return row.first();
}

/** The "add" button of a row: "Add to Creature 1 · Innate — …", or "Add to… — …" when the target slot refuses the trait. */
export const addButton = (row: Locator): Locator => row.getByRole('button', { name: /^Add to[ …]/ });

/** The "add" button of a trait the target slot refuses but another slot of the creature takes: it opens the choice of slot. */
export const addElsewhereButton = (row: Locator): Locator => row.getByRole('button', { name: /^Add to… — / });

/** The sheet that lists the slots of the target's creature for such a trait. It is on the page, not in the row. */
export const slotChooser = (page: Page): Locator => page.getByRole('dialog', { name: /^Add .+ to Creature \d$/ });

/** One slot of that sheet, by what it says ("Add to Artifact (empty)", "Replace Flesh Rot in Artifact"). */
export const slotChoice = (page: Page, name: string): Locator =>
  slotChooser(page).getByRole('button', { name, exact: true });

/** Finds the trait and presses its "add" button. */
export async function addToParty(page: Page, trait: Trait): Promise<void> {
  await addButton(await findRow(page, trait)).click();
}
