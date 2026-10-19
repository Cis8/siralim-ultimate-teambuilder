import { expect, test, type Page } from '@playwright/test';
import {
  keywordSlug,
  taxonomy,
  type KeywordKey,
  type KeywordVerdict,
  type KeywordView,
  type RelationIndex,
  type Trait,
} from '@atlas/core';
import { axeViolations } from './support/axe';
import { publishedDataset } from './support/dataset';
import { announcedCount, countText, openExplore } from './support/explore-page';
import {
  chipName,
  chipOf,
  closeKeywordChips,
  keywordCardOf,
  keywordCards,
  keywordList,
  keywordSummary,
  openKeywordChips,
  seeInExplore,
  shownKeywordList,
  togetherLinks,
  traitsText,
  VERDICT_TITLES,
} from './support/keyword-page';
import { addToParty, plainTraits, showParty, slot } from './support/party-page';
import { fromKeyword, paramOf, pathOf, placeLink, synergyHeading, whenLoaded } from './support/synergy-page';
import { artifactFilter, filterAnnouncement, randomToggle, relationsOfDataset, showMore } from './support/trait-page';

// Phase 2, M13.5: the page of a keyword. Who applies it, who relies on it, and whether that is enough, held to what core says of the
// published dataset (the relation index), and the counts held to what Explore shows for the same filter (ROADMAP criterion 11).

/** Cards a list draws before the person opens it (DESIGN § Synergy pages). */
const PREVIEW = 6;

const labelOf = (key: string): string => taxonomy.get(key)?.label ?? key;

async function dataset(request: Parameters<typeof publishedDataset>[0]) {
  const { traits, datasetVersion } = await publishedDataset(request);
  const index = relationsOfDataset(traits);
  const viewOf = (key: KeywordKey, artifactOnly = false): KeywordView => {
    const found = index.keywordView(key, { artifactOnly });
    if (found === undefined) throw new Error(`the index has no key ${key}`);
    return found;
  };
  return { traits, datasetVersion, index, viewOf };
}

async function openKeyword(page: Page, key: KeywordKey, search = ''): Promise<void> {
  await page.goto(`./synergy/kw/${keywordSlug(key)}${search}`);
  await expect(synergyHeading(page)).toHaveText(labelOf(key));
  await whenLoaded(page);
}

/** The first key of the taxonomy order whose view has this verdict and `fits`. */
function keyWith(
  index: RelationIndex,
  verdict: KeywordVerdict,
  fits: (view: KeywordView) => boolean = () => true,
): KeywordKey {
  const found = index.keys.find((key) => {
    const view = index.keywordView(key);
    return view?.verdict === verdict && fits(view);
  });
  if (found === undefined) throw new Error(`the dataset has no key with the verdict ${verdict}`);
  return found;
}

const namesOf = (traits: readonly Trait[]): string[] => traits.map(({ name }) => name);

