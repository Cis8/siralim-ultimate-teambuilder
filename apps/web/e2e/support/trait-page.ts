import type { Locator, Page } from '@playwright/test';
import { createRelationIndex, taxonomy, type RelationIndex, type Trait } from '@atlas/core';
import { withUniqueName } from './party-page';

/** What core says about how the traits of the published dataset relate: the page is held to it, as Explore's counts are. */
export const relationsOfDataset = (traits: readonly Trait[]): RelationIndex => createRelationIndex(traits, taxonomy);

/** The card of the trait in focus. */
export const focusCard = (page: Page): Locator => page.getByRole('region', { name: 'Focused trait' });

/** One of the two sides of the page: what enables the focus, what it enables. The heading holds the count, after the name. */
export const side = (page: Page, name: 'Enabled by' | 'Enables'): Locator =>
  page.getByRole('region', { name: new RegExp(`^${name} \\d`) });

/** A lane of a side, by the start of its heading: "Applies Vulnerable", "Several keys". */
export const lane = (scope: Locator, heading: string): Locator =>
  scope.getByRole('region', { name: new RegExp(`^${heading} \\d`) });

/** The card in `scope` for this trait: its name is a link that says "Re-centre on …". */
export const cardOf = (scope: Locator, name: string): Locator =>
  scope
    .getByRole('listitem')
    .filter({ has: scope.page().getByRole('link', { name: `Re-centre on ${name}`, exact: true }) });

/** Every card in `scope`. */
export const cards = (scope: Locator): Locator =>
  scope.getByRole('listitem').filter({ has: scope.page().getByRole('link', { name: /^Re-centre on / }) });

/** The "add" button of a card or of the focus: "Add to Creature 1 · Innate — …", or "Add to… — …". */
export const addOf = (scope: Locator): Locator => scope.getByRole('button', { name: /^Add to[ …]/ });

/** The steps of the trail, and the step the person is on. */
export const trail = (page: Page): Locator => page.getByRole('navigation', { name: 'Exploration trail' });

export const artifactFilter = (page: Page): Locator => page.getByRole('checkbox', { name: 'Artifact-eligible only' });

/** The polite line of the Synergy pages: what a screen reader is told of a change of the party. */
export const synergyAnnouncement = (page: Page): Locator => page.locator('.synergy ~ p[aria-live="polite"]');

/** The polite line of the page of a trait: what a screen reader is told when the artifact filter is turned on or off. */
export const filterAnnouncement = (page: Page): Locator => page.locator('.synergy > p[aria-live="polite"]');

/** A button of the heading of a group of random sources, which folds the group away. */
export const randomToggle = (scope: Locator): Locator => scope.getByRole('button', { name: /^Random sources · / });

/** The first trait of `traits` (with a name no other trait has, so that a page can be asked for it by name) that `fits`. */
export function firstUnique(traits: readonly Trait[], fits: (trait: Trait) => boolean, because: string): Trait {
  const found = withUniqueName(traits).find(fits);
  if (found === undefined) throw new Error(`the dataset has no trait ${because}`);
  return found;
}
