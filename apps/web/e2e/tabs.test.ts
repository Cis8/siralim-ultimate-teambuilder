import { expect, test, type Locator, type Page } from '@playwright/test';
import { axeViolations } from './support/axe';
import { publishedDataset } from './support/dataset';
import { filtersButton, isCompact, isTabbed, openExplore, results, rows, searchBox } from './support/explore-page';
import {
  addToParty,
  partyAnnouncement,
  partyPanel,
  plainTraits,
  showExplore,
  showParty,
  tab,
} from './support/party-page';

// Where the party has no room beside the list (under 1100 px) Explore and Party are tabs at the foot of the window
// (DESIGN § Layout, SPEC §7): one view on screen at a time, the tab in the address, the page where each was left.

const tablist = (page: Page) => page.getByRole('tablist', { name: 'Sections' });
const searchParam = (page: Page, name: string) => new URL(page.url()).searchParams.get(name);

/** The top and the foot of what a locator draws, in the window. */
async function edges(locator: Locator): Promise<{ top: number; bottom: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('the element is not drawn');
  return { top: box.y, bottom: box.y + box.height };
}

/** The position in the whole list of the first row the window shows any of. */
const firstRowInView = (page: Page): Promise<string | null> =>
  rows(page).evaluateAll(
    (items) => items.find((item) => item.getBoundingClientRect().bottom > 0)?.getAttribute('aria-posinset') ?? null,
  );

