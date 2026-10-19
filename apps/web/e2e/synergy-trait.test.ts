import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  canBeDependency,
  keywordSlug,
  taxonomy,
  traitFacts,
  type RelatedTrait,
  type RelationIndex,
  type RelationSide,
  type Trait,
} from '@atlas/core';
import { axeViolations } from './support/axe';
import { publishedDataset } from './support/dataset';
import { openExplore, rows } from './support/explore-page';
import { tabTo } from './support/keyboard';
import { addToParty, plainTraits, showParty, slot, slotChoice, slotChooser, toolbarButton } from './support/party-page';
import { paramOf, pathOf, placeLink, suggestionFor, synergyHeading, traitPicker } from './support/synergy-page';
import {
  addOf,
  artifactFilter,
  cardOf,
  cards,
  filterAnnouncement,
  firstUnique,
  focusCard,
  lane,
  listing,
  randomToggle,
  relationsOfDataset,
  showMore,
  side,
  synergyAnnouncement,
  trail,
} from './support/trait-page';

// Phase 2, M13.3 and M13.4: the page of a trait. The focus card, the two sides of lanes, the lists under them, the trail, the artifact
// filter and the party, held to what core says of the published dataset (the relation index), as Explore's counts are held to the search.

/** Cards a list under the sides draws before the person opens it, and the most it draws after (DESIGN § Synergy pages). */
const PREVIEW = 6;
const LISTED_AT_MOST = 200;

const labelOf = (key: string): string => taxonomy.get(key)?.label ?? key;
const plural = (count: number): string => `${String(count)} ${count === 1 ? 'trait' : 'traits'}`;

/** What core says of the three lists under the sides of a trait, with or without the artifact filter. */
function listsOf(index: RelationIndex, trait: Trait, artifactOnly = false) {
  const options = { artifactOnly };
  const alternatives = index.alternativesOf(trait.id, options);
  const sameTrigger = index.sameTriggerOf(trait.id, options);
  const sameFamily = index.sameFamilyOf(trait.id, options);
  const sides = index.relationsOf(trait.id, options);
  if (alternatives === undefined || sameTrigger === undefined || sameFamily === undefined || sides === undefined) {
    throw new Error(`the index has no trait ${trait.id}`);
  }
  return { alternatives, sameTrigger, sameFamily, sides };
}

/** What the polite line says when the filter is turned on or off: the count of every list the page counts. */
function filterNote(index: RelationIndex, trait: Trait, on: boolean): string {
  const { alternatives, sameTrigger, sameFamily, sides } = listsOf(index, trait, on);
  const counts = [
    `Enabled by ${plural(sides.enabledBy.count)}.`,
    `Enables ${plural(sides.enables.count)}.`,
    `Alternatives ${plural(alternatives.length)}.`,
    `Same trigger ${plural(sameTrigger.entries.length)}.`,
    ...(sameFamily.grouping ? [] : [`Same family ${plural(sameFamily.entries.length)}.`]),
  ];
  return `${on ? 'Only traits with a material are listed.' : 'Every trait is listed.'} ${counts.join(' ')}`;
}
const isRandom = ({ strength }: RelatedTrait): boolean => strength === 'random';
const entriesOf = (relationSide: RelationSide): RelatedTrait[] => [
  ...relationSide.several,
  ...relationSide.single.flatMap(({ entries }) => entries),
];
/** The entries a page draws as soon as it opens: the random sources are folded away behind a button (the real sheet has dozens). */
const drawn = (relationSide: RelationSide): RelatedTrait[] =>
  entriesOf(relationSide).filter((entry) => !isRandom(entry));

/** The dataset of the build, the relation index over it, and the names that identify exactly one trait. */
async function dataset(request: Parameters<typeof publishedDataset>[0]) {
  const { traits, datasetVersion } = await publishedDataset(request);
  const index = relationsOfDataset(traits);
  /** The traits any slot of a creature takes, which a test can ask for by name. */
  const plain = new Set(plainTraits(traits).map(({ id }) => id));
  const names = new Map<string, number>();
  for (const { name } of traits) names.set(name, (names.get(name) ?? 0) + 1);
  const hasUniqueName = ({ name }: Trait): boolean => names.get(name) === 1;
  const relationsOf = (trait: Trait) => {
    const found = index.relationsOf(trait.id);
    if (found === undefined) throw new Error(`the index has no trait ${trait.id}`);
    return found;
  };
  return { traits, datasetVersion, index, plain, hasUniqueName, relationsOf };
}

async function openTrait(page: Page, trait: Trait, search = ''): Promise<void> {
  await page.goto(`./synergy/${trait.id}${search}`);
  await expect(synergyHeading(page)).toHaveText(trait.name);
  await expect(page.getByText('Loading the traits…')).toHaveCount(0);
}

/** The text after a label of the facts of the focus ("Relies on", "Material"). */
const fact = (card: Locator, label: string): Locator =>
  card
    .locator('dt')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator('xpath=following-sibling::dd[1]');

