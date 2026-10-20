import { expect, test, type Page } from '@playwright/test';
import { axeViolations } from './support/axe';
import { openExplore, publishedCount, results, searchBox } from './support/explore-page';
import { keepSearches, savedAs } from './support/history-page';
import {
  backButton,
  bannerFix,
  clearButton,
  issueBanner,
  openSearchSheet,
  readsAs,
  searchSheet,
  sheetApplies,
  sheetCaret,
  sheetField,
  sheetManageButton,
  sheetOptions,
  sheetSaveButton,
  showTraitsButton,
  syntaxButton,
  syntaxToolbar,
} from './support/search-sheet-page';
import { paramOf } from './support/synergy-page';

// PLAN 11.5, DESIGN § Search sheet and QUERY_LANGUAGE §8: on a phone (a narrow screen that is touched) a press on the search field opens a
// full-screen dialog with the same editor in it, a button that shows the traits, and a toolbar that writes the pieces of the query
// language a keyboard hides. The keyboard of the phone itself cannot be seen from here: the owner checks it on the devices (PLAN).

/** The traits the page shows, as the count the button of the sheet and the page itself say. */
const traitsInButton = async (page: Page): Promise<number> => {
  const text = (await searchSheetButtonText(page)).replace(/,/gu, '');
  return Number(/(\d+)/u.exec(text)?.[1]);
};
const searchSheetButtonText = async (page: Page): Promise<string> => (await showTraitsButton(page).textContent()) ?? '';

