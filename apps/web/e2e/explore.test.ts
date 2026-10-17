import { expect, test, type Locator, type Page } from '@playwright/test';
import type { KeywordRole, Trait } from '@atlas/core';
import { axeViolations } from './support/axe';
import { publishedDataset } from './support/dataset';

/** The count a screen reader is told; it follows the typing once it pauses. */
const announcedCount = (page: Page) => page.getByRole('status');

const rows = (page: Page) => page.getByRole('listitem');

/**
 * Opens Explore and waits for the first row. The traits are fetched once the page is hydrated, so a field typed in before
 * that is lost to the hydration (WebKit gets there last).
 */
async function openExplore(page: Page): Promise<void> {
  await page.goto('./');
  await expect(rows(page).first()).toBeVisible();
}

/** The total the build published: the tests read it so that a data refresh does not break them. */
async function publishedCount(page: Page): Promise<number> {
  const manifest = (await (await page.request.get('./data/manifest.json')).json()) as { count: number };
  return manifest.count;
}

test.describe('explore', () => {
  test('has the filters, the results and the party side by side', async ({ page }) => {
    await openExplore(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Explore traits' })).toBeAttached();
    await expect(page.getByRole('region', { name: 'Filters' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Results' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Party' })).toBeVisible();
  });

  test('shows each trait with its creature, family, class, description and material', async ({ page }) => {
    await openExplore(page);

    const first = rows(page).first();
    await expect(first.getByRole('heading', { level: 3 })).not.toBeEmpty();
    await expect(first.locator('.creature')).not.toBeEmpty();
    await expect(first.locator('.origin')).toContainText('·');
    await expect(first.locator('.description')).not.toBeEmpty();
    await expect(first.locator('.material')).not.toBeEmpty();
  });

  test('narrows the results as you type and says how many are left', async ({ page }) => {
    const total = await publishedCount(page);
    await openExplore(page);
    await expect(announcedCount(page)).toContainText(`of ${total.toLocaleString('en-US')} traits`);

    await page.getByRole('textbox', { name: 'Search traits' }).fill('class:death');

    await expect(announcedCount(page)).not.toContainText(`${total.toLocaleString('en-US')} of`);
    const origins = await rows(page).locator('.origin').allTextContents();
    expect(origins.length).toBeGreaterThan(0);
    for (const origin of origins) expect(origin).toMatch(/· Death$/);
  });

  test('says so when no trait matches, and comes back when the query is cleared', async ({ page }) => {
    const total = await publishedCount(page);
    await openExplore(page);
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
    await openExplore(page);

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

    test('draws no trait twice as filters are taken off one by one and the list grows back to the whole', async ({
      page,
    }) => {
      const failures: string[] = [];
      page.on('pageerror', (error) => failures.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') failures.push(message.text());
      });
      await openExplore(page);
      const panel = page.getByRole('region', { name: 'Filters' });
      const chips = page.getByRole('group', { name: 'Filters and query terms' });
      // Each list that is shown has the traits of the one before it, and of the whole list, at other places: rows measured
      // for one list must not keep the places they had in it once the next one is shown (the virtualiser rebuilds what it
      // measured from the row that changed, and keeps the keys of the rows above it).
      const settle = () => page.waitForTimeout(300);

      await panel.getByRole('button', { name: /^Life\s/ }).click();
      await settle();
      await panel
        .getByRole('group', { name: 'Vulnerable', exact: true })
        .getByRole('button', { name: /^Applies/ })
        .click();
      await settle();
      await panel.getByRole('checkbox', { name: /does not stack/ }).check();
      await settle();
      for (const name of ['Remove class:life', 'Remove applies:vulnerable', 'Remove stack:no']) {
        await chips.getByRole('button', { name }).click();
        await settle();
      }

      await expect(rows(page).first()).toHaveAttribute('aria-setsize', String(await publishedCount(page)));
      const places = await rows(page).evaluateAll((items) => items.map((item) => item.getAttribute('aria-posinset')));
      expect(new Set(places).size).toBe(places.length);
      expect(failures).toEqual([]);
    });

    test('draws only the rows near the screen, however many traits there are', async ({ page }) => {
      const total = await publishedCount(page);
      await openExplore(page);

      expect(await rows(page).count()).toBeLessThan(60);
      await expect(rows(page).first()).toHaveAttribute('aria-posinset', '1');
      await expect(rows(page).first()).toHaveAttribute('aria-setsize', String(total));
    });

    test('scrolls on to the last trait, and lets go of the rows left behind', async ({ page, request }) => {
      const { traits } = await publishedDataset(request);
      await openExplore(page);

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
      await openExplore(page);

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
      await openExplore(page);
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
      await openExplore(page);
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
      await openExplore(page);
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
      await openExplore(page);
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
      await openExplore(page);
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
      await openExplore(page);
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
      await openExplore(page);
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

  test.describe('the filters', () => {
    const search = (page: Page) => page.getByRole('textbox', { name: 'Search traits' });
    const filters = (page: Page) => page.getByRole('region', { name: 'Filters' });
    const chips = (page: Page) => page.getByRole('group', { name: 'Filters and query terms' });
    const format = (count: number) => count.toLocaleString('en-US');
    const countText = (shown: number, all: readonly Trait[]) => `${format(shown)} of ${format(all.length)} traits`;

    /** A class or a trigger in the panel: its name, then the number of traits it would show. */
    const facet = (page: Page, label: string, count?: number) =>
      filters(page).getByRole('button', {
        name: new RegExp(`^${label}\\s*${count === undefined ? '[\\d,]+' : format(count)}\\s*traits$`),
      });

    /** One of the two sides of a buff, a debuff or an effect in the panel. */
    const side = (page: Page, keyword: string, which: 'Applies' | 'Relies on') =>
      filters(page)
        .getByRole('group', { name: keyword, exact: true })
        .getByRole('button', { name: new RegExp(`^${which}\\s`) });

    const mode = (page: Page, label: 'Match all' | 'Match any') =>
      filters(page).getByRole('group', { name: 'Keyword match mode' }).getByRole('button', { name: label });

    const applying = (traits: readonly Trait[], key: string) => withRole(traits, key, 'applies');
    const withRole = (traits: readonly Trait[], key: string, role: KeywordRole) =>
      traits.filter((trait) => trait.keywords.some((keyword) => keyword.key === key && keyword.role === role));

    const origins = (page: Page) => rows(page).locator('.origin').allTextContents();

    test('lists the classes, the keywords by kind and the flags, each with the traits it would show', async ({
      page,
      request,
    }) => {
      const { traits } = await publishedDataset(request);
      await openExplore(page);

      const perClass = new Map<string, number>();
      for (const { class: name } of traits) perClass.set(name, (perClass.get(name) ?? 0) + 1);
      expect(perClass.size).toBeGreaterThan(5);
      for (const [name, count] of perClass) await expect(facet(page, name, count), name).toBeVisible();

      for (const kind of ['Debuffs', 'Buffs', 'Effects', 'Triggers', 'Mechanics']) {
        await expect(filters(page).getByRole('heading', { level: 4, name: kind, exact: true })).toBeVisible();
      }
      await expect(side(page, 'Vulnerable', 'Applies')).toHaveAccessibleName(
        `Applies ${format(applying(traits, 'vulnerable').length)} traits`,
      );
      await expect(side(page, 'Vulnerable', 'Relies on')).toHaveAccessibleName(
        `Relies on ${format(withRole(traits, 'vulnerable', 'uses').length)} traits`,
      );
      await expect(filters(page).getByRole('checkbox', { name: 'Artifact-eligible (has material)' })).not.toBeChecked();
      await expect(filters(page).getByRole('checkbox', { name: 'Only “does not stack”' })).not.toBeChecked();
    });

    test('chooses classes as an any-of, and counts the other classes as before', async ({ page, request }) => {
      const { traits } = await publishedDataset(request);
      const inClass = (name: string) => traits.filter((trait) => trait.class === name);
      await openExplore(page);

      await facet(page, 'Life').click();
      await expect(facet(page, 'Life')).toHaveAttribute('aria-pressed', 'true');
      await expect(announcedCount(page)).toHaveText(countText(inClass('Life').length, traits));
      for (const origin of await origins(page)) expect(origin).toMatch(/· Life$/);
      // Choosing a class does not empty the others.
      await expect(facet(page, 'Death', inClass('Death').length)).toBeVisible();

      await facet(page, 'Death').click();
      await expect(announcedCount(page)).toHaveText(
        countText(inClass('Life').length + inClass('Death').length, traits),
      );
      for (const origin of await origins(page)) expect(origin).toMatch(/· (Life|Death)$/);

      await facet(page, 'Life').click();
      await expect(facet(page, 'Life')).toHaveAttribute('aria-pressed', 'false');
      await expect(announcedCount(page)).toHaveText(countText(inClass('Death').length, traits));
    });

    test('leaves out of a class the classes whose name has its own in it', async ({ page, request }) => {
      const { traits } = await publishedDataset(request);
      const bosses = traits.filter((trait) => trait.class === 'Boss');
      expect(bosses.length).toBeGreaterThan(0);
      await openExplore(page);

      await facet(page, 'Boss').click();

      await expect(announcedCount(page)).toHaveText(countText(bosses.length, traits));
      for (const origin of await origins(page)) expect(origin).toMatch(/· Boss$/);
      await expect(page.getByText('· Nether Boss')).toHaveCount(0);
    });

    test('matches the keywords chosen all together or any of them, and counts them as they change', async ({
      page,
      request,
    }) => {
      const { traits } = await publishedDataset(request);
      const vulnerable = new Set(applying(traits, 'vulnerable'));
      const weak = new Set(applying(traits, 'weak'));
      const both = [...vulnerable].filter((trait) => weak.has(trait));
      const either = new Set([...vulnerable, ...weak]);
      // The comparison below says nothing unless the two modes differ.
      expect(both.length).toBeLessThan(either.size);
      await openExplore(page);

      await side(page, 'Vulnerable', 'Applies').click();
      await expect(side(page, 'Vulnerable', 'Applies')).toHaveAttribute('aria-pressed', 'true');
      await expect(announcedCount(page)).toHaveText(countText(vulnerable.size, traits));

      await side(page, 'Weak', 'Applies').click();
      await expect(mode(page, 'Match all')).toHaveAttribute('aria-pressed', 'true');
      await expect(announcedCount(page)).toHaveText(countText(both.length, traits));

      await mode(page, 'Match any').click();
      await expect(mode(page, 'Match any')).toHaveAttribute('aria-pressed', 'true');
      await expect(mode(page, 'Match all')).toHaveAttribute('aria-pressed', 'false');
      await expect(announcedCount(page)).toHaveText(countText(either.size, traits));

      await side(page, 'Weak', 'Applies').click();
      await expect(side(page, 'Weak', 'Applies')).toHaveAttribute('aria-pressed', 'false');
      await expect(announcedCount(page)).toHaveText(countText(vulnerable.size, traits));
    });

    test('keeps the two sides of a keyword apart, and filters by a trigger on its own', async ({ page, request }) => {
      const { traits } = await publishedDataset(request);
      const relying = withRole(traits, 'vulnerable', 'uses');
      const mentioning = traits.filter((trait) => trait.keywords.some((keyword) => keyword.key === 'start of battle'));
      await openExplore(page);

      await side(page, 'Vulnerable', 'Relies on').click();
      await expect(announcedCount(page)).toHaveText(countText(relying.length, traits));
      await expect(side(page, 'Vulnerable', 'Applies')).toHaveAttribute('aria-pressed', 'false');
      await side(page, 'Vulnerable', 'Relies on').click();

      await facet(page, 'Start of battle', mentioning.length).click();
      await expect(facet(page, 'Start of battle')).toHaveAttribute('aria-pressed', 'true');
      await expect(announcedCount(page)).toHaveText(countText(mentioning.length, traits));
    });

    test('filters by the traits that can sit in an artifact slot and by those that do not stack', async ({
      page,
      request,
    }) => {
      const { traits } = await publishedDataset(request);
      const withMaterial = traits.filter((trait) => trait.material !== null);
      const notStacking = traits.filter((trait) => !trait.stacks);
      const both = notStacking.filter((trait) => trait.material !== null);
      await openExplore(page);
      const material = filters(page).getByRole('checkbox', { name: 'Artifact-eligible (has material)' });
      const stacking = filters(page).getByRole('checkbox', { name: 'Only “does not stack”' });

      await material.check();
      await expect(announcedCount(page)).toHaveText(countText(withMaterial.length, traits));

      await stacking.check();
      await expect(announcedCount(page)).toHaveText(countText(both.length, traits));

      await material.uncheck();
      await expect(announcedCount(page)).toHaveText(countText(notStacking.length, traits));
    });

    test('shows a chip for each filter that is on, and a chip takes its filter off', async ({ page, request }) => {
      const { traits } = await publishedDataset(request);
      await openExplore(page);
      await expect(chips(page)).toContainText('No filters yet');

      await facet(page, 'Life').click();
      await side(page, 'Vulnerable', 'Applies').click();
      await filters(page).getByRole('checkbox', { name: 'Only “does not stack”' }).check();

      await expect(chips(page).getByText('class:life')).toBeVisible();
      await expect(chips(page).getByText('applies:vulnerable')).toBeVisible();
      await expect(chips(page).getByText('stack:no')).toBeVisible();
      await expect(chips(page)).not.toContainText('No filters yet');

      await chips(page).getByRole('button', { name: 'Remove class:life' }).click();
      await expect(facet(page, 'Life')).toHaveAttribute('aria-pressed', 'false');
      await expect(chips(page).getByText('class:life')).toHaveCount(0);
      // The focus goes on to the next chip, not back to the top of the page.
      await expect(chips(page).getByRole('button', { name: 'Remove applies:vulnerable' })).toBeFocused();

      await chips(page).getByRole('button', { name: 'Remove applies:vulnerable' }).click();
      await chips(page).getByRole('button', { name: 'Remove stack:no' }).click();
      await expect(chips(page)).toContainText('No filters yet');
      await expect(chips(page)).toBeFocused();
      await expect(announcedCount(page)).toHaveText(countText(traits.length, traits));
    });

    test('shows the terms of the query bar as chips that can be excluded, included again and removed', async ({
      page,
    }) => {
      await openExplore(page);
      await search(page).fill('vulnerable OR weak');
      await expect(chips(page).getByRole('button', { name: 'vulnerable — exclude it' })).toBeVisible();
      await expect(chips(page).getByRole('button', { name: 'weak — exclude it' })).toBeVisible();

      await chips(page).getByRole('button', { name: 'vulnerable — exclude it' }).click();
      await expect(search(page)).toHaveValue('-vulnerable OR weak');
      const excluded = chips(page).getByRole('button', { name: 'vulnerable — include it again' });
      await expect(excluded).toContainText('NOT');

      await excluded.click();
      await expect(search(page)).toHaveValue('vulnerable OR weak');

      await chips(page).getByRole('button', { name: 'Remove vulnerable' }).click();
      await expect(search(page)).toHaveValue('weak');
      await expect(chips(page).getByRole('button', { name: 'Remove weak' })).toBeFocused();

      await chips(page).getByRole('button', { name: 'Remove weak' }).click();
      await expect(search(page)).toHaveValue('');
      await expect(chips(page)).toBeFocused();
    });

    test('writes the effective query, with the filters in it, and copies it', async ({
      page,
      context,
      browserName,
    }) => {
      if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await openExplore(page);
      await expect(page.getByText('Effective query')).toBeHidden();

      await search(page).fill('weak');
      await facet(page, 'Life').click();
      await expect(page.getByRole('code')).toHaveText('class:life weak');

      await page.getByRole('button', { name: 'Copy query' }).click();
      await expect(page.getByText('Copied', { exact: true })).toBeVisible();
      if (browserName === 'chromium') {
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('class:life weak');
      }
    });

    test('stays in the window beside the list, at the top of the page and scrolled down it', async ({ page }) => {
      test.skip((page.viewportSize()?.width ?? 0) < 700, 'Stacked above the list, the filters are part of the page.');
      await openExplore(page);
      const panel = filters(page).locator('.filters-body');
      const height = page.viewportSize()?.height ?? 0;

      for (const scrolled of [0, 150, 5000]) {
        await page.evaluate((top) => {
          window.scrollTo(0, top);
        }, scrolled);
        await expect(
          async () => {
            const box = await panel.boundingBox();
            expect(box).not.toBeNull();
            expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height + 1);
            if (scrolled === 5000) expect(box?.y).toBe(0);
          },
          `scrolled to ${String(scrolled)}`,
        ).toPass();
      }
    });

    test('starts the list over when a filter changes while the page is far down it', async ({ page }) => {
      await openExplore(page);
      await page.evaluate(() => {
        window.scrollTo(0, 20_000);
      });
      await expect(rows(page).first()).not.toHaveAttribute('aria-posinset', '1');

      // From the keyboard: Safari does not focus a button that is clicked.
      await facet(page, 'Life').focus();
      await page.keyboard.press('Enter');

      await expect(facet(page, 'Life')).toHaveAttribute('aria-pressed', 'true');
      await expect(rows(page).first()).toHaveAttribute('aria-posinset', '1');
      await expect(facet(page, 'Life')).toBeFocused();
    });

    test('suggests matching any of the keywords when several are all asked for and none is found', async ({ page }) => {
      await openExplore(page);
      await side(page, 'Vulnerable', 'Applies').click();
      await side(page, 'Weak', 'Applies').click();
      await search(page).fill('zzzqxj');
      await expect(page.getByText('No trait matches.')).toBeVisible();
      await expect(page.getByText('Or switch the keywords to “Match any”.')).toBeVisible();

      await mode(page, 'Match any').click();
      await expect(page.getByText('Or switch the keywords to “Match any”.')).toBeHidden();
      expect(await axeViolations(page)).toEqual([]);
    });

    test('has no WCAG 2.2 AA violations with filters on, a term excluded and the effective query shown', async ({
      page,
    }) => {
      await openExplore(page);
      await facet(page, 'Life').click();
      await side(page, 'Vulnerable', 'Applies').click();
      await facet(page, 'Start of battle').click();
      await filters(page).getByRole('checkbox', { name: 'Artifact-eligible (has material)' }).check();
      await search(page).fill('weak OR snared');
      await chips(page).getByRole('button', { name: 'weak — exclude it' }).click();
      await expect(page.getByRole('button', { name: 'Copy query' })).toBeVisible();

      expect(await axeViolations(page)).toEqual([]);
    });
  });

  test('has no WCAG 2.2 AA violations, with results and with a query typed', async ({ page }) => {
    await openExplore(page);
    expect(await axeViolations(page)).toEqual([]);

    await page.getByRole('textbox', { name: 'Search traits' }).fill('(vulnerable OR weak) -stack:no');
    await expect(rows(page).first()).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});
