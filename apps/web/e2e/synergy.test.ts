import { expect, test, type Page } from '@playwright/test';
import { keywordSlug, slugify, taxonomy, type Trait } from '@atlas/core';
import { axeViolations } from './support/axe';
import { publishedDataset } from './support/dataset';
import { isTabbed, openExplore } from './support/explore-page';
import { addToParty, plainTraits, showParty, slot, toolbarButton, withUniqueName } from './support/party-page';
import {
  fromKeyword,
  fromParty,
  paramOf,
  pathOf,
  placeLink,
  suggestionFor,
  synergyHeading,
  traitPicker,
  traitSuggestions,
} from './support/synergy-page';

// Phase 2, M13.2: the Synergy explorer is a set of routes (ADR-0011) reached by links and by address, with the party of the
// session carried along. What a trait page shows besides its head is the work of the slices after this one.

/** The first trait the tests can address and find by name: it stacks, has a material, and no other is called the same. */
async function aTrait(request: Parameters<typeof publishedDataset>[0]): Promise<Trait> {
  const [first] = plainTraits((await publishedDataset(request)).traits);
  if (first === undefined) throw new Error('the dataset has no plain trait');
  return first;
}

async function typeInPicker(page: Page, text: string): Promise<void> {
  await traitPicker(page).fill(text);
  await expect(traitSuggestions(page).first()).toBeVisible();
}

