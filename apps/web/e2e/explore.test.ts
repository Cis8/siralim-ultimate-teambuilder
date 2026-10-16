import { expect, test, type Locator, type Page } from '@playwright/test';
import type { KeywordRole, Trait } from '@atlas/core';
import { axeViolations } from './support/axe';
import { publishedDataset } from './support/dataset';

/** The count a screen reader is told; it follows the typing once it pauses. */
const announcedCount = (page: Page) => page.getByRole('status');

const rows = (page: Page) => page.getByRole('listitem');

/** The total the build published: the tests read it so that a data refresh does not break them. */
async function publishedCount(page: Page): Promise<number> {
  const manifest = (await (await page.request.get('./data/manifest.json')).json()) as { count: number };
  return manifest.count;
}

test.describe('explore', () => {
  test('has the filters, the results and the party side by side', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByRole('heading', { level: 1, name: 'Explore traits' })).toBeAttached();
    await expect(page.getByRole('region', { name: 'Filters' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Results' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Party' })).toBeVisible();
  });

  test('shows each trait with its creature, family, class, description and material', async ({ page }) => {
    await page.goto('./');

    const first = rows(page).first();
    await expect(first.getByRole('heading', { level: 3 })).not.toBeEmpty();
    await expect(first.locator('.creature')).not.toBeEmpty();
    await expect(first.locator('.origin')).toContainText('·');
    await expect(first.locator('.description')).not.toBeEmpty();
    await expect(first.locator('.material')).not.toBeEmpty();
  });

  test('narrows the results as you type and says how many are left', async ({ page }) => {
    const total = await publishedCount(page);
    await page.goto('./');
    await expect(announcedCount(page)).toContainText(`of ${total.toLocaleString('en-US')} traits`);

    await page.getByRole('textbox', { name: 'Search traits' }).fill('class:death');

    await expect(announcedCount(page)).not.toContainText(`${total.toLocaleString('en-US')} of`);
    const origins = await rows(page).locator('.origin').allTextContents();
    expect(origins.length).toBeGreaterThan(0);
    for (const origin of origins) expect(origin).toMatch(/· Death$/);
  });

  test('says so when no trait matches, and comes back when the query is cleared', async ({ page }) => {
    const total = await publishedCount(page);
    await page.goto('./');
    const search = page.getByRole('textbox', { name: 'Search traits' });

    await search.fill('zzzqxj');
    await expect(announcedCount(page)).toHaveText(`0 of ${total.toLocaleString('en-US')} traits`);
    await expect(page.getByText('No trait matches.')).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);

    await search.fill('');
    await expect(announcedCount(page)).toHaveText(
      `${total.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} traits`,
    );
    await expect(page.getByText('No trait matches.')).toBeHidden();
  });

  test('sorts by class when asked to', async ({ page }) => {
    await page.goto('./');
    await expect(rows(page).first()).toBeVisible();

    await page.getByLabel('Sort').selectOption({ label: 'Class, then family' });

    const classes = (await rows(page).locator('.origin').allTextContents()).map(
      (origin) => origin.split('· ').pop() ?? '',
    );
    expect(classes.length).toBeGreaterThan(1);
    expect(classes).toEqual([...classes].sort((a, b) => a.localeCompare(b)));
  });

  test.describe('the result list', () => {
    /** Where the rows drawn stand in the list and what their description says, as the page has them. */
    const drawnDescriptions = (page: Page) =>
      rows(page).evaluateAll((items) =>
        items.map((item) => ({
          position: Number(item.getAttribute('aria-posinset')),
          description: item.querySelector('.description')?.textContent ?? '',
        })),
      );

    test('draws only the rows near the screen, however many traits there are', async ({ page }) => {
      const total = await publishedCount(page);
      await page.goto('./');
      await expect(rows(page).first()).toBeVisible();

      expect(await rows(page).count()).toBeLessThan(60);
      await expect(rows(page).first()).toHaveAttribute('aria-posinset', '1');
      await expect(rows(page).first()).toHaveAttribute('aria-setsize', String(total));
    });

    test('scrolls on to the last trait, and lets go of the rows left behind', async ({ page, request }) => {
      const { traits } = await publishedDataset(request);
      await page.goto('./');
      await expect(rows(page).first()).toBeVisible();

      // The heights of the rows below are estimated until they are drawn: the bottom of the page moves as they are.
      await expect(async () => {
        await page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
        });
        await expect(rows(page).last()).toHaveAttribute('aria-posinset', String(traits.length));
        await expect(rows(page).last()).toBeInViewport();
      }).toPass();

      await expect(rows(page).last().getByRole('heading', { level: 3 })).toHaveText(traits.at(-1)?.name ?? '');
      await expect(page.locator('li[aria-posinset="1"]')).toHaveCount(0);
      expect(await rows(page).count()).toBeLessThan(60);
    });

    test('reads each description exactly as the dataset has it', async ({ page, request }) => {
      const { traits } = await publishedDataset(request);
      await page.goto('./');
      await expect(rows(page).first()).toBeVisible();

      // The whole list, in the order of the dataset: each row is the trait at its position.
      const drawn = await drawnDescriptions(page);
      expect(drawn.length).toBeGreaterThan(0);
      for (const { position, description } of drawn) {
        expect(description, `trait ${String(position)}`).toBe(traits[position - 1]?.description);
      }

      // With marks and keywords drawn into the text, a row still says what some trait of the dataset says.
      const descriptions = new Set(traits.map((trait) => trait.description));
      await page.getByRole('textbox', { name: 'Search traits' }).fill('vulnerable OR "start of battle"');
      await expect(page.locator('mark').first()).toBeVisible();
      const marked = await drawnDescriptions(page);
      expect(marked.length).toBeGreaterThan(0);
      for (const { description } of marked) expect(descriptions.has(description), description).toBe(true);
    });

    test('styles a keyword by its kind and, by shape and not by colour alone, by its role', async ({ page }) => {
      await page.goto('./');
      const search = page.getByRole('textbox', { name: 'Search traits' });
      const style = (token: Locator) =>
        token.evaluate((element) => {
          const { textDecorationLine, outlineStyle } = getComputedStyle(element);
          return { underlined: textDecorationLine.includes('underline'), outline: outlineStyle };
        });

      await search.fill('applies:vulnerable');
      const applies = rows(page).locator('.keyword[data-kind="debuff"][data-role="applies"]').first();
      await expect(applies).toBeVisible();
      expect(await style(applies)).toEqual({ underlined: true, outline: 'none' });

      await search.fill('uses:vulnerable');
      const uses = rows(page).locator('.keyword[data-kind="debuff"][data-role="uses"]').first();
      await expect(uses).toBeVisible();
      expect(await style(uses)).toEqual({ underlined: false, outline: 'dashed' });

      await search.fill('"start of battle"');
      const trigger = rows(page).locator('.keyword[data-kind="trigger"]').first();
      await expect(trigger).toBeVisible();
      expect(await trigger.getAttribute('data-role')).toBeNull();
    });

    test('marks the text the query looks for, inside a keyword too, and nothing else', async ({ page }) => {
      await page.goto('./');
      const search = page.getByRole('textbox', { name: 'Search traits' });
      const marks = page.locator('mark');

      await search.fill('vulnerable');
      await expect(marks.first()).toBeVisible();
      for (const text of await marks.allTextContents()) expect(text.toLowerCase()).toBe('vulnerable');
      await expect(rows(page).locator('.keyword mark').first()).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);

      await search.fill('-vulnerable');
      await expect(rows(page).first()).toBeVisible();
      await expect(marks).toHaveCount(0);

      await search.fill('class:death');
      await expect(rows(page).first()).toBeVisible();
      await expect(marks).toHaveCount(0);
    });
  });

  test.describe('a keyword in a description', () => {
    const search = (page: Page) => page.getByRole('textbox', { name: 'Search traits' });
    const total = (traits: readonly Trait[]) => traits.length.toLocaleString('en-US');

    /** The traits of the dataset that do this with the keyword: what the page has to show after the click. */
    const withRole = (traits: readonly Trait[], key: string, role: KeywordRole) =>
      traits.filter((trait) => trait.keywords.some((keyword) => keyword.key === key && keyword.role === role));

    /** A trait is told apart by its family and its name (SPEC § Identity): a name alone can belong to several. */
    const identity = (trait: Trait) => `${trait.family} · ${trait.name}`;

    const drawnIdentities = (page: Page) =>
      rows(page).evaluateAll((items) =>
        items.map((item) => {
          const name = item.querySelector('h3')?.textContent.trim() ?? '';
          const family = item.querySelector('.origin')?.textContent.split(' · ')[0] ?? '';
          return `${family} · ${name}`;
        }),
      );

    /** Every row drawn is one of `expected`, and the count a screen reader is told is how many there are. */
    async function expectShown(page: Page, expected: readonly Trait[], all: readonly Trait[]): Promise<void> {
      await expect(announcedCount(page)).toHaveText(
        `${expected.length.toLocaleString('en-US')} of ${total(all)} traits`,
      );
      const allowed = new Set(expected.map(identity));
      const drawn = await drawnIdentities(page);
      expect(drawn.length).toBeGreaterThan(0);
      for (const trait of drawn) expect(allowed.has(trait), trait).toBe(true);
    }

    test('is a button that says what the trait does with it and what a click shows', async ({ page }) => {
      await page.goto('./');
      await search(page).fill('vulnerable');

      await expect(
        rows(page)
          .getByRole('button', { name: 'Applies Vulnerable — show traits that rely on it', pressed: false })
          .first(),
      ).toBeVisible();
      await expect(
        rows(page)
          .getByRole('button', { name: 'Relies on Vulnerable — show traits that apply it', pressed: false })
          .first(),
      ).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test('leads from a trait that applies it to the traits that rely on it, and the other way round', async ({
      page,
      request,
    }) => {
      const { traits } = await publishedDataset(request);
      await page.goto('./');
      await search(page).fill('vulnerable');
      const appliedHere = rows(page).getByRole('button', { name: /^Applies Vulnerable — / });
      await expect(appliedHere.first()).toBeVisible();

      await appliedHere.first().click();
      await expectShown(page, withRole(traits, 'vulnerable', 'uses'), traits);

      // Reached from the keyboard this time: the first trait of the list that relies on it leads back to the appliers.
      const reliedOnHere = rows(page).getByRole('button', { name: /^Relies on Vulnerable — /, pressed: false });
      await reliedOnHere.first().focus();
      await page.keyboard.press('Enter');
      await expectShown(page, withRole(traits, 'vulnerable', 'applies'), traits);
    });

    test('is pressed in a trait whose own filter is on, and a second click takes the filter off', async ({
      page,
      request,
    }) => {
      const { traits } = await publishedDataset(request);
      await page.goto('./');
      await search(page).fill('vulnerable');
      await expect(announcedCount(page)).toContainText('of');
      const before = (await announcedCount(page).textContent()) ?? '';
      await rows(page)
        .getByRole('button', { name: /^Applies Vulnerable — / })
        .first()
        .click();
      await expectShown(page, withRole(traits, 'vulnerable', 'uses'), traits);

      // The list now shows the traits that rely on Vulnerable: the ones that give it too have the filter's token on.
      const pressed = rows(page).getByRole('button', { pressed: true });
      await expect(pressed.first()).toHaveAccessibleName(/^Applies Vulnerable — /);
      await expect(rows(page).getByRole('button', { name: /^Applies Vulnerable — /, pressed: false })).toHaveCount(0);
      expect(await axeViolations(page)).toEqual([]);

      await pressed.first().click();
      await expect(announcedCount(page)).toHaveText(before);
    });

    test('shows the traits from the first, wherever in the list it was clicked, and moves the focus there', async ({
      page,
    }) => {
      await page.goto('./');
      await expect(rows(page).first()).toBeVisible();
      await page.evaluate(() => {
        window.scrollTo(0, 20_000);
      });
      await expect(rows(page).first()).not.toHaveAttribute('aria-posinset', '1');

      // Playwright brings the token into view first, so the page is still far down the list when the click lands.
      await rows(page).getByRole('button').first().click();

      await expect(page.getByRole('heading', { level: 2, name: 'Results' })).toBeFocused();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await expect(rows(page).first()).toHaveAttribute('aria-posinset', '1');
    });

    test('filters by a trigger, with no side to take, and by the flag "does not stack"', async ({ page, request }) => {
      const { traits } = await publishedDataset(request);
      await page.goto('./');
      await search(page).fill('"start of battle"');
      await rows(page)
        .getByRole('button', { name: /^start of battle — show traits that mention it$/i })
        .first()
        .click();
      // The phrase typed above also has to be found in the trait, so the filter is looked at on its own.
      await search(page).fill('');
      const mentioningIt = traits.filter((trait) =>
        trait.keywords.some((keyword) => keyword.key === 'start of battle'),
      );
      await expectShown(page, mentioningIt, traits);
      await expect(
        rows(page)
          .getByRole('button', { name: /^start of battle/i, pressed: true })
          .first(),
      ).toBeVisible();

      await search(page).fill('weak');
      const before = (await announcedCount(page).textContent()) ?? '';
      await rows(page)
        .getByRole('button', { name: /show only traits that do not stack$/ })
        .first()
        .click();
      await expect(announcedCount(page)).not.toHaveText(before);
      const flags = await rows(page).evaluateAll((items) =>
        items.map((item) => item.querySelectorAll('[data-kind="flag"]').length),
      );
      expect(flags.length).toBeGreaterThan(0);
      for (const count of flags) expect(count).toBeGreaterThan(0);
    });
  });

  test('has no WCAG 2.2 AA violations, with results and with a query typed', async ({ page }) => {
    await page.goto('./');
    await expect(rows(page).first()).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);

    await page.getByRole('textbox', { name: 'Search traits' }).fill('(vulnerable OR weak) -stack:no');
    await expect(rows(page).first()).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});