test.describe('the search sheet on a phone', () => {
  test.beforeEach(async ({ page }) => {
    await openExplore(page);
    test.skip(
      !(await sheetApplies(page)),
      'A mouse and a wide screen edit in the page: the sheet is for a touch screen.',
    );
  });

  test('opens on a press on the search field, with the focus in its own field, which holds the text of the page', async ({
    page,
  }) => {
    await openExplore(page, './?q=weak');

    await openSearchSheet(page);

    await expect(sheetField(page)).toHaveValue('weak');
    await expect(backButton(page)).toBeVisible();
    await expect(showTraitsButton(page)).toBeVisible();
    await expect(syntaxToolbar(page)).toBeVisible();
  });

  test('is not opened by the keyboard, or by a field filled in: those edit in the page', async ({ page }) => {
    await searchBox(page).fill('weak');
    await searchBox(page).press('Escape');
    await expect(searchBox(page)).toHaveValue('weak');
    await expect(searchSheet(page)).toBeHidden();
  });

  test('shows how many traits the search finds as it is typed, and shuts on that button with the search in the page', async ({
    page,
  }) => {
    const all = await publishedCount(page);
    await openSearchSheet(page);
    expect(await traitsInButton(page)).toBe(all);

    await sheetField(page).pressSequentially('applies:snared');
    await expect.poll(() => traitsInButton(page)).toBeLessThan(all);
    const found = await traitsInButton(page);

    await showTraitsButton(page).click();

    await expect(searchSheet(page)).toBeHidden();
    await expect(searchBox(page)).toHaveValue('applies:snared');
    await expect.poll(() => paramOf(page, 'q')).toBe('applies:snared');
    await expect(results(page)).toBeVisible();
    expect(found).toBeGreaterThan(0);
  });

  test('puts the focus on the results when it shuts, and not in the field, which would raise the keyboard', async ({
    page,
  }) => {
    await openSearchSheet(page);
    await sheetField(page).pressSequentially('weak');

    await backButton(page).click();

    await expect(searchSheet(page)).toBeHidden();
    await expect(page.getByRole('heading', { level: 2, name: 'Results' })).toBeFocused();
    await expect(searchBox(page)).not.toBeFocused();
  });

  test('shuts with Escape, keeping what was typed, and remembers it as a recent search', async ({ page }) => {
    await openSearchSheet(page);
    await sheetField(page).pressSequentially('uses:weak');
    // The first suggestion is active as the person types, and Escape lets go of it before it closes the sheet.
    await page.keyboard.press('Escape');
    await expect(searchSheet(page)).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(searchSheet(page)).toBeHidden();
    await expect(searchBox(page)).toHaveValue('uses:weak');

    await searchBox(page).fill('');
    await openSearchSheet(page);
    await expect(sheetOptions(page).first()).toHaveAccessibleName('Recent uses:weak');
  });

  test('shuts with Enter when it has nothing to take from the list, as the button does', async ({ page }) => {
    await openSearchSheet(page);
    await sheetField(page).pressSequentially('weak');
    await page.keyboard.press('Escape');

    await page.keyboard.press('Enter');

    await expect(searchSheet(page)).toBeHidden();
    await expect(searchBox(page)).toHaveValue('weak');
  });

  test('takes the suggestion that is active with Enter, and stays open for what comes next', async ({ page }) => {
    await openSearchSheet(page);
    await sheetField(page).pressSequentially('wea');
    await expect(sheetField(page)).toHaveAttribute('aria-activedescendant', /.+/);

    await page.keyboard.press('Enter');

    await expect(searchSheet(page)).toBeVisible();
    await expect(sheetField(page)).toHaveValue(/^applies:weak/);
  });

  test('empties the field with the clear button and keeps the focus in it', async ({ page }) => {
    await openExplore(page, './?q=weak');
    await openSearchSheet(page);

    await clearButton(page).click();

    await expect(sheetField(page)).toHaveValue('');
    await expect(sheetField(page)).toBeFocused();
    await expect(clearButton(page)).toBeHidden();
  });

  test('says how the search reads, and the first thing wrong with it with the button that mends it', async ({
    page,
  }) => {
    await openSearchSheet(page);
    await sheetField(page).pressSequentially('clas:life (weak');
    await expect(readsAs(page)).toContainText('Reads as');

    await expect(issueBanner(page)).toContainText('Error');
    await expect(issueBanner(page)).toContainText('+1 more');
    await expect(sheetField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(sheetField(page)).toHaveAccessibleDescription(/clas/u);

    await bannerFix(page, 'Change to “class:”').click();

    await expect(sheetField(page)).toHaveValue('class:life (weak');
    await expect(sheetField(page)).toBeFocused();
    await expect(issueBanner(page)).toContainText('(');
    await bannerFix(page, /Add the missing/u).click();
    await expect(sheetField(page)).toHaveValue('class:life (weak)');
    await expect(issueBanner(page)).toBeHidden();
    await expect(sheetField(page)).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('lists the suggestions for the word at the caret, and a press on one takes it without taking the focus', async ({
    page,
  }) => {
    await openSearchSheet(page);
    await sheetField(page).pressSequentially('wea');
    await expect(sheetOptions(page).nth(2)).toBeVisible();
    const second = sheetOptions(page).nth(1);
    const name = (await second.textContent()) ?? '';
    expect(name).toMatch(/uses:weak/u);

    await second.click();

    await expect(sheetField(page)).toHaveValue(/^uses:weak/u);
    await expect(sheetField(page)).toBeFocused();
    await expect(searchSheet(page)).toBeVisible();
  });

  test('draws the query in colour, with a line under what is wrong, as the field in the page does', async ({
    page,
  }) => {
    await openSearchSheet(page);
    await sheetField(page).pressSequentially('class:life -weak OR (a');

    const mirror = searchSheet(page).locator('.mirror');
    await expect(mirror.locator('[data-kind="field"]')).toHaveText('class:');
    await expect(mirror.locator('[data-kind="negation"]')).toHaveText('-');
    await expect(mirror.locator('[data-kind="operator"]')).toHaveText('OR');
    await expect(mirror.locator('[data-severity="error"]')).toHaveText('(');
  });

  test.describe('the toolbar', () => {
    test('writes an operator at the caret with a blank on each side, and keeps the focus and the keyboard', async ({
      page,
    }) => {
      await openSearchSheet(page);
      await sheetField(page).pressSequentially('weak');

      await syntaxButton(page, 'OR').click();

      await expect(sheetField(page)).toHaveValue('weak OR ');
      await expect(sheetField(page)).toBeFocused();
      expect(await sheetCaret(page)).toBe(8);

      await sheetField(page).pressSequentially('snared');
      await expect(sheetField(page)).toHaveValue('weak OR snared');
    });

    test('writes NOT as the dash of a negation, and the name of the button says NOT', async ({ page }) => {
      await openSearchSheet(page);
      await sheetField(page).pressSequentially('weak');
      await expect(syntaxButton(page, 'NOT')).toHaveAccessibleName(/NOT/u);

      await syntaxButton(page, 'NOT').click();
      await sheetField(page).pressSequentially('snared');

      await expect(sheetField(page)).toHaveValue('weak -snared');
    });

    test('writes a pair of quotes with the caret between them, so that a phrase is never left open', async ({
      page,
    }) => {
      await openSearchSheet(page);

      await syntaxButton(page, '"').click();
      await expect(sheetField(page)).toHaveValue('""');
      expect(await sheetCaret(page)).toBe(1);
      await expect(issueBanner(page)).toBeHidden();

      await sheetField(page).pressSequentially('start of battle');
      await expect(sheetField(page)).toHaveValue('"start of battle"');
      await expect(issueBanner(page)).toBeHidden();
    });

    test('closes a phrase that is open before the caret instead of opening another', async ({ page }) => {
      await openSearchSheet(page);
      await sheetField(page).pressSequentially('"two words');

      await syntaxButton(page, '"').click();

      await expect(sheetField(page)).toHaveValue('"two words"');
      expect(await sheetCaret(page)).toBe(11);
    });

    test('writes groups, and a field whose value the list then suggests', async ({ page }) => {
      await openSearchSheet(page);

      await syntaxButton(page, '(').click();
      await sheetField(page).pressSequentially('weak');
      await syntaxButton(page, ')').click();
      await expect(sheetField(page)).toHaveValue('(weak)');

      await syntaxButton(page, 'AND').click();
      await syntaxButton(page, 'applies:').click();
      await expect(sheetField(page)).toHaveValue('(weak) AND applies:');
      await expect(sheetOptions(page).first()).toHaveAccessibleName(/^(Debuff|Buff|Effect|Event) applies:/u);
    });

    test('writes a finished term, which narrows the search', async ({ page }) => {
      await openSearchSheet(page);
      const all = await traitsInButton(page);

      await syntaxButton(page, 'mat:yes').click();

      await expect(sheetField(page)).toHaveValue('mat:yes ');
      await expect.poll(() => traitsInButton(page)).toBeLessThan(all);
    });

    test('replaces the text that is selected, as typing over it does', async ({ page }) => {
      await openExplore(page, './?q=weak%20OR%20snared');
      await openSearchSheet(page);
      await sheetField(page).evaluate((field: HTMLInputElement) => {
        field.setSelectionRange(5, 7);
      });

      await syntaxButton(page, 'uses:').click();

      await expect(sheetField(page)).toHaveValue('weak uses: snared');
    });
  });

  test('lists the recent and saved searches for a blank field, and a press on one takes it', async ({ page }) => {
    await keepSearches(page, { recent: ['applies:snared'], saved: savedAs('class:life') });
    await openExplore(page);
    await openSearchSheet(page);

    await expect(searchSheet(page).getByRole('listbox', { name: 'Recent and saved searches' })).toBeVisible();
    await expect(sheetOptions(page)).toHaveCount(2);

    await sheetOptions(page).first().click();

    await expect(sheetField(page)).toHaveValue('applies:snared');
    await expect(searchSheet(page)).toBeVisible();
  });

  test('has the star and the button of searches, which work as they do in the page', async ({ page }) => {
    await openSearchSheet(page);
    await expect(sheetSaveButton(page)).toBeHidden();
    await sheetField(page).pressSequentially('uses:weak');

    await sheetSaveButton(page).click();
    await expect(sheetSaveButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(sheetField(page)).toBeFocused();

    await sheetManageButton(page).click();
    const manage = page.getByRole('dialog', { name: 'Manage searches' });
    await expect(manage).toBeVisible();
    await manage.getByRole('button', { name: 'Done' }).click();
    await expect(manage).toBeHidden();
    await expect(sheetManageButton(page)).toBeFocused();
    await expect(searchSheet(page)).toBeVisible();
  });

  test('leaves the list of the page shut behind it, and after it', async ({ page }) => {
    await keepSearches(page, { recent: ['applies:snared'], saved: savedAs('class:life') });
    await openExplore(page);
    const pageList = page.locator('#query-suggestions');

    await openSearchSheet(page);
    await expect(pageList).toBeHidden();

    await backButton(page).click();
    await expect(searchSheet(page)).toBeHidden();
    await expect(pageList).toBeHidden();
    await expect(searchBox(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('has no accessibility violation open, with a fault in the query and the list showing', async ({ page }) => {
    await openSearchSheet(page);
    await sheetField(page).pressSequentially('clas:life (wea');
    await expect(issueBanner(page)).toBeVisible();
    await expect(sheetOptions(page).first()).toBeVisible();

    expect(await axeViolations(page)).toEqual([]);
  });

  test('does not scroll the page behind it, and is never wider than the window', async ({ page }) => {
    await openSearchSheet(page);

    const overflow = await page.evaluate(() => ({
      body: getComputedStyle(document.body).overflow,
      wider: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    expect(overflow).toEqual({ body: 'hidden', wider: false });
  });

  test('is as tall as the part of the window that the visual viewport shows, so that its foot stays above a keyboard', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'Only Chromium can be told to zoom the page from here, which shrinks the visual viewport.',
    );
    await openSearchSheet(page);
    const session = await page.context().newCDPSession(page);
    await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });

    await expect
      .poll(async () => {
        const [viewport, sheet] = await Promise.all([
          page.evaluate(() => visualViewport?.height ?? 0),
          searchSheet(page).evaluate((dialog) => dialog.getBoundingClientRect().height),
        ]);
        return Math.abs(viewport - sheet);
      })
      .toBeLessThan(1);
    await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
  });
});

test.describe('the search field with a mouse', () => {
  test.beforeEach(async ({ page }) => {
    await openExplore(page);
    test.skip(await sheetApplies(page), 'A touch screen opens the sheet: the other tests of this file are for it.');
  });

  test('is edited in the page: a press puts the caret in it and opens no sheet', async ({ page }) => {
    await searchBox(page).click();
    await searchBox(page).pressSequentially('weak');

    await expect(searchBox(page)).toBeFocused();
    await expect(searchBox(page)).toHaveValue('weak');
    await expect(searchSheet(page)).toBeHidden();
  });
});