test.describe('the Synergy pages, opened from their address', () => {
  test('/synergy offers three ways in: a trait by name, a trait of the party, a keyword', async ({ page }) => {
    await page.goto('./synergy');

    await expect(page).toHaveTitle('Synergies — Trait Atlas');
    await expect(synergyHeading(page)).toHaveText('Synergies');
    await expect(traitPicker(page)).toBeVisible();
    await expect(fromParty(page)).toContainText('Your party is empty.');
    await expect(fromParty(page).getByRole('link', { name: 'Go to Explore' })).toBeVisible();
    const keywords = fromKeyword(page);
    for (const group of ['Debuffs', 'Buffs', 'Effects']) {
      await expect(keywords.getByRole('heading', { level: 3, name: group, exact: true })).toBeVisible();
    }
    await expect(keywords.getByRole('link', { name: 'Vulnerable', exact: true })).toBeVisible();
  });

  test('a trait page opens straight from the address, with the trait named and described', async ({
    page,
    request,
  }) => {
    const trait = await aTrait(request);

    await page.goto(`./synergy/${trait.id}`);

    await expect(synergyHeading(page)).toHaveText(trait.name);
    await expect(page).toHaveTitle(`${trait.name} — Synergies — Trait Atlas`);
    await expect(page.getByText(`${trait.family} · ${trait.class}`)).toBeVisible();
    await expect(page.getByText(trait.description, { exact: true })).toBeVisible();
    await expect(traitPicker(page)).toBeVisible();
  });

  test('a keyword page opens straight from the address of the slug of its key', async ({ page }) => {
    // A key of two words, written with a hyphen: the case a slug exists for.
    const entry = taxonomy.get('mega magic');
    if (entry?.kind !== 'effect') throw new Error('the taxonomy has no Mega Magic effect');
    expect(keywordSlug(entry.key)).toBe('mega-magic');

    await page.goto('./synergy/kw/mega-magic');

    await expect(synergyHeading(page)).toHaveText(entry.label);
    await expect(page).toHaveTitle(`${entry.label} — Synergies — Trait Atlas`);
    await expect(page.getByText('Effect', { exact: true })).toBeVisible();
    await expect(fromKeyword(page).getByRole('link', { name: entry.label, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('an id the dataset does not know is a state of the page: it says so, and offers a way on', async ({
    page,
    request,
  }) => {
    const { traits, datasetVersion } = await publishedDataset(request);
    // A trait whose name the id still spells out, filed under a family the sheet no longer has.
    const moved = withUniqueName(traits).find((trait) => /^[A-Za-z]{6,}( [A-Za-z]+)*$/u.test(trait.name));
    if (moved === undefined) throw new Error('the dataset has no trait with a plain name');
    const lostId = `retired-family--${slugify(moved.name)}`;
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));

    await page.goto(`./synergy/${lostId}`);

    await expect(synergyHeading(page)).toHaveText('Trait not found');
    await expect(page).toHaveTitle('Trait not found — Synergies — Trait Atlas');
    await expect(page.getByText(`Compendium v${datasetVersion} has no trait with the id “${lostId}”.`)).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Traits with a similar name' })
        .getByRole('link', { name: moved.name, exact: true }),
    ).toBeVisible();
    // The search is there to be changed, and starts with the name the id kept.
    await expect(traitPicker(page)).toHaveValue(slugify(moved.name).replaceAll('-', ' '));
    expect(problems).toEqual([]);
  });

  test('an id with no name to look for says that no trait is like it', async ({ page }) => {
    await page.goto('./synergy/---');

    await expect(synergyHeading(page)).toHaveText('Trait not found');
    await expect(page.getByText('No trait has a similar name.')).toBeVisible();
  });

  test('a slug that is no keyword’s opens the keyword picker', async ({ page }) => {
    await page.goto('./synergy/kw/not-a-keyword');

    await expect(synergyHeading(page)).toHaveText('Keyword not found');
    await expect(page).toHaveTitle('Keyword not found — Synergies — Trait Atlas');
    await expect(page.getByText('“not-a-keyword” is not a buff, debuff or effect')).toBeVisible();
    await expect(fromKeyword(page).getByRole('link', { name: 'Vulnerable', exact: true })).toBeVisible();
    // An event is a keyword, and has no page of its own (GAME_RULES R12).
    await page.goto('./synergy/kw/start-of-battle');
    await expect(synergyHeading(page)).toHaveText('Keyword not found');
  });

  test('a keyword of the picker leads to the page of its slug', async ({ page }) => {
    await page.goto('./synergy');
    await fromKeyword(page).getByRole('link', { name: 'Vulnerable', exact: true }).click();

    await expect.poll(() => pathOf(page)).toBe('/synergy/kw/vulnerable');
    await expect(synergyHeading(page)).toHaveText('Vulnerable');
  });
});

test.describe('picking a trait', () => {
  test('opens its page as a step of the history, and Back and Forward walk it', async ({ page, request }) => {
    const trait = await aTrait(request);
    await page.goto('./synergy');

    await typeInPicker(page, trait.name);
    await suggestionFor(page, trait.name).click();

    await expect.poll(() => pathOf(page)).toBe(`/synergy/${trait.id}`);
    await expect(synergyHeading(page)).toHaveText(trait.name);

    await page.goBack();
    await expect.poll(() => pathOf(page)).toBe('/synergy');
    await expect(synergyHeading(page)).toHaveText('Synergies');

    await page.goForward();
    await expect.poll(() => pathOf(page)).toBe(`/synergy/${trait.id}`);
    await expect(synergyHeading(page)).toHaveText(trait.name);
  });

  test('works with the keyboard alone: type, the first match is active, Enter takes it', async ({ page, request }) => {
    const trait = await aTrait(request);
    await page.goto('./synergy');

    await traitPicker(page).fill(trait.name);
    await expect(traitSuggestions(page).first()).toBeVisible();
    await expect(traitPicker(page)).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');

    await expect.poll(() => pathOf(page)).toMatch(/^\/synergy\/.+/u);
    await expect(synergyHeading(page)).toBeVisible();
    // The field is empty again: the page is another one, and the person asked for it already.
    await expect(traitPicker(page)).toHaveValue('');
  });

  test('lists nothing for a text no trait fits, and nothing for an empty field', async ({ page }) => {
    await page.goto('./synergy');
    await expect(traitPicker(page)).toBeVisible();

    await traitPicker(page).fill('zzzzzzzz');
    await expect(traitPicker(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(traitSuggestions(page)).toHaveCount(0);
  });
});

test.describe('the party, carried from page to page', () => {
  test('goes from Explore to the Synergies and back, with the same party and what can be undone', async ({
    page,
    request,
  }) => {
    const trait = await aTrait(request);
    await openExplore(page);
    await addToParty(page, trait);
    await expect.poll(() => paramOf(page, 'party')).toContain(trait.id);

    await placeLink(page, 'Synergies').click();

    await expect.poll(() => pathOf(page)).toBe('/synergy');
    expect(paramOf(page, 'party')).toContain(trait.id);
    const mine = fromParty(page);
    await expect(mine.getByText('Creature 1 · Innate')).toBeVisible();

    await mine.getByRole('link', { name: trait.name, exact: true }).click();
    await expect.poll(() => pathOf(page)).toBe(`/synergy/${trait.id}`);
    expect(paramOf(page, 'party')).toContain(trait.id);

    await placeLink(page, 'Explore').click();
    await expect.poll(() => pathOf(page)).toBe('/');
    await showParty(page);
    await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(
      `Target slot: Creature 1 · Innate, ${trait.name}`,
    );
    // The session is the same one: the add can still be undone.
    await expect(toolbarButton(page, 'Undo')).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('is the party of the last visit for a visit with none in the address, and the address then says so', async ({
    page,
    request,
  }) => {
    const trait = await aTrait(request);
    await openExplore(page);
    await addToParty(page, trait);
    await expect.poll(() => paramOf(page, 'party')).toContain(trait.id);

    await page.goto('./synergy');

    await expect(fromParty(page).getByRole('link', { name: trait.name, exact: true })).toBeVisible();
    await expect.poll(() => paramOf(page, 'party')).toContain(trait.id);
  });

  test('is read from the address of a Synergy page: a lost trait is shown for what it is', async ({
    page,
    request,
  }) => {
    const { datasetVersion } = await publishedDataset(request);
    const trait = await aTrait(request);

    await page.goto(`./synergy?party=${datasetVersion},${trait.id},gone--from-the-sheet`);

    const mine = fromParty(page);
    await expect(mine.getByRole('link', { name: trait.name, exact: true })).toBeVisible();
    await expect(mine.getByText('gone--from-the-sheet')).toBeVisible();
    await expect(mine.getByText(`Not found in v${datasetVersion}`)).toBeVisible();
  });

  test('stays in the address of every page the person goes through', async ({ page, request }) => {
    const { datasetVersion } = await publishedDataset(request);
    const trait = await aTrait(request);
    const party = `${datasetVersion},${trait.id}`;

    await page.goto(`./synergy/${trait.id}?party=${party}`);
    await placeLink(page, 'Synergies').click();
    await expect.poll(() => pathOf(page)).toBe('/synergy');
    expect(paramOf(page, 'party')).toBe(party);

    await fromKeyword(page).getByRole('link', { name: 'Vulnerable', exact: true }).click();
    await expect.poll(() => pathOf(page)).toBe('/synergy/kw/vulnerable');
    expect(paramOf(page, 'party')).toBe(party);
  });
});

test.describe('the places of the app', () => {
  test('are the same three wherever the person is, and the page they are on is marked', async ({ page }) => {
    await openExplore(page);
    await expect(placeLink(page, 'Explore').or(page.getByRole('tab', { name: /^Explore/ }))).toBeVisible();
    await expect(placeLink(page, 'Synergies')).toBeVisible();

    await placeLink(page, 'Synergies').click();
    await expect.poll(() => pathOf(page)).toBe('/synergy');

    await expect(placeLink(page, 'Synergies')).toHaveAttribute('aria-current', 'page');
    await expect(placeLink(page, 'Explore')).not.toHaveAttribute('aria-current', 'page');
    await expect(placeLink(page, 'Party')).toBeVisible();
    await expect(placeLink(page, 'Party')).toContainText('0 of 18 slots filled');

    await placeLink(page, 'Explore').click();
    await expect.poll(() => pathOf(page)).toBe('/');
  });

  test('on a wide screen are links in the header, which the foot of the window does not repeat', async ({ page }) => {
    test.skip(isTabbed(page), 'A narrow screen has them at the foot of the window.');
    await page.goto('./synergy');

    await expect(page.getByRole('navigation', { name: 'Pages' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Sections' })).toBeHidden();
  });

  test('on a narrow screen are links at the foot of the window, and on Explore beside the tabs, not among them', async ({
    page,
  }) => {
    test.skip(!isTabbed(page), 'A wide screen has them in the header.');
    await page.goto('./synergy');
    const bar = page.getByRole('navigation', { name: 'Sections' });

    await expect(bar).toBeVisible();
    await expect(bar.getByRole('link')).toHaveCount(3);
    await expect(page.getByRole('navigation', { name: 'Pages' })).toBeHidden();

    await openExplore(page);
    await expect(page.getByRole('tablist', { name: 'Sections' }).getByRole('tab')).toHaveCount(2);
    await expect(page.getByRole('tablist', { name: 'Sections' }).getByRole('link')).toHaveCount(0);
    await expect(placeLink(page, 'Synergies')).toBeVisible();
  });
});

test.describe('accessibility of the Synergy pages', () => {
  test('has no WCAG 2.2 AA violations on the picker, with a party and the list of matches open', async ({
    page,
    request,
  }) => {
    const { datasetVersion } = await publishedDataset(request);
    const trait = await aTrait(request);
    await page.goto(`./synergy?party=${datasetVersion},${trait.id}`);
    await typeInPicker(page, trait.name.slice(0, 3));

    expect(await axeViolations(page)).toEqual([]);
  });

  test('has none on a trait page, a keyword page, and the two pages for what is not found', async ({
    page,
    request,
  }) => {
    const trait = await aTrait(request);
    for (const address of [
      `./synergy/${trait.id}`,
      './synergy/kw/vulnerable',
      './synergy/retired--some-trait',
      './synergy/kw/not-a-keyword',
    ]) {
      await page.goto(address);
      await expect(synergyHeading(page)).toBeVisible();
      await expect(page.getByText('Loading the traits…')).toHaveCount(0);
      expect(await axeViolations(page), address).toEqual([]);
    }
  });
});