test.describe('the card of the trait in focus', () => {
  test('describes the trait, and its buffs, debuffs and effects lead to the pages of those keywords', async ({
    page,
    request,
  }) => {
    const { traits } = await publishedDataset(request);
    const trait = firstUnique(
      traits,
      (each) => each.keywords.some((hit) => hit.kind === 'debuff') && each.keywords.some((hit) => hit.kind === 'event'),
      'that names a debuff and an event',
    );
    await openTrait(page, trait);

    const description = focusCard(page).locator('.description');
    await expect(description).toHaveText(trait.description);
    // A buff, a debuff or an effect is a link to the page of its keyword; an event or a mechanic leads nowhere (GAME_RULES R12).
    const dependencies = trait.keywords.filter((hit) => canBeDependency(hit.kind));
    await expect(description.locator('a.keyword')).toHaveCount(dependencies.length);
    const [first] = dependencies;
    if (first === undefined) throw new Error('the trait names no dependency');
    await expect(description.locator('a.keyword').first()).toHaveAttribute(
      'href',
      new RegExp(`/synergy/kw/${keywordSlug(first.key)}(\\?|$)`, 'u'),
    );
    const events = trait.keywords.filter((hit) => hit.kind === 'event');
    await expect(description.locator('span.keyword[data-kind="event"]')).toHaveCount(events.length);
    await expect(description.locator('a.keyword[data-kind="event"], button.keyword')).toHaveCount(0);
  });

  test('says what the trait relies on, applies and waits for, and what it is made of', async ({ page, request }) => {
    const { traits } = await publishedDataset(request);
    const fleshRot = traits.find(({ id }) => id === 'abomination--flesh-rot');
    if (fleshRot === undefined) throw new Error('the dataset has no Flesh Rot');
    await openTrait(page, fleshRot);

    const card = focusCard(page);
    await expect(fact(card, 'Relies on')).toHaveText('Weak, Vulnerable');
    await expect(fact(card, 'Applies')).toHaveText('—');
    await expect(fact(card, 'Material')).toHaveText('Brute Stitches');
  });

  test('names the events a trait waits for, and who acts where its text says', async ({ page, request }) => {
    const { traits } = await publishedDataset(request);
    const trait = firstUnique(
      traits,
      (each) => traitFacts(each).triggers.some(({ actor }) => actor === 'self'),
      'that waits for something its own creature does',
    );
    const own = traitFacts(trait).triggers.find(({ actor }) => actor === 'self');
    if (own === undefined) throw new Error('the trait has no such trigger');
    await openTrait(page, trait);

    await expect(fact(focusCard(page), 'Triggers')).toContainText(`${labelOf(own.event)} (this creature)`);
  });

  test('says in words that a trait has no material, which is what keeps it out of the Artifact slot', async ({
    page,
    request,
  }) => {
    const { traits } = await publishedDataset(request);
    const trait = firstUnique(traits, (each) => each.material === null, 'without a material');
    await openTrait(page, trait);

    await expect(fact(focusCard(page), 'Material')).toHaveText('No material — not artifact-eligible');
  });

  test('is a link away from the page of a keyword it names, with the party it was opened with', async ({
    page,
    request,
  }) => {
    const { datasetVersion, traits } = await dataset(request);
    const [mine] = plainTraits(traits);
    const fleshRot = traits.find(({ id }) => id === 'abomination--flesh-rot');
    if (mine === undefined || fleshRot === undefined) throw new Error('the dataset lacks a trait this test needs');
    const party = `${datasetVersion},${mine.id}`;
    await page.goto(`./synergy/${fleshRot.id}?party=${party}`);

    await focusCard(page)
      .getByRole('link', { name: /^Relies on Weak — / })
      .click();

    await expect.poll(() => pathOf(page)).toBe('/synergy/kw/weak');
    expect(paramOf(page, 'party')).toBe(party);
  });

  test('finds the trait in Explore, and nothing else', async ({ page, request }) => {
    const { traits } = await dataset(request);
    const trait = firstUnique(traits, () => true, 'at all');
    await openTrait(page, trait);

    await focusCard(page).getByRole('link', { name: 'Open in Explore' }).click();

    await expect.poll(() => pathOf(page)).toBe('/');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).getByRole('heading', { level: 3, name: trait.name })).toBeVisible();
  });
});

