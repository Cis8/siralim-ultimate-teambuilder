import { expect, test, type Page } from '@playwright/test';
import { axeViolations } from './support/axe';
import { publishedDataset } from './support/dataset';
import {
  countText,
  facet,
  filtersButton,
  filtersSheet,
  flag,
  format,
  isCompact,
  openExplore,
  openFilters,
} from './support/explore-page';

// On a narrow screen the filters are a modal sheet over the page (DESIGN § Accessibility: focus trapped, Esc closes, focus
// returns). The facets inside it are the same ones the other tests press; these tests are about the sheet itself.

/** Opens the sheet from the keyboard: Safari does not focus a button that is clicked, and the focus is what is tested. */
async function openFromKeyboard(page: Page): Promise<void> {
  await filtersButton(page).focus();
  await page.keyboard.press('Enter');
  await expect(filtersSheet(page)).toBeVisible();
}

/** Whether the focus is on the page behind the sheet: in the sheet, or out of the page (the browser's own controls), it is not. */
const focusOnPageBehind = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const focused = document.activeElement;
    const sheet = document.querySelector('dialog');
    return focused !== null && focused !== document.body && sheet !== null && !sheet.contains(focused);
  });

test.describe('the filters sheet', () => {
  test.describe('on a narrow screen', () => {
    test.beforeEach(({ page }) => {
      test.skip(!isCompact(page), 'A wide window has the filters beside the list.');
    });

    test('is opened by the Filters button, and the filters are not on the page before', async ({ page }) => {
      await openExplore(page);

      await expect(filtersButton(page)).toBeVisible();
      await expect(page.getByRole('region', { name: 'Filters' })).toHaveCount(0);
      await expect(filtersSheet(page)).toBeHidden();

      await filtersButton(page).click();

      await expect(filtersSheet(page)).toBeVisible();
      await expect(filtersSheet(page).getByRole('heading', { level: 2, name: 'Filters' })).toBeVisible();
      await expect(facet(page, 'Life')).toBeVisible();
    });

    test('keeps the focus in the sheet, whichever way the tab key goes', async ({ page }) => {
      await openExplore(page);

      await openFromKeyboard(page);
      expect(await focusOnPageBehind(page)).toBe(false);
      await expect(filtersSheet(page).locator(':focus')).toHaveCount(1);

      for (const key of ['Shift+Tab', 'Shift+Tab', 'Tab', 'Tab', 'Tab']) {
        await page.keyboard.press(key);
        expect(await focusOnPageBehind(page), key).toBe(false);
      }

      // From the last control onwards, and from the first one backwards: nothing behind the sheet takes the focus.
      await filtersSheet(page)
        .getByRole('button', { name: /^Show / })
        .focus();
      await page.keyboard.press('Tab');
      expect(await focusOnPageBehind(page)).toBe(false);
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Shift+Tab');
      expect(await focusOnPageBehind(page)).toBe(false);
    });

    test('closes on Esc, and the focus returns to the button that opened it', async ({ page }) => {
      await openExplore(page);
      await openFromKeyboard(page);

      await page.keyboard.press('Escape');

      await expect(filtersSheet(page)).toBeHidden();
      await expect(filtersButton(page)).toBeFocused();
    });

    test('closes with its button, which says how many traits the filters now show', async ({ page, request }) => {
      const { traits } = await publishedDataset(request);
      const life = traits.filter((trait) => trait.class === 'Life').length;
      await openExplore(page);
      await openFromKeyboard(page);
      const close = filtersSheet(page).getByRole('button', { name: /^Show / });
      await expect(close).toHaveText(`Show ${format(traits.length)} traits`);

      await facet(page, 'Life').click();
      await expect(close).toHaveText(`Show ${format(life)} traits`);
      // Said aloud too: the live region of the page behind the sheet is out of reach.
      await expect(filtersSheet(page).locator('[aria-live="polite"]')).toHaveText(countText(life, traits));

      await close.focus();
      await page.keyboard.press('Enter');

      await expect(filtersSheet(page)).toBeHidden();
      await expect(filtersButton(page)).toBeFocused();
    });

    test('closes when the dimmed page behind it is tapped', async ({ page }) => {
      await openExplore(page);
      await openFilters(page);

      // Above the sheet, which never rises as high as the top of the window.
      await page.mouse.click(10, 10);

      await expect(filtersSheet(page)).toBeHidden();
    });

    test('does not close when something in it is tapped, and is no step of the history', async ({ page }) => {
      await openExplore(page);
      const before = await page.evaluate(() => window.history.length);

      await openFilters(page);
      await filtersSheet(page).getByRole('heading', { level: 2, name: 'Filters' }).click();
      await facet(page, 'Life').click();

      await expect(filtersSheet(page)).toBeVisible();
      expect(await page.evaluate(() => window.history.length)).toBe(before + 1);
    });

    test('scrolls its filters under a title and over a button that stay in place, not the whole sheet', async ({
      page,
    }) => {
      await openExplore(page);
      await openFilters(page);

      // A control far down the panel: focusing it scrolls the filters to it.
      await facet(page, 'Start of battle').focus();

      await expect(facet(page, 'Start of battle')).toBeInViewport();
      await expect(filtersSheet(page).getByRole('heading', { level: 2, name: 'Filters' })).toBeInViewport();
      await expect(filtersSheet(page).getByRole('button', { name: /^Show / })).toBeInViewport();
      // Nothing of the panel reaches beyond the sheet itself (text for a screen reader is placed out of the way, and
      // must not make the sheet scrollable, which let its title slide away).
      expect(await filtersSheet(page).evaluate((sheet) => sheet.scrollHeight - sheet.clientHeight)).toBeLessThanOrEqual(
        1,
      );
    });

    test('says on its button how many filters are on', async ({ page }) => {
      await openExplore(page);
      await expect(filtersButton(page)).toHaveAccessibleName('Filters');

      await openFilters(page);
      await facet(page, 'Life').click();
      await flag(page, 'Only “does not stack”').check();
      await page.keyboard.press('Escape');

      await expect(filtersButton(page)).toHaveAccessibleName('Filters 2 active');
    });

    test('keeps the sheet apart from the page when the window changes width', async ({ page }) => {
      await openExplore(page);
      await openFilters(page);
      const narrow = page.viewportSize();
      if (narrow === null) throw new Error('the project has no viewport');

      await page.setViewportSize({ width: 1200, height: 800 });

      await expect(filtersButton(page)).toHaveCount(0);
      await expect(page.getByRole('region', { name: 'Filters' })).toBeVisible();

      await page.setViewportSize(narrow);

      await expect(filtersButton(page)).toBeVisible();
      await expect(filtersSheet(page)).toBeHidden();
    });

    test('has no WCAG 2.2 AA violations with the sheet open and with filters on', async ({ page }) => {
      await openExplore(page);
      await openFilters(page);
      await facet(page, 'Life').click();
      await flag(page, 'Artifact-eligible (has material)').check();

      expect(await axeViolations(page)).toEqual([]);
    });
  });

  test.describe('on a wide screen', () => {
    test.beforeEach(({ page }) => {
      test.skip(isCompact(page), 'A narrow window has the filters in a sheet.');
    });

    test('has the filters beside the list and no button to open them', async ({ page }) => {
      await openExplore(page);

      await expect(page.getByRole('region', { name: 'Filters' })).toBeVisible();
      await expect(filtersButton(page)).toHaveCount(0);
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  });
});
