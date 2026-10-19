import { expect, test, type Page } from '@playwright/test';
import { keywordSlug, taxonomy, type RelationIndex, type Trait } from '@atlas/core';
import { axeViolations } from './support/axe';
import { publishedDataset } from './support/dataset';
import { isCompact } from './support/explore-page';
import {
  chipOf,
  keywordChips,
  keywordList,
  keywordTab,
  keywordTabs,
  openKeywordChips,
  shownKeywordList,
  traitsText,
} from './support/keyword-page';
import { plainTraits, withUniqueName } from './support/party-page';
import {
  openTraitPicker,
  paramOf,
  pathOf,
  suggestionFor,
  synergyHeading,
  traitPickerButton,
  whenLoaded,
} from './support/synergy-page';
import {
  artifactFilter,
  cardOf,
  cards,
  firstUnique,
  focusCard,
  listing,
  relationsOfDataset,
  sectionTab,
  sectionTabs,
  showSection,
  side,
  trail,
  type TraitSection,
} from './support/trait-page';

// Phase 2, M13.6: the Synergy pages on a phone (DESIGN § Synergy pages). Under 700 px the lists of a page are tabs, one on show,
// the page scrolls, the trail is a row of pills, the description of the focus folds, and the pickers are sheets. From 700 px none of
// that is so, which the last tests hold to account.

const labelOf = (key: string): string => taxonomy.get(key)?.label ?? key;
const plural = (count: number): string => `${String(count)} ${count === 1 ? 'trait' : 'traits'}`;

/** The counts the tabs of a trait say, from core: the four lists, the last being the traits of Same trigger and Same family together. */
function tabCounts(index: RelationIndex, trait: Trait, artifactOnly = false): Record<TraitSection, number> {
  const options = { artifactOnly };
  const sides = index.relationsOf(trait.id, options);
  const alternatives = index.alternativesOf(trait.id, options);
  const sameTrigger = index.sameTriggerOf(trait.id, options);
  const sameFamily = index.sameFamilyOf(trait.id, options);
  if (sides === undefined || alternatives === undefined || sameTrigger === undefined || sameFamily === undefined) {
    throw new Error(`the index has no trait ${trait.id}`);
  }
  return {
    'Enabled by': sides.enabledBy.count,
    Enables: sides.enables.count,
    Alternatives: alternatives.length,
    // A grouping of the sheet (Backer, Exotic…) is no family and lists nobody (PLAN D36), whatever core holds for it.
    Related: new Set([
      ...sameTrigger.entries.map(({ trait: each }) => each.id),
      ...(sameFamily.grouping ? [] : sameFamily.entries.map(({ id }) => id)),
    ]).size,
  };
}

const SECTIONS = ['Enabled by', 'Enables', 'Alternatives', 'Related'] as const;
const tabName = (section: TraitSection, counts: Record<TraitSection, number>): string =>
  `${section} ${plural(counts[section])}`;

async function dataset(request: Parameters<typeof publishedDataset>[0]) {
  const { traits, datasetVersion } = await publishedDataset(request);
  return { traits, datasetVersion, index: relationsOfDataset(traits) };
}

async function openTrait(page: Page, trait: Trait, search = ''): Promise<void> {
  await page.goto(`./synergy/${trait.id}${search}`);
  await expect(synergyHeading(page)).toHaveText(trait.name);
  await whenLoaded(page);
}

async function openKeyword(page: Page, key: string, search = ''): Promise<void> {
  await page.goto(`./synergy/kw/${keywordSlug(key)}${search}`);
  await expect(synergyHeading(page)).toHaveText(labelOf(key));
  await whenLoaded(page);
}

const widerThanTheWindow = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

/** A trait with something in each of the four lists, and a name of its own. */
const richTrait = (index: RelationIndex, traits: readonly Trait[]): Trait =>
  firstUnique(
    traits,
    (each) => Object.values(tabCounts(index, each)).every((count) => count > 0),
    'with something in each of the four lists',
  );