test.describe('what enables the trait, and what it enables', () => {
  test('lists a trait that ties through two keys once, in a lane of its own, as “×2 links”', async ({
    page,
    request,
  }) => {
    const { traits, hasUniqueName, relationsOf } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) =>
        relationsOf(each).enabledBy.several.some(
          (entry) => entry.strength === 'specific' && entry.score === 2 && hasUniqueName(entry.trait),
        ),
      'that a trait applying two of its keys enables',
    );
    const tied = relationsOf(focus).enabledBy.several.find(
      (entry) => entry.strength === 'specific' && entry.score === 2 && hasUniqueName(entry.trait),
    );
    if (tied === undefined) throw new Error('no trait ties through two keys');
    await openTrait(page, focus);

    const enabledBy = side(page, 'Enabled by');
    const several = lane(enabledBy, 'Several keys');
    await expect(cardOf(several, tied.trait.name)).toHaveCount(1);
    await expect(cardOf(several, tied.trait.name)).toContainText('×2 links');
    // The keys it ties through are named, in the order the focus names them.
    await expect(cardOf(several, tied.trait.name)).toContainText(
      `through ${tied.links.map(({ key }) => labelOf(key)).join(' · ')}`,
    );
    // Once on its side: the lanes of one key do not repeat it.
    await expect(cardOf(enabledBy, tied.trait.name)).toHaveCount(1);
  });

  test('has a lane for each key the trait relies on, and says how many traits each side lists', async ({
    page,
    request,
  }) => {
    const { traits, relationsOf } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => {
        const { enabledBy } = relationsOf(each);
        return enabledBy.single.length >= 2 && !entriesOf(enabledBy).some(isRandom);
      },
      'that relies on two keys and has no random source for either',
    );
    const { enabledBy, enables } = relationsOf(focus);
    await openTrait(page, focus);

    await expect(page.getByRole('heading', { level: 2, name: `Enabled by ${plural(enabledBy.count)}` })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: `Enables ${plural(enables.count)}` })).toBeVisible();
    for (const { key, entries } of enabledBy.single) {
      const keyLane = lane(side(page, 'Enabled by'), `Applies ${labelOf(key)}`);
      await expect(keyLane.getByRole('heading', { level: 3 })).toContainText(plural(entries.length));
      await expect(cards(keyLane)).toHaveCount(entries.length);
      // The lanes are in the order the trait names its keys, and each is a real list.
      await expect(keyLane.getByRole('list')).toHaveCount(1);
    }
  });

  test('puts the random sources last, labelled, and folded away behind a button when there are many', async ({
    page,
    request,
  }) => {
    const { traits, relationsOf } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => relationsOf(each).enabledBy.single.some(({ entries }) => entries.some(isRandom)),
      'that relies on a debuff some trait applies at random',
    );
    const keyLane = relationsOf(focus).enabledBy.single.find(({ entries }) => entries.some(isRandom));
    if (keyLane === undefined) throw new Error('no lane has a random source');
    const random = keyLane.entries.filter(isRandom);
    const certain = keyLane.entries.filter((entry) => !isRandom(entry));
    await openTrait(page, focus);

    const laneOnPage = lane(side(page, 'Enabled by'), `Applies ${labelOf(keyLane.key)}`);
    // Folded: the traits that give the key for sure are listed, the random sources wait behind the button that says how many.
    await expect(cards(laneOnPage)).toHaveCount(certain.length);
    const toggle = randomToggle(laneOnPage);
    await expect(toggle).toHaveText(`Random sources · ${String(random.length)}`);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(cards(laneOnPage)).toHaveCount(keyLane.entries.length);
    // Every one of them says it is random, and none of the others does.
    await expect(cards(laneOnPage).filter({ hasText: /\brandom\b/u })).toHaveCount(random.length);
    // Ranked last: the first of the random sources is drawn below the last of the others.
    const lastCertain = await cards(laneOnPage)
      .nth(certain.length - 1)
      .boundingBox();
    const firstRandom = await cards(laneOnPage).nth(certain.length).boundingBox();
    expect(firstRandom?.y ?? 0).toBeGreaterThan(lastCertain?.y ?? Number.POSITIVE_INFINITY);
    // A trait that gives the key only once another is there is labelled too, among those that give it for sure.
    const conditional = certain.filter(({ strength }) => strength === 'conditional');
    await expect(cards(laneOnPage).filter({ hasText: /\bconditional\b/u })).toHaveCount(conditional.length);

    await toggle.click();
    await expect(cards(laneOnPage)).toHaveCount(certain.length);
  });

  test('says so where there is nothing to list: no key to rely on, none applied by name, a key nobody relies on', async ({
    page,
    request,
  }) => {
    const { traits, relationsOf } = await dataset(request);

    const bare = firstUnique(
      traits,
      (each) => {
        const { enabledBy, enables } = relationsOf(each);
        return (
          enabledBy.count === 0 && enabledBy.unmet.length === 0 && enables.count === 0 && enables.unmet.length === 0
        );
      },
      'that neither relies on nor applies a buff, debuff or effect',
    );
    await openTrait(page, bare);
    await expect(side(page, 'Enabled by')).toContainText(
      `Self-sufficient: ${bare.name} doesn’t rely on any buff, debuff or effect.`,
    );
    await expect(side(page, 'Enables')).toContainText(
      `${bare.name} applies no buff, debuff or effect by name, so no trait is listed as relying on it.`,
    );

    const ignored = firstUnique(
      traits,
      (each) => relationsOf(each).enables.unmet.length > 0,
      'that applies a key nothing relies on',
    );
    const [key] = relationsOf(ignored).enables.unmet;
    if (key === undefined) throw new Error('no key is unmet');
    await openTrait(page, ignored);
    await expect(side(page, 'Enables')).toContainText(`Nothing relies on ${labelOf(key)} yet in the compendium.`);
  });
});

