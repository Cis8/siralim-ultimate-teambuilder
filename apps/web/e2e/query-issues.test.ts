import { expect, test } from '@playwright/test';
import { axeViolations } from './support/axe';
import {
  caretOf,
  chips,
  fixButton,
  issueRows,
  issuesAnnouncement,
  issuesBadge,
  issuesList,
  openExplore,
  rows,
  searchBox,
} from './support/explore-page';
import { tabTo } from './support/keyboard';

// Acceptance criterion 1 (docs/ROADMAP.md) and PLAN 9.6: a query that is wrong says so inside the search field, lists what is
// wrong under it, and mends it with a click or the keyboard, leaving the caret where the person had it.

/** Two errors, each with a fix: a field that does not exist, and a parenthesis that is never closed. */
const BROKEN = 'clas:life (weak OR snared';
const MENDED = 'class:life (weak OR snared)';
const FIX_FIELD = 'Change to “class:”';
const FIX_PARENTHESIS = 'Add the missing “)”';

test.describe('the issues of a query', () => {
  test('shows two errors with working fixes, and the query is clean after both (criterion 1)', async ({ page }) => {
    await openExplore(page);

    await searchBox(page).fill(BROKEN);

    await expect(issuesBadge(page)).toHaveText('2 issues');
    await expect(searchBox(page)).toHaveAttribute('aria-invalid', 'true');
    // The list opens by itself for a query that was typed.
    await expect(issuesBadge(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(issueRows(page)).toHaveCount(2);
    await expect(issueRows(page).nth(0)).toContainText('Error Unknown field “clas:”. Did you mean “class:”?');
    await expect(issueRows(page).nth(1)).toContainText('Error Unclosed “(”');

    await fixButton(page, FIX_FIELD).click();

    await expect(searchBox(page)).toHaveValue('class:life (weak OR snared');
    await expect(issuesBadge(page)).toHaveText('1 issue');
    await expect(issueRows(page)).toHaveCount(1);
    await expect(searchBox(page)).toBeFocused();

    await fixButton(page, FIX_PARENTHESIS).click();

    await expect(searchBox(page)).toHaveValue(MENDED);
    await expect(issuesBadge(page)).toHaveCount(0);
    await expect(issuesList(page)).toBeHidden();
    await expect(searchBox(page)).not.toHaveAttribute('aria-invalid', 'true');
    await expect(searchBox(page)).toBeFocused();
    // The field is mended, and so is what it means: `class:` now filters the class instead of looking for the text `clas:`.
    await expect(chips(page).getByRole('button', { name: 'class:life — exclude it' })).toBeVisible();
    await expect(rows(page).first()).toBeVisible();
  });

  test('keeps the caret in front of the text it was in front of, instead of throwing it to the end', async ({
    page,
  }) => {
    await openExplore(page);
    await searchBox(page).fill(BROKEN);
    await expect(issuesBadge(page)).toHaveText('2 issues');

    // Caret at the end: it stays at the end of the longer text.
    await fixButton(page, FIX_FIELD).click();
    await expect(searchBox(page)).toHaveValue('class:life (weak OR snared');
    expect(await caretOf(page)).toBe('class:life (weak OR snared'.length);

    // Caret at the start: the parenthesis is added at the far end, and the caret does not follow it.
    await searchBox(page).press('Home');
    await fixButton(page, FIX_PARENTHESIS).click();
    await expect(searchBox(page)).toHaveValue(MENDED);
    expect(await caretOf(page)).toBe(0);
  });

  test('can be fixed with the keyboard alone, and the focus comes back to the field', async ({ page }) => {
    await openExplore(page);
    await tabTo(page, searchBox(page), { limit: 5 });
    await page.keyboard.type(BROKEN);
    await expect(issuesBadge(page)).toHaveText('2 issues');

    // The badge follows the field, then the fixes of the list that opened under it.
    await page.keyboard.press('Tab');
    await expect(issuesBadge(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(fixButton(page, FIX_FIELD)).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(searchBox(page)).toHaveValue('class:life (weak OR snared');
    await expect(searchBox(page)).toBeFocused();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(fixButton(page, FIX_PARENTHESIS)).toBeFocused();
    await page.keyboard.press('Space');

    await expect(searchBox(page)).toHaveValue(MENDED);
    await expect(searchBox(page)).toBeFocused();
    await expect(issuesBadge(page)).toHaveCount(0);
  });

  test('takes a fix back with the undo of the field, as it does typing', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'Not a browser the app is tested in.');
    await openExplore(page);
    await searchBox(page).fill(BROKEN);
    await fixButton(page, FIX_FIELD).click();
    await expect(searchBox(page)).toHaveValue('class:life (weak OR snared');

    await page.keyboard.press('ControlOrMeta+z');

    await expect(searchBox(page)).toHaveValue(BROKEN);
    await expect(issuesBadge(page)).toHaveText('2 issues');
  });

  test('is only counted by a badge when the query arrives with the address, and the badge opens the list', async ({
    page,
  }) => {
    // A parenthesis closed that was never opened, and one opened that is never closed, round a query that finds traits.
    await openExplore(page, `./?q=${encodeURIComponent('weak OR snared ) (')}`);

    await expect(issuesBadge(page)).toHaveText('2 issues');
    await expect(issuesBadge(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(issuesList(page)).toBeHidden();

    await issuesBadge(page).click();
    await expect(issuesBadge(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(issueRows(page)).toHaveCount(2);

    await issuesBadge(page).click();
    await expect(issuesList(page)).toBeHidden();
  });

  test('leaves a term alone while it is being typed, and warns about it once it is finished', async ({ page }) => {
    await openExplore(page);

    // A word no trait has: a warning, but only after the person has gone on to something else.
    await searchBox(page).pressSequentially('zzzzzz');
    await expect(issuesBadge(page)).toHaveCount(0);

    await searchBox(page).press('Space');
    await expect(issuesBadge(page)).toHaveText('1 issue');
    await expect(issueRows(page).first()).toContainText('Warning “zzzzzz” appears in no trait');
    // A warning is not an error: the search takes the text as it stands.
    await expect(searchBox(page)).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('describes the field by what is wrong, and says it to a screen reader after a pause and after a fix', async ({
    page,
  }) => {
    await openExplore(page);

    await searchBox(page).fill(BROKEN);

    await expect(issuesAnnouncement(page)).toHaveText('2 issues');
    const described = await searchBox(page).getAttribute('aria-describedby');
    expect(described?.split(' ')).toHaveLength(2);
    await expect(searchBox(page)).toHaveAccessibleDescription(/Error Unknown field “clas:”.*Error Unclosed “\(”/);

    await fixButton(page, FIX_FIELD).click();
    await expect(issuesAnnouncement(page)).toHaveText('Fixed. 1 issue left.');

    await fixButton(page, FIX_PARENTHESIS).click();
    await expect(issuesAnnouncement(page)).toHaveText('Fixed. No issues left.');
  });

  test('has nothing for axe to report with the badge and the list open', async ({ page }) => {
    await openExplore(page);
    // Two errors and a warning: both severities, with and without a fix.
    await searchBox(page).fill('clas:life (weak OR snared zzzzzz mat:maybe ');

    await expect(issuesBadge(page)).toHaveText('4 issues');
    await expect(issueRows(page)).toHaveCount(4);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('lists the first few issues of a long query and counts the rest', async ({ page }) => {
    await openExplore(page);

    await searchBox(page).fill(')))))))) ');

    await expect(issuesBadge(page)).toHaveText('8 issues');
    await expect(issueRows(page)).toHaveCount(6);
    await expect(issueRows(page).last()).toHaveText('and 3 more');
  });
});
