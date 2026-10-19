import type { Locator, Page } from '@playwright/test';
import { type KeywordStats, type KeywordVerdict } from '@atlas/core';

/** The head of the page of a keyword: its name, the counts, the verdict and the keywords its appliers also apply. */
export const keywordSummary = (page: Page): Locator => page.locator('header.summary');

/** One of the two lists of the page, by its title; the heading holds the count after the name. */
export const keywordList = (page: Page, title: 'Appliers' | 'Rely on it'): Locator =>
  page.getByRole('region', { name: new RegExp(`^${title} \\d`) });

/** The picker of the other keywords, at the foot of the page. */
export const keywordChips = (page: Page): Locator => page.getByRole('region', { name: 'Keywords' });

/** The cards of a list of the page: the name of each is a link that says "Open …", the page being no trait's. */
export const keywordCards = (scope: Locator): Locator =>
  scope.getByRole('listitem').filter({ has: scope.page().getByRole('link', { name: /^Open / }) });

/** The card in `scope` for this trait. */
export const keywordCardOf = (scope: Locator, name: string): Locator =>
  scope.getByRole('listitem').filter({ has: scope.page().getByRole('link', { name: `Open ${name}`, exact: true }) });

/** The link of a list to the same traits in Explore. */
export const seeInExplore = (scope: Locator): Locator => scope.getByRole('link', { name: /^See in Explore/ });

/** The keywords the appliers also apply, as the links of the summary. */
export const togetherLinks = (page: Page): Locator => keywordSummary(page).getByRole('list').getByRole('link');

/** The words of the verdicts (the oracle of the tests: the page is held to these, not to its own copy). */
export const VERDICT_TITLES: Readonly<Record<KeywordVerdict, string>> = {
  supported: 'Well supported',
  scarce: 'Scarce enabler',
  'no-payoff': 'No payoff yet',
  'only-random': 'Only by chance',
  'only-conditional': 'Only under a condition',
  'no-source': 'No source',
};

/**
 * The name of the chip of a keyword: its label, then what a screen reader is told of the counts. The browser puts a space between
 * the label and the hidden words, so the comma may follow one.
 */
export const chipName = (label: string, { appliers, users }: KeywordStats): RegExp =>
  new RegExp(
    String.raw`^${escapeRegExp(label)}\s*, ${String(appliers)} ${appliers === 1 ? 'applier' : 'appliers'}, ${String(users)} ${users === 1 ? 'user' : 'users'}$`,
    'u',
  );

/** The chip of a keyword, whatever its counts are. */
export const chipOf = (scope: Locator, label: string): Locator =>
  scope.getByRole('link', { name: new RegExp(String.raw`^${escapeRegExp(label)}\s*,`, 'u') });

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

/** "1 trait", "8 traits": the count a screen reader hears after the name of a list. */
export const traitsText = (count: number): string => `${String(count)} ${count === 1 ? 'trait' : 'traits'}`;