test.describe('the summary of a keyword', () => {
  test('says how many traits apply it and how many rely on it, and what that comes to', async ({ page, request }) => {
    const { index, viewOf } = await dataset(request);
    // One key for each verdict the sheet has: the words are the ones of VERDICT_TITLES, and the reason follows them.
    const verdicts: KeywordVerdict[] = ['supported', 'scarce', 'no-payoff'];

    for (const verdict of verdicts) {
      const key = keyWith(index, verdict);
      const { stats } = viewOf(key);
      await openKeyword(page, key);

      const summary = keywordSummary(page);
      await expect(summary).toContainText(`${String(stats.appliers)} ${stats.appliers === 1 ? 'applies' : 'apply'} it`);
      await expect(summary).toContainText(`${String(stats.users)} ${stats.users === 1 ? 'relies on' : 'rely on'} it`);
      await expect(summary.getByText(VERDICT_TITLES[verdict], { exact: true }), key).toBeVisible();
      await expect(summary.getByText(/\.$/u).last(), key).toBeVisible();
    }
  });

  test('names the kind of the keyword, and the page takes its name for a title', async ({ page, request }) => {
    const { index } = await dataset(request);
    const buff = index.keys.find((key) => taxonomy.get(key)?.kind === 'buff');
    if (buff === undefined) throw new Error('the dataset has no buff');

    await openKeyword(page, 'vulnerable');
    await expect(keywordSummary(page).getByText('Debuff', { exact: true })).toBeVisible();
    await expect(page).toHaveTitle('Vulnerable — Synergies — Trait Atlas');

    await openKeyword(page, buff);
    await expect(keywordSummary(page).getByText('Buff', { exact: true })).toBeVisible();
  });

  test('says how many more give it under a condition or at random, which the counts above leave out', async ({
    page,
    request,
  }) => {
    const { index, viewOf } = await dataset(request);
    const key = index.keys.find((each) => viewOf(each).stats.random > 0 && viewOf(each).stats.conditional > 0);
    if (key === undefined) throw new Error('no key is given under a condition and at random');
    const { stats } = viewOf(key);

    await openKeyword(page, key);

    await expect(keywordSummary(page)).toContainText(
      `${String(stats.random)} more afflict a random debuff, which may be this one.`,
    );
    await expect(keywordSummary(page)).toContainText(
      `${String(stats.conditional)} more ${stats.conditional === 1 ? 'gives' : 'give'} it once another debuff is there.`,
    );
  });

  test('links the keywords its appliers also apply, each with how many of them do', async ({ page, request }) => {
    const { index, viewOf } = await dataset(request);
    const key = index.keys.find((each) => viewOf(each).coApplied.length > 2);
    if (key === undefined) throw new Error('no key has three that its appliers also apply');
    const together = viewOf(key).coApplied;

    await openKeyword(page, key);

    await expect(keywordSummary(page).getByText('Often applied together with')).toBeVisible();
    await expect(togetherLinks(page)).toHaveText(together.map((each) => labelOf(each.key)));
    // The number is for the eye; the ear is told what it counts.
    const first = together[0];
    if (first === undefined) throw new Error('no keyword in common');
    await expect(keywordSummary(page).getByRole('listitem').first()).toContainText(
      `, applied by ${String(first.count)} of its appliers`,
    );
  });

  test('has no such line for a keyword whose appliers apply nothing else', async ({ page, request }) => {
    const { index, viewOf } = await dataset(request);
    const key = index.keys.find((each) => viewOf(each).coApplied.length === 0);
    if (key === undefined) throw new Error('every key has a keyword in common');

    await openKeyword(page, key);

    await expect(keywordSummary(page).getByText('Often applied together with')).toHaveCount(0);
  });
});

