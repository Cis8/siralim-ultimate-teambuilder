import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { axeViolations } from './support/axe';
import { openExplore, searchBox } from './support/explore-page';
import {
  forgetButtons,
  historyList,
  historyRows,
  keepSearches,
  keptSearches,
  manageSearchesButton,
  openSearchesSheet,
  saveRefusal,
  saveSearchButton,
  savedAs,
  searchesFile,
  searchesSheet,
  sheetSearches,
} from './support/history-page';
import { paramOf } from './support/synergy-page';

// Acceptance criterion 10 (docs/ROADMAP.md), PLAN 11.4 and SPEC §8.3: recent searches are remembered, saved searches are kept with a
// star, an empty field lists both, a sheet manages them, and a file carries them from one browser to another or back.

/** Types a search and sends it: Esc puts the list of suggestions away first, since Enter would take the suggestion that is active. */
async function send(page: Page, search: string): Promise<void> {
  await searchBox(page).pressSequentially(search);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
}

test.describe('recent searches', () => {
  test('remembers a search sent with Enter, and lists it for the empty field', async ({ page }) => {
    await openExplore(page);

    await send(page, 'applies:snared');
    await searchBox(page).fill('');

    await expect(historyList(page)).toBeVisible();
    await expect(historyRows(page)).toHaveCount(1);
    await expect(historyRows(page).first()).toHaveAccessibleName('Recent applies:snared');
  });

  test('remembers a search when the field is left with its text changed', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).pressSequentially('uses:weak');

    // Tab would take the suggestion that is active (D26): Esc puts the list away, and Tab then leaves.
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(searchBox(page)).not.toBeFocused();
    await searchBox(page).fill('');

    await expect(historyRows(page)).toHaveCount(1);
    await expect(historyRows(page).first()).toHaveAccessibleName('Recent uses:weak');
  });

  test('does not remember a search that was not changed, one that arrived with the address included', async ({
    page,
  }) => {
    await openExplore(page, './?q=weak');
    await searchBox(page).click();
    await page.keyboard.press('Tab');
    await searchBox(page).fill('');

    await expect(historyList(page)).toBeHidden();
  });

  test('does not remember what Enter took from the suggestions, which is a word in the middle of being typed', async ({
    page,
  }) => {
    await openExplore(page);
    await searchBox(page).pressSequentially('wea');
    await expect(searchBox(page)).toHaveAttribute('aria-activedescendant', /.+/);

    await page.keyboard.press('Enter');
    await expect(searchBox(page)).toHaveValue(/^applies:weak/);
    await searchBox(page).fill('');

    await expect(historyList(page)).toBeHidden();
  });

  test('lists the newest first, and a search sent again moves to the front', async ({ page }) => {
    await openExplore(page);
    for (const search of ['a', 'b', 'c', 'd', 'e', 'f', 'e']) {
      await searchBox(page).fill(search);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Enter');
    }
    await searchBox(page).fill('');

    await expect(historyRows(page).locator('.label')).toHaveText(['e', 'f', 'd', 'c', 'b', 'a']);
  });

  test('says in the sheet that there is nothing, when there is nothing', async ({ page }) => {
    await openExplore(page);
    await openSearchesSheet(page);

    await expect(searchesSheet(page)).toContainText('Nothing is saved yet. Press the star beside the search field');
    await expect(searchesSheet(page)).toContainText('No recent searches yet.');
    await expect(searchesSheet(page).getByRole('heading', { name: 'Saved (0 of 50)' })).toBeVisible();
    await expect(searchesSheet(page).getByRole('heading', { name: 'Recent (0)' })).toBeVisible();
  });

  test('keeps them for the next visit', async ({ page }) => {
    await openExplore(page);
    await send(page, 'applies:snared');
    await page.goto('./');

    await expect(searchBox(page)).toHaveValue('');
    await searchBox(page).click();

    await expect(historyRows(page).first()).toHaveAccessibleName('Recent applies:snared');
  });
});

