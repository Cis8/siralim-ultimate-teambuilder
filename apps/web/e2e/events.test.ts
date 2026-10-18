import { expect, test, type Page } from '@playwright/test';
import { taxonomy, type KeywordActor, type Trait } from '@atlas/core';
import { axeViolations } from './support/axe';
import { publishedDataset } from './support/dataset';
import {
  announcedCount,
  chips,
  clearFiltersButton,
  closeFilters,
  countText,
  filters,
  format,
  isCompact,
  openExplore,
  openFilters,
  rows,
  searchBox,
  section,
  side,
  who,
} from './support/explore-page';

// The Events section (SPEC §8.1, GAME_RULES R12): five groups, each event with a button for the traits that cause it and one
// for those that react to it, and one "Who" control, a toggle for each actor, that sets who acts in the filters.

const GROUPS = ['Battle and turns', 'Actions', 'Hits', 'Life and death', 'Buffs and debuffs'] as const;

/** What a filter on a side of an event, by anyone or by any of the actors, finds in the dataset. */
const having = (traits: readonly Trait[], role: 'applies' | 'uses', key: string, ...actors: KeywordActor[]): Trait[] =>
  traits.filter((trait) =>
    trait.keywords.some(
      (hit) =>
        hit.key === key &&
        hit.role === role &&
        (actors.length === 0 || (hit.actor !== undefined && actors.includes(hit.actor))),
    ),
  );

const addressKeywords = (page: Page): string | null => new URL(page.url()).searchParams.get('kw');
const expectAddressKeywords = (page: Page, keywords: string | null) =>
  expect.poll(() => addressKeywords(page)).toBe(keywords);
const historyLength = (page: Page) => page.evaluate(() => window.history.length);

