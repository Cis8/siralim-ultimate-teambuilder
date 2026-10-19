import { expect, test, type Locator, type Page } from '@playwright/test';
import { CONTROLS } from './support/controls';
import { publishedDataset } from './support/dataset';
import {
  backToTopButton,
  chips,
  closeFilters,
  facet,
  filtersSheet,
  fixButton,
  openExplore,
  openFilters,
  rows,
  scrollScreens,
  searchBox,
  suggestions,
} from './support/explore-page';
import {
  addButton,
  addElsewhereButton,
  addToParty,
  findRow,
  partyPanel,
  plainTraits,
  slotChooser,
  withUniqueName,
} from './support/party-page';
import { fromParty, synergyHeading, traitPicker, traitSuggestions, whenLoaded } from './support/synergy-page';
import { cardOf, firstUnique, randomToggle, relationsOfDataset, side } from './support/trait-page';

// On a phone every control is a target for a finger (DESIGN § Accessibility): at least 44 × 44 px, where WCAG 2.5.8 asks for
// 24. The tests measure what the page draws, in the Pixel 7 and iPhone 14 projects, for the places a phone shows: Explore,
// the filters sheet, the Party tab and the Synergy pages. The result card (DESIGN § Result list) is checked for its shape as well.

/** What a finger needs. */
const MIN_TARGET = 44;

/**
 * A control inside a sentence has the height of its line and needs no more (WCAG 2.5.8, the Inline exception): the keywords
 * of a description, which cannot be taller than the text they are part of, and the link in the footer's credit.
 */
const IN_A_SENTENCE = '.description .keyword, .app-footer a';

interface Measured {
  /** What each control measured is called: the test checks that the ones it cares about were among them. */
  readonly names: readonly string[];
  /** The ones under 44 px either way, each with its name and what it measures. */
  readonly tooSmall: readonly string[];
}

/**
 * Measures the controls drawn inside `scope`. A control that is not shown (`display: none`, `visibility: hidden`, the view
 * of the other tab) or that sits off the page (the skip link, until it takes the focus) is not a target. A checkbox is as
 * large as its label too: pressing the label presses it.
 */
function measureControls(scope: Locator): Promise<Measured> {
  return scope.evaluate(
    (root, { controls, inSentence, min }) => {
      const words = (element: Element): string => element.textContent.replace(/\s+/g, ' ').trim();
      const names: string[] = [];
      const tooSmall: string[] = [];
      for (const control of root.querySelectorAll(controls)) {
        if (!control.checkVisibility({ checkVisibilityCSS: true }) || control.matches(inSentence)) continue;
        const own = control.getBoundingClientRect();
        if (own.bottom <= 0 || own.right <= 0) continue;
        const labels = control instanceof HTMLInputElement ? Array.from(control.labels ?? []) : [];
        const boxes = [own, ...labels.map((label) => label.getBoundingClientRect())];
        const width = Math.max(...boxes.map((box) => box.right)) - Math.min(...boxes.map((box) => box.left));
        const height = Math.max(...boxes.map((box) => box.bottom)) - Math.min(...boxes.map((box) => box.top));
        const name =
          control.getAttribute('aria-label') ?? (labels.length > 0 ? labels.map(words).join(' ') : words(control));
        names.push(name);
        if (width < min - 0.5 || height < min - 0.5) {
          tooSmall.push(`${control.tagName.toLowerCase()} “${name}” is ${String(width)} × ${String(height)}`);
        }
      }
      return { names, tooSmall };
    },
    { controls: CONTROLS, inSentence: IN_A_SENTENCE, min: MIN_TARGET },
  );
}

/**
 * Every control of `scope` is large enough, and the ones in `including` were among those measured: a selector that found
 * nothing must not pass for a page with no small control.
 */
async function expectTargetsLargeEnough(scope: Locator, including: readonly RegExp[]): Promise<void> {
  const { names, tooSmall } = await measureControls(scope);
  for (const wanted of including) {
    expect(
      names.some((name) => wanted.test(name)),
      `a control named ${String(wanted)} was measured`,
    ).toBe(true);
  }
  expect(tooSmall).toEqual([]);
}

/** The fields iOS zooms the page in on when they take the focus, if their text is under 16 px (a checkbox has no text). */
const TEXT_FIELDS = 'input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"]), select, textarea';

/** What iOS asks of a field's text so that it does not zoom. */
const MIN_FIELD_FONT_SIZE = 16;

/**
 * Every text field and select drawn inside `scope` has text of 16 px or more, and the ones in `including` were among those
 * looked at (the sheet and the Party tab have none today: the check holds for the day they have).
 */
