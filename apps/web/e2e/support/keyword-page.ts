import { expect, type Locator, type Page } from '@playwright/test';
import { type KeywordStats, type KeywordVerdict } from '@atlas/core';
import { isCompact } from './explore-page';

/** The head of the page of a keyword: its name, the counts, the verdict and the keywords its appliers also apply. */
export const keywordSummary = (page: Page): Locator => page.locator('header.summary');

/** One of the two lists of the page, by its title; the heading holds the count after the name. */
export const keywordList = (page: Page, title: 'Appliers' | 'Rely on it'): Locator =>
  page.getByRole('region', { name: new RegExp(`^${title} \\d`) });

/** The tab list of a phone, where the two lists are tabs, and one tab of it: its name holds the count after the label. */
export const keywordTabs = (page: Page): Locator => page.getByRole('tablist', { name: 'Keyword lists' });
export const keywordTab = (page: Page, title: 'Appliers' | 'Rely on it'): Locator =>
  keywordTabs(page).getByRole('tab', { name: new RegExp(`^${title} \\d`) });

/** A list of the page, brought forward: under 700 px the two lists are tabs, one on show, and from there they are side by side. */
export async function shownKeywordList(page: Page, title: 'Appliers' | 'Rely on it'): Promise<Locator> {
  if (isCompact(page)) {
    await keywordTab(page, title).click();
    await expect(keywordTab(page, title)).toHaveAttribute('aria-selected', 'true');
  }
  return keywordList(page, title);
}

/** The picker of the other keywords: at the foot of the page, and on a phone in a sheet (`openKeywordChips` opens it). */
export const keywordChips = (page: Page): Locator =>
  page.getByRole('region', { name: 'Keywords' }).or(page.getByRole('dialog', { name: 'Keywords' }));

/** The picker, brought forward: on a phone a button opens the sheet that holds it. */
export async function openKeywordChips(page: Page): Promise<Locator> {
  if (isCompact(page)) {
    await page.getByRole('button', { name: 'Other keywords' }).click();
    await expect(page.getByRole('dialog', { name: 'Keywords' })).toBeVisible();
  }
  return keywordChips(page);
}

/** Puts the picker away, as a person does with the sheet of a phone (the page behind it is out of reach until then). */
export async function closeKeywordChips(page: Page): Promise<void> {
  if (!isCompact(page)) return;
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Keywords' })).toBeHidden();
}

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