test.describe('who applies it and who relies on it', () => {
  test('lists the traits the view lists, in its order, and counts them in the heading', async ({ page, request }) => {
    const { index, viewOf } = await dataset(request);
    // A key with more traits than the preview shows on both sides, and no group of traits that give it in a weaker way: every card of
    // the list is then in the list itself.
    const key = index.keys.find((each) => {
      const { stats } = viewOf(each);
      return stats.appliers > PREVIEW && stats.users > PREVIEW && stats.random === 0 && stats.conditional === 0;
    });
    if (key === undefined) throw new Error('no key has a long list on each side and no weaker source');
    const view = viewOf(key);
    await openKeyword(page, key);

    for (const [title, traits] of [
      ['Appliers', view.appliers],
      ['Rely on it', view.users],
    ] as const) {
      const list = await shownKeywordList(page, title);
      await expect(
        page.getByRole('heading', { level: 2, name: `${title} ${traitsText(traits.length)}` }),
      ).toBeVisible();
      await expect(keywordCards(list)).toHaveCount(PREVIEW);

      await showMore(list).click();

      await expect(keywordCards(list)).toHaveCount(traits.length);
      await expect(list.locator('a.name')).toHaveText(namesOf(traits));
    }
  });

  test('names the link of a card by what it does, since no trait is at the centre of the page', async ({
    page,
    request,
  }) => {
    const { index, viewOf } = await dataset(request);
    const key = index.keys[0];
    if (key === undefined) throw new Error('the index has no key');
    const [first] = viewOf(key).appliers;
    if (first === undefined) throw new Error('nothing applies the first key');
    await openKeyword(page, key);

    await expect(page.getByRole('link', { name: `Open ${first.name}` }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /^Re-centre on / })).toHaveCount(0);
  });

  test('puts the traits that give it at random in a group of their own, folded away behind a button', async ({
    page,
    request,
  }) => {
    const { index, viewOf } = await dataset(request);
    const key = index.keys.find((each) => viewOf(each).stats.random > 3);
    if (key === undefined) throw new Error('no key is given at random by more than a few traits');
    const view = viewOf(key);
    await openKeyword(page, key);
    const appliers = keywordList(page, 'Appliers');

    // The heading counts the traits that apply it by name, as the summary does: the others are counted in their own group.
    await expect(
      page.getByRole('heading', { level: 2, name: `Appliers ${traitsText(view.appliers.length)}` }),
    ).toBeVisible();
    const toggle = randomToggle(appliers);
    await expect(toggle).toHaveText(`Random sources · ${String(view.random.length)}`);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(appliers.getByText('no material', { exact: true })).toHaveCount(0);
    const before = await keywordCards(appliers).count();

    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(keywordCards(appliers)).toHaveCount(before + view.random.length);
    // Each of them says how it gives the key, so the card makes sense apart from its group.
    await expect(appliers.getByText('random', { exact: true })).toHaveCount(view.random.length);
  });

  test('puts the traits that give it under a condition in a group of their own too', async ({ page, request }) => {
    const { index, viewOf } = await dataset(request);
    const key = index.keys.find((each) => viewOf(each).stats.conditional > 0);
    if (key === undefined) throw new Error('no key is given under a condition');
    const view = viewOf(key);
    await openKeyword(page, key);
    const appliers = keywordList(page, 'Appliers');

    await expect(
      appliers.getByRole('heading', { level: 3, name: `Under a condition · ${String(view.conditional.length)}` }),
    ).toBeVisible();
    await expect(appliers.getByText('They give it once the other debuff of their pair is there.')).toBeVisible();
    await expect(appliers.getByText('conditional', { exact: true })).toHaveCount(view.conditional.length);
    for (const trait of view.conditional) await expect(keywordCardOf(appliers, trait.name).first()).toBeVisible();
  });

  test('says so where nothing relies on the keyword', async ({ page, request }) => {
    const { index, viewOf } = await dataset(request);
    const key = keyWith(index, 'no-payoff');
    await openKeyword(page, key);

    await expect(
      (await shownKeywordList(page, 'Rely on it')).getByText(
        `Nothing relies on ${labelOf(key)} yet in the compendium.`,
      ),
    ).toBeVisible();
    expect(viewOf(key).stats.users).toBe(0);
  });
});

test.describe('the same traits in Explore (criterion 11)', () => {
  test('are as many in Explore as the page counts, for the traits that apply it and for those that rely on it', async ({
    page,
    request,
  }) => {
    const { traits, index, viewOf } = await dataset(request);
    const keys = [keyWith(index, 'supported'), keyWith(index, 'scarce')];

    for (const key of keys) {
      const { stats } = viewOf(key);
      for (const [title, count, filter] of [
        ['Appliers', stats.appliers, `kw=a:${key}`],
        ['Rely on it', stats.users, `kw=u:${key}`],
      ] as const) {
        await openKeyword(page, key);
        await seeInExplore(await shownKeywordList(page, title)).click();

        await expect.poll(() => paramOf(page, 'kw'), key).toBe(filter.slice('kw='.length));
        await expect(announcedCount(page), `${key} ${title}`).toContainText(countText(count, traits));
      }
    }
  });

  test('are as many with the artifact filter on, which goes with the link', async ({ page, request }) => {
    const { traits, index, viewOf } = await dataset(request);
    // A key whose appliers the filter makes fewer (it moves few counts on v2.0), so that they differ from the ones without it.
    const key = index.keys.find((each) => {
      const all = viewOf(each).stats;
      const kept = viewOf(each, true).stats;
      return kept.appliers < all.appliers && kept.users > 0;
    });
    if (key === undefined) throw new Error('no key has an applier without a material');
    const kept = viewOf(key, true).stats;
    await openKeyword(page, key, '?mat=yes');

    for (const [title, count] of [
      ['Appliers', kept.appliers],
      ['Rely on it', kept.users],
    ] as const) {
      await openKeyword(page, key, '?mat=yes');
      await seeInExplore(await shownKeywordList(page, title)).click();

      await expect.poll(() => paramOf(page, 'mat')).toBe('yes');
      await expect(announcedCount(page), title).toContainText(countText(count, traits));
    }
  });

  test('carries the party to Explore, and names the link by the list it leaves', async ({ page, request }) => {
    const { traits, datasetVersion } = await dataset(request);
    const [mine] = plainTraits(traits);
    if (mine === undefined) throw new Error('the dataset has no plain trait');
    await openKeyword(page, 'vulnerable', `?party=${datasetVersion},${mine.id}`);

    const link = seeInExplore(keywordList(page, 'Appliers'));

    await expect(link).toHaveAccessibleName('See in Explore — Appliers');
    await expect(seeInExplore(await shownKeywordList(page, 'Rely on it'))).toHaveAccessibleName(
      'See in Explore — Rely on it',
    );
    await shownKeywordList(page, 'Appliers');
    await link.click();
    await expect.poll(() => pathOf(page)).toBe('/');
    expect(paramOf(page, 'party')).toContain(mine.id);
  });
});