async function expectFieldsNotZoomedIn(scope: Locator, including: readonly RegExp[]): Promise<void> {
  const { names, tooSmall } = await scope.evaluate(
    (root, { fields, min }) => {
      const words = (element: Element): string => element.textContent.replace(/\s+/g, ' ').trim();
      const names: string[] = [];
      const tooSmall: string[] = [];
      for (const field of root.querySelectorAll(fields)) {
        if (!field.checkVisibility({ checkVisibilityCSS: true })) continue;
        const labelled =
          field instanceof HTMLInputElement ||
          field instanceof HTMLSelectElement ||
          field instanceof HTMLTextAreaElement
            ? Array.from(field.labels ?? [])
            : [];
        const name = field.getAttribute('aria-label') ?? labelled.map(words).join(' ');
        names.push(name);
        const size = Number.parseFloat(getComputedStyle(field).fontSize);
        if (size < min) tooSmall.push(`${field.tagName.toLowerCase()} “${name}” has text of ${String(size)} px`);
      }
      return { names, tooSmall };
    },
    { fields: TEXT_FIELDS, min: MIN_FIELD_FONT_SIZE },
  );
  for (const wanted of including) {
    expect(
      names.some((name) => wanted.test(name)),
      `a field named ${String(wanted)} was looked at`,
    ).toBe(true);
  }
  expect(tooSmall).toEqual([]);
}

/** The box of something drawn, which the test has already seen on the page. */
async function boxOf(locator: Locator): Promise<{ left: number; right: number; top: number; bottom: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('the element is not drawn');
  return { left: box.x, right: box.x + box.width, top: box.y, bottom: box.y + box.height };
}

const widerThanTheWindow = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