test.describe('the Events section', () => {
  test('lists the events in five groups, each with a button to cause it and one to react to it', async ({
    page,
    request,
  }) => {
    const { traits } = await publishedDataset(request);
    await openExplore(page);
    await openFilters(page);

    for (const name of GROUPS) {
      await expect(filters(page).getByRole('heading', { level: 5, name, exact: true }), name).toBeVisible();
    }
    const events = taxonomy.ofKind('event');
    expect(events).toHaveLength(18);
    for (const { key, label } of events) {
      await expect(side(page, label, 'Causes'), label).toHaveAccessibleName(
        `Causes ${format(having(traits, 'applies', key).length)} traits`,
      );
      await expect(side(page, label, 'Reacts'), label).toHaveAccessibleName(
        `Reacts ${format(having(traits, 'uses', key).length)} traits`,
      );
      await expect(side(page, label, 'Applies'), label).toHaveCount(0);
    }
  });

  test('turns an event on whoever acts, and the address, the chip and the count say so', async ({ page, request }) => {
    const { traits } = await publishedDataset(request);
    const reacting = having(traits, 'uses', 'attack');
    await openExplore(page);
    await openFilters(page);

    await side(page, 'Attack', 'Reacts').click();

    await expect(side(page, 'Attack', 'Reacts')).toHaveAttribute('aria-pressed', 'true');
    await expect(side(page, 'Attack', 'Causes')).toHaveAttribute('aria-pressed', 'false');
    await expect(announcedCount(page)).toHaveText(countText(reacting.length, traits));
    await expectAddressKeywords(page, 'u:attack');
    await closeFilters(page);
    await expect(chips(page)).toContainText('uses:attack');
  });

  test.describe('the "Who" control', () => {
    test('shows "Any" to begin with, and four choices in the order of the rules', async ({ page }) => {
      await openExplore(page);
      await openFilters(page);

      await expect(who(page, 'Any')).toHaveAttribute('aria-pressed', 'true');
      for (const choice of ['This creature', 'Your creatures', 'Enemies'] as const) {
        await expect(who(page, choice)).toHaveAttribute('aria-pressed', 'false');
      }
      const names = await filters(page)
        .getByRole('group', { name: 'Who acts', includeHidden: true })
        .getByRole('button', { includeHidden: true })
        .allTextContents();
      expect(names).toEqual(['Any', 'This creature', 'Your creatures', 'Enemies']);
    });

    test('narrows the event filters that are on, in one step of the history that back undoes', async ({
      page,
      request,
    }) => {
      const { traits } = await publishedDataset(request);
      const bySelf = having(traits, 'uses', 'attack', 'self');
      const byAnyone = having(traits, 'uses', 'attack');
      expect(bySelf.length).toBeLessThan(byAnyone.length);
      await openExplore(page);
      await openFilters(page);
      await side(page, 'Attack', 'Reacts').click();
      await expectAddressKeywords(page, 'u:attack');
      const before = await historyLength(page);

      await who(page, 'This creature').click();

      await expectAddressKeywords(page, 'u:attack/self');
      expect(await historyLength(page)).toBe(before + 1);
      await expect(who(page, 'This creature')).toHaveAttribute('aria-pressed', 'true');
      await expect(who(page, 'Any')).toHaveAttribute('aria-pressed', 'false');
      await expect(announcedCount(page)).toHaveText(countText(bySelf.length, traits));
      await expect(side(page, 'Attack', 'Reacts')).toHaveAttribute('aria-pressed', 'true');
      await closeFilters(page);
      await expect(chips(page)).toContainText('uses:attack/self');

      await page.goBack();

      await expectAddressKeywords(page, 'u:attack');
      await openFilters(page);
      await expect(who(page, 'Any')).toHaveAttribute('aria-pressed', 'true');
      await expect(announcedCount(page)).toHaveText(countText(byAnyone.length, traits));
    });

    test('is the actor the next filter gets when it is chosen first, with the counts of that actor', async ({
      page,
      request,
    }) => {
      const { traits } = await publishedDataset(request);
      const causedByEnemies = having(traits, 'applies', 'heal', 'enemy');
      expect(causedByEnemies.length).toBeGreaterThan(0);
      expect(causedByEnemies.length).toBeLessThan(having(traits, 'applies', 'heal').length);
      await openExplore(page);
      await openFilters(page);
      const entries = await historyLength(page);

      await who(page, 'Enemies').click();

      await expect(who(page, 'Enemies')).toHaveAttribute('aria-pressed', 'true');
      await expect(side(page, 'Heal', 'Causes')).toHaveAccessibleName(
        `Causes ${format(causedByEnemies.length)} traits`,
      );
      // Nothing is filtered yet: no step of the history, and no parameter.
      expect(addressKeywords(page)).toBeNull();
      expect(await historyLength(page)).toBe(entries);

      await side(page, 'Heal', 'Causes').click();

      await expectAddressKeywords(page, 'a:heal/enemy');
      await expect(announcedCount(page)).toHaveText(countText(causedByEnemies.length, traits));

      await who(page, 'Any').click();

      await expectAddressKeywords(page, 'a:heal');
      await expect(side(page, 'Heal', 'Causes')).toHaveAccessibleName(
        `Causes ${format(having(traits, 'applies', 'heal').length)} traits`,
      );
    });

    test('shows nothing pressed while the filters name several actors, and a press makes them one', async ({
      page,
    }) => {
      await openExplore(page, './?kw=u:attack/self,u:death/enemy&mode=any');
      await openFilters(page);

      for (const choice of ['Any', 'This creature', 'Your creatures', 'Enemies'] as const) {
        await expect(who(page, choice), choice).toHaveAttribute('aria-pressed', 'false');
      }

      await who(page, 'Your creatures').click();

      await expectAddressKeywords(page, 'u:attack/ally,u:death/ally');
      await expect(who(page, 'Your creatures')).toHaveAttribute('aria-pressed', 'true');
    });

    test.describe('with several actors', () => {
      test('turns each button on and off on its own, and puts "Any" back when the last actor goes', async ({
        page,
        request,
      }) => {
        const { traits } = await publishedDataset(request);
        const bySelf = having(traits, 'uses', 'attack', 'self');
        const byEither = having(traits, 'uses', 'attack', 'self', 'enemy');
        expect(byEither.length).toBeGreaterThan(bySelf.length);
        await openExplore(page);
        await openFilters(page);
        await side(page, 'Attack', 'Reacts').click();
        await who(page, 'This creature').click();
        await expectAddressKeywords(page, 'u:attack/self');
        const before = await historyLength(page);

        await who(page, 'Enemies').click();

        await expectAddressKeywords(page, 'u:attack/self,u:attack/enemy');
        expect(await historyLength(page)).toBe(before + 1);
        await expect(who(page, 'This creature')).toHaveAttribute('aria-pressed', 'true');
        await expect(who(page, 'Enemies')).toHaveAttribute('aria-pressed', 'true');
        await expect(who(page, 'Any')).toHaveAttribute('aria-pressed', 'false');
        await expect(who(page, 'Your creatures')).toHaveAttribute('aria-pressed', 'false');
        await expect(announcedCount(page)).toHaveText(countText(byEither.length, traits));
        await expect(side(page, 'Attack', 'Reacts')).toHaveAttribute('aria-pressed', 'true');

        await who(page, 'This creature').click();

        await expectAddressKeywords(page, 'u:attack/enemy');
        await expect(who(page, 'This creature')).toHaveAttribute('aria-pressed', 'false');
        await expect(who(page, 'Enemies')).toHaveAttribute('aria-pressed', 'true');
        await expect(announcedCount(page)).toHaveText(
          countText(having(traits, 'uses', 'attack', 'enemy').length, traits),
        );

        await who(page, 'Enemies').click();

        await expectAddressKeywords(page, 'u:attack');
        await expect(who(page, 'Any')).toHaveAttribute('aria-pressed', 'true');
        await expect(who(page, 'Enemies')).toHaveAttribute('aria-pressed', 'false');
      });

      test('writes the filters of one side as alternatives, in the chips and the effective query', async ({ page }) => {
        await openExplore(page);
        await openFilters(page);
        await side(page, 'Attack', 'Reacts').click();
        await who(page, 'This creature').click();
        await who(page, 'Enemies').click();
        await side(page, 'Weak', 'Relies on').click();
        await closeFilters(page);

        await expect(chips(page)).toContainText('uses:attack/self');
        await expect(chips(page)).toContainText('uses:attack/enemy');
        await expect(page.getByRole('code')).toHaveText('(uses:attack/self OR uses:attack/enemy) uses:weak');
      });

      test('counts beside the buttons the traits that name at least one of the actors, each once', async ({
        page,
        request,
      }) => {
        const { traits } = await publishedDataset(request);
        const either = having(traits, 'applies', 'heal', 'self', 'enemy');
        expect(either.length).toBeGreaterThan(0);
        await openExplore(page);
        await openFilters(page);

        await who(page, 'This creature').click();
        await who(page, 'Enemies').click();

        // Nothing is filtered yet: no parameter, and the counts are those of the two actors together.
        expect(addressKeywords(page)).toBeNull();
        await expect(side(page, 'Heal', 'Causes')).toHaveAccessibleName(`Causes ${format(either.length)} traits`);
      });

      test('takes every actor off with "Any", in one step, and stays on "Any" when it is pressed again', async ({
        page,
      }) => {
        await openExplore(page, './?kw=u:attack/self,u:attack/enemy');
        await openFilters(page);
        await expect(who(page, 'This creature')).toHaveAttribute('aria-pressed', 'true');
        await expect(who(page, 'Enemies')).toHaveAttribute('aria-pressed', 'true');
        const before = await historyLength(page);

        await who(page, 'Any').click();

        await expectAddressKeywords(page, 'u:attack');
        expect(await historyLength(page)).toBe(before + 1);
        await expect(who(page, 'Any')).toHaveAttribute('aria-pressed', 'true');
        await expect(who(page, 'This creature')).toHaveAttribute('aria-pressed', 'false');

        await who(page, 'Any').click();

        await expectAddressKeywords(page, 'u:attack');
        expect(await historyLength(page)).toBe(before + 1);
        await expect(who(page, 'Any')).toHaveAttribute('aria-pressed', 'true');
      });

      test('gives every event filter the actors, and back undoes it', async ({ page }) => {
        await openExplore(page, './?kw=u:attack/self,a:death/self');
        await openFilters(page);
        await expect(who(page, 'This creature')).toHaveAttribute('aria-pressed', 'true');

        await who(page, 'Your creatures').click();

        await expectAddressKeywords(page, 'u:attack/self,u:attack/ally,a:death/self,a:death/ally');
        await expect(who(page, 'This creature')).toHaveAttribute('aria-pressed', 'true');
        await expect(who(page, 'Your creatures')).toHaveAttribute('aria-pressed', 'true');

        await page.goBack();

        await expectAddressKeywords(page, 'u:attack/self,a:death/self');
        await expect(who(page, 'Your creatures')).toHaveAttribute('aria-pressed', 'false');
      });

      test('counts in the section, shut, each filter once: an actor is a filter', async ({ page }) => {
        await openExplore(page);
        await openFilters(page);
        await side(page, 'Attack', 'Reacts').click();
        await side(page, 'Death', 'Reacts').click();
        await who(page, 'This creature').click();
        await who(page, 'Enemies').click();

        await section(page, 'Events').click();

        await expect(section(page, 'Events')).toHaveAccessibleName(/^Events 4 on$/);
        await expect(clearFiltersButton(page)).toHaveAccessibleName('Clear filters (4)');
      });
    });

    test('keeps what was chosen when the window moves the panel between a column and a sheet', async ({ page }) => {
      await openExplore(page);
      await openFilters(page);
      await who(page, 'Enemies').click();
      const original = page.viewportSize();
      if (original === null) throw new Error('the project has no viewport');

      await page.setViewportSize(isCompact(page) ? { width: 1200, height: 800 } : { width: 600, height: 800 });
      await openFilters(page);
      await expect(who(page, 'Enemies')).toHaveAttribute('aria-pressed', 'true');

      await page.setViewportSize(original);
      await openFilters(page);
      await expect(who(page, 'Enemies')).toHaveAttribute('aria-pressed', 'true');
    });

    test('counts in the section, shut, each event filter once, however it is narrowed', async ({ page }) => {
      await openExplore(page);
      await openFilters(page);
      await side(page, 'Attack', 'Reacts').click();
      await side(page, 'Death', 'Reacts').click();
      await who(page, 'This creature').click();

      await section(page, 'Events').click();

      await expect(section(page, 'Events')).toHaveAccessibleName(/^Events 2 on$/);
      await expect(clearFiltersButton(page)).toHaveAccessibleName('Clear filters (2)');
    });
  });

  test('takes the actor off with a second press, whoever the filter was narrowed to', async ({ page }) => {
    await openExplore(page, './?kw=u:provoke/enemy');
    await openFilters(page);
    await expect(side(page, 'Provoke', 'Reacts')).toHaveAttribute('aria-pressed', 'true');

    await side(page, 'Provoke', 'Reacts').click();

    await expect(side(page, 'Provoke', 'Reacts')).toHaveAttribute('aria-pressed', 'false');
    await expectAddressKeywords(page, null);
  });

  test.describe('an event in a description', () => {
    test('says in its name what the trait does with it and who acts', async ({ page }) => {
      await openExplore(page);
      await searchBox(page).fill('"after this creature attacks"');

      await expect(
        rows(page)
          .getByRole('button', { name: /^Reacts to attacks \(this creature\) — show traits that cause it$/i })
          .first(),
      ).toBeVisible();
    });

    test('leads to the counterpart of the role, whoever acts, and the panel’s button is pressed for it', async ({
      page,
      request,
    }) => {
      const { traits } = await publishedDataset(request);
      await openExplore(page);
      await searchBox(page).fill('"after this creature attacks"');
      await rows(page)
        .getByRole('button', { name: /^Reacts to attacks \(this creature\) — show traits that cause it$/i })
        .first()
        .click();
      await searchBox(page).fill('');

      await expectAddressKeywords(page, 'a:attack');
      await expect(announcedCount(page)).toHaveText(countText(having(traits, 'applies', 'attack').length, traits));
      await openFilters(page);
      await expect(side(page, 'Attack', 'Causes')).toHaveAttribute('aria-pressed', 'true');
      await expect(side(page, 'Attack', 'Reacts')).toHaveAttribute('aria-pressed', 'false');
      await expect(who(page, 'Any')).toHaveAttribute('aria-pressed', 'true');
    });

    test('is pressed while the panel has the event on for an actor, and a second click takes it off', async ({
      page,
    }) => {
      await openExplore(page, './?kw=a:attack/self');

      await expect(
        rows(page)
          .getByRole('button', { name: /^Reacts to attacks .* — show traits that cause it$/i, pressed: true })
          .first(),
      ).toBeVisible();
      await rows(page)
        .getByRole('button', { name: /^Reacts to attacks .* — show traits that cause it$/i, pressed: true })
        .first()
        .click();

      await expectAddressKeywords(page, null);
    });
  });

  test('has no WCAG 2.2 AA violations, narrowed, with a filter on', async ({ page }) => {
    await openExplore(page);
    await openFilters(page);
    await side(page, 'Provoke', 'Reacts').click();
    await who(page, 'Enemies').click();
    await who(page, 'This creature').click();

    expect(await axeViolations(page)).toEqual([]);
  });
});
