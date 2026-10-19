import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Trait } from '@atlas/core';
import { axeViolations } from './support/axe';
import { publishedDataset } from './support/dataset';
import { openExplore, results, scrollScreens, searchBox } from './support/explore-page';
import { addButton, addToParty, findRow, partyPanel, plainTraits, showParty, slot } from './support/party-page';
import { paramOf, pathOf, synergyHeading } from './support/synergy-page';

// Phase 2, M13.7: a trait met in Explore leads to its Synergy page, from a result and from a filled slot of the party, and the way
// back finds the search and the party as they were left (ROADMAP, M13).

/** Two traits the tests can find by name and put in a party. */
async function twoTraits(request: Parameters<typeof publishedDataset>[0]): Promise<[Trait, Trait]> {
  const [first, second] = plainTraits((await publishedDataset(request)).traits);
  if (first === undefined || second === undefined) throw new Error('the dataset has fewer than two plain traits');
  return [first, second];
}

/** The link of a card or a slot that leads to the Synergy page of `trait`. */
const synergiesLink = (scope: Locator | Page, trait: Trait): Locator =>
  scope.getByRole('link', { name: `Synergies of ${trait.name}`, exact: true });

test.describe('a result', () => {
  test('leads to the page of its trait, carrying the party that stood beside it', async ({ page, request }) => {
    const [first, second] = await twoTraits(request);
    await openExplore(page);
    await addToParty(page, first);
    await expect.poll(() => paramOf(page, 'party')).toContain(first.id);

    await synergiesLink(await findRow(page, second), second).click();

    await expect.poll(() => pathOf(page)).toBe(`/synergy/${second.id}`);
    await expect(synergyHeading(page)).toHaveText(second.name);
    expect(paramOf(page, 'party')).toContain(first.id);
  });

  test('followed just after typing still leads there: the address, which follows the typing late, does not call the person back', async ({
    page,
    request,
  }) => {
    const [first] = await twoTraits(request);
    await openExplore(page);
    // The page of the trait is a route fetched on the first visit. Slower than the pause that the address waits after the typing
    // (400 ms), the write meant for Explore would arrive in the middle of the move, or after it.
    await page.route('**/*.js', async (route) => {
      await new Promise((settled) => setTimeout(settled, 900));
      await route.continue();
    });

    await synergiesLink(await findRow(page, first), first).click();

    await expect.poll(() => pathOf(page)).toBe(`/synergy/${first.id}`);
    await expect(synergyHeading(page)).toHaveText(first.name);
    // Well past the pause: the page is still the one the person went to.
    await page.waitForTimeout(1_000);
    expect(pathOf(page)).toBe(`/synergy/${first.id}`);
  });

  test('follows the party: the address it leads to has the trait just added', async ({ page, request }) => {
    const [first] = await twoTraits(request);
    await openExplore(page);
    const row = await findRow(page, first);
    const link = synergiesLink(row, first);
    await expect(link).not.toHaveAttribute('href', new RegExp(`party=.*${first.id}`, 'u'));

    await addButton(row).click();

    await expect(link).toHaveAttribute('href', new RegExp(`/synergy/${first.id}\\?.*party=.*${first.id}`, 'u'));
  });

  test('is reached with the keyboard after the keywords of the description, and Enter opens the page', async ({
    page,
    request,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'Safari’s tab key skips links unless a setting is on (keyboard.ts).');
    const [first] = await twoTraits(request);
    await openExplore(page);
    const row = await findRow(page, first);

    await addButton(row).focus();
    // The add button, then the keywords of the description (if there are any), then the link.
    const stops = await row.locator('.description .keyword').count();
    for (let stop = 0; stop <= stops; stop += 1) await page.keyboard.press('Tab');
    await expect(synergiesLink(row, first)).toBeFocused();
    await page.keyboard.press('Enter');

    await expect.poll(() => pathOf(page)).toBe(`/synergy/${first.id}`);
    await expect(synergyHeading(page)).toHaveText(first.name);
  });

  test('is inside its row, which the list measures again: the rows do not overlap, near the top and far down', async ({
    page,
  }) => {
    await openExplore(page);

    for (const screens of [0, 20]) {
      await scrollScreens(page, screens);
      await expect(results(page).locator('li[data-index]').nth(3)).toBeVisible();
      const faults = await results(page).evaluate((root) => {
        const found: string[] = [];
        const items = Array.from(root.querySelectorAll<HTMLElement>('li[data-index]'));
        for (const [at, item] of items.entries()) {
          const link = item.querySelector('a[href*="/synergy/"]');
          if (link === null) found.push(`row ${String(at)} has no link to the Synergies`);
          else if (link.getBoundingClientRect().bottom > item.getBoundingClientRect().bottom + 0.5) {
            found.push(`the link of row ${String(at)} is below its row`);
          }
          const next = items[at + 1];
          if (next !== undefined && item.getBoundingClientRect().bottom > next.getBoundingClientRect().top + 0.5) {
            found.push(`row ${String(at)} reaches into the next one`);
          }
        }
        return found;
      });
      expect(faults, `${String(screens)} screens down`).toEqual([]);
    }
  });
});

test.describe('the way back', () => {
  test('from the page of a result finds the search and the party as they were left', async ({ page, request }) => {
    const [first, second] = await twoTraits(request);
    await openExplore(page);
    await addToParty(page, first);
    const row = await findRow(page, second);
    const query = await searchBox(page).inputValue();
    expect(query).toContain(second.name);
    // The address follows the typing once it pauses (400 ms): a person takes longer than that to reach a link, a test does not.
    await expect.poll(() => paramOf(page, 'q')).toBe(query);
    const address = new URL(page.url()).search;
    expect(address).toContain(first.id);

    await synergiesLink(row, second).click();
    await expect.poll(() => pathOf(page)).toBe(`/synergy/${second.id}`);
    await page.goBack();

    await expect.poll(() => pathOf(page)).toBe('/');
    await expect(searchBox(page)).toHaveValue(query);
    await expect(synergiesLink(results(page), second)).toBeVisible();
    expect(new URL(page.url()).search).toBe(address);
    await showParty(page);
    await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(
      `Target slot: Creature 1 · Innate, ${first.name}`,
    );
  });
});

test.describe('a filled slot of the party', () => {
  test('leads to the page of its trait; an empty slot and a lost trait have no link', async ({ page, request }) => {
    const { datasetVersion } = await publishedDataset(request);
    const [first] = await twoTraits(request);
    const party = `${datasetVersion},${first.id},gone--from-the-sheet`;
    await page.goto(`./?party=${party}&tab=party`);
    await expect(partyPanel(page)).toBeVisible();

    // One link in eighteen slots: the one trait the dataset knows.
    await expect(partyPanel(page).getByRole('link', { name: /^Synergies of / })).toHaveCount(1);
    await synergiesLink(partyPanel(page), first).click();

    await expect.poll(() => pathOf(page)).toBe(`/synergy/${first.id}`);
    await expect(synergyHeading(page)).toHaveText(first.name);
    // The lost trait is kept in the party that goes along, as it is on every page.
    expect(paramOf(page, 'party')).toBe(party);
  });
});

test.describe('accessibility', () => {
  test('has no WCAG 2.2 AA violations on Explore with the links, and on the Party tab with a trait', async ({
    page,
    request,
  }) => {
    const [first] = await twoTraits(request);
    await openExplore(page);
    await addToParty(page, first);
    await expect(synergiesLink(await findRow(page, first), first)).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);

    await showParty(page);
    await expect(synergiesLink(partyPanel(page), first)).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});