test.describe('touch targets on a phone', () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(!isMobile, 'A pointer that hovers is not a finger: the large targets are asked for on a touch screen.');
  });

  test('has every control of Explore at least 44 × 44 px, with a query and a filter on', async ({ page }) => {
    await openExplore(page);
    // Two one-letter terms: the narrowest chips there are, and a free text that most traits contain.
    await searchBox(page).fill('a e');
    await expect(chips(page).getByRole('button', { name: /exclude it$/ })).toHaveCount(2);
    await openFilters(page);
    await facet(page, 'Life').click();
    await closeFilters(page);
    await expect(chips(page).getByRole('button', { name: /^Remove / })).toHaveCount(3);
    await expect(rows(page).first()).toBeVisible();

    await expectTargetsLargeEnough(page.locator('body'), [
      /^Add to /,
      /^Remove a$/,
      /^a — exclude it$/,
      /^Copy query$/,
      /^Filters/,
      /^Explore/,
      /^Party/,
    ]);

    // Scrolled into the list, the button at the top right of the window is there to be measured as well.
    await scrollScreens(page, 3);
    await expect(backToTopButton(page)).toBeVisible();
    await expectTargetsLargeEnough(page.locator('body'), [/^Back to top$/, /^Add to /]);
  });

  test('has the issues badge and the fix of every issue at least 44 × 44 px, without making the page wider', async ({
    page,
  }) => {
    await openExplore(page);
    await searchBox(page).fill('clas:life (weak OR snared');
    await expect(fixButton(page, 'Change to “class:”')).toBeVisible();

    await expectTargetsLargeEnough(page.locator('body'), [
      /^2 issues$/,
      /^Change to “class:”$/,
      /^Add the missing “\)”$/,
    ]);
    expect(await widerThanTheWindow(page)).toBe(false);
  });

  test('has every suggestion at least 44 × 44 px, without making the page wider', async ({ page }) => {
    await openExplore(page);
    await searchBox(page).pressSequentially('wea');
    await expect(suggestions(page).nth(2)).toBeVisible();

    await expectTargetsLargeEnough(page.locator('body'), [/^Search traits$/, /^Debuff/, /^Trait/]);
    expect(await widerThanTheWindow(page)).toBe(false);
  });

  test('has text of 16 px or more in every text field and select, below which iOS zooms the page in on focus', async ({
    page,
  }) => {
    await openExplore(page);
    await expectFieldsNotZoomedIn(page.locator('body'), [/^Search traits$/, /^Sort/]);

    await openFilters(page);
    await expectFieldsNotZoomedIn(filtersSheet(page), []);

    await page.goto('./?tab=party');
    await expect(partyPanel(page)).toBeVisible();
    await expectFieldsNotZoomedIn(page.locator('body'), []);
  });

  test('has every control of the open filters sheet at least 44 × 44 px', async ({ page }) => {
    await openExplore(page);
    await openFilters(page);

    await expectTargetsLargeEnough(filtersSheet(page), [
      /^Clear filters$/,
      /^Class$/,
      /^Debuffs$/,
      /^Match all$/,
      /^Life/,
      /^Applies/,
      /^Show /,
      /^Artifact-eligible/,
    ]);
  });

  test('has the button that offers other slots, and every slot of its sheet, at least 44 × 44 px', async ({
    page,
    request,
  }) => {
    const mastery = withUniqueName((await publishedDataset(request)).traits).find(
      (trait) => trait.kind === 'mastery' && trait.material !== null,
    );
    if (mastery === undefined) throw new Error('the dataset has no mastery trait with a material');
    await openExplore(page);
    const row = await findRow(page, mastery);
    // A phone draws dots on it, and no words: its name says them.
    await expect(addElsewhereButton(row).locator('.label')).toBeHidden();
    await expectTargetsLargeEnough(row, [/^Add to… — /]);

    await addElsewhereButton(row).click();
    await expect(slotChooser(page)).toBeVisible();

    await expectTargetsLargeEnough(slotChooser(page), [/^Add to Artifact \(empty\)$/, /^Cancel$/]);
  });

  test('has every control of the Party tab at least 44 × 44 px, with a trait, a dependency and a lost trait', async ({
    page,
    request,
  }) => {
    const { traits, datasetVersion } = await publishedDataset(request);
    const user = withUniqueName(traits).find(
      (trait) =>
        trait.kind === 'creature' &&
        trait.material !== null &&
        trait.keywords.some((hit) => hit.key === 'vulnerable' && hit.role === 'uses') &&
        !trait.keywords.some((hit) => hit.key === 'vulnerable' && hit.role === 'applies'),
    );
    if (user === undefined) throw new Error('the dataset has no trait that relies on Vulnerable');
    await page.goto(`./?party=${datasetVersion},${user.id},gone--from-the-sheet&tab=party`);
    await expect(partyPanel(page)).toBeVisible();
    // What the measure has to find: a slot's clear button, a missing dependency and the search for a lost trait.
    await expect(partyPanel(page).getByRole('button', { name: /^Clear Creature 1 · Innate \(/ })).toBeVisible();
    await expect(
      partyPanel(page)
        .getByRole('button', { name: / — missing — / })
        .first(),
    ).toBeVisible();
    await expect(partyPanel(page).getByRole('button', { name: /^Search for / })).toBeVisible();

    await expectTargetsLargeEnough(page.locator('body'), [
      /^Target slot: /,
      /^Clear Creature 1 · Innate \(/,
      /^Undo$/,
      /^Copy link$/,
      / — missing — /,
      /^Search for /,
      /^Explore/,
      /^Party/,
    ]);
  });

  test('has every control of the Synergy pages at least 44 × 44 px, and no field with text under 16 px', async ({
    page,
    request,
  }) => {
    const { traits, datasetVersion } = await publishedDataset(request);
    const [trait] = plainTraits(traits);
    if (trait === undefined) throw new Error('the dataset has no plain trait');
    const named = new RegExp(`^${trait.name.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)}$`, 'u');

    // The picker, with a party that has a trait and a lost one, and the list of matches open.
    await page.goto(`./synergy?party=${datasetVersion},${trait.id},gone--from-the-sheet`);
    await expect(fromParty(page).getByRole('link', { name: trait.name, exact: true })).toBeVisible();
    await traitPicker(page).fill(trait.name.slice(0, 3));
    await expect(traitSuggestions(page).first()).toBeVisible();
    await expectTargetsLargeEnough(page.locator('body'), [
      /^Find a trait$/,
      /^Trait/,
      named,
      /^Vulnerable$/,
      /^Explore$/,
      /^Party/,
      /^Synergies$/,
    ]);
    await expectFieldsNotZoomedIn(page.locator('body'), [/^Find a trait$/]);
    expect(await widerThanTheWindow(page)).toBe(false);

    // The pages that have no party to show: a trait, a keyword, a keyword that is none, a trait that is none.
    for (const [address, including] of [
      [`./synergy/${trait.id}`, [/^Find a trait$/]],
      ['./synergy/kw/vulnerable', [/^Vulnerable$/]],
      ['./synergy/kw/not-a-keyword', [/^Weak$/]],
      [`./synergy/retired--${trait.id.split('--')[1] ?? 'x'}`, [/^Find a trait$/]],
    ] as const) {
      await page.goto(address);
      await expect(synergyHeading(page)).toBeVisible();
      await whenLoaded(page);
      await expectTargetsLargeEnough(page.locator('body'), [...including, /^Synergies$/]);
      expect(await widerThanTheWindow(page), address).toBe(false);
    }
  });

  test('has every control of the page of a trait at least 44 × 44 px: the lanes, the cards, the filter, the trail', async ({
    page,
    request,
  }) => {
    const { traits, datasetVersion } = await publishedDataset(request);
    const index = relationsOfDataset(traits);
    // Lanes of one key and of several, a random group, and a mastery that the target slot refuses (its button offers the choice of slot).
    const focus = firstUnique(
      traits,
      (each) => {
        const found = index.relationsOf(each.id)?.enabledBy;
        if (found === undefined) return false;
        const all = [...found.several, ...found.single.flatMap(({ entries }) => entries)];
        return (
          found.single.length > 0 &&
          all.some(({ strength, trait }) => strength !== 'random' && trait.kind === 'mastery') &&
          all.some(({ strength }) => strength === 'random')
        );
      },
      'with a mastery among those that enable it, and a random source of one of its keys',
    );
    const [mine] = plainTraits(traits);
    if (mine === undefined) throw new Error('the dataset has no plain trait');
    await page.goto(`./synergy/${focus.id}?party=${datasetVersion},${mine.id}`);
    await expect(synergyHeading(page)).toHaveText(focus.name);
    await whenLoaded(page);

    await randomToggle(side(page, 'Enabled by')).first().click();
    // A control scrolled above the window is not measured: the page is taken back to its top, and the cards are all below it.
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await expectTargetsLargeEnough(page.locator('body'), [
      /^Find a trait$/,
      /^Artifact-eligible only$/,
      /^Add to Creature 1 · Fused — /,
      /^Add to… — /,
      /^Re-centre on /,
      /^Open in Explore$/,
      /^Random sources · /,
      /^Synergies$/,
    ]);
    await expectFieldsNotZoomedIn(page.locator('body'), [/^Find a trait$/]);
    expect(await widerThanTheWindow(page)).toBe(false);

    // A step on the way adds the trail, whose links are targets too.
    const [first] = index.relationsOf(focus.id)?.enabledBy.several ?? [];
    if (first === undefined) throw new Error('no trait ties through several keys');
    await cardOf(side(page, 'Enabled by'), first.trait.name).getByRole('link').click();
    await expect(synergyHeading(page)).toHaveText(first.trait.name);
    await expectTargetsLargeEnough(page.locator('body'), [new RegExp(`^Re-centre on ${focus.name}$`, 'u')]);
    expect(await widerThanTheWindow(page)).toBe(false);
  });

  test('does not make the page wider than the window, on Explore or on the Party tab', async ({ page }) => {
    await openExplore(page);
    expect(await widerThanTheWindow(page)).toBe(false);

    // An id of some length in a slot, which the party panel prints whole.
    await page.goto('./?party=1.0,gone--from-the-sheet-with-a-very-long-id-indeed&tab=party');
    await expect(partyPanel(page)).toBeVisible();
    expect(await widerThanTheWindow(page)).toBe(false);
  });

  test.describe('the result card', () => {
    /** The room a card leaves around what it holds, on a phone (`result-row.svelte`). */
    const CARD_PADDING = 16;

    test('has the add button at the top right as a 44 px square, named for what it does', async ({ page }) => {
      await openExplore(page);
      const card = rows(page).first();
      const add = addButton(card);

      const [cardBox, addBox, nameBox, descriptionBox] = [
        await boxOf(card),
        await boxOf(add),
        await boxOf(card.getByRole('heading', { level: 3 })),
        await boxOf(card.locator('.description')),
      ];

      expect(addBox.right - addBox.left).toBeCloseTo(MIN_TARGET, 0);
      expect(addBox.bottom - addBox.top).toBeCloseTo(MIN_TARGET, 0);
      // Beside the name, above the description, against the card's right edge.
      expect(addBox.top).toBeLessThan(nameBox.bottom);
      expect(addBox.bottom).toBeLessThanOrEqual(descriptionBox.top);
      expect(nameBox.right).toBeLessThanOrEqual(addBox.left);
      expect(cardBox.right - addBox.right).toBeLessThanOrEqual(CARD_PADDING + 0.5);
      await expect(add).toHaveAccessibleName(/^Add to Creature 1 · Innate — .+/);
      // It shows no words: the slot is on the Party tab, and the card says where the trait went afterwards.
      await expect(add.locator('.label')).toBeHidden();
    });

    test('has the add button before the keywords of the description in the tab order, as it is laid out', async ({
      page,
    }) => {
      await openExplore(page);
      const card = rows(page)
        .filter({ has: page.locator('.description .keyword') })
        .first();

      await addButton(card).focus();
      await page.keyboard.press('Tab');

      await expect(card.locator('.description .keyword').first()).toBeFocused();
    });

    test('says where the trait is in the party under the description of its card', async ({ page, request }) => {
      const [first] = plainTraits((await publishedDataset(request)).traits);
      if (first === undefined) throw new Error('the dataset has no plain trait');
      await openExplore(page);
      await addToParty(page, first);

      const card = await findRow(page, first);
      const inParty = card.getByText('In party: Creature 1 · Innate');
      await expect(inParty).toBeVisible();

      expect((await boxOf(inParty)).top).toBeGreaterThanOrEqual((await boxOf(card.locator('.description'))).bottom);
    });
  });
});
