import { expect, test } from '@playwright/test';
import { isTabbed, openExplore, results, rows, searchBox } from './support/explore-page';
import { tab, showParty } from './support/party-page';

// PLAN 10.4 (QUERY_LANGUAGE §6): the slash goes to the search field from anywhere the slash is not a character.

test.describe('the slash key', () => {
  test('focuses the search field and is not typed into it', async ({ page }) => {
    await openExplore(page);
    await expect(searchBox(page)).not.toBeFocused();

    await page.keyboard.press('/');

    await expect(searchBox(page)).toBeFocused();
    await expect(searchBox(page)).toHaveValue('');
  });

  test('works from a button, and what is typed next goes to the field', async ({ page }) => {
    await openExplore(page);
    await rows(page)
      .first()
      .getByRole('button', { name: /^Add to/ })
      .focus();

    await page.keyboard.press('/');
    await page.keyboard.type('weak');

    await expect(searchBox(page)).toBeFocused();
    await expect(searchBox(page)).toHaveValue('weak');
  });

  test('is a character in the field, where it is typed', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).focus();

    await page.keyboard.type('start of turn/');

    await expect(searchBox(page)).toHaveValue('start of turn/');
  });

  test('brings the search forward from the Party tab', async ({ page }) => {
    await openExplore(page);
    await showParty(page);

    await page.keyboard.press('/');

    await expect(searchBox(page)).toBeFocused();
    await expect(results(page)).toBeVisible();
    if (isTabbed(page)) await expect(tab(page, 'Explore')).toHaveAttribute('aria-selected', 'true');
  });

  test('is left to the browser with Ctrl held', async ({ page }) => {
    await openExplore(page);

    await page.keyboard.press('Control+/');

    await expect(searchBox(page)).not.toBeFocused();
  });
});