test.describe('the other keywords', () => {
  test('are chips that say in words how many traits apply them and rely on them, under the same filter', async ({
    page,
    request,
  }) => {
    const { index } = await dataset(request);
    await openKeyword(page, 'vulnerable');

    for (const filtered of [false, true]) {
      if (filtered) await artifactFilter(page).check();
      // On a phone the chips are in a sheet, which is put away again: the page behind it is out of reach while it is open.
      const chips = await openKeywordChips(page);
      const stats = index.keywordStats({ artifactOnly: filtered });
      for (const key of index.keys) {
        const counts = stats.get(key);
        if (counts === undefined) throw new Error(`no counts for ${key}`);
        await expect(chips.getByRole('link', { name: chipName(labelOf(key), counts) }), key).toBeVisible();
      }
      await closeKeywordChips(page);
    }
  });

  test('mark the keyword of the page as the current one', async ({ page, request }) => {
    const { viewOf } = await dataset(request);
    await openKeyword(page, 'vulnerable');
    const chips = await openKeywordChips(page);

    await expect(chips.getByRole('link', { name: chipName('Vulnerable', viewOf('vulnerable').stats) })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(chips.locator('[aria-current="page"]')).toHaveCount(1);
  });

  test('lead to another keyword as a step of the history, with the focus on its name and the verdict said', async ({
    page,
    request,
  }) => {
    const { index, viewOf } = await dataset(request);
    const first = keyWith(index, 'supported', (view) => view.coApplied.length > 0);
    const next = viewOf(first).coApplied[0]?.key;
    if (next === undefined) throw new Error('no keyword in common');
    const view = viewOf(next);
    await openKeyword(page, first);
    await expect(filterAnnouncement(page)).toHaveText('');

    await togetherLinks(page).first().click();

    await expect.poll(() => pathOf(page)).toBe(`/synergy/kw/${keywordSlug(next)}`);
    await expect(synergyHeading(page)).toHaveText(labelOf(next));
    await expect(synergyHeading(page)).toBeFocused();
    await expect(filterAnnouncement(page)).toHaveText(
      new RegExp(
        `^${labelOf(next)}: ${String(view.stats.appliers)} .*, ${String(view.stats.users)} .*\\. ${VERDICT_TITLES[view.verdict]}\\. `,
        'u',
      ),
    );

    await page.goBack();
    await expect(synergyHeading(page)).toHaveText(labelOf(first));
  });

  test('is opened by its address with the focus left where the browser puts it, and nothing said', async ({ page }) => {
    await openKeyword(page, 'vulnerable');

    await expect(synergyHeading(page)).not.toBeFocused();
    await expect(filterAnnouncement(page)).toHaveText('');
  });
});

test.describe('the artifact filter', () => {
  test('narrows the counts, the lists and the chips, and says so, and goes with the person to the next keyword', async ({
    page,
    request,
  }) => {
    const { index, viewOf } = await dataset(request);
    const key = index.keys.find((each) => {
      const all = viewOf(each).stats;
      const kept = viewOf(each, true).stats;
      return kept.appliers < all.appliers && kept.appliers > 0;
    });
    if (key === undefined) throw new Error('no key has an applier without a material');
    const all = viewOf(key);
    const kept = viewOf(key, true);
    await openKeyword(page, key);
    await expect(artifactFilter(page)).not.toBeChecked();
    await expect(
      page.getByRole('heading', { level: 2, name: `Appliers ${traitsText(all.stats.appliers)}` }),
    ).toBeVisible();

    await artifactFilter(page).check();

    await expect.poll(() => paramOf(page, 'mat')).toBe('yes');
    await expect(
      page.getByRole('heading', { level: 2, name: `Appliers ${traitsText(kept.stats.appliers)}` }),
    ).toBeVisible();
    // On a phone this list is the other tab and is not on show (a tab press would be a step of the history, which this test counts).
    await expect(
      page.getByRole('heading', { level: 2, name: `Rely on it ${traitsText(kept.stats.users)}`, includeHidden: true }),
    ).toHaveCount(1);
    await expect(keywordSummary(page)).toContainText(`${String(kept.stats.appliers)} `);
    await expect(filterAnnouncement(page)).toHaveText(
      `Only traits with a material are listed. Appliers ${traitsText(kept.stats.appliers)}. Rely on it ${traitsText(kept.stats.users)}. ${VERDICT_TITLES[kept.verdict]}.`,
    );
    await expect(synergyHeading(page)).toHaveText(labelOf(key));

    // The next keyword is opened with the filter on, and the box says so.
    const other = index.keys.find((each) => each !== key);
    if (other === undefined) throw new Error('the index has one key');
    await chipOf(await openKeywordChips(page), labelOf(other)).click();
    await expect.poll(() => pathOf(page)).toBe(`/synergy/kw/${keywordSlug(other)}`);
    expect(paramOf(page, 'mat')).toBe('yes');
    await expect(artifactFilter(page)).toBeChecked();

    // Back takes the keyword back, and then the filter back.
    await page.goBack();
    await expect(synergyHeading(page)).toHaveText(labelOf(key));
    await expect(artifactFilter(page)).toBeChecked();
    await page.goBack();
    await expect.poll(() => paramOf(page, 'mat')).toBeNull();
    await expect(artifactFilter(page)).not.toBeChecked();
    await expect(
      page.getByRole('heading', { level: 2, name: `Appliers ${traitsText(all.stats.appliers)}` }),
    ).toBeVisible();
  });

  test('is read from the address: a page opened with mat=yes has the box checked and counts only traits with a material', async ({
    page,
    request,
  }) => {
    const { index, viewOf } = await dataset(request);
    const key = index.keys.find((each) => viewOf(each, true).stats.appliers < viewOf(each).stats.appliers);
    if (key === undefined) throw new Error('no key has an applier without a material');

    await openKeyword(page, key, '?mat=yes');

    await expect(artifactFilter(page)).toBeChecked();
    await expect(
      page.getByRole('heading', { level: 2, name: `Appliers ${traitsText(viewOf(key, true).stats.appliers)}` }),
    ).toBeVisible();
  });
});

test.describe('the party, from the page of a keyword', () => {
  test('opens the page of a trait from a card, with the party and the filter it was opened with', async ({
    page,
    request,
  }) => {
    const { traits, datasetVersion, viewOf } = await dataset(request);
    const [mine] = plainTraits(traits);
    if (mine === undefined) throw new Error('the dataset has no plain trait');
    const names = new Map<string, number>();
    for (const { name } of traits) names.set(name, (names.get(name) ?? 0) + 1);
    const target = viewOf('vulnerable').appliers.find((trait) => names.get(trait.name) === 1 && trait.id !== mine.id);
    if (target === undefined) throw new Error('no applier of Vulnerable has a name of its own');
    await openKeyword(page, 'vulnerable', `?mat=yes&party=${datasetVersion},${mine.id}`);

    await page.getByRole('link', { name: `Open ${target.name}`, exact: true }).click();

    await expect.poll(() => pathOf(page)).toBe(`/synergy/${target.id}`);
    expect(paramOf(page, 'mat')).toBe('yes');
    expect(paramOf(page, 'party')).toContain(mine.id);
  });

  test('adds the trait of a card to the party, and the other keywords and Explore have it', async ({
    page,
    request,
  }) => {
    const { traits, viewOf } = await dataset(request);
    const names = new Map<string, number>();
    for (const { name } of traits) names.set(name, (names.get(name) ?? 0) + 1);
    const plain = new Set(plainTraits(traits).map(({ id }) => id));
    const neighbour = viewOf('vulnerable')
      .appliers.slice(0, PREVIEW)
      .find((trait) => plain.has(trait.id) && names.get(trait.name) === 1);
    if (neighbour === undefined) throw new Error('no plain trait among the first appliers of Vulnerable');
    await openKeyword(page, 'vulnerable');
    const card = keywordCardOf(keywordList(page, 'Appliers'), neighbour.name);

    await card.getByRole('button', { name: /^Add to[ …]/ }).click();

    await expect(card).toContainText('In party: Creature 1 · Innate');
    await expect.poll(() => paramOf(page, 'party')).toContain(neighbour.id);

    // The party goes with the person to another keyword, and to Explore, where it can be undone.
    await chipOf(await openKeywordChips(page), 'Weak').click();
    await expect.poll(() => pathOf(page)).toBe('/synergy/kw/weak');
    expect(paramOf(page, 'party')).toContain(neighbour.id);
    await placeLink(page, 'Explore').click();
    await expect.poll(() => pathOf(page)).toBe('/');
    await showParty(page);
    await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(
      `Target slot: Creature 1 · Innate, ${neighbour.name}`,
    );
  });

  test('marks a trait that is in the party already, when the page is opened with it', async ({ page, request }) => {
    const { traits, datasetVersion, viewOf } = await dataset(request);
    const names = new Map<string, number>();
    for (const { name } of traits) names.set(name, (names.get(name) ?? 0) + 1);
    const plain = new Set(plainTraits(traits).map(({ id }) => id));
    const member = viewOf('vulnerable')
      .appliers.slice(0, PREVIEW)
      .find((trait) => plain.has(trait.id) && names.get(trait.name) === 1);
    if (member === undefined) throw new Error('no plain trait among the first appliers of Vulnerable');

    await openKeyword(page, 'vulnerable', `?party=${datasetVersion},${member.id}`);

    await expect(keywordCardOf(keywordList(page, 'Appliers'), member.name)).toContainText(
      'In party: Creature 1 · Innate',
    );
  });

  test('is the party of Explore: a trait added there goes with the person to a keyword', async ({ page, request }) => {
    const { traits } = await dataset(request);
    const [mine] = plainTraits(traits);
    if (mine === undefined) throw new Error('the dataset has no plain trait');
    await openExplore(page);
    await addToParty(page, mine);

    await placeLink(page, 'Synergies').click();
    await expect.poll(() => pathOf(page)).toBe('/synergy');
    await fromKeyword(page).getByRole('link', { name: 'Vulnerable', exact: true }).click();

    await expect.poll(() => pathOf(page)).toBe('/synergy/kw/vulnerable');
    expect(paramOf(page, 'party')).toContain(mine.id);
  });
});

test.describe('accessibility of the page of a keyword', () => {
  test('has no WCAG 2.2 AA violations with a verdict of each tone, the groups open, the filter on and a party', async ({
    page,
    request,
  }) => {
    const { traits, datasetVersion, index, viewOf } = await dataset(request);
    const [mine] = plainTraits(traits);
    if (mine === undefined) throw new Error('the dataset has no plain trait');
    const crowded = index.keys.find((each) => viewOf(each).stats.random > 3 && viewOf(each).stats.conditional > 0);
    if (crowded === undefined) throw new Error('no key has a folded group and a conditional one');

    await openKeyword(page, crowded, `?mat=yes&party=${datasetVersion},${mine.id}`);
    expect(await axeViolations(page)).toEqual([]);

    await randomToggle(keywordList(page, 'Appliers')).click();
    expect(await axeViolations(page)).toEqual([]);

    // The other tones of the verdict, and a list that is empty.
    for (const verdict of ['supported', 'scarce', 'no-payoff'] as const) {
      await openKeyword(page, keyWith(index, verdict));
      expect(await axeViolations(page), verdict).toEqual([]);
    }
  });

  test('has none for a slug that is no keyword’s, with the chips and their counts', async ({ page }) => {
    await page.goto('./synergy/kw/not-a-keyword');
    await expect(synergyHeading(page)).toHaveText('Keyword not found');
    await whenLoaded(page);

    expect(await axeViolations(page)).toEqual([]);
  });
});