test.describe('the list of an empty field', () => {
  test.beforeEach(async ({ page }) => {
    await keepSearches(page, {
      recent: ['applies:snared', 'uses:weak'],
      saved: savedAs('class:life mat:yes'),
    });
  });

  test('opens on a press in the field and on the arrow, and not on a focus alone', async ({ page }) => {
    await openExplore(page);

    await searchBox(page).focus();
    await expect(historyList(page)).toBeHidden();

    await searchBox(page).click();
    await expect(historyList(page)).toBeVisible();
    await expect(historyRows(page)).toHaveCount(3);

    await page.keyboard.press('Escape');
    await expect(historyList(page)).toBeHidden();
    await page.keyboard.press('ArrowDown');
    await expect(historyList(page)).toBeVisible();
    await expect(searchBox(page)).toHaveAttribute('aria-expanded', 'true');
  });

  test('lists the recent searches, then the saved ones, each with a word that says which it is', async ({ page }) => {
    await openExplore(page);

    await searchBox(page).click();

    await expect(historyRows(page)).toHaveText([
      'Recent applies:snared',
      'Recent uses:weak',
      'Saved class:life mat:yes',
    ]);
    await expect(historyRows(page).nth(2)).toHaveAccessibleName('Saved class:life mat:yes');
  });

  test('has nothing active, so that Tab leaves the field and Enter is its own (WCAG 2.1.2)', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).click();
    await expect(historyList(page)).toBeVisible();
    await expect(searchBox(page)).not.toHaveAttribute('aria-activedescendant', /.+/);

    await page.keyboard.press('Tab');

    await expect(searchBox(page)).not.toBeFocused();
    await expect(searchBox(page)).toHaveValue('');
    await expect(historyList(page)).toBeHidden();
  });

  test('stays so when the typing has just emptied the field', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).pressSequentially('x');
    await searchBox(page).press('Backspace');

    await expect(historyList(page)).toBeVisible();
    await expect(searchBox(page)).not.toHaveAttribute('aria-activedescendant', /.+/);
    await page.keyboard.press('Tab');
    await expect(searchBox(page)).toHaveValue('');
  });

  test('takes the search under the arrows, with Enter, and puts it in the field whole', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).click();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(historyRows(page).nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');

    await expect(searchBox(page)).toHaveValue('uses:weak');
    await expect(historyList(page)).toBeHidden();
    await expect(searchBox(page)).toBeFocused();
    await expect.poll(() => paramOf(page, 'q')).toBe('uses:weak');
  });

  test('takes the search that is pressed, and remembers it as the newest', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).click();

    await historyRows(page).nth(1).click();
    await expect(searchBox(page)).toHaveValue('uses:weak');
    await searchBox(page).fill('');

    await expect(historyRows(page).first()).toHaveAccessibleName('Recent uses:weak');
  });

  test('gives way to the suggestions as soon as there is something to complete', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).click();
    await expect(historyList(page)).toBeVisible();

    await searchBox(page).pressSequentially('wea');

    await expect(historyList(page)).toBeHidden();
    await expect(searchBox(page)).toHaveAttribute('aria-activedescendant', /.+/);
  });

  test('has no accessibility violation', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).click();
    await expect(historyList(page)).toBeVisible();

    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('the star', () => {
  test('is there while the field holds a search, and keeps it', async ({ page }) => {
    await openExplore(page);
    await expect(saveSearchButton(page)).toBeHidden();

    await searchBox(page).pressSequentially('uses:weak');

    await expect(saveSearchButton(page)).toBeVisible();
    await expect(saveSearchButton(page)).toHaveAttribute('aria-pressed', 'false');
    await saveSearchButton(page).click();
    await expect(saveSearchButton(page)).toHaveAttribute('aria-pressed', 'true');
    // The name does not change with the state: a toggle says it is pressed in its own property.
    await expect(saveSearchButton(page)).toHaveAccessibleName('Save this search');
    expect(await keptSearches(page)).toMatchObject({ saved: [{ name: 'uses:weak', query: 'uses:weak' }] });
  });

  test('does not take the focus from the field, where the keyboard of a phone is', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).pressSequentially('uses:weak');

    await saveSearchButton(page).click();

    await expect(searchBox(page)).toBeFocused();
  });

  test('lists a saved search once, as saved, and keeps it for the next visit', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).pressSequentially('uses:weak');
    await saveSearchButton(page).click();
    await page.goto('./');

    await searchBox(page).click();

    await expect(historyRows(page)).toHaveCount(1);
    await expect(historyRows(page).first()).toHaveAccessibleName('Saved uses:weak');
  });

  test('takes the search off again when it is pressed again, and the search stays among the recent ones', async ({
    page,
  }) => {
    await openExplore(page);
    await searchBox(page).pressSequentially('uses:weak');
    await saveSearchButton(page).click();

    await saveSearchButton(page).click();

    await expect(saveSearchButton(page)).toHaveAttribute('aria-pressed', 'false');
    await searchBox(page).fill('');
    await expect(historyRows(page)).toHaveText(['Recent uses:weak']);
  });

  test('is pressed for a text that is saved already, however it came to the field', async ({ page }) => {
    await keepSearches(page, { recent: [], saved: savedAs('uses:weak') });
    await openExplore(page, './?q=uses%3Aweak');

    await expect(saveSearchButton(page)).toHaveAttribute('aria-pressed', 'true');
    await searchBox(page).fill('uses:weak ');
    await expect(saveSearchButton(page)).toHaveAttribute('aria-pressed', 'true');
    await searchBox(page).fill('uses:snared');
    await expect(saveSearchButton(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('says why it did nothing when the fifty places are taken, and never swaps a search the person kept', async ({
    page,
  }) => {
    const places = Array.from({ length: 50 }, (_, at) => `class:life ${String(at)}`);
    await keepSearches(page, { recent: [], saved: savedAs(...places) });
    await openExplore(page);
    await searchBox(page).pressSequentially('uses:weak');

    await saveSearchButton(page).click();

    await expect(saveSearchButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(saveRefusal(page)).toContainText('You have 50 saved searches already. Remove one to save this one.');
    expect(await keptSearches(page)).toMatchObject({ saved: savedAs(...places) });

    // The way out is in the line itself: forget one, and the same search can be kept.
    await saveRefusal(page).getByRole('button', { name: 'Manage searches' }).click();
    await forgetButtons(page).first().click();
    await searchesSheet(page).getByRole('button', { name: 'Done' }).click();
    await expect(manageSearchesButton(page)).toBeFocused();
    await saveSearchButton(page).click();
    await expect(saveSearchButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(saveRefusal(page)).toBeHidden();
  });

  test('has the refusal go with the text it was about', async ({ page }) => {
    const places = Array.from({ length: 50 }, (_, at) => `class:life ${String(at)}`);
    await keepSearches(page, { recent: [], saved: savedAs(...places) });
    await openExplore(page);
    await searchBox(page).pressSequentially('uses:weak');
    await saveSearchButton(page).click();
    await expect(saveRefusal(page)).toBeVisible();

    await searchBox(page).pressSequentially(' x');

    await expect(saveRefusal(page)).toBeHidden();
  });

  test('has no accessibility violation, pressed or not, nor with the refusal showing', async ({ page }) => {
    const places = Array.from({ length: 50 }, (_, at) => `class:life ${String(at)}`);
    await keepSearches(page, { recent: [], saved: savedAs(...places) });
    await openExplore(page);
    await searchBox(page).pressSequentially('uses:weak');
    expect(await axeViolations(page)).toEqual([]);

    await saveSearchButton(page).click();
    await expect(saveRefusal(page)).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('the sheet that manages the searches', () => {
  const kept = { recent: ['applies:snared', 'uses:weak', 'weak'], saved: savedAs('class:life mat:yes', 'stack:no') };

  test.beforeEach(async ({ page }) => {
    await keepSearches(page, kept);
  });

  test('lists both, with how many of each', async ({ page }) => {
    await openExplore(page);
    await openSearchesSheet(page);

    await expect(searchesSheet(page).getByRole('heading', { name: 'Saved (2 of 50)' })).toBeVisible();
    await expect(searchesSheet(page).getByRole('heading', { name: 'Recent (3)' })).toBeVisible();
    await expect(sheetSearches(page, 'Saved')).toHaveText(['class:life mat:yes', 'stack:no']);
    await expect(sheetSearches(page, 'Recent')).toHaveText(['applies:snared', 'uses:weak', 'weak']);
  });

  test('puts a search in the field, shuts, and gives the focus back to the button that opened it', async ({ page }) => {
    await openExplore(page);
    await openSearchesSheet(page);

    await sheetSearches(page, 'Saved').first().click();

    await expect(searchesSheet(page)).toBeHidden();
    await expect(searchBox(page)).toHaveValue('class:life mat:yes');
    await expect(manageSearchesButton(page)).toBeFocused();
    await expect.poll(() => paramOf(page, 'q')).toBe('class:life mat:yes');
    // It is the newest of the recent ones now, and it is saved as well: the list shows it once, as saved.
    await searchBox(page).fill('');
    await expect(historyRows(page).first()).toHaveAccessibleName('Recent applies:snared');
  });

  test('forgets a search, and the focus goes to the one that takes its place, or to the heading', async ({ page }) => {
    await openExplore(page);
    await openSearchesSheet(page);

    await searchesSheet(page)
      .getByRole('button', { name: 'Remove “class:life mat:yes” from the saved searches' })
      .click();
    await expect(sheetSearches(page, 'Saved')).toHaveText(['stack:no']);
    await expect(sheetSearches(page, 'Saved').first()).toBeFocused();
    await expect(searchesSheet(page).getByRole('heading', { name: 'Saved (1 of 50)' })).toBeVisible();

    await searchesSheet(page).getByRole('button', { name: 'Remove “stack:no” from the saved searches' }).click();
    await expect(searchesSheet(page).getByRole('heading', { name: 'Saved (0 of 50)' })).toBeFocused();

    await searchesSheet(page).getByRole('button', { name: 'Remove “weak” from the recent searches' }).click();
    await expect(sheetSearches(page, 'Recent')).toHaveText(['applies:snared', 'uses:weak']);
    // What a person forgot stays forgotten after a visit.
    expect(await keptSearches(page)).toMatchObject({ recent: ['applies:snared', 'uses:weak'], saved: [] });
  });

  test('closes with Esc, and with Done, the focus back on its button', async ({ page }) => {
    await openExplore(page);
    await openSearchesSheet(page);
    await page.keyboard.press('Escape');
    await expect(searchesSheet(page)).toBeHidden();
    await expect(manageSearchesButton(page)).toBeFocused();

    await openSearchesSheet(page);
    await searchesSheet(page).getByRole('button', { name: 'Done' }).click();
    await expect(searchesSheet(page)).toBeHidden();
    await expect(manageSearchesButton(page)).toBeFocused();
  });

  test('has no accessibility violation', async ({ page }) => {
    await openExplore(page);
    await openSearchesSheet(page);

    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe('the file of searches', () => {
  const kept = { recent: ['applies:snared', 'uses:weak', 'weak'], saved: savedAs('class:life mat:yes', 'stack:no') };

  test('exports what is kept, and importing it again after taking everything away restores it', async ({
    page,
  }, testInfo) => {
    await keepSearches(page, kept);
    await openExplore(page);
    await openSearchesSheet(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      searchesSheet(page).getByRole('button', { name: 'Export searches' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('trait-atlas-searches.json');
    const path = testInfo.outputPath('searches.json');
    await download.saveAs(path);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(JSON.parse(searchesFile(kept)));
    await expect(searchesSheet(page)).toContainText('Exported 2 saved and 3 recent searches.');

    while ((await forgetButtons(page).count()) > 0) await forgetButtons(page).first().click();
    await expect(searchesSheet(page).getByRole('heading', { name: 'Saved (0 of 50)' })).toBeVisible();
    await expect(searchesSheet(page).getByRole('heading', { name: 'Recent (0)' })).toBeVisible();

    await searchesSheet(page).locator('input[type="file"]').setInputFiles(path);

    await expect(searchesSheet(page)).toContainText('Imported 2 saved, 3 recent.');
    await expect(sheetSearches(page, 'Saved')).toHaveText(['class:life mat:yes', 'stack:no']);
    await expect(sheetSearches(page, 'Recent')).toHaveText(['applies:snared', 'uses:weak', 'weak']);
    expect(await keptSearches(page)).toEqual(JSON.parse(searchesFile(kept)));
  });

  test('adds to what is there when it holds more, and adds nothing when it is read again', async ({ page }) => {
    await keepSearches(page, { recent: ['weak'], saved: savedAs('stack:no') });
    await openExplore(page);
    await openSearchesSheet(page);
    const file = searchesFile({ recent: ['weak', 'snared'], saved: savedAs('stack:no', 'uses:weak') });
    const input = searchesSheet(page).locator('input[type="file"]');

    await input.setInputFiles({ name: 'more.json', mimeType: 'application/json', buffer: Buffer.from(file) });
    await expect(searchesSheet(page)).toContainText('Imported 1 saved, 1 recent.');
    await expect(sheetSearches(page, 'Saved')).toHaveText(['stack:no', 'uses:weak']);
    // What was there stays first; the file adds the rest.
    await expect(sheetSearches(page, 'Recent')).toHaveText(['weak', 'snared']);

    await input.setInputFiles({ name: 'more.json', mimeType: 'application/json', buffer: Buffer.from(file) });
    await expect(searchesSheet(page)).toContainText('Nothing new in this file: its searches are here already.');
  });

  test('opens the browser’s file chooser from the Import button', async ({ page }) => {
    await openExplore(page);
    await openSearchesSheet(page);

    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      searchesSheet(page).getByRole('button', { name: 'Import searches' }).click(),
    ]);

    expect(chooser.isMultiple()).toBe(false);
  });

  test.describe('refuses a file that is not whole, and changes nothing', () => {
    const bad = [
      ['one that is not JSON', '{"app": "trait-atlas", "kind": "search-his', 'it is not JSON'],
      ['one from another app', '{"hello": "world"}', 'was not made by Trait Atlas'],
      [
        'one from another version',
        JSON.stringify({ app: 'trait-atlas', kind: 'search-history', version: 2, recent: [], saved: [] }),
        'another version of Trait Atlas',
      ],
      [
        'one with searches that are not text',
        JSON.stringify({ app: 'trait-atlas', kind: 'search-history', version: 1, recent: [4], saved: [] }),
        'damaged',
      ],
      [
        'one with more than the app keeps',
        searchesFile({ recent: [], saved: savedAs(...Array.from({ length: 51 }, (_, at) => `s ${String(at)}`)) }),
        'more than Trait Atlas keeps',
      ],
    ] as const;

    for (const [name, text, because] of bad) {
      test(name, async ({ page }) => {
        await keepSearches(page, kept);
        await openExplore(page);
        await openSearchesSheet(page);
        const before = await keptSearches(page);

        await searchesSheet(page)
          .locator('input[type="file"]')
          .setInputFiles({ name: 'searches.json', mimeType: 'application/json', buffer: Buffer.from(text) });

        await expect(searchesSheet(page)).toContainText(because);
        await expect(searchesSheet(page)).toContainText('Nothing was imported.');
        await expect(sheetSearches(page, 'Saved')).toHaveCount(2);
        await expect(sheetSearches(page, 'Recent')).toHaveCount(3);
        expect(await keptSearches(page)).toEqual(before);
      });
    }
  });
});

test.describe('a browser that keeps nothing (a private window, blocked site data)', () => {
  test('still serves the visit: the searches are held while the page is open', async ({ page }) => {
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    await openExplore(page);

    await send(page, 'applies:snared');
    await saveSearchButton(page).click();
    await expect(saveSearchButton(page)).toHaveAttribute('aria-pressed', 'true');
    await searchBox(page).fill('');

    await expect(historyRows(page)).toHaveText(['Saved applies:snared']);
    expect(failures).toEqual([]);
  });
});
