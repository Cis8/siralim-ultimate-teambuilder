import { expect, test, type APIRequestContext } from '@playwright/test';
import type { Trait } from '@atlas/core';
import { axeViolations } from './support/axe';
import { publishedDataset } from './support/dataset';
import {
  backToTopButton,
  clearFiltersButton,
  facet,
  filtersButton,
  filtersSheet,
  isCompact,
  isTabbed,
  issuesBadge,
  issuesList,
  openExplore,
  pageHeading,
  rows,
  scrollScreens,
  scrolledBy,
  searchBox,
} from './support/explore-page';
import { problemsOf, tabTo, walkTabOrder, type TabWalk } from './support/keyboard';
import {
  addButton,
  addElsewhereButton,
  findRow,
  partyPanel,
  plainTraits,
  slot,
  slotChooser,
  tab,
  toolbarButton,
  withUniqueName,
} from './support/party-page';
import { pathOf, placeLink, synergyHeading, whenLoaded } from './support/synergy-page';
import { firstUnique, relationsOfDataset } from './support/trait-page';

// Criterion 8: with the keyboard alone every action is reachable and the focus can be seen (DESIGN § Accessibility). The walks
// press Tab through a page the way a person does, and stop at every control; the flows do what a person does with the keys.

/** A trait of the dataset in which the keyword has this role, found by name alone. */
const withRole = (traits: readonly Trait[], role: 'applies' | 'uses' | 'resists'): Trait => {
  const found = withUniqueName(traits).find((trait) => trait.keywords.some((hit) => hit.role === role));
  if (found === undefined) throw new Error(`the dataset has no trait that ${role} a keyword`);
  return found;
};

/** The address of a page with a short list of results (every shape a keyword takes) and a party with a gap in it. */
async function addressOf(request: APIRequestContext, view: 'explore' | 'party'): Promise<string> {
  const { traits, datasetVersion } = await publishedDataset(request);
  const results = (['applies', 'uses', 'resists'] as const).map((role) => withRole(traits, role));
  const query = results.map((trait) => `trait:"${trait.name}"`).join(' OR ');
  // A creature that relies on Vulnerable with nothing to give it (a gap to search for), and a trait the dataset lost.
  const reliant = plainTraits(traits).find(
    (trait) =>
      trait.keywords.some((hit) => hit.key === 'vulnerable' && hit.role === 'uses') &&
      !trait.keywords.some((hit) => hit.key === 'vulnerable' && hit.role === 'applies'),
  );
  if (reliant === undefined) throw new Error('the dataset has no trait that relies on Vulnerable');
  const party = [datasetVersion, reliant.id, 'gone--from-the-sheet'].join(',');
  return `./?q=${encodeURIComponent(query)}&party=${party}${view === 'party' ? '&tab=party' : ''}`;
}

/**
 * The controls a walk missed. Safari's tab key goes to form controls and buttons, not to links, unless the person has turned
 * that on in its settings: for WebKit a link is not counted as missed.
 */
const missed = ({ unreached }: TabWalk, browserName: string): readonly string[] =>
  browserName === 'webkit' ? unreached.filter((control) => !control.startsWith('a “')) : unreached;