test.describe('the page of a trait on a phone', () => {
  test.beforeEach(({ page }) => {
    test.skip(!isCompact(page), 'The lists are tabs under 700 px.');
  });

  test('has the four lists as tabs with the counts core gives, the first on show and named by its tab', async ({
    page,
    request,
  }) => {
    const { traits, index } = await dataset(request);
    const focus = richTrait(index, traits);
    const counts = tabCounts(index, focus);

    await openTrait(page, focus);

    await expect(sectionTabs(page).getByRole('tab')).toHaveCount(4);
    for (const section of SECTIONS)
      await expect(sectionTab(page, section)).toHaveAccessibleName(tabName(section, counts));
    await expect(sectionTab(page, 'Enabled by')).toHaveAttribute('aria-selected', 'true');
    await expect(sectionTab(page, 'Enables')).toHaveAttribute('aria-selected', 'false');
    // One panel is on show, and its tab names it.
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    await expect(page.getByRole('tabpanel')).toHaveAccessibleName(tabName('Enabled by', counts));
    expect(paramOf(page, 'section')).toBeNull();
  });

  test('brings a list forward when its tab is pressed, as a step of the history', async ({ page, request }) => {
    const { traits, index } = await dataset(request);
    const focus = richTrait(index, traits);
    await openTrait(page, focus);

    await sectionTab(page, 'Enables').click();

    await expect(sectionTab(page, 'Enables')).toHaveAttribute('aria-selected', 'true');
    await expect(sectionTab(page, 'Enabled by')).toHaveAttribute('aria-selected', 'false');
    await expect(side(page, 'Enables')).toBeVisible();
    await expect(side(page, 'Enabled by')).toBeHidden();
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    await expect.poll(() => paramOf(page, 'section')).toBe('enables');

    await page.goBack();
    await expect(sectionTab(page, 'Enabled by')).toHaveAttribute('aria-selected', 'true');
    await expect(side(page, 'Enabled by')).toBeVisible();
    expect(paramOf(page, 'section')).toBeNull();

    // The first tab is the page's plain address: nothing is written for it.
    await sectionTab(page, 'Alternatives').click();
    await expect.poll(() => paramOf(page, 'section')).toBe('alternatives');
    await sectionTab(page, 'Enabled by').click();
    await expect.poll(() => paramOf(page, 'section')).toBeNull();
  });

  test('is a tab list for the keyboard: one stop, the arrows, Home and End go along it and select', async ({
    page,
    request,
  }) => {
    const { traits, index } = await dataset(request);
    await openTrait(page, richTrait(index, traits));
    const selectedTab = (section: TraitSection) => sectionTab(page, section);

    await expect(selectedTab('Enabled by')).toHaveAttribute('tabindex', '0');
    await expect(selectedTab('Enables')).toHaveAttribute('tabindex', '-1');
    await selectedTab('Enabled by').focus();

    await page.keyboard.press('ArrowRight');
    await expect(selectedTab('Enables')).toBeFocused();
    await expect(selectedTab('Enables')).toHaveAttribute('aria-selected', 'true');
    await expect(side(page, 'Enables')).toBeVisible();

    await page.keyboard.press('End');
    await expect(selectedTab('Related')).toBeFocused();
    await expect(selectedTab('Related')).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowRight');
    await expect(selectedTab('Enabled by')).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await expect(selectedTab('Related')).toBeFocused();

    await page.keyboard.press('Home');
    await expect(selectedTab('Enabled by')).toBeFocused();
    await expect(selectedTab('Enabled by')).toHaveAttribute('aria-selected', 'true');
    await expect(selectedTab('Enabled by')).toHaveAttribute('tabindex', '0');
    await expect(selectedTab('Related')).toHaveAttribute('tabindex', '-1');
  });

  test('goes along from the tab a key was pressed on, also when keys come faster than the address follows', async ({
    page,
    request,
  }) => {
    const { traits, index } = await dataset(request);
    await openTrait(page, richTrait(index, traits));
    await sectionTab(page, 'Enabled by').focus();

    // Three arrows in one task, before the page can have read the address the first one asked for: a key held down repeats this fast.
    await page.evaluate(() => {
      for (let press = 0; press < 3; press += 1) {
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      }
    });

    await expect(sectionTab(page, 'Related')).toBeFocused();
    await expect(sectionTab(page, 'Related')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => paramOf(page, 'section')).toBe('related');
  });

  test('is read from the address, and a section the page does not have is the first', async ({ page, request }) => {
    const { traits, index } = await dataset(request);
    const focus = richTrait(index, traits);

    await openTrait(page, focus, '?section=alternatives');
    await expect(sectionTab(page, 'Alternatives')).toHaveAttribute('aria-selected', 'true');
    await expect(listing(page, 'Alternatives')).toBeVisible();

    // A keyword's section, a made-up one: nothing to show, so the first list.
    for (const search of ['?section=appliers', '?section=nowhere']) {
      await openTrait(page, focus, search);
      await expect(sectionTab(page, 'Enabled by')).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('starts the next trait on the first tab, whichever tab the last one was left on', async ({ page, request }) => {
    const { traits, index } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => (index.alternativesOf(each.id) ?? []).some(({ trait }) => withUniqueName(traits).includes(trait)),
      'with an alternative that has a name of its own',
    );
    const [first] = (index.alternativesOf(focus.id) ?? []).filter(({ trait }) =>
      withUniqueName(traits).includes(trait),
    );
    if (first === undefined) throw new Error('no alternative to follow');
    await openTrait(page, focus, '?section=alternatives');

    await cardOf(listing(page, 'Alternatives'), first.trait.name).getByRole('link').click();

    await expect.poll(() => pathOf(page)).toBe(`/synergy/${first.trait.id}`);
    await expect(sectionTab(page, 'Enabled by')).toHaveAttribute('aria-selected', 'true');
    expect(paramOf(page, 'section')).toBeNull();
  });

  test('holds Same trigger and Same family in the last tab, one above the other', async ({ page, request }) => {
    const { traits, index } = await dataset(request);
    await openTrait(page, richTrait(index, traits));

    await showSection(page, 'Related');

    await expect(listing(page, 'Alternatives')).toBeHidden();
    const [trigger, family] = [
      await listing(page, 'Same trigger').boundingBox(),
      await listing(page, 'Same family').boundingBox(),
    ];
    if (trigger === null || family === null) throw new Error('the two lists are not both drawn');
    expect(family.x).toBeCloseTo(trigger.x, 0);
    expect(family.y).toBeGreaterThan(trigger.y + trigger.height - 1);
  });

  test('says the counts again once the artifact filter is on', async ({ page, request }) => {
    const { traits, index } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => {
        const all = tabCounts(index, each);
        const kept = tabCounts(index, each, true);
        return all['Enabled by'] > kept['Enabled by'] && kept['Enabled by'] > 0 && all.Alternatives > kept.Alternatives;
      },
      'that some trait without a material enables and is an alternative to',
    );
    const kept = tabCounts(index, focus, true);
    await openTrait(page, focus);

    await artifactFilter(page).check();

    for (const section of SECTIONS) {
      await expect(sectionTab(page, section)).toHaveAccessibleName(tabName(section, kept));
    }
  });

  test('has a page that is no wider than the window, on each tab and on the narrowest phone', async ({
    page,
    request,
  }) => {
    const { traits, index } = await dataset(request);
    const focus = richTrait(index, traits);
    await openTrait(page, focus);

    for (const section of SECTIONS) {
      await showSection(page, section);
      expect(await widerThanTheWindow(page), section).toBe(false);
    }

    await page.setViewportSize({ width: 320, height: 640 });
    for (const section of SECTIONS) {
      await showSection(page, section);
      expect(await widerThanTheWindow(page), `${section} at 320 px`).toBe(false);
    }
    // The four labels fit their tabs: nothing of a label is cut.
    const clipped = await sectionTabs(page).evaluate((list) =>
      Array.from(
        list.querySelectorAll('[role="tab"]'),
        (tabButton) => tabButton.scrollWidth > tabButton.clientWidth + 1,
      ),
    );
    expect(clipped).toEqual([false, false, false, false]);
  });
});

test.describe('the trail and the description on a phone', () => {
  test.beforeEach(({ page }) => {
    test.skip(!isCompact(page), 'These are the ways of a phone.');
  });

  test('is a row of pills that scrolls sideways, each as large as a finger, with the trait where the person is in sight', async ({
    page,
    request,
  }) => {
    const { traits } = await dataset(request);
    // Names that no other name begins with, so that the picker's first match for each is the trait itself.
    const chain = plainTraits(traits)
      .filter(
        (each) =>
          !traits.some((other) => other.id !== each.id && other.name.toLowerCase().startsWith(each.name.toLowerCase())),
      )
      .slice(0, 6);
    expect(chain).toHaveLength(6);
    const [start, ...rest] = chain;
    if (start === undefined) throw new Error('no trait to start from');
    await openTrait(page, start);
    for (const trait of rest) {
      await (await openTraitPicker(page)).fill(trait.name);
      await suggestionFor(page, trait.name).click();
      await expect.poll(() => pathOf(page)).toBe(`/synergy/${trait.id}`);
      await expect(synergyHeading(page)).toHaveText(trait.name);
    }

    const steps = trail(page).getByRole('listitem');
    await expect(steps).toHaveCount(6);
    const nav = await trail(page).evaluate((element) => ({
      overflowX: getComputedStyle(element).overflowX,
      scrolls: element.scrollWidth > element.clientWidth,
      scrolledTo: element.scrollLeft,
      scrolledMax: element.scrollWidth - element.clientWidth,
    }));
    expect(nav.overflowX).toBe('auto');
    // Six names do not fit one row of a phone: it scrolls, and it is scrolled to the end, where the person is.
    expect(nav.scrolls).toBe(true);
    expect(nav.scrolledTo).toBeCloseTo(nav.scrolledMax, 0);

    const frame = await trail(page).boundingBox();
    const here = await steps.last().boundingBox();
    if (frame === null || here === null) throw new Error('the trail is not drawn');
    expect(here.x).toBeGreaterThanOrEqual(frame.x - 1);
    expect(here.x + here.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
    for (const index of [0, 1, 2, 3, 4, 5]) {
      const box = await steps.nth(index).locator('a, [aria-current="location"]').boundingBox();
      expect(box?.height ?? 0, `step ${String(index)}`).toBeGreaterThanOrEqual(44);
    }
    expect(await widerThanTheWindow(page)).toBe(false);
  });

  test('folds a long description to three lines, with a button that opens it and closes it again', async ({
    page,
    request,
  }) => {
    const { traits } = await dataset(request);
    const long = withUniqueName(traits).find(({ description }) => description.length > 300);
    const short = withUniqueName(traits).find(({ description }) => description.length < 80);
    if (long === undefined || short === undefined) throw new Error('the dataset lacks a long or a short description');
    const heightOf = () =>
      focusCard(page)
        .locator('.description')
        .evaluate((element) => ({
          drawn: element.clientHeight,
          whole: element.scrollHeight,
          line: Number.parseFloat(getComputedStyle(element).lineHeight),
        }));

    await openTrait(page, long);
    const unfold = focusCard(page).getByRole('button', { name: /^Show (more|less)$/ });
    await expect(unfold).toHaveText('Show more');
    await expect(unfold).toHaveAttribute('aria-expanded', 'false');
    const folded = await heightOf();
    expect(folded.drawn).toBeLessThanOrEqual(3 * folded.line + 1);
    expect(folded.whole).toBeGreaterThan(folded.drawn);

    await unfold.click();

    await expect(unfold).toHaveText('Show less');
    await expect(unfold).toHaveAttribute('aria-expanded', 'true');
    expect((await heightOf()).drawn).toBeGreaterThan(3 * folded.line + 1);
    await expect(unfold).toHaveAttribute(
      'aria-controls',
      (await focusCard(page).locator('.description').getAttribute('id')) ?? '',
    );

    await unfold.click();
    await expect(unfold).toHaveText('Show more');
    expect((await heightOf()).drawn).toBeLessThanOrEqual(3 * folded.line + 1);

    // A description that fits has nothing to open.
    await openTrait(page, short);
    await expect(focusCard(page).getByRole('button', { name: /^Show (more|less)$/ })).toHaveCount(0);
  });

  test('starts the next trait folded, whether or not the last was opened', async ({ page, request }) => {
    const { traits } = await dataset(request);
    // Two long descriptions, with names that no other name begins with, so that the picker's first match for each is the trait itself.
    const [first, second] = withUniqueName(traits).filter(
      ({ description, name }) =>
        description.length > 250 &&
        !traits.some((other) => other.name !== name && other.name.toLowerCase().startsWith(name.toLowerCase())),
    );
    if (first === undefined || second === undefined) throw new Error('the dataset has no two long descriptions');
    await openTrait(page, first);
    const unfold = focusCard(page).getByRole('button', { name: /^Show (more|less)$/ });
    await unfold.click();
    await expect(unfold).toHaveText('Show less');

    await (await openTraitPicker(page)).fill(second.name);
    await suggestionFor(page, second.name).click();

    await expect(synergyHeading(page)).toHaveText(second.name);
    await expect(unfold).toHaveText('Show more');
    await expect(unfold).toHaveAttribute('aria-expanded', 'false');
  });

  test('opens by itself when the focus goes to a keyword in the part that is cut', async ({ page, request }) => {
    const { traits } = await dataset(request);
    const linked = ['buff', 'debuff', 'effect'];
    // Three lines of a phone hold about 140 characters: a keyword that begins past the 180th is in the part that is cut.
    const late = withUniqueName(traits).find(({ keywords }) =>
      keywords.some((hit) => linked.includes(hit.kind) && hit.span[0] > 180),
    );
    if (late === undefined) throw new Error('no description has a keyword that begins past its 180th character');
    await openTrait(page, late);
    const unfold = focusCard(page).getByRole('button', { name: /^Show (more|less)$/ });
    await expect(unfold).toHaveText('Show more');

    // The last keyword of the text is in the lines that are cut away: the focus must not rest on what cannot be seen.
    await focusCard(page).locator('.description a').last().focus();

    await expect(unfold).toHaveText('Show less');
    await expect(unfold).toHaveAttribute('aria-expanded', 'true');
    await expect(focusCard(page).locator('.description a').last()).toBeInViewport();
  });
});

test.describe('the pickers on a phone', () => {
  test.beforeEach(({ page }) => {
    test.skip(!isCompact(page), 'The pickers are sheets under 700 px.');
  });

  test('opens the search for a trait in a sheet with the focus in its field, and a pick closes it on the new trait', async ({
    page,
    request,
  }) => {
    const { traits } = await dataset(request);
    const [start, other] = plainTraits(traits).filter(
      (each) => !traits.some((x) => x.id !== each.id && x.name.toLowerCase().startsWith(each.name.toLowerCase())),
    );
    if (start === undefined || other === undefined) throw new Error('no two traits to move between');
    await openTrait(page, start);
    const sheet = page.getByRole('dialog', { name: 'Find a trait' });

    // Before: a button, no field on the page.
    await expect(traitPickerButton(page)).toBeVisible();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('combobox', { name: 'Find a trait' })).toHaveCount(0);

    const field = await openTraitPicker(page);
    await expect(sheet).toBeVisible();
    await field.fill(other.name);
    await expect(sheet.getByRole('button', { name: 'Close' })).toBeVisible();
    await suggestionFor(page, other.name).click();

    await expect.poll(() => pathOf(page)).toBe(`/synergy/${other.id}`);
    await expect(sheet).toBeHidden();
    await expect(synergyHeading(page)).toHaveText(other.name);
    // The page puts the focus on the name of the trait it moved to, as for any other move: not on the button that opened the sheet.
    await expect(synergyHeading(page)).toBeFocused();
  });

  test('gives the focus back to its button when it is put away', async ({ page, request }) => {
    const { traits } = await dataset(request);
    const [trait] = plainTraits(traits);
    if (trait === undefined) throw new Error('no plain trait');
    await openTrait(page, trait);
    const sheet = page.getByRole('dialog', { name: 'Find a trait' });

    await openTraitPicker(page);
    await page.keyboard.press('Escape');

    await expect(sheet).toBeHidden();
    await expect(traitPickerButton(page)).toBeFocused();

    // The Close button does the same.
    await openTraitPicker(page);
    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toBeHidden();
    await expect(traitPickerButton(page)).toBeFocused();
  });
});

test.describe('the page of a keyword on a phone', () => {
  test.beforeEach(({ page }) => {
    test.skip(!isCompact(page), 'The lists are tabs under 700 px.');
  });

  test('has the two lists as tabs with the counts of the view, and the first on show', async ({ page, request }) => {
    const { index } = await dataset(request);
    const key = index.keys.find((each) => {
      const stats = index.keywordView(each)?.stats;
      return stats !== undefined && stats.appliers > 0 && stats.users > 0;
    });
    if (key === undefined) throw new Error('no key has appliers and users');
    const stats = index.keywordView(key)?.stats;
    if (stats === undefined) throw new Error('no view');

    await openKeyword(page, key);

    await expect(keywordTabs(page).getByRole('tab')).toHaveCount(2);
    await expect(keywordTab(page, 'Appliers')).toHaveAccessibleName(`Appliers ${traitsText(stats.appliers)}`);
    await expect(keywordTab(page, 'Rely on it')).toHaveAccessibleName(`Rely on it ${traitsText(stats.users)}`);
    await expect(keywordTab(page, 'Appliers')).toHaveAttribute('aria-selected', 'true');
    await expect(keywordList(page, 'Appliers')).toBeVisible();
    await expect(keywordList(page, 'Rely on it')).toBeHidden();
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    expect(paramOf(page, 'section')).toBeNull();

    await keywordTab(page, 'Rely on it').click();

    await expect(keywordList(page, 'Rely on it')).toBeVisible();
    await expect(keywordList(page, 'Appliers')).toBeHidden();
    await expect.poll(() => paramOf(page, 'section')).toBe('users');
    await page.keyboard.press('ArrowLeft');
    await expect(keywordTab(page, 'Appliers')).toBeFocused();
    await expect(keywordTab(page, 'Appliers')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => paramOf(page, 'section')).toBeNull();
  });

  test('is read from the address, and the second list is where "users" leads', async ({ page }) => {
    await openKeyword(page, 'vulnerable', '?section=users');
    await expect(keywordTab(page, 'Rely on it')).toHaveAttribute('aria-selected', 'true');

    // A trait's section means nothing here: the first list.
    await openKeyword(page, 'vulnerable', '?section=enables');
    await expect(keywordTab(page, 'Appliers')).toHaveAttribute('aria-selected', 'true');
  });

  test('puts the other keywords in a sheet, and a pick closes it on the new keyword', async ({ page, request }) => {
    const { index } = await dataset(request);
    await openKeyword(page, 'vulnerable');

    // Not at the foot of the page any more: a button opens them.
    await expect(page.getByRole('region', { name: 'Keywords' })).toHaveCount(0);
    const chips = await openKeywordChips(page);
    await expect(chips.getByRole('link')).toHaveCount(index.keys.length);
    await expect(chips.locator('[aria-current="page"]')).toHaveCount(1);

    await chipOf(chips, 'Weak').click();

    await expect.poll(() => pathOf(page)).toBe('/synergy/kw/weak');
    await expect(page.getByRole('dialog', { name: 'Keywords' })).toBeHidden();
    await expect(synergyHeading(page)).toHaveText('Weak');
    await expect(synergyHeading(page)).toBeFocused();
  });

  test('has a page that is no wider than the window, on each tab', async ({ page }) => {
    await openKeyword(page, 'vulnerable');
    expect(await widerThanTheWindow(page)).toBe(false);
    await shownKeywordList(page, 'Rely on it');
    expect(await widerThanTheWindow(page)).toBe(false);

    await page.setViewportSize({ width: 320, height: 640 });
    await shownKeywordList(page, 'Appliers');
    expect(await widerThanTheWindow(page)).toBe(false);
    await shownKeywordList(page, 'Rely on it');
    expect(await widerThanTheWindow(page)).toBe(false);
  });
});

test.describe('accessibility of the Synergy pages on a phone', () => {
  test.beforeEach(({ page }) => {
    test.skip(!isCompact(page), 'These are the ways of a phone.');
  });

  test('has no WCAG 2.2 AA violations on each tab of a trait, with its description open, and with the search in its sheet', async ({
    page,
    request,
  }) => {
    const { traits, datasetVersion, index } = await dataset(request);
    const [mine] = plainTraits(traits);
    if (mine === undefined) throw new Error('the dataset has no plain trait');
    const focus = richTrait(index, traits);
    await openTrait(page, focus, `?party=${datasetVersion},${mine.id}`);

    for (const section of SECTIONS) {
      await showSection(page, section);
      expect(await axeViolations(page), section).toEqual([]);
    }

    const long = withUniqueName(traits).find(({ description }) => description.length > 300);
    if (long === undefined) throw new Error('no long description');
    await openTrait(page, long);
    expect(await axeViolations(page), 'folded').toEqual([]);
    await focusCard(page).getByRole('button', { name: 'Show more' }).click();
    expect(await axeViolations(page), 'unfolded').toEqual([]);

    const field = await openTraitPicker(page);
    await field.fill(long.name.slice(0, 3));
    await expect(page.getByRole('listbox', { name: 'Matching traits' }).getByRole('option').first()).toBeVisible();
    expect(await axeViolations(page), 'search sheet').toEqual([]);
  });

  test('has none on each tab of a keyword, and with the other keywords in their sheet', async ({ page }) => {
    await openKeyword(page, 'vulnerable');
    expect(await axeViolations(page), 'appliers').toEqual([]);
    await shownKeywordList(page, 'Rely on it');
    expect(await axeViolations(page), 'users').toEqual([]);

    await openKeywordChips(page);
    expect(await axeViolations(page), 'keywords sheet').toEqual([]);
  });
});

test.describe('the Synergy pages from 700 px', () => {
  test.beforeEach(({ page }) => {
    test.skip(isCompact(page), 'The ways of a phone are not for a screen this wide.');
  });

  test('show every list of a trait at once, with no tabs, and the search in the toolbar', async ({ page, request }) => {
    const { traits, index } = await dataset(request);
    await openTrait(page, richTrait(index, traits));

    await expect(sectionTabs(page)).toHaveCount(0);
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
    await expect(traitPickerButton(page)).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Find a trait' })).toBeVisible();
    for (const visible of [
      side(page, 'Enabled by'),
      side(page, 'Enables'),
      listing(page, 'Alternatives'),
      listing(page, 'Same trigger'),
      listing(page, 'Same family'),
    ]) {
      await expect(visible).toBeVisible();
    }
    // A section in the address changes nothing here.
    await openTrait(page, richTrait(index, traits), '?section=related');
    await expect(side(page, 'Enabled by')).toBeVisible();
    await expect(cards(listing(page, 'Alternatives')).first()).toBeVisible();
  });

  test('show both lists of a keyword at once, and the other keywords at the foot of the page', async ({ page }) => {
    await openKeyword(page, 'vulnerable');

    await expect(keywordTabs(page)).toHaveCount(0);
    await expect(keywordList(page, 'Appliers')).toBeVisible();
    await expect(keywordList(page, 'Rely on it')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Other keywords' })).toHaveCount(0);
    await expect(keywordChips(page)).toBeVisible();
  });
});