test.describe('the artifact filter', () => {
  test('leaves out the traits without a material, is a step of the history, and goes with the person from trait to trait', async ({
    page,
    request,
  }) => {
    const { traits, relationsOf, index, hasUniqueName } = await dataset(request);
    // No random source among them: a folded group draws none of its cards, and the count of the tags would not be the whole.
    const focus = firstUnique(
      traits,
      (each) => {
        const { enabledBy } = relationsOf(each);
        const kept = index.relationsOf(each.id, { artifactOnly: true })?.enabledBy.count ?? 0;
        return kept > 0 && kept < enabledBy.count && !entriesOf(enabledBy).some(isRandom);
      },
      'that some trait without a material enables, and no trait enables at random',
    );
    const all = relationsOf(focus).enabledBy;
    const kept = index.relationsOf(focus.id, { artifactOnly: true })?.enabledBy;
    if (kept === undefined) throw new Error('the index has no trait for the focus');
    await openTrait(page, focus);
    const enabledBy = side(page, 'Enabled by');
    await expect(artifactFilter(page)).not.toBeChecked();
    await expect(page.getByRole('heading', { level: 2, name: `Enabled by ${plural(all.count)}` })).toBeVisible();
    await expect(enabledBy.getByText('no material', { exact: true })).toHaveCount(all.count - kept.count);

    await artifactFilter(page).check();

    await expect.poll(() => paramOf(page, 'mat')).toBe('yes');
    await expect(page.getByRole('heading', { level: 2, name: `Enabled by ${plural(kept.count)}` })).toBeVisible();
    await expect(enabledBy.getByText('no material', { exact: true })).toHaveCount(0);
    // A screen reader is told what changed, which is only the counts.
    await expect(filterAnnouncement(page)).toHaveText(filterNote(index, focus, true));
    // The focus itself stays, whatever its material.
    await expect(synergyHeading(page)).toHaveText(focus.name);

    // The next trait is opened with the filter on, and the box says so.
    const next = drawn(kept).find(({ trait }) => hasUniqueName(trait));
    if (next === undefined) throw new Error('the filter leaves nothing to follow');
    await cardOf(enabledBy, next.trait.name).getByRole('link').click();
    await expect.poll(() => pathOf(page)).toBe(`/synergy/${next.trait.id}`);
    expect(paramOf(page, 'mat')).toBe('yes');
    await expect(artifactFilter(page)).toBeChecked();

    // Back takes the trait back, and then the filter back.
    await page.goBack();
    await expect(synergyHeading(page)).toHaveText(focus.name);
    await expect(artifactFilter(page)).toBeChecked();
    await page.goBack();
    await expect.poll(() => paramOf(page, 'mat')).toBeNull();
    await expect(artifactFilter(page)).not.toBeChecked();
    await expect(page.getByRole('heading', { level: 2, name: `Enabled by ${plural(all.count)}` })).toBeVisible();
    await expect(filterAnnouncement(page)).toHaveText(filterNote(index, focus, false));
  });

  test('is read from the address: a page opened with mat=yes has the box checked and lists only traits with a material', async ({
    page,
    request,
  }) => {
    const { traits, relationsOf, index } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => {
        const { enabledBy } = relationsOf(each);
        const kept = index.relationsOf(each.id, { artifactOnly: true })?.enabledBy.count ?? 0;
        return kept > 0 && kept < enabledBy.count;
      },
      'that some trait without a material enables',
    );
    const kept = index.relationsOf(focus.id, { artifactOnly: true })?.enabledBy.count ?? 0;

    await openTrait(page, focus, '?mat=yes');

    await expect(artifactFilter(page)).toBeChecked();
    await expect(page.getByRole('heading', { level: 2, name: `Enabled by ${plural(kept)}` })).toBeVisible();
  });
});

test.describe('moving the focus', () => {
  test('goes to a trait of a card as a step of the history, and the focus lands on its name', async ({
    page,
    request,
  }) => {
    const { traits, hasUniqueName, relationsOf } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => drawn(relationsOf(each).enabledBy).some(({ trait }) => hasUniqueName(trait)),
      'that a trait with a name of its own enables',
    );
    const next = drawn(relationsOf(focus).enabledBy).find(({ trait }) => hasUniqueName(trait));
    if (next === undefined) throw new Error('no card to follow');
    await openTrait(page, focus);

    await cardOf(side(page, 'Enabled by'), next.trait.name).getByRole('link').click();

    await expect.poll(() => pathOf(page)).toBe(`/synergy/${next.trait.id}`);
    await expect(synergyHeading(page)).toHaveText(next.trait.name);
    await expect(page).toHaveTitle(`${next.trait.name} — Synergies — Trait Atlas`);
    await expect(synergyHeading(page)).toBeFocused();

    await page.goBack();
    await expect.poll(() => pathOf(page)).toBe(`/synergy/${focus.id}`);
    await expect(synergyHeading(page)).toHaveText(focus.name);
    await expect(synergyHeading(page)).toBeFocused();

    await page.goForward();
    await expect(synergyHeading(page)).toHaveText(next.trait.name);
  });

  test('opened by its address, takes no focus from the browser and has no trail to show', async ({ page, request }) => {
    const { traits } = await dataset(request);
    const trait = firstUnique(traits, () => true, 'at all');

    await openTrait(page, trait);

    await expect(synergyHeading(page)).not.toBeFocused();
    await expect(trail(page)).toHaveCount(0);
  });

  test('keeps a trail of the last six traits, whose steps lead back, and starts it again from the picker', async ({
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
      .slice(0, 7);
    expect(chain).toHaveLength(7);
    const [start, ...rest] = chain;
    if (start === undefined) throw new Error('no trait to start from');
    await openTrait(page, start);
    await expect(trail(page)).toHaveCount(0);

    for (const trait of rest) {
      await traitPicker(page).fill(trait.name);
      await suggestionFor(page, trait.name).click();
      await expect.poll(() => pathOf(page)).toBe(`/synergy/${trait.id}`);
      await expect(synergyHeading(page)).toHaveText(trait.name);
    }

    // Seven traits visited, six remembered: the first is gone, the last is where the person is.
    const steps = trail(page).getByRole('listitem');
    await expect(steps).toHaveCount(6);
    await expect(steps.first()).toHaveText(chain[1]?.name ?? '');
    await expect(trail(page).getByText(start.name, { exact: true })).toHaveCount(0);
    const here = steps.last();
    await expect(here).toHaveText(chain[6]?.name ?? '');
    await expect(here.locator('[aria-current="location"]')).toHaveCount(1);
    await expect(here.getByRole('link')).toHaveCount(0);

    // A step is a way back: it cuts the trail to there.
    const back = chain[3];
    if (back === undefined) throw new Error('no trait to go back to');
    await trail(page)
      .getByRole('link', { name: `Re-centre on ${back.name}`, exact: true })
      .click();
    await expect.poll(() => pathOf(page)).toBe(`/synergy/${back.id}`);
    await expect(synergyHeading(page)).toBeFocused();
    await expect(steps).toHaveCount(3);
    await expect(steps.last()).toHaveText(back.name);

    // The picker is a new start.
    await placeLink(page, 'Synergies').click();
    await expect.poll(() => pathOf(page)).toBe('/synergy');
    const again = chain[4];
    if (again === undefined) throw new Error('no trait to pick again');
    await traitPicker(page).fill(again.name);
    await suggestionFor(page, again.name).click();
    await expect.poll(() => pathOf(page)).toBe(`/synergy/${again.id}`);
    await expect(trail(page)).toHaveCount(0);
    // The page of a trait that opens from another page takes the focus as well, not only the one that moves from trait to trait.
    await expect(synergyHeading(page)).toBeFocused();
  });

  test('works with the keyboard alone: Tab to a card, Enter, and the focus is on the new name', async ({
    page,
    request,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'Safari’s tab key does not stop at links unless the person asks it to.');
    const { traits, hasUniqueName, relationsOf } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => drawn(relationsOf(each).enabledBy).some(({ trait }) => hasUniqueName(trait)),
      'that a trait with a name of its own enables',
    );
    const next = drawn(relationsOf(focus).enabledBy).find(({ trait }) => hasUniqueName(trait));
    if (next === undefined) throw new Error('no card to follow');
    await openTrait(page, focus);

    await tabTo(page, cardOf(side(page, 'Enabled by'), next.trait.name).getByRole('link'), { limit: 120 });
    await page.keyboard.press('Enter');

    await expect.poll(() => pathOf(page)).toBe(`/synergy/${next.trait.id}`);
    await expect(synergyHeading(page)).toBeFocused();
  });
});