test.describe('the tab key', () => {
  test('can skip the filters, which a keyboard otherwise passes button by button, and lands at the results', async ({
    page,
    request,
    browserName,
  }) => {
    test.skip(
      isCompact(page),
      'The filters are a sheet on a narrow screen: nothing lies between the search and the results.',
    );
    test.skip(browserName === 'webkit', 'Safari’s tab key does not stop at links unless the person asks it to.');
    await openExplore(page, await addressOf(request, 'explore'));

    // After the query's own controls: the link to the content, the field, three chips of two buttons, the sort and the copy button.
    const presses = await tabTo(page, page.getByRole('link', { name: 'Skip filters' }), { limit: 15 });
    expect(presses).toBeGreaterThan(1);
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { level: 2, name: 'Results' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(addButton(rows(page).first())).toBeFocused();
  });

  test('reaches every control of Explore, and each shows a ring in sight', async ({ page, request, browserName }) => {
    await openExplore(page, await addressOf(request, 'explore'));

    const walk = await walkTabOrder(page);

    expect(walk.stops.length).toBeGreaterThan(10);
    expect(problemsOf(walk)).toEqual([]);
    expect(missed(walk, browserName)).toEqual([]);
  });

  test('reaches the badge of the issues and every fix of their list, and each shows a ring in sight', async ({
    page,
    browserName,
  }) => {
    // A parenthesis closed that was never opened, and one opened that is never closed, round a query that finds traits.
    await openExplore(page, `./?q=${encodeURIComponent('weak OR snared ) (')}`);
    await tabTo(page, issuesBadge(page), { limit: 6 });
    await page.keyboard.press('Enter');
    await expect(issuesList(page)).toBeVisible();

    const walk = await walkTabOrder(page, { within: '#query-issues' });

    expect(walk.stops.map(({ name }) => name)).toEqual(
      expect.arrayContaining([expect.stringContaining('“Remove “)””'), expect.stringContaining('“Remove “(””')]),
    );
    expect(problemsOf(walk)).toEqual([]);
    expect(missed(walk, browserName)).toEqual([]);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('reaches every control of the Party tab, and each shows a ring in sight', async ({
    page,
    request,
    browserName,
  }) => {
    test.skip(!isTabbed(page), 'A wide window shows the party beside the list: the walk of Explore holds it.');
    await page.goto(await addressOf(request, 'party'));
    await expect(partyPanel(page)).toBeVisible();

    const walk = await walkTabOrder(page);

    expect(walk.stops.length).toBeGreaterThan(10);
    expect(problemsOf(walk)).toEqual([]);
    expect(missed(walk, browserName)).toEqual([]);
  });

  test('reaches every control of the open filters sheet, and none of the page behind it', async ({
    page,
    request,
    browserName,
  }) => {
    test.skip(!isCompact(page), 'A wide window has the filters in the page.');
    await openExplore(page, await addressOf(request, 'explore'));
    await tabTo(page, filtersButton(page));
    await page.keyboard.press('Enter');
    await expect(filtersSheet(page)).toBeVisible();

    const walk = await walkTabOrder(page, { within: 'dialog[open]' });

    expect(walk.stops.length).toBeGreaterThan(10);
    expect(problemsOf(walk)).toEqual([]);
    expect(missed(walk, browserName)).toEqual([]);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('reaches every slot of the sheet that offers them, and none of the page behind it', async ({
    page,
    request,
    browserName,
  }) => {
    const { traits } = await publishedDataset(request);
    const mastery = withUniqueName(traits).find((trait) => trait.kind === 'mastery' && trait.material !== null);
    if (mastery === undefined) throw new Error('the dataset has no mastery trait with a material');
    await openExplore(page);
    const add = addElsewhereButton(await findRow(page, mastery));
    await add.focus();
    await page.keyboard.press('Enter');
    await expect(slotChooser(page)).toBeVisible();

    const walk = await walkTabOrder(page, { within: 'dialog[open]' });

    // The slot it offers (a mastery fits the Artifact slot only) and Cancel.
    expect(walk.stops.length).toBeGreaterThanOrEqual(2);
    expect(problemsOf(walk)).toEqual([]);
    expect(missed(walk, browserName)).toEqual([]);
  });
});

test.describe('the tab key on the Synergy pages', () => {
  test('reaches every control of each of them, and each shows a ring in sight', async ({
    page,
    request,
    browserName,
  }) => {
    const { traits, datasetVersion } = await publishedDataset(request);
    const [trait] = plainTraits(traits);
    if (trait === undefined) throw new Error('the dataset has no plain trait');
    // A trait with lanes of several keys and of one, and a group of random sources (folded away, so that the walk is not a hundred stops).
    const index = relationsOfDataset(traits);
    const crowded = firstUnique(
      traits,
      (each) => {
        const found = index.relationsOf(each.id)?.enabledBy;
        return (
          found !== undefined && found.several.length > 0 && found.single.some(({ entries }) => entries.length > 1)
        );
      },
      'with lanes of several keys and of one',
    );
    // A phone shows one list of a page at a time, as a tab: the page is opened on each of them in turn, and the walk of each must reach
    // every control it shows. From 700 px the lists are all on the page and `section=` changes nothing, so one walk does.
    const traitSections = ['enabled-by', 'enables', 'alternatives', 'related'];
    const keywordSections = ['appliers', 'users'];
    const addresses: [string, readonly string[]][] = [
      // The picker with a party in it, the page of a trait (a plain one, and one with lanes and a party), of a keyword, and the two
      // pages of what was not found.
      [`./synergy?party=${datasetVersion},${trait.id},gone--from-the-sheet`, []],
      [`./synergy/${trait.id}`, traitSections],
      [`./synergy/${crowded.id}?mat=yes&party=${datasetVersion},${trait.id}`, traitSections],
      ['./synergy/kw/vulnerable', keywordSections],
      ['./synergy/retired--some-trait', []],
      ['./synergy/kw/not-a-keyword', []],
    ];

    const walkSynergyPage = async (address: string): Promise<void> => {
      await page.goto(address);
      await expect(synergyHeading(page)).toBeVisible();
      await whenLoaded(page);

      const walk = await walkTabOrder(page);

      // Most of what these pages hold is links, which Safari's tab key passes by.
      if (browserName !== 'webkit') expect(walk.stops.length, address).toBeGreaterThan(3);
      expect(problemsOf(walk), address).toEqual([]);
      expect(missed(walk, browserName), address).toEqual([]);
    };

    for (const [address, sections] of addresses) {
      for (const section of isCompact(page) ? sections : []) {
        await walkSynergyPage(`${address}${address.includes('?') ? '&' : '?'}section=${section}`);
      }
      if (!isCompact(page) || sections.length === 0) await walkSynergyPage(address);
    }
  });
});

test.describe('the keyboard alone', () => {
  test('goes from Explore to the Synergies by the link in the header or at the foot, and back', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'Safari’s tab key does not stop at links unless the person asks it to.');
    await openExplore(page);

    // The bar at the foot of a narrow screen is the last of the page: Shift+Tab from the top finds it first.
    await tabTo(page, placeLink(page, 'Synergies'), { backwards: isTabbed(page), limit: 10 });
    await page.keyboard.press('Enter');
    await expect.poll(() => pathOf(page)).toBe('/synergy');
    await expect(placeLink(page, 'Synergies')).toHaveAttribute('aria-current', 'page');

    await tabTo(page, placeLink(page, 'Explore'), { backwards: isTabbed(page), limit: 10 });
    await page.keyboard.press('Enter');
    await expect.poll(() => pathOf(page)).toBe('/');
  });

  test('searches, adds a trait to the party and takes it back, without a pointer', async ({
    page,
    request,
    browserName,
  }) => {
    const [trait] = plainTraits((await publishedDataset(request)).traits);
    if (trait === undefined) throw new Error('the dataset has no plain trait');
    const slotName = 'Creature 1 · Innate';
    await openExplore(page);

    await test.step('types the search', async () => {
      await tabTo(page, searchBox(page), { limit: 5 });
      await page.keyboard.type(`trait:"${trait.name}" family:"${trait.family}"`);
      await expect(rows(page)).toHaveCount(1);
    });

    await test.step('goes to the trait, past the filters, and adds it', async () => {
      const skip = page.getByRole('link', { name: 'Skip filters' });
      if ((await skip.isVisible()) && browserName !== 'webkit') {
        await tabTo(page, skip, { limit: 15 });
        await page.keyboard.press('Enter');
      }
      await tabTo(page, addButton(rows(page).first()), { limit: 40 });
      await page.keyboard.press('Enter');

      await expect(rows(page).first().getByText(`In party: ${slotName}`)).toBeVisible();
    });

    await test.step('gets to the party and takes the trait back with Undo', async () => {
      if (isTabbed(page)) {
        // The tabs are one stop at the foot of the page, and the arrows move along them.
        await tabTo(page, tab(page, 'Explore'), { limit: 20 });
        await page.keyboard.press('ArrowRight');
        await expect(partyPanel(page)).toBeVisible();
      }
      await tabTo(page, toolbarButton(page, 'Undo'), { backwards: isTabbed(page), limit: 80 });
      await expect(slot(page, slotName)).toHaveAccessibleName(`Target slot: ${slotName}, ${trait.name}`);
      await page.keyboard.press('Enter');

      await expect(slot(page, slotName)).toHaveAccessibleName(`Target slot: ${slotName}, empty`);
      await expect(toolbarButton(page, 'Undo')).toBeFocused();
    });

    await test.step('puts it back with Redo, and clears the party', async () => {
      await page.keyboard.press('Tab');
      await expect(toolbarButton(page, 'Redo')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(slot(page, slotName)).toHaveAccessibleName(`Target slot: ${slotName}, ${trait.name}`);

      await page.keyboard.press('Tab');
      await expect(toolbarButton(page, 'Clear party')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(slot(page, slotName)).toHaveAccessibleName(`Target slot: ${slotName}, empty`);
    });
  });

  test('goes back to the top of a long list with the Back to top button, and lands on the heading of the page', async ({
    page,
  }) => {
    await openExplore(page);
    await scrollScreens(page, 3);
    await expect(backToTopButton(page)).toBeVisible();
    // The list never ends to a tab key going forward (it draws more of it at every press), so the button is the last control
    // of the page's content and Shift+Tab from the foot finds it. The Home key is the quick way for a keyboard.
    await tabTo(page, backToTopButton(page), { backwards: true, limit: 10 });
    await page.keyboard.press('Enter');

    await expect(pageHeading(page)).toBeFocused();
    await expect.poll(() => scrolledBy(page)).toBe(0);
    await expect(searchBox(page)).not.toBeFocused();
  });

  test('turns a filter on and off with Space, in the sheet where there is one', async ({ page }) => {
    await openExplore(page);

    if (isCompact(page)) {
      await tabTo(page, filtersButton(page), { limit: 20 });
      await page.keyboard.press('Enter');
      await expect(filtersSheet(page)).toBeVisible();
    }
    await tabTo(page, facet(page, 'Life'), { limit: 40 });
    await page.keyboard.press('Space');
    await expect(facet(page, 'Life')).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Space');
    await expect(facet(page, 'Life')).toHaveAttribute('aria-pressed', 'false');

    if (isCompact(page)) {
      await page.keyboard.press('Escape');
      await expect(filtersSheet(page)).toBeHidden();
      await expect(filtersButton(page)).toBeFocused();
    }
  });

  test('takes the filters off with Clear filters, which keeps the focus when there is nothing left to clear', async ({
    page,
  }) => {
    await openExplore(page);

    if (isCompact(page)) {
      await tabTo(page, filtersButton(page), { limit: 20 });
      await page.keyboard.press('Enter');
      await expect(filtersSheet(page)).toBeVisible();
    }
    await tabTo(page, facet(page, 'Life'), { limit: 40 });
    await page.keyboard.press('Space');
    await expect(facet(page, 'Life')).toHaveAttribute('aria-pressed', 'true');

    // The button is the first stop of the panel, before the classes.
    await tabTo(page, clearFiltersButton(page), { backwards: true, limit: 10 });
    await expect(clearFiltersButton(page)).toHaveAccessibleName('Clear filters (1)');
    await page.keyboard.press('Enter');

    await expect(facet(page, 'Life')).toHaveAttribute('aria-pressed', 'false');
    await expect(clearFiltersButton(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(clearFiltersButton(page)).toBeFocused();
  });
});
