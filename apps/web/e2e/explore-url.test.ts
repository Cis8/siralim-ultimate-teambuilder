import { expect, test, type Page } from '@playwright/test';
import type { Trait } from '@atlas/core';
import { axeViolations } from './support/axe';
import { publishedDataset } from './support/dataset';
import {
  announcedCount,
  countText,
  facet,
  mode,
  openExplore,
  publishedCount,
  rows,
  searchBox,
  side,
} from './support/explore-page';

// Every search is a link (SPEC §7, ADR-0005): what the page shows is written into the address, and an address brings back
// what it says. The codec itself is tested in `core`; these tests go through the page.

/** The address of the page without its origin and path: what a link carries. */
const addressSearch = (page: Page): string => new URL(page.url()).search;

/** The address follows typing once it pauses, so it is waited for. */
const expectAddressSearch = (page: Page, search: string) => expect.poll(() => addressSearch(page)).toBe(search);

const historyLength = (page: Page) => page.evaluate(() => window.history.length);

const isPressed = (page: Page, label: string, pressed: boolean) =>
  expect(facet(page, label)).toHaveAttribute('aria-pressed', String(pressed));

test.describe('the address of Explore', () => {
  test('carries the query that criterion 1 asks for, and brings it back on reload', async ({ page, request }) => {
    const { traits } = await publishedDataset(request);
    const query = '(vulnerable OR weak) -stack:no';
    // Criterion 1: the traits that mention Vulnerable or Weak, in any column, and that stack.
    const mentions = (trait: Trait): boolean =>
      [trait.creature, trait.family, trait.class, trait.name, trait.description, trait.material].some(
        (column) => column !== null && /vulnerable|weak/i.test(column),
      );
    const expected = traits.filter((trait) => mentions(trait) && trait.stacks);
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(traits.length);
    await openExplore(page);

    await searchBox(page).fill(query);

    await expect(announcedCount(page)).toHaveText(countText(expected.length, traits));
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(query);
    expect([...new URL(page.url()).searchParams.keys()]).toEqual(['q']);

    await page.reload();
    await expect(rows(page).first()).toBeVisible();
    await expect(searchBox(page)).toHaveValue(query);
    await expect(announcedCount(page)).toHaveText(countText(expected.length, traits));
  });

  test('carries the filters that criterion 4 asks for, and brings them back on reload', async ({ page, request }) => {
    const { traits } = await publishedDataset(request);
    const applies = (trait: Trait, key: string) =>
      trait.keywords.some((keyword) => keyword.key === key && keyword.role === 'applies');
    const expected = traits.filter(
      (trait) => ['Life', 'Death'].includes(trait.class) && (applies(trait, 'vulnerable') || applies(trait, 'weak')),
    );
    expect(expected.length).toBeGreaterThan(0);
    await openExplore(page);

    // Classes are an any-of, the keywords follow the all/any switch.
    await facet(page, 'Life').click();
    await facet(page, 'Death').click();
    await side(page, 'Vulnerable', 'Applies').click();
    await side(page, 'Weak', 'Applies').click();
    await mode(page, 'Match any').click();

    await expect(announcedCount(page)).toHaveText(countText(expected.length, traits));
    await expectAddressSearch(page, '?class=life,death&kw=a:vulnerable,a:weak&mode=any');

    await page.reload();
    await expect(rows(page).first()).toBeVisible();
    await isPressed(page, 'Life', true);
    await isPressed(page, 'Death', true);
    await expect(side(page, 'Vulnerable', 'Applies')).toHaveAttribute('aria-pressed', 'true');
    await expect(side(page, 'Weak', 'Applies')).toHaveAttribute('aria-pressed', 'true');
    await expect(mode(page, 'Match any')).toHaveAttribute('aria-pressed', 'true');
    await expect(announcedCount(page)).toHaveText(countText(expected.length, traits));
    expect(await axeViolations(page)).toEqual([]);
  });

  test('is read from a link that someone else wrote, in any letter case and order', async ({ page, request }) => {
    const { traits } = await publishedDataset(request);
    const expected = traits.filter((trait) => trait.class === 'Nature' && !trait.stacks);
    expect(expected.length).toBeGreaterThan(0);

    await openExplore(page, './?stack=NO&sort=AZ&class=Nature');

    await isPressed(page, 'Nature', true);
    await expect(page.getByLabel('Sort')).toHaveValue('az');
    await expect(page.getByRole('checkbox', { name: 'Only “does not stack”' })).toBeChecked();
    await expect(announcedCount(page)).toHaveText(countText(expected.length, traits));
  });

  test('shows the plain page for an address it cannot read, and leaves the address alone', async ({ page }) => {
    const total = await publishedCount(page);
    await openExplore(page, './?class=&mode=bogus&sort=zzz&mat=maybe&kw=nothing&unknown=1');

    await expect(announcedCount(page)).toHaveText(
      `${total.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} traits`,
    );
    await expect(searchBox(page)).toHaveValue('');
    await expect(page.getByLabel('Sort')).toHaveValue('book');
    expect(addressSearch(page)).toBe('?class=&mode=bogus&sort=zzz&mat=maybe&kw=nothing&unknown=1');
  });

  test('keeps the parameters that are not Explore’s, and the path', async ({ page }) => {
    await openExplore(page, './?party=abc&q=weak');
    await expect(searchBox(page)).toHaveValue('weak');
    const path = new URL(page.url()).pathname;

    await facet(page, 'Life').click();

    await expectAddressSearch(page, '?party=abc&q=weak&class=life');
    expect(new URL(page.url()).pathname).toBe(path);
  });

  test.describe('the history', () => {
    test('has one entry for a stretch of typing and a new one for each choice', async ({ page }) => {
      await openExplore(page);
      const before = await historyLength(page);

      await searchBox(page).fill('weak');
      await expectAddressSearch(page, '?q=weak');
      await searchBox(page).pressSequentially(' OR snared');
      await expectAddressSearch(page, '?q=weak+OR+snared');
      expect(await historyLength(page)).toBe(before);

      await facet(page, 'Life').click();
      await expectAddressSearch(page, '?q=weak+OR+snared&class=life');
      expect(await historyLength(page)).toBe(before + 1);
    });

    test('steps back and forward through the choices, each with the query typed before it', async ({ page }) => {
      await openExplore(page);
      await searchBox(page).fill('weak');
      await expectAddressSearch(page, '?q=weak');
      await facet(page, 'Life').click();
      await facet(page, 'Death').click();
      await expectAddressSearch(page, '?q=weak&class=life,death');

      await page.goBack();
      await expectAddressSearch(page, '?q=weak&class=life');
      await isPressed(page, 'Life', true);
      await isPressed(page, 'Death', false);
      await expect(searchBox(page)).toHaveValue('weak');

      await page.goBack();
      await expectAddressSearch(page, '?q=weak');
      await isPressed(page, 'Life', false);
      await expect(searchBox(page)).toHaveValue('weak');

      await page.goForward();
      await page.goForward();
      await expectAddressSearch(page, '?q=weak&class=life,death');
      await isPressed(page, 'Life', true);
      await isPressed(page, 'Death', true);
      await expect(searchBox(page)).toHaveValue('weak');
    });

    test('puts back the list that went with the entry it returns to', async ({ page, request }) => {
      const { traits } = await publishedDataset(request);
      const inClass = (name: string) => traits.filter((trait) => trait.class === name);
      await openExplore(page);
      await facet(page, 'Life').click();
      await expect(announcedCount(page)).toHaveText(countText(inClass('Life').length, traits));
      await facet(page, 'Death').click();
      await expect(announcedCount(page)).toHaveText(
        countText(inClass('Life').length + inClass('Death').length, traits),
      );

      await page.goBack();

      await expect(announcedCount(page)).toHaveText(countText(inClass('Life').length, traits));
      for (const origin of await rows(page).locator('.origin').allTextContents()) expect(origin).toMatch(/· Life$/);
    });

    test('takes a click on a keyword and the sort as steps of their own', async ({ page }) => {
      await openExplore(page);
      await searchBox(page).fill('vulnerable');
      await expectAddressSearch(page, '?q=vulnerable');

      await rows(page)
        .getByRole('button', { name: /^Applies Vulnerable — / })
        .first()
        .click();
      await expectAddressSearch(page, '?q=vulnerable&kw=u:vulnerable');

      await page.getByLabel('Sort').selectOption({ value: 'az' });
      await expectAddressSearch(page, '?q=vulnerable&kw=u:vulnerable&sort=az');

      await page.goBack();
      await expectAddressSearch(page, '?q=vulnerable&kw=u:vulnerable');
      await expect(page.getByLabel('Sort')).toHaveValue('book');

      await page.goBack();
      await expectAddressSearch(page, '?q=vulnerable');
      await expect(side(page, 'Vulnerable', 'Relies on')).toHaveAttribute('aria-pressed', 'false');
    });

    test('drops what was being typed when the browser goes back before the address caught up', async ({ page }) => {
      await openExplore(page);
      await facet(page, 'Life').click();
      await expectAddressSearch(page, '?class=life');

      await searchBox(page).fill('weak');
      await page.goBack();

      await expectAddressSearch(page, '');
      // The pause of the typing has run out by now: the text that was waiting must not have been written to the entry.
      await page.waitForTimeout(700);
      expect(addressSearch(page)).toBe('');
      await expect(searchBox(page)).toHaveValue('');
    });
  });

  test('loses no key typed while the address is being written, and keeps the focus in the field', async ({ page }) => {
    await openExplore(page);
    const search = searchBox(page);
    // The router changes the history in the middle of a navigation, before the page is told that it is over. One key is
    // typed at that very moment, once: a page that read the state back from the address it has just written would put
    // back "weak" over "weak!".
    await search.evaluate((input: HTMLInputElement) => {
      const replaceState = window.history.replaceState.bind(window.history);
      window.history.replaceState = (...args: Parameters<History['replaceState']>) => {
        window.history.replaceState = replaceState;
        replaceState(...args);
        input.value += '!';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
    });
    await search.click();

    await search.pressSequentially('weak');

    await expect(search).toHaveValue('weak!');
    await expect(search).toBeFocused();
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('weak!');
  });

  test('has no WCAG 2.2 AA violations when opened from a link with a query and filters', async ({ page }) => {
    await openExplore(page, './?q=a&class=life,death,nature&sort=az&stack=no');

    expect(await axeViolations(page)).toEqual([]);
  });
});