test.describe('the lists under the sides: Alternatives, Same trigger, Same family', () => {
  /** What an alternative says it shares: the keys the focus applies and relies on, in the order the focus names them. */
  const sharedLine = (shared: readonly { key: string; role: string }[]): string => {
    const of = (role: string) => shared.filter((tie) => tie.role === role).map(({ key }) => labelOf(key));
    const parts = [
      ...(of('applies').length > 0 ? [`applies ${of('applies').join(', ')}`] : []),
      ...(of('uses').length > 0 ? [`relies on ${of('uses').join(', ')}`] : []),
    ];
    return `Also ${parts.join(' · ')}`;
  };

  test('Alternatives lists the traits that do what the focus does, best first, each with what it shares', async ({
    page,
    request,
  }) => {
    const { traits, index } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => {
        const found = index.alternativesOf(each.id) ?? [];
        return found.length >= 2 && found.length <= PREVIEW && (found[0]?.shared.length ?? 0) >= 2;
      },
      'with a few alternatives, the best of which shares two keys',
    );
    const { alternatives } = listsOf(index, focus);
    await openTrait(page, focus);

    const list = listing(page, 'Alternatives');
    await expect(list.getByRole('heading', { level: 2 })).toHaveText(
      new RegExp(`^Alternatives\\s*${String(alternatives.length)}`),
    );
    await expect(list.getByRole('heading', { level: 2 })).toContainText(plural(alternatives.length));
    await expect(list).toContainText(`Traits that apply or rely on the same keys as ${focus.name}`);
    // Every one is there, in core's order, and a list this short has no button.
    await expect(cards(list)).toHaveCount(alternatives.length);
    for (const [at, found] of alternatives.entries()) {
      await expect(
        cards(list)
          .nth(at)
          .getByRole('link', { name: /^Re-centre on / }),
      ).toHaveAccessibleName(`Re-centre on ${found.trait.name}`);
    }
    await expect(showMore(list)).toHaveCount(0);
    // What the best one shares is said in words, and a trait with several keys in common says how many.
    const [best] = alternatives;
    if (best === undefined) throw new Error('no alternative');
    await expect(cards(list).first()).toContainText(sharedLine(best.shared));
    await expect(cards(list).first()).toContainText(`×${String(best.shared.length)} in common`);
  });

  test('opens the rest of a long list with a button that keeps the focus, and closes it again', async ({
    page,
    request,
  }) => {
    const { traits, index } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => {
        const found = index.alternativesOf(each.id)?.length ?? 0;
        return found > PREVIEW && found <= LISTED_AT_MOST;
      },
      'with more alternatives than the first cards, and not more than the page lists',
    );
    const total = listsOf(index, focus).alternatives.length;
    await openTrait(page, focus);

    const list = listing(page, 'Alternatives');
    await expect(cards(list)).toHaveCount(PREVIEW);
    const more = showMore(list);
    await expect(more).toHaveText(`Show all ${String(total)}`);
    await expect(more).toHaveAccessibleName(`Show all ${String(total)} — Alternatives`);
    await expect(more).toHaveAttribute('aria-expanded', 'false');

    // By the keyboard, as a person who cannot point does it: the button does not move out from under the focus.
    await more.focus();
    await page.keyboard.press('Enter');

    await expect(cards(list)).toHaveCount(total);
    await expect(more).toBeFocused();
    await expect(more).toHaveText('Show fewer');
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    // The button comes before the cards it opens, so the tab key goes on into them.
    await expect(more).toHaveAttribute('aria-controls', (await list.getByRole('list').getAttribute('id')) ?? '');

    await page.keyboard.press('Enter');

    await expect(cards(list)).toHaveCount(PREVIEW);
    await expect(more).toBeFocused();
    await expect(more).toHaveText(`Show all ${String(total)}`);
  });

  test('cuts a very long list at 200 and says so, and the artifact filter is the way to shorten it', async ({
    page,
    request,
  }) => {
    const { traits, index } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => (index.sameTriggerOf(each.id)?.entries.length ?? 0) > LISTED_AT_MOST,
      'that more than 200 traits share a trigger with',
    );
    const total = listsOf(index, focus).sameTrigger.entries.length;
    await openTrait(page, focus);

    const list = listing(page, 'Same trigger');
    await expect(list.getByRole('heading', { level: 2 })).toContainText(plural(total));
    await expect(cards(list)).toHaveCount(PREVIEW);
    await expect(list.getByText(/^Showing the first/u)).toHaveCount(0);
    await expect(showMore(list)).toHaveText(`Show the first ${String(LISTED_AT_MOST)}`);

    await showMore(list).click();

    await expect(cards(list)).toHaveCount(LISTED_AT_MOST);
    await expect(list.getByText(/^Showing the first/u)).toHaveText(
      `Showing the first ${String(LISTED_AT_MOST)} of ${String(total)}. The artifact filter above narrows the list.`,
    );
    await expect(showMore(list)).toHaveText('Show fewer');

    await showMore(list).click();
    await expect(cards(list)).toHaveCount(PREVIEW);
    await expect(list.getByText(/^Showing the first/u)).toHaveCount(0);
  });

  test('Same trigger names the events the focus waits for, and which of them each trait waits for too', async ({
    page,
    request,
  }) => {
    const { traits, index } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => {
        const found = index.sameTriggerOf(each.id);
        return found !== undefined && found.triggers.length >= 2 && (found.entries[0]?.shared.length ?? 0) >= 2;
      },
      'that waits for two events, and a trait that waits for both',
    );
    const { sameTrigger } = listsOf(index, focus);
    await openTrait(page, focus);

    const list = listing(page, 'Same trigger');
    await expect(list).toContainText(`Traits that also react to ${sameTrigger.triggers.map(labelOf).join(', ')}`);
    await expect(cards(list)).toHaveCount(Math.min(PREVIEW, sameTrigger.entries.length));
    // The best come first, each with the events it shares, and a trait that shares more than one says how many.
    for (const [at, match] of sameTrigger.entries.slice(0, PREVIEW).entries()) {
      const card = cards(list).nth(at);
      await expect(card.getByRole('link', { name: /^Re-centre on / })).toHaveAccessibleName(
        `Re-centre on ${match.trait.name}`,
      );
      await expect(card).toContainText(`Also reacts to ${match.shared.map(labelOf).join(', ')}`);
      if (match.shared.length > 1) await expect(card).toContainText(`×${String(match.shared.length)} in common`);
    }
  });

  test('Same trigger says that a trait which waits for no event has none to share', async ({ page, request }) => {
    const { traits, index } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => index.sameTriggerOf(each.id)?.triggers.length === 0,
      'that waits for no event',
    );
    await openTrait(page, focus);

    const list = listing(page, 'Same trigger');
    await expect(list.getByRole('heading', { level: 2 })).toContainText(plural(0));
    await expect(list).toContainText(`${focus.name} reacts to no event, so no trait is listed with it.`);
    await expect(cards(list)).toHaveCount(0);
    await expect(showMore(list)).toHaveCount(0);
  });

  test('Same family puts the mastery of the family first, and counts what core counts', async ({ page, request }) => {
    const { traits, index } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => {
        const found = index.sameFamilyOf(each.id);
        return (
          found !== undefined && !found.grouping && found.entries[0]?.kind === 'mastery' && found.entries.length >= 3
        );
      },
      'in a family with its mastery and other traits',
    );
    const { sameFamily } = listsOf(index, focus);
    await openTrait(page, focus);

    const list = listing(page, 'Same family');
    await expect(list.getByRole('heading', { level: 2 })).toContainText(plural(sameFamily.entries.length));
    await expect(list).toContainText(`Other ${sameFamily.family} traits, the mastery first`);
    await expect(cards(list)).toHaveCount(Math.min(PREVIEW, sameFamily.entries.length));
    await expect(cards(list).first()).toContainText('Mastery trait');
    await expect(
      cards(list)
        .first()
        .getByRole('link', { name: /^Re-centre on / }),
    ).toHaveAccessibleName(`Re-centre on ${sameFamily.entries[0]?.name ?? ''}`);
  });

  test('Same family does not list a grouping of the sheet as if it were a family, and says why (PLAN D36)', async ({
    page,
    request,
  }) => {
    const { traits, index } = await dataset(request);
    const focus = firstUnique(traits, (each) => index.sameFamilyOf(each.id)?.grouping === true, 'in a grouping');
    const { sameFamily } = listsOf(index, focus);
    await openTrait(page, focus);

    const list = listing(page, 'Same family');
    await expect(list.getByRole('heading', { level: 2, name: 'Same family' })).toBeVisible();
    await expect(list).toContainText(`${sameFamily.family} is a grouping in the compendium, not a family`);
    await expect(list).toContainText('No mastery trait is named for it, so its traits are not listed together.');
    await expect(cards(list)).toHaveCount(0);
    await expect(showMore(list)).toHaveCount(0);
  });

  test('Same family says that a trait is alone in its family, where it is', async ({ page, request }) => {
    const { traits, index } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => {
        const found = index.sameFamilyOf(each.id);
        return found !== undefined && !found.grouping && found.entries.length === 0;
      },
      'alone in its family',
    );
    await openTrait(page, focus);

    await expect(listing(page, 'Same family')).toContainText(
      `No other trait of the ${listsOf(index, focus).sameFamily.family} family in the compendium.`,
    );
  });

  test('keeps only the traits with a material once the artifact filter is on, in every list', async ({
    page,
    request,
  }) => {
    const { traits, index } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => {
        const all = listsOf(index, each);
        const kept = listsOf(index, each, true);
        return (
          kept.alternatives.length > 0 &&
          kept.alternatives.length < all.alternatives.length &&
          kept.sameTrigger.entries.length > 0 &&
          kept.sameTrigger.entries.length < all.sameTrigger.entries.length
        );
      },
      'whose alternatives and same trigger both lose a trait without a material',
    );
    const kept = listsOf(index, focus, true);
    await openTrait(page, focus, '?mat=yes');

    await expect(listing(page, 'Alternatives').getByRole('heading', { level: 2 })).toContainText(
      plural(kept.alternatives.length),
    );
    await expect(listing(page, 'Same trigger').getByRole('heading', { level: 2 })).toContainText(
      plural(kept.sameTrigger.entries.length),
    );
    await expect(listing(page, 'Alternatives').getByText('no material', { exact: true })).toHaveCount(0);
    await expect(listing(page, 'Same trigger').getByText('no material', { exact: true })).toHaveCount(0);
  });

  test('starts every trait with its lists shut, and a card re-centres the page like the lanes do', async ({
    page,
    request,
  }) => {
    const { traits, index } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => {
        const [best] = index.alternativesOf(each.id) ?? [];
        return (
          (index.alternativesOf(each.id)?.length ?? 0) > PREVIEW &&
          (best === undefined ? 0 : (index.alternativesOf(best.trait.id)?.length ?? 0)) > PREVIEW
        );
      },
      'with more alternatives than the first cards, the best of which has as many',
    );
    const [first] = listsOf(index, focus).alternatives;
    if (first === undefined) throw new Error('no alternative');
    const total = listsOf(index, first.trait).alternatives.length;
    await openTrait(page, focus);
    const list = listing(page, 'Alternatives');
    await showMore(list).click();
    await expect(showMore(list)).toHaveText('Show fewer');

    await cards(list)
      .first()
      .getByRole('link', { name: /^Re-centre on / })
      .click();

    await expect.poll(() => pathOf(page)).toBe(`/synergy/${first.trait.id}`);
    await expect(synergyHeading(page)).toBeFocused();
    // Nothing the last trait had opened stays open for this one: its list is shut, with the button to open it.
    await expect(cards(list)).toHaveCount(PREVIEW);
    await expect(showMore(list)).toHaveText(`Show all ${String(total)}`);
    await expect(showMore(list)).toHaveAttribute('aria-expanded', 'false');
  });

  test('adds the trait of a card to the party like any other card of the page', async ({ page, request }) => {
    const { traits, plain, index } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => (index.sameFamilyOf(each.id)?.entries.slice(0, PREVIEW) ?? []).some((trait) => plain.has(trait.id)),
      'with a plain trait among the first of its family',
    );
    const neighbour = listsOf(index, focus)
      .sameFamily.entries.slice(0, PREVIEW)
      .find((trait) => plain.has(trait.id));
    if (neighbour === undefined) throw new Error('no plain trait in the family');
    await openTrait(page, focus);
    const card = cardOf(listing(page, 'Same family'), neighbour.name);

    await addOf(card).click();

    await expect(card).toContainText('In party: Creature 1 · Innate');
    await expect.poll(() => paramOf(page, 'party')).toContain(neighbour.id);
  });
});

