import { expect, test, type Locator } from '@playwright/test';
import { axeViolations } from './support/axe';
import {
  announcedCount,
  caretOf,
  fixButton,
  issuesBadge,
  openExplore,
  rows,
  searchBox,
  suggestionList,
  suggestions,
  suggestionsAnnouncement,
} from './support/explore-page';
import { tabTo } from './support/keyboard';

// Acceptance criteria 2, 3 and 6 (docs/ROADMAP.md), PLAN 10.5 and QUERY_LANGUAGE §6: typing in the search field offers what may come
// next, with the number of traits each choice would show; Tab and Enter take the active one, the arrows move among them, and a
// field that is only focused is no trap. The assist layer is fetched when the page is idle, so `searchBox` (a combobox) waits for it.

/** What a screen reader reads of an option: its kind, what is written, what it means, and how many traits it finds. */
const nameOf = async (option: Locator): Promise<string> => {
  const snapshot = await option.ariaSnapshot();
  const name = /option "(.*)"/u.exec(snapshot)?.[1];
  if (name === undefined) throw new Error(`no option in ${snapshot}`);
  return name;
};

/** The number of traits that an option says it finds (“… 42 traits” at the end of its name). */
const countOf = async (option: Locator): Promise<number> => {
  const name = await nameOf(option);
  const found = /([\d,]+) traits?$/u.exec(name)?.[1];
  if (found === undefined) throw new Error(`“${name}” has no count`);
  return Number(found.replaceAll(',', ''));
};

/** What an option writes: the text in the font of the field. */
const labelOf = (option: Locator): Promise<string> => option.locator('.label').innerText();