test.describe('the tabs', () => {
  test.describe('on a narrow screen', () => {
    test.beforeEach(({ page }) => {
      test.skip(!isTabbed(page), 'A wide window has the party beside the list.');
    });

    test('shows Explore first and the party only once its tab is pressed', async ({ page }) => {
      await openExplore(page);

      await expect(tablist(page)).toBeVisible();
      await expect(tab(page, 'Explore')).toHaveAttribute('aria-selected', 'true');
      await expect(tab(page, 'Party')).toHaveAttribute('aria-selected', 'false');
      await expect(results(page)).toBeVisible();
      await expect(searchBox(page)).toBeVisible();
      await expect(partyPanel(page)).toBeHidden();
      await expect(page.getByRole('tabpanel')).toHaveCount(1);
      await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Explore');

      await tab(page, 'Party').click();

      await expect(tab(page, 'Party')).toHaveAttribute('aria-selected', 'true');
      await expect(tab(page, 'Explore')).toHaveAttribute('aria-selected', 'false');
      await expect(partyPanel(page)).toBeVisible();
      await expect(results(page)).toBeHidden();
      await expect(searchBox(page)).toBeHidden();
      await expect(page.getByRole('tabpanel')).toHaveCount(1);
      await expect(page.getByRole('tabpanel')).toHaveAccessibleName(/^Party/);
    });

    test('has each tab name the panel it shows, and the panel the tab', async ({ page }) => {
      await openExplore(page);

      for (const name of ['Explore', 'Party'] as const) {
        const id = await tab(page, name).getAttribute('aria-controls');
        const panel = page.locator(`[id="${id ?? ''}"]`);
        await expect(panel).toHaveAttribute('role', 'tabpanel');
        await expect(panel).toHaveAttribute('aria-labelledby', (await tab(page, name).getAttribute('id')) ?? '');
      }
    });

    test('keeps one tab in the tab order, and moves along them with the arrows, Home and End', async ({ page }) => {
      await openExplore(page);
      await expect(tab(page, 'Explore')).toHaveAttribute('tabindex', '0');
      await expect(tab(page, 'Party')).toHaveAttribute('tabindex', '-1');

      // Safari does not focus a button that is clicked: the keyboard is what is tested, so the focus is put there first.
      await tab(page, 'Explore').focus();
      await page.keyboard.press('ArrowRight');
      await expect(tab(page, 'Party')).toBeFocused();
      await expect(tab(page, 'Party')).toHaveAttribute('aria-selected', 'true');
      await expect(tab(page, 'Party')).toHaveAttribute('tabindex', '0');
      await expect(tab(page, 'Explore')).toHaveAttribute('tabindex', '-1');
      await expect(partyPanel(page)).toBeVisible();

      await page.keyboard.press('ArrowRight');
      await expect(tab(page, 'Explore')).toBeFocused();
      await expect(tab(page, 'Explore')).toHaveAttribute('aria-selected', 'true');

      await page.keyboard.press('ArrowLeft');
      await expect(tab(page, 'Party')).toBeFocused();
      await page.keyboard.press('Home');
      await expect(tab(page, 'Explore')).toBeFocused();
      await expect(tab(page, 'Explore')).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('End');
      await expect(tab(page, 'Party')).toBeFocused();
      await expect(tab(page, 'Party')).toHaveAttribute('aria-selected', 'true');
    });

    test('says on the party tab how many slots are filled, and tells an addition made out of its sight', async ({
      page,
      request,
    }) => {
      const [first] = plainTraits((await publishedDataset(request)).traits);
      if (first === undefined) throw new Error('the dataset has no plain trait');
      await openExplore(page);
      await expect(tab(page, 'Party')).toHaveAccessibleName('Party 0 of 18 slots filled');
      await expect(tab(page, 'Party')).toContainText('0/18');

      await addToParty(page, first);

      await expect(partyPanel(page)).toBeHidden();
      await expect(partyAnnouncement(page)).toHaveText(`Added ${first.name} to Creature 1 · Innate.`);
      await expect(tab(page, 'Party')).toHaveAccessibleName('Party 1 of 18 slots filled');
      await expect(tab(page, 'Party')).toContainText('1/18');
    });

    test.describe('in the address', () => {
      test('writes the tab for the party only, a step of the history, so that back returns to the other', async ({
        page,
      }) => {
        await openExplore(page);
        expect(searchParam(page, 'tab')).toBeNull();

        await tab(page, 'Party').click();
        await expect.poll(() => searchParam(page, 'tab')).toBe('party');

        await tab(page, 'Explore').click();
        await expect.poll(() => searchParam(page, 'tab')).toBeNull();

        await page.goBack();
        await expect(tab(page, 'Party')).toHaveAttribute('aria-selected', 'true');
        await expect(partyPanel(page)).toBeVisible();
        expect(searchParam(page, 'tab')).toBe('party');

        await page.goBack();
        await expect(tab(page, 'Explore')).toHaveAttribute('aria-selected', 'true');
        await expect(results(page)).toBeVisible();
        expect(searchParam(page, 'tab')).toBeNull();

        await page.goForward();
        await expect(tab(page, 'Party')).toHaveAttribute('aria-selected', 'true');
      });

      test('opens on the tab a link names, and on Explore for a name that is no tab', async ({ page }) => {
        await page.goto('./?tab=party');
        await expect(tab(page, 'Party')).toHaveAttribute('aria-selected', 'true');
        await expect(partyPanel(page)).toBeVisible();
        await expect(results(page)).toBeHidden();

        await page.goto('./?tab=nonsense');
        await expect(rows(page).first()).toBeVisible();
        await expect(tab(page, 'Explore')).toHaveAttribute('aria-selected', 'true');
      });

      test('keeps the search and the party in the address when the tab changes, and the tab when they do', async ({
        page,
        request,
      }) => {
        const [first] = plainTraits((await publishedDataset(request)).traits);
        if (first === undefined) throw new Error('the dataset has no plain trait');
        await openExplore(page);
        await addToParty(page, first);
        await searchBox(page).fill('weak');
        await expect.poll(() => searchParam(page, 'q')).toBe('weak');

        await showParty(page);

        await expect.poll(() => searchParam(page, 'tab')).toBe('party');
        expect(searchParam(page, 'q')).toBe('weak');
        expect(searchParam(page, 'party')).toContain(first.id);

        // An edit of the party on its tab leaves the tab where it is.
        await partyPanel(page).getByRole('button', { name: 'Clear party' }).click();
        await expect.poll(() => searchParam(page, 'party')).toBeNull();
        expect(searchParam(page, 'tab')).toBe('party');
      });

      test('brings the search forward when the party asks for one, and back returns to the party', async ({ page }) => {
        await page.goto('./?party=1.0,gone--from-the-sheet&tab=party');
        await expect(partyPanel(page)).toBeVisible();

        await partyPanel(page)
          .getByRole('button', { name: /^Search for / })
          .click();

        await expect(tab(page, 'Explore')).toHaveAttribute('aria-selected', 'true');
        await expect(results(page)).toBeVisible();
        await expect(page.getByRole('heading', { level: 2, name: 'Results' })).toBeFocused();
        expect(searchParam(page, 'tab')).toBeNull();
        expect(searchParam(page, 'q')).not.toBeNull();

        await page.goBack();

        await expect(tab(page, 'Party')).toHaveAttribute('aria-selected', 'true');
        await expect(partyPanel(page)).toBeVisible();
        expect(searchParam(page, 'q')).toBeNull();
      });
    });

    test('brings the page back to where each tab was left', async ({ page }) => {
      await openExplore(page);
      await page.evaluate(() => {
        window.scrollTo(0, 3000);
      });
      await expect.poll(() => firstRowInView(page)).not.toBe('1');
      const seen = await firstRowInView(page);

      await showParty(page);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

      await showExplore(page);
      await expect.poll(() => firstRowInView(page)).toBe(seen);
    });

    test('leaves room for the bars at the foot of the page, the Filters button above the tabs', async ({ page }) => {
      const footer = page.getByRole('contentinfo');
      const toTheFoot = () =>
        page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
        });
      await openExplore(page);
      // No trait matches: the page has a height of its own, whereas a list of rows is estimated until it is drawn.
      await searchBox(page).fill('zzzzzzzz');
      await expect(page.getByText('No trait matches.')).toBeVisible();
      await toTheFoot();
      const tabs = await edges(tablist(page));

      if (isCompact(page)) {
        const filters = await edges(filtersButton(page));
        expect(filters.bottom).toBeLessThanOrEqual(tabs.top);
        expect((await edges(footer)).bottom).toBeLessThanOrEqual(filters.top);
      } else {
        expect((await edges(footer)).bottom).toBeLessThanOrEqual(tabs.top);
      }

      await showParty(page);
      await expect(filtersButton(page)).toHaveCount(0);
      await toTheFoot();
      expect((await edges(footer)).bottom).toBeLessThanOrEqual((await edges(tablist(page))).top);
    });

    test('scrolls a control that takes the focus clear of the bars at the foot of the window', async ({ page }) => {
      await openExplore(page);
      // The fifth row is below the fold: its button is the one a person has scrolled to and left near the foot.
      const add = results(page)
        .locator('li[aria-posinset="5"]')
        .getByRole('button', { name: /^Add to / });
      const underABar = () =>
        add.evaluate((button) => {
          const box = button.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return hit !== null && !button.contains(hit);
        });
      await add.evaluate((button) => {
        window.scrollBy(0, button.getBoundingClientRect().top - (window.innerHeight - 40));
      });
      expect(await underABar()).toBe(true);

      await add.focus();

      await expect.poll(underABar).toBe(false);
    });

    test('has no WCAG 2.2 AA violations on either tab (axe)', async ({ page, request }) => {
      const [first] = plainTraits((await publishedDataset(request)).traits);
      if (first === undefined) throw new Error('the dataset has no plain trait');
      await openExplore(page);
      await addToParty(page, first);
      expect(await axeViolations(page)).toEqual([]);

      await showParty(page);
      expect(await axeViolations(page)).toEqual([]);
    });
  });

  test.describe('on a screen with room for the filters but not for the party', () => {
    test.beforeEach(({ isMobile }) => {
      test.skip(isMobile, 'The width is set by the test: a desktop window is enough.');
    });

    test('has the filters beside the list and the party on a tab of its own', async ({ page }) => {
      await page.setViewportSize({ width: 900, height: 800 });
      await openExplore(page);

      await expect(page.getByRole('region', { name: 'Filters' })).toBeVisible();
      await expect(filtersButton(page)).toHaveCount(0);
      await expect(results(page)).toBeVisible();
      await expect(partyPanel(page)).toBeHidden();

      await tab(page, 'Party').click();

      await expect(partyPanel(page)).toBeVisible();
      await expect(results(page)).toBeHidden();
      await expect(page.getByRole('region', { name: 'Filters' })).toBeHidden();
      expect(await axeViolations(page)).toEqual([]);
    });

    test('changes from tabs to columns at 1100 px, with no width in between', async ({ page }) => {
      await page.setViewportSize({ width: 1099, height: 800 });
      await openExplore(page);
      await expect(tablist(page)).toBeVisible();
      await expect(partyPanel(page)).toBeHidden();

      await page.setViewportSize({ width: 1100, height: 800 });

      await expect(tablist(page)).toHaveCount(0);
      await expect(results(page)).toBeVisible();
      await expect(partyPanel(page)).toBeVisible();
      // Side by side: the party is to the right of the results, and level with them.
      const [resultsBox, partyBox] = [await edges(results(page)), await edges(partyPanel(page))];
      expect(Math.abs(partyBox.top - resultsBox.top)).toBeLessThan(2);
    });

    test('keeps the tab through a change of width, and shows both views when there is room', async ({ page }) => {
      await page.setViewportSize({ width: 900, height: 800 });
      await openExplore(page);
      await tab(page, 'Party').click();

      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(tablist(page)).toHaveCount(0);
      await expect(results(page)).toBeVisible();
      await expect(partyPanel(page)).toBeVisible();

      await page.setViewportSize({ width: 900, height: 800 });
      await expect(tab(page, 'Party')).toHaveAttribute('aria-selected', 'true');
      await expect(partyPanel(page)).toBeVisible();
      await expect(results(page)).toBeHidden();
    });
  });

  test.describe('on a wide screen', () => {
    test.beforeEach(({ page }) => {
      test.skip(isTabbed(page), 'A narrow window has the tabs.');
    });

    test('has no tabs, and shows the search and the party together whatever tab the link names', async ({ page }) => {
      await page.goto('./?tab=party');
      await expect(rows(page).first()).toBeVisible();

      await expect(tablist(page)).toHaveCount(0);
      await expect(page.getByRole('tabpanel')).toHaveCount(0);
      await expect(results(page)).toBeVisible();
      await expect(searchBox(page)).toBeVisible();
      await expect(partyPanel(page)).toBeVisible();
    });
  });
});