test.describe('the party, from the page of a trait', () => {
  /** A trait that a card of the page shows and that any slot of a creature takes. */
  async function plainNeighbour(request: Parameters<typeof publishedDataset>[0]) {
    const { traits, plain, relationsOf } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => drawn(relationsOf(each).enabledBy).some(({ trait }) => plain.has(trait.id)),
      'that a plain trait enables',
    );
    const neighbour = drawn(relationsOf(focus).enabledBy).find(({ trait }) => plain.has(trait.id));
    if (neighbour === undefined) throw new Error('no plain trait beside the focus');
    return { focus, neighbour: neighbour.trait, traits };
  }

  test('adds the trait of a card to the target slot, says where it is, and keeps the party for the other pages', async ({
    page,
    request,
  }) => {
    const { focus, neighbour } = await plainNeighbour(request);
    await openTrait(page, focus);
    const card = cardOf(side(page, 'Enabled by'), neighbour.name);

    await addOf(card).click();

    await expect(card).toContainText('In party: Creature 1 · Innate');
    await expect.poll(() => paramOf(page, 'party')).toContain(neighbour.id);
    await expect(synergyAnnouncement(page)).toHaveText(`Added ${neighbour.name} to Creature 1 · Innate.`);
    // The next trait goes to the next slot: the button says so.
    await expect(addOf(card)).toHaveAccessibleName(`Add to Creature 1 · Fused — ${neighbour.name}`);

    // The party is the session's: Explore has it, and it can be undone there.
    await placeLink(page, 'Explore').click();
    await expect.poll(() => pathOf(page)).toBe('/');
    await showParty(page);
    await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(
      `Target slot: Creature 1 · Innate, ${neighbour.name}`,
    );
    await expect(toolbarButton(page, 'Undo')).not.toHaveAttribute('aria-disabled', 'true');
  });

  test('takes the trait in focus too, and marks it as in the party', async ({ page, request }) => {
    const { traits } = await dataset(request);
    const focus = plainTraits(traits)[0];
    if (focus === undefined) throw new Error('the dataset has no plain trait');
    await openTrait(page, focus);

    await addOf(focusCard(page)).click();

    await expect(focusCard(page)).toContainText('In party: Creature 1 · Innate');
    await expect.poll(() => paramOf(page, 'party')).toContain(focus.id);
  });

  test('knows a trait that is in the party already, when the page is opened with it', async ({ page, request }) => {
    const { datasetVersion, traits } = await dataset(request);
    const focus = plainTraits(traits)[0];
    if (focus === undefined) throw new Error('the dataset has no plain trait');

    await openTrait(page, focus, `?party=${datasetVersion},${focus.id}`);

    await expect(focusCard(page)).toContainText('In party: Creature 1 · Innate');
  });

  test('offers the choice of slot for a trait the target slot refuses, as Explore does', async ({ page, request }) => {
    const { traits, hasUniqueName, relationsOf } = await dataset(request);
    const asksArtifact = (trait: Trait): boolean => trait.kind === 'mastery' && hasUniqueName(trait);
    const focus = firstUnique(
      traits,
      (each) => drawn(relationsOf(each).enabledBy).some(({ trait }) => asksArtifact(trait)),
      'that a mastery trait enables',
    );
    const mastery = drawn(relationsOf(focus).enabledBy).find(({ trait }) => asksArtifact(trait));
    if (mastery === undefined) throw new Error('no mastery beside the focus');
    await openTrait(page, focus);
    const card = cardOf(side(page, 'Enabled by'), mastery.trait.name);

    // The target slot (Innate) refuses it, and the card says why.
    await expect(card.getByText(/Mastery traits can only go in the Artifact slot/u)).toBeVisible();
    await addOf(card).click();

    await expect(slotChooser(page)).toBeVisible();
    await slotChoice(page, 'Add to Artifact (empty)').click();
    await expect(slotChooser(page)).toBeHidden();
    await expect(card).toContainText('In party: Creature 1 · Artifact');
    await expect(synergyAnnouncement(page)).toHaveText(`Added ${mastery.trait.name} to Creature 1 · Artifact.`);
  });

  test('is the party of Explore: a trait added there is marked here', async ({ page, request }) => {
    const { focus, neighbour, traits } = await plainNeighbour(request);
    const added = plainTraits(traits).find(({ id }) => id === neighbour.id);
    if (added === undefined) throw new Error('the neighbour is not plain');
    await openExplore(page);
    await addToParty(page, added);
    await expect.poll(() => paramOf(page, 'party')).toContain(added.id);

    await page.goto(`./synergy/${focus.id}`);

    await expect(cardOf(side(page, 'Enabled by'), added.name)).toContainText('In party: Creature 1 · Innate');
  });
});