test.describe('the suggestions under the search field', () => {
  test('offer applies:vulnerable with its count, and Tab takes it and leaves the caret after it (criterion 2)', async ({
    page,
  }) => {
    await openExplore(page);

    await searchBox(page).pressSequentially('applies:vul');

    const first = suggestions(page).first();
    await expect(first).toBeVisible();
    await expect(first).toContainText('applies:vulnerable');
    await expect(first).toHaveAttribute('aria-selected', 'true');
    const count = await countOf(first);
    expect(count).toBeGreaterThan(0);

    await page.keyboard.press('Tab');

    await expect(searchBox(page)).toHaveValue('applies:vulnerable ');
    expect(await caretOf(page)).toBe('applies:vulnerable '.length);
    await expect(searchBox(page)).toBeFocused();
    await expect(suggestionList(page)).toBeHidden();
    // The count was the number of traits that Enter would have shown.
    await expect(announcedCount(page)).toHaveText(new RegExp(`^${String(count)} of `, 'u'));
  });

  test('name the active option with its count, and say how many there are (criterion 3)', async ({ page }) => {
    await openExplore(page);

    await searchBox(page).pressSequentially('applies:vul');

    const first = suggestions(page).first();
    await expect(first).toHaveAccessibleName(/^Debuff applies:vulnerable applies “vulnerable” [\d,]+ traits$/);
    await expect(searchBox(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(searchBox(page)).toHaveAttribute('aria-autocomplete', 'list');
    await expect(searchBox(page)).toHaveAttribute(
      'aria-controls',
      (await suggestionList(page).getAttribute('id')) ?? '',
    );
    await expect(searchBox(page)).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id')) ?? '');
    // The size of the list is said once it has kept its size for a moment.
    await expect(suggestionsAnnouncement(page)).toHaveText('1 suggestion');
  });

  test('count the rest of the list a moment after it is drawn', async ({ page }) => {
    await openExplore(page);

    await searchBox(page).pressSequentially('wea');

    await expect(suggestionsAnnouncement(page)).toHaveText(/^\d+ suggestions$/);
    const options = await suggestions(page).all();
    expect(options.length).toBeGreaterThan(3);
    for (const option of options) {
      const kind = (await nameOf(option)).split(' ')[0];
      // A bare field and an operator are not a search; every finished term says how many traits it finds.
      if (kind === 'Field' || kind === 'Operator') await expect(option).not.toHaveAccessibleName(/ traits?$/);
      else await expect(option).toHaveAccessibleName(/ [\d,]+ traits?$/);
    }
  });

  test('count a suggestion among the traits the filters leave: it is what Enter would show (D18)', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).pressSequentially('applies:vul');
    const everywhere = await countOf(suggestions(page).first());

    await openExplore(page, './?class=life');
    await searchBox(page).pressSequentially('applies:vul');

    const inLife = await countOf(suggestions(page).first());
    expect(inLife).toBeGreaterThan(0);
    expect(inLife).toBeLessThan(everywhere);
    await page.keyboard.press('Tab');
    await expect(announcedCount(page)).toHaveText(new RegExp(`^${String(inLife)} of `, 'u'));
  });

  test('are no trap: Tab leaves a field that was only focused, and Shift+Tab leaves it with text typed (criterion 6)', async ({
    page,
  }) => {
    await openExplore(page);
    await tabTo(page, searchBox(page), { limit: 6 });
    await expect(suggestionList(page)).toBeHidden();

    await page.keyboard.press('Tab');

    await expect(searchBox(page)).not.toBeFocused();
    await expect(searchBox(page)).toHaveValue('');

    await tabTo(page, searchBox(page), { backwards: true, limit: 6 });
    await page.keyboard.type('weak');
    await expect(suggestions(page).first()).toBeVisible();
    await page.keyboard.press('Shift+Tab');

    await expect(searchBox(page)).not.toBeFocused();
    await expect(searchBox(page)).toHaveValue('weak');
    await expect(suggestionList(page)).toBeHidden();
  });

  test('are moved among with the arrows, and the one that is active is the one Tab takes (criterion 6)', async ({
    page,
  }) => {
    await openExplore(page);
    await searchBox(page).pressSequentially('weak');
    const options = suggestions(page);
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    const second = await labelOf(options.nth(1));
    const last = await labelOf(options.last());

    await page.keyboard.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(options.first()).toHaveAttribute('aria-selected', 'false');
    await expect(searchBox(page)).toHaveAttribute(
      'aria-activedescendant',
      (await options.nth(1).getAttribute('id')) ?? '',
    );

    // Up from the first wraps to the last, and down from the last to the first.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(options.last()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Tab');

    await expect(searchBox(page)).toHaveValue(`${second} `);
    expect(last).not.toBe(second);
  });

  test('are taken with Enter as well, and the text before and after the word is left as it was', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).fill('weak OR snared');
    await searchBox(page).press('Home');
    for (let step = 0; step < 4; step++) await searchBox(page).press('ArrowRight');
    // The caret is at the end of the first word. Moving it with the arrows brings nothing up; a key typed does.
    await searchBox(page).press('Backspace');
    await searchBox(page).pressSequentially('k');
    await expect(suggestions(page).first()).toContainText('applies:weak');

    await page.keyboard.press('Enter');

    await expect(searchBox(page)).toHaveValue('applies:weak OR snared');
    expect(await caretOf(page)).toBe('applies:weak'.length);
    await expect(suggestionList(page)).toBeHidden();
  });

  test('keep the list open after a field, for its value, with nothing active until the person chooses', async ({
    page,
  }) => {
    await openExplore(page);
    await searchBox(page).pressSequentially('appl');
    await expect(suggestions(page).first()).toContainText('applies:');
    await expect(suggestions(page).first()).toHaveAccessibleName(/^Field applies:/);

    await page.keyboard.press('Tab');

    await expect(searchBox(page)).toHaveValue('applies:');
    await expect(suggestionList(page)).toBeVisible();
    await expect(searchBox(page)).not.toHaveAttribute('aria-activedescendant', /./u);
    await expect(suggestions(page).first()).toHaveAttribute('aria-selected', 'false');
    // What it offers now are the keywords the field takes.
    await expect(suggestions(page).first()).toContainText('applies:');
    expect(await labelOf(suggestions(page).first())).not.toBe('applies:');
    // With none active a Tab is the browser's again: it leaves the field.
    await page.keyboard.press('Tab');
    await expect(searchBox(page)).not.toBeFocused();
  });

  test('are put away with Escape, which leaves the text and frees the Tab key', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).pressSequentially('applies:vul');
    await expect(suggestions(page).first()).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(suggestionList(page)).toBeHidden();
    await expect(searchBox(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(searchBox(page)).toHaveValue('applies:vul');
    await page.keyboard.press('Tab');
    await expect(searchBox(page)).not.toBeFocused();
    await expect(searchBox(page)).toHaveValue('applies:vul');
  });

  test('are put away when the field loses the focus, and come back with the next key', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).pressSequentially('applies:vul');
    await expect(suggestions(page).first()).toBeVisible();

    await searchBox(page).blur();
    await expect(suggestionList(page)).toBeHidden();

    await searchBox(page).focus();
    await expect(suggestionList(page)).toBeHidden();
    await page.keyboard.press('Backspace');
    await expect(suggestions(page).first()).toBeVisible();
  });

  test('are taken with a press on one, which leaves the focus in the field', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).pressSequentially('applies:vul');
    const first = suggestions(page).first();
    await expect(first).toContainText('applies:vulnerable');

    await first.click();

    await expect(searchBox(page)).toHaveValue('applies:vulnerable ');
    await expect(searchBox(page)).toBeFocused();
    expect(await caretOf(page)).toBe('applies:vulnerable '.length);
    await expect(suggestionList(page)).toBeHidden();
    await expect(rows(page).first()).toBeVisible();
  });

  test('do not come back when a fix mends the text, nor make an option active', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).pressSequentially('clas:life ');
    await expect(issuesBadge(page)).toHaveText('1 issue');
    await page.keyboard.press('Escape');
    await expect(suggestionList(page)).toBeHidden();

    await fixButton(page, 'Change to “class:”').click();

    await expect(searchBox(page)).toHaveValue('class:life ');
    await expect(searchBox(page)).toBeFocused();
    await expect(suggestionList(page)).toBeHidden();
    await expect(searchBox(page)).not.toHaveAttribute('aria-activedescendant', /./u);
    // A Tab is the browser's: nothing is waiting to be taken.
    await page.keyboard.press('Tab');
    await expect(searchBox(page)).toHaveValue('class:life ');
  });

  test('sit under the list of issues, so that the buttons that mend them stay in reach', async ({ page }) => {
    await openExplore(page);

    await searchBox(page).pressSequentially('clas:life (weak OR snared');

    await expect(suggestions(page).first()).toBeVisible();
    await expect(issuesBadge(page)).toHaveText('2 issues');
    const fix = await fixButton(page, 'Change to “class:”').boundingBox();
    const popup = await suggestionList(page).boundingBox();
    if (fix === null || popup === null) throw new Error('the lists are not drawn');
    expect(popup.y).toBeGreaterThanOrEqual(fix.y + fix.height);
    await fixButton(page, 'Change to “class:”').click();
    await expect(searchBox(page)).toHaveValue('class:life (weak OR snared');
  });

  test('have nothing for axe to report with the list open, and with the issues open beside it', async ({ page }) => {
    await openExplore(page);

    await searchBox(page).pressSequentially('applies:vul');
    await expect(suggestions(page).first()).toBeVisible();
    await expect(suggestionsAnnouncement(page)).toHaveText('1 suggestion');
    expect(await axeViolations(page)).toEqual([]);

    await searchBox(page).fill('');
    await searchBox(page).pressSequentially('clas:life (weak OR wea');
    await expect(suggestions(page).first()).toBeVisible();
    await expect(issuesBadge(page)).toHaveText('2 issues');
    await expect(suggestions(page).nth(3)).toHaveAccessibleName(/ traits?$/);
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('the search field before the assist layer is there', () => {
  test('is a plain field, and becomes a combobox on its own once the traits are in and the page is idle', async ({
    page,
  }) => {
    // No pointer, no focus: `openExplore` is not used, since it brings a pointer to the field.
    await page.goto('./');
    await expect(rows(page).first()).toBeVisible();

    await expect(searchBox(page)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search traits' })).toHaveCount(0);
    await expect(searchBox(page)).not.toBeFocused();
    // Nothing moved, and nothing is up: it is the same field, with no list.
    await expect(suggestionList(page)).toBeHidden();
    await expect(searchBox(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('stays a plain field that searches, when the layer cannot be fetched', async ({ page }) => {
    // The layer is the one script with the combobox in it: it is refused, as a connection that dropped would.
    await page.route('**/_app/immutable/**/*.js', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes('aria-autocomplete')) await route.abort();
      else await route.fulfill({ response, body });
    });
    const failures: string[] = [];
    // WebKit reports a resize observer that could not deliver everything in a frame (the virtual list measuring its rows) as an error: no fault.
    page.on('pageerror', (error) => {
      if (!error.message.startsWith('ResizeObserver loop')) failures.push(error.message);
    });

    await openExplore(page);
    const field = page.getByRole('textbox', { name: 'Search traits' });
    await field.focus();
    await field.pressSequentially('class:death');
    await expect(rows(page).first()).toBeVisible();
    await page.waitForTimeout(300);

    await expect(field).toHaveValue('class:death');
    await expect(page.getByRole('combobox', { name: 'Search traits' })).toHaveCount(0);
    // The search ran all the same: it shows the traits of a class, not all of them.
    await expect(announcedCount(page)).not.toHaveText(/^1,\d{3} of /u);
    await page.keyboard.press('Tab');
    await expect(field).not.toBeFocused();
    expect(failures).toEqual([]);
  });
});