test.describe('accessibility of the page of a trait', () => {
  test('has no WCAG 2.2 AA violations with the lanes, a folded and an open group of random sources, the filter and a party', async ({
    page,
    request,
  }) => {
    const { traits, datasetVersion, relationsOf } = await dataset(request);
    const focus = firstUnique(
      traits,
      (each) => relationsOf(each).enabledBy.single.some(({ entries }) => entries.some(isRandom)),
      'that relies on a debuff some trait applies at random',
    );
    const [mine] = plainTraits(traits);
    if (mine === undefined) throw new Error('the dataset has no plain trait');
    await openTrait(page, focus, `?mat=yes&party=${datasetVersion},${mine.id}`);

    expect(await axeViolations(page)).toEqual([]);

    await randomToggle(side(page, 'Enabled by')).first().click();
    expect(await axeViolations(page)).toEqual([]);
  });

  test('has none with the three lists under the sides, one of them opened to 200 cards, and with a grouping that is no family', async ({
    page,
    request,
  }) => {
    const { traits, index } = await dataset(request);
    const long = firstUnique(
      traits,
      (each) => (index.sameTriggerOf(each.id)?.entries.length ?? 0) > LISTED_AT_MOST,
      'that more than 200 traits share a trigger with',
    );
    await openTrait(page, long);
    expect(await axeViolations(page)).toEqual([]);

    await showMore(listing(page, 'Same trigger')).click();
    await expect(cards(listing(page, 'Same trigger'))).toHaveCount(LISTED_AT_MOST);
    expect(await axeViolations(page)).toEqual([]);

    const grouped = firstUnique(traits, (each) => index.sameFamilyOf(each.id)?.grouping === true, 'in a grouping');
    await openTrait(page, grouped);
    expect(await axeViolations(page)).toEqual([]);
  });

  test('has none with the choice of slot open, and with a trail of two traits', async ({ page, request }) => {
    const { traits, hasUniqueName, relationsOf } = await dataset(request);
    const asksArtifact = (trait: Trait): boolean => trait.kind === 'mastery' && hasUniqueName(trait);
    const focus = firstUnique(
      traits,
      (each) => drawn(relationsOf(each).enabledBy).some(({ trait }) => asksArtifact(trait)),
      'that a mastery trait enables',
    );
    const mastery = drawn(relationsOf(focus).enabledBy).find(({ trait }) => asksArtifact(trait));
    if (mastery === undefined) throw new Error('no mastery beside the focus');
    await openTrait(page, focus);
    await addOf(cardOf(side(page, 'Enabled by'), mastery.trait.name)).click();
    await expect(slotChooser(page)).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    await page.keyboard.press('Escape');

    await cardOf(side(page, 'Enabled by'), mastery.trait.name).getByRole('link').click();
    await expect(synergyHeading(page)).toHaveText(mastery.trait.name);
    await expect(trail(page)).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});
