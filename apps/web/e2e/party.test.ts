import { expect, test } from '@playwright/test';
import { taxonomy, type Trait } from '@atlas/core';
import { axeViolations } from './support/axe';
import { publishedDataset } from './support/dataset';
import { openExplore, results, searchBox } from './support/explore-page';
import {
  addButton,
  addElsewhereButton,
  addToParty,
  clearButton,
  findRow,
  partyAnnouncement,
  partyPanel,
  plainTraits,
  showExplore,
  showParty,
  slot,
  slotChoice,
  slotChooser,
  toolbarButton,
  withUniqueName,
} from './support/party-page';

// The party planner (SPEC §8.2) through the page: acceptance criteria 5 and 7, undo and redo, and the party in the address.
// The traits come from the dataset the build published, so that a data refresh does not break the tests.
// On a narrow screen the party is a tab of its own: a test shows it (`showParty`) before it reads or presses anything in it,
// and `findRow` / `addToParty` bring the search forward again. On a wide screen both are in sight and these do nothing.

const isCreature = (trait: Trait): boolean => trait.kind === 'creature';

test.describe('the party planner', () => {
  test('fills the target slot from a result, moves the target on, and says so', async ({ page, request }) => {
    const [first, second] = plainTraits((await publishedDataset(request)).traits);
    if (first === undefined || second === undefined) throw new Error('the dataset has no two plain traits');
    await openExplore(page);
    await showParty(page);

    await expect(slot(page, 'Creature 1 · Innate')).toHaveAttribute('aria-pressed', 'true');
    await addToParty(page, first);
    await showParty(page);

    await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(
      `Target slot: Creature 1 · Innate, ${first.name}`,
    );
    await expect(slot(page, 'Creature 1 · Fused')).toHaveAttribute('aria-pressed', 'true');
    await expect(slot(page, 'Creature 1 · Innate')).toHaveAttribute('aria-pressed', 'false');
    await expect(partyPanel(page).getByText('1/18 slots')).toBeVisible();
    await expect(partyAnnouncement(page)).toHaveText(`Added ${first.name} to Creature 1 · Innate.`);

    await addToParty(page, second);
    await showParty(page);

    await expect(slot(page, 'Creature 1 · Fused')).toHaveAccessibleName(
      `Target slot: Creature 1 · Fused, ${second.name}`,
    );
    await expect(slot(page, 'Creature 1 · Artifact')).toHaveAttribute('aria-pressed', 'true');
    await expect(partyPanel(page).getByText('2/18 slots')).toBeVisible();
  });

  test('puts the next trait in the slot that was chosen as the target', async ({ page, request }) => {
    const [first] = plainTraits((await publishedDataset(request)).traits);
    if (first === undefined) throw new Error('the dataset has no plain trait');
    await openExplore(page);
    await showParty(page);

    await slot(page, 'Creature 3 · Fused').click();
    await expect(slot(page, 'Creature 3 · Fused')).toHaveAttribute('aria-pressed', 'true');
    await addToParty(page, first);
    await showParty(page);

    await expect(slot(page, 'Creature 3 · Fused')).toHaveAccessibleName(
      `Target slot: Creature 3 · Fused, ${first.name}`,
    );
    await expect(slot(page, 'Creature 3 · Artifact')).toHaveAttribute('aria-pressed', 'true');
  });

  test('shows where a trait is in the party next to its row', async ({ page, request }) => {
    const [first] = plainTraits((await publishedDataset(request)).traits);
    if (first === undefined) throw new Error('the dataset has no plain trait');
    await openExplore(page);

    const row = await findRow(page, first);
    await expect(row.getByText(/^In party:/)).toHaveCount(0);
    await addButton(row).click();

    await expect(row.getByText('In party: Creature 1 · Innate')).toBeVisible();
  });

  test.describe('a trait that cannot go in the target slot (acceptance criterion 5)', () => {
    // The target slot refuses it, and the card says why; the button opens the slots of the creature that do take it.
    test('is not added to the Artifact slot without a material: the card says why, and offers the other slots', async ({
      page,
      request,
    }) => {
      const { traits } = await publishedDataset(request);
      const noMaterial = withUniqueName(traits).find((trait) => isCreature(trait) && trait.material === null);
      if (noMaterial === undefined) throw new Error('the dataset has no creature trait without a material');
      await openExplore(page);
      await showParty(page);
      await slot(page, 'Creature 1 · Artifact').click();

      const row = await findRow(page, noMaterial);
      const add = addElsewhereButton(row);

      const reason = 'This trait has no material, so it cannot go in the Artifact slot.';
      await expect(row.getByText(reason)).toBeVisible();
      await expect(add).toHaveAccessibleDescription(reason);
      await expect(add).not.toHaveAttribute('aria-disabled', 'true');
      await expect(add).toHaveAttribute('aria-haspopup', 'dialog');
      await expect(add).toHaveText('Add to…');

      await add.click();

      // Only the slots that take the trait are offered, those of the creature the target is on; the party is unchanged so far.
      await expect(slotChooser(page)).toBeVisible();
      await expect(slotChooser(page).getByRole('heading', { level: 2 })).toHaveText(
        `Add ${noMaterial.name} to Creature 1`,
      );
      await expect(slotChooser(page).getByText(reason)).toBeVisible();
      await expect(slotChooser(page).getByRole('button')).toHaveText([
        'Add to Innate (empty)',
        'Add to Fused (empty)',
        'Cancel',
      ]);

      await slotChoice(page, 'Add to Fused (empty)').click();

      await expect(slotChooser(page)).toBeHidden();
      await expect(add).toBeFocused();
      // The player is told with the party out of sight, too.
      await expect(partyAnnouncement(page)).toHaveText(`Added ${noMaterial.name} to Creature 1 · Fused.`);
      await expect(row.getByText('In party: Creature 1 · Fused')).toBeVisible();
      await showParty(page);

      await expect(slot(page, 'Creature 1 · Fused')).toHaveAccessibleName(
        `Target slot: Creature 1 · Fused, ${noMaterial.name}`,
      );
      // The player was filling the Artifact slot, and still is.
      await expect(slot(page, 'Creature 1 · Artifact')).toHaveAttribute('aria-pressed', 'true');
      await expect(partyPanel(page).getByText('1/18 slots')).toBeVisible();
    });

    test('names what it would replace, says so when it does, and puts it back on Undo', async ({ page, request }) => {
      const { traits } = await publishedDataset(request);
      const mastery = withUniqueName(traits).find((trait) => trait.kind === 'mastery' && trait.material !== null);
      const [plain] = plainTraits(traits);
      if (mastery === undefined || plain === undefined) throw new Error('the dataset has no traits for this');
      await openExplore(page);
      await showParty(page);
      await slot(page, 'Creature 1 · Artifact').click();
      await addToParty(page, plain);
      await showParty(page);
      await slot(page, 'Creature 1 · Innate').click();

      const row = await findRow(page, mastery);
      await addElsewhereButton(row).click();

      // A mastery fits the Artifact slot only, and that one holds a trait.
      await expect(slotChooser(page).getByRole('button')).toHaveText([`Replace ${plain.name} in Artifact`, 'Cancel']);
      await slotChoice(page, `Replace ${plain.name} in Artifact`).click();

      await expect(partyAnnouncement(page)).toHaveText(
        `Added ${mastery.name} to Creature 1 · Artifact, replacing ${plain.name}.`,
      );
      await showParty(page);
      await expect(slot(page, 'Creature 1 · Artifact')).toHaveAccessibleName(
        `Target slot: Creature 1 · Artifact, ${mastery.name}`,
      );
      // The target is the slot the player chose, not the one the trait went to.
      await expect(slot(page, 'Creature 1 · Innate')).toHaveAttribute('aria-pressed', 'true');

      // Asked again, the slot says the trait is there already, and choosing it changes nothing.
      const again = await findRow(page, mastery);
      await addElsewhereButton(again).click();
      await expect(slotChooser(page).getByRole('button')).toHaveText(['Already in Artifact', 'Cancel']);
      await slotChoice(page, 'Already in Artifact').click();
      await expect(slotChooser(page)).toBeHidden();
      await showParty(page);
      await expect(partyPanel(page).getByText('1/18 slots')).toBeVisible();

      await toolbarButton(page, 'Undo').click();

      await expect(slot(page, 'Creature 1 · Artifact')).toHaveAccessibleName(
        `Target slot: Creature 1 · Artifact, ${plain.name}`,
      );
    });

    test('is let go of with Esc or Cancel, which change nothing and give the focus back', async ({ page, request }) => {
      const { traits } = await publishedDataset(request);
      const noMaterial = withUniqueName(traits).find((trait) => isCreature(trait) && trait.material === null);
      if (noMaterial === undefined) throw new Error('the dataset has no creature trait without a material');
      await openExplore(page);
      await showParty(page);
      await slot(page, 'Creature 1 · Artifact').click();
      const row = await findRow(page, noMaterial);
      const add = addElsewhereButton(row);

      await add.focus();
      await page.keyboard.press('Enter');
      await expect(slotChooser(page)).toBeVisible();
      await page.keyboard.press('Escape');

      await expect(slotChooser(page)).toBeHidden();
      await expect(add).toBeFocused();

      await add.click();
      await slotChooser(page).getByRole('button', { name: 'Cancel' }).click();

      await expect(slotChooser(page)).toBeHidden();
      await expect(add).toBeFocused();
      await showParty(page);
      await expect(partyPanel(page).getByText('0/18 slots')).toBeVisible();
    });

    test('is added to the Innate slot all the same: the material matters only to an artifact', async ({
      page,
      request,
    }) => {
      const { traits } = await publishedDataset(request);
      const noMaterial = withUniqueName(traits).find((trait) => isCreature(trait) && trait.material === null);
      if (noMaterial === undefined) throw new Error('the dataset has no creature trait without a material');
      await openExplore(page);

      const row = await findRow(page, noMaterial);

      await expect(addButton(row)).not.toHaveAttribute('aria-disabled', 'true');
      await addButton(row).click();
      await showParty(page);
      await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(
        `Target slot: Creature 1 · Innate, ${noMaterial.name}`,
      );
    });

    test('says a mastery trait can only go in the Artifact slot', async ({ page, request }) => {
      const { traits } = await publishedDataset(request);
      const mastery = withUniqueName(traits).find((trait) => trait.kind === 'mastery' && trait.material !== null);
      if (mastery === undefined) throw new Error('the dataset has no mastery trait with a material');
      await openExplore(page);

      const row = await findRow(page, mastery);
      await expect(row.getByText('Mastery traits can only go in the Artifact slot.')).toBeVisible();

      await showParty(page);
      await slot(page, 'Creature 1 · Artifact').click();
      await showExplore(page);
      await expect(addButton(row)).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  test('flags two copies of a trait that does not stack (acceptance criterion 7)', async ({ page, request }) => {
    const { traits } = await publishedDataset(request);
    const noStack = withUniqueName(traits).find(
      (trait) => isCreature(trait) && !trait.stacks && trait.material !== null,
    );
    if (noStack === undefined) throw new Error('the dataset has no creature trait that does not stack');
    await openExplore(page);

    await addToParty(page, noStack);
    await showParty(page);
    await expect(partyPanel(page).getByText('Duplicate non-stacking traits')).toHaveCount(0);

    await addToParty(page, noStack);
    await showParty(page);

    await expect(partyPanel(page).getByText('Duplicate non-stacking traits')).toBeVisible();
    await expect(
      partyPanel(page).getByText(
        `${noStack.name} (Creature 1 · Innate, Creature 1 · Fused) — only one copy has an effect`,
      ),
    ).toBeVisible();
  });

  test('shows what the party applies and relies on, and when a dependency is covered', async ({ page, request }) => {
    const { traits } = await publishedDataset(request);
    const unique = withUniqueName(traits).filter(isCreature);
    const hasRole = (trait: Trait, role: 'applies' | 'uses') =>
      trait.keywords.some((hit) => hit.key === 'vulnerable' && hit.role === role);
    const user = unique.find(
      (trait) => hasRole(trait, 'uses') && !hasRole(trait, 'applies') && trait.material !== null,
    );
    const applier = unique.find((trait) => hasRole(trait, 'applies') && trait.material !== null);
    if (user === undefined || applier === undefined) throw new Error('the dataset has no trait for this');
    const label = taxonomy.get('vulnerable')?.label ?? 'Vulnerable';
    await openExplore(page);

    await addToParty(page, user);
    await showParty(page);

    const dependency = (status: 'missing' | 'covered') =>
      partyPanel(page).getByRole('button', { name: `${label} — ${status} — show traits that apply it` });
    await expect(dependency('missing')).toBeVisible();
    await expect(dependency('covered')).toHaveCount(0);

    await addToParty(page, applier);
    await showParty(page);

    await expect(dependency('covered')).toBeVisible();
    await expect(dependency('missing')).toHaveCount(0);
    await expect(
      partyPanel(page)
        .getByRole('listitem')
        .filter({ hasText: new RegExp(`^${label}$`) }),
    ).toHaveCount(1);
  });

  test('looks for the traits that apply a missing dependency when it is pressed', async ({ page, request }) => {
    const { traits } = await publishedDataset(request);
    const user = withUniqueName(traits).find(
      (trait) =>
        isCreature(trait) &&
        trait.material !== null &&
        trait.keywords.some((hit) => hit.key === 'vulnerable' && hit.role === 'uses') &&
        !trait.keywords.some((hit) => hit.key === 'vulnerable' && hit.role === 'applies'),
    );
    if (user === undefined) throw new Error('the dataset has no trait that relies on Vulnerable');
    const label = taxonomy.get('vulnerable')?.label ?? 'Vulnerable';
    await openExplore(page);
    await addToParty(page, user);
    await showParty(page);

    await partyPanel(page)
      .getByRole('button', { name: `${label} — missing — show traits that apply it` })
      .click();

    await expect.poll(() => new URL(page.url()).searchParams.get('kw')).toBe('a:vulnerable');
    // The traits that apply it are on the search, which a narrow screen has to bring forward: the party was on screen.
    await expect(results(page)).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Results' })).toBeFocused();
  });

  test('clears a slot, and the whole party', async ({ page, request }) => {
    const [first, second] = plainTraits((await publishedDataset(request)).traits);
    if (first === undefined || second === undefined) throw new Error('the dataset has no two plain traits');
    await openExplore(page);
    await addToParty(page, first);
    await addToParty(page, second);
    await showParty(page);

    await clearButton(page, 'Creature 1 · Innate').click();

    await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(/, empty$/);
    await expect(slot(page, 'Creature 1 · Innate')).toHaveAttribute('aria-pressed', 'true');
    await expect(slot(page, 'Creature 1 · Innate')).toBeFocused();
    await expect(partyPanel(page).getByText('1/18 slots')).toBeVisible();
    await expect(partyAnnouncement(page)).toHaveText('Cleared Creature 1 · Innate.');

    await toolbarButton(page, 'Clear party').click();

    await expect(partyPanel(page).getByText('0/18 slots')).toBeVisible();
    await expect(slot(page, 'Creature 1 · Fused')).toHaveAccessibleName(/, empty$/);
    await expect(slot(page, 'Creature 1 · Innate')).toHaveAttribute('aria-pressed', 'true');
    await expect(partyAnnouncement(page)).toHaveText('Cleared the party.');
  });

  test.describe('undo and redo', () => {
    test('take back and bring back an edit with the buttons', async ({ page, request }) => {
      const [first, second] = plainTraits((await publishedDataset(request)).traits);
      if (first === undefined || second === undefined) throw new Error('the dataset has no two plain traits');
      await openExplore(page);
      await showParty(page);
      await expect(toolbarButton(page, 'Undo')).toHaveAttribute('aria-disabled', 'true');
      await addToParty(page, first);
      await addToParty(page, second);
      await showParty(page);
      await expect(toolbarButton(page, 'Undo')).not.toHaveAttribute('aria-disabled', 'true');

      await toolbarButton(page, 'Undo').click();

      await expect(slot(page, 'Creature 1 · Fused')).toHaveAccessibleName(/, empty$/);
      await expect(slot(page, 'Creature 1 · Fused')).toHaveAttribute('aria-pressed', 'true');
      await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(
        `Target slot: Creature 1 · Innate, ${first.name}`,
      );
      await expect(partyAnnouncement(page)).toHaveText(`Undid: added ${second.name} to Creature 1 · Fused.`);
      await expect(toolbarButton(page, 'Redo')).not.toHaveAttribute('aria-disabled', 'true');

      await toolbarButton(page, 'Redo').click();

      await expect(slot(page, 'Creature 1 · Fused')).toHaveAccessibleName(
        `Target slot: Creature 1 · Fused, ${second.name}`,
      );
      await expect(toolbarButton(page, 'Redo')).toHaveAttribute('aria-disabled', 'true');
    });

    test('are on Ctrl+Z and Ctrl+Shift+Z, and leave a text field to its own undo', async ({ page, request }) => {
      const [first] = plainTraits((await publishedDataset(request)).traits);
      if (first === undefined) throw new Error('the dataset has no plain trait');
      await openExplore(page);
      await addToParty(page, first);

      // In the query box the keys are the box's own.
      await searchBox(page).focus();
      await page.keyboard.press('Control+z');
      await showParty(page);
      await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(
        `Target slot: Creature 1 · Innate, ${first.name}`,
      );

      // Anywhere else they are the party's.
      await slot(page, 'Creature 1 · Fused').focus();
      await page.keyboard.press('Control+z');
      await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(/, empty$/);

      await page.keyboard.press('Control+Shift+Z');
      await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(
        `Target slot: Creature 1 · Innate, ${first.name}`,
      );
    });

    test('drop what could be redone when another trait is added', async ({ page, request }) => {
      const [first, second] = plainTraits((await publishedDataset(request)).traits);
      if (first === undefined || second === undefined) throw new Error('the dataset has no two plain traits');
      await openExplore(page);
      await addToParty(page, first);
      await showParty(page);
      await toolbarButton(page, 'Undo').click();
      await expect(toolbarButton(page, 'Redo')).not.toHaveAttribute('aria-disabled', 'true');

      await addToParty(page, second);
      await showParty(page);

      await expect(toolbarButton(page, 'Redo')).toHaveAttribute('aria-disabled', 'true');
    });
  });

  test.describe('the party in the address (SPEC §7)', () => {
    test('is written as the version and the ids, with the target when it is not the next empty slot', async ({
      page,
      request,
    }) => {
      const dataset = await publishedDataset(request);
      const [first] = plainTraits(dataset.traits);
      if (first === undefined) throw new Error('the dataset has no plain trait');
      await openExplore(page);

      await addToParty(page, first);
      await expect
        .poll(() => new URL(page.url()).searchParams.get('party'))
        .toBe(`${dataset.datasetVersion},${first.id}`);
      expect(new URL(page.url()).searchParams.has('target')).toBe(false);

      await showParty(page);
      await slot(page, 'Creature 3 · Fused').click();
      await expect.poll(() => new URL(page.url()).searchParams.get('target')).toBe('3-fused');
    });

    test('brings the party and the target back on reload', async ({ page, request }) => {
      const [first, second] = plainTraits((await publishedDataset(request)).traits);
      if (first === undefined || second === undefined) throw new Error('the dataset has no two plain traits');
      await openExplore(page);
      await addToParty(page, first);
      await showParty(page);
      await slot(page, 'Creature 4 · Artifact').click();
      await addToParty(page, second);
      await expect.poll(() => new URL(page.url()).searchParams.get('party')).toContain(second.id);

      await page.reload();
      await showParty(page);
      await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(
        `Target slot: Creature 1 · Innate, ${first.name}`,
      );
      await expect(slot(page, 'Creature 4 · Artifact')).toHaveAccessibleName(
        `Target slot: Creature 4 · Artifact, ${second.name}`,
      );
      await expect(slot(page, 'Creature 5 · Innate')).toHaveAttribute('aria-pressed', 'true');
    });

    test('keeps the search when the party changes, and the party when the search changes', async ({
      page,
      request,
    }) => {
      const [first] = plainTraits((await publishedDataset(request)).traits);
      if (first === undefined) throw new Error('the dataset has no plain trait');
      await openExplore(page);
      await addToParty(page, first);

      await expect.poll(() => new URL(page.url()).searchParams.get('party')).not.toBeNull();
      expect(new URL(page.url()).searchParams.get('q')).toBe(`trait:"${first.name}" family:"${first.family}"`);

      await searchBox(page).fill('weak');
      await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('weak');
      expect(new URL(page.url()).searchParams.get('party')).toContain(first.id);
    });

    test('opens a link with a party whose traits the dataset does not know, and keeps them', async ({
      page,
      request,
    }) => {
      const { datasetVersion } = await publishedDataset(request);
      await page.goto('./?party=1.0,gone--from-the-sheet');
      await showParty(page);
      await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(
        `Target slot: Creature 1 · Innate, gone--from-the-sheet (Not found in v${datasetVersion})`,
      );

      // Choosing another slot writes the address again: the id stays in it, under the version of the dataset now in use.
      await slot(page, 'Creature 3 · Fused').click();

      await expect.poll(() => new URL(page.url()).searchParams.get('target')).toBe('3-fused');
      expect(new URL(page.url()).searchParams.get('party')).toBe(`${datasetVersion},gone--from-the-sheet`);
    });
  });

  test.describe('a trait the dataset does not know (SPEC §5)', () => {
    test('offers a search for the name its id keeps, which finds the trait if it was only moved', async ({
      page,
      request,
    }) => {
      const { traits } = await publishedDataset(request);
      const moved = withUniqueName(traits).find((trait) => /^[A-Za-z ]+$/.test(trait.name) && trait.id.includes('--'));
      if (moved === undefined) throw new Error('the dataset has no trait with a plain name');
      const oldId = `an-old-family--${moved.id.split('--')[1] ?? ''}`;
      await page.goto(`./?party=1.0,${oldId}`);
      await showParty(page);
      await expect(slot(page, 'Creature 1 · Innate')).toBeVisible();

      await partyPanel(page)
        .getByRole('button', { name: `Search for “${moved.name.toLowerCase()}”` })
        .click();

      // The search is on the Explore tab, which a narrow screen brings forward.
      await expect(searchBox(page)).toHaveValue(`trait:"${moved.name.toLowerCase()}"`);
      await expect(
        page.getByRole('region', { name: 'Results' }).getByRole('heading', { level: 3, name: moved.name, exact: true }),
      ).toBeVisible();
      // The party is as it was: the slot still holds the id the link had.
      await showParty(page);
      await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(new RegExp(`, ${oldId} \\(Not found in v`));
    });

    test('has no search to offer for an id that keeps no name', async ({ page }) => {
      await page.goto('./?party=1.0,family--');
      await showParty(page);
      await expect(slot(page, 'Creature 1 · Innate')).toBeVisible();

      await expect(partyPanel(page).getByRole('button', { name: /^Search for / })).toHaveCount(0);
    });
  });

  test.describe('the link (acceptance criterion 6)', () => {
    test('copies the party and the search, and a fresh browser opens the same page', async ({
      page,
      context,
      browser,
      browserName,
      request,
    }) => {
      if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      const [first, second] = plainTraits((await publishedDataset(request)).traits);
      if (first === undefined || second === undefined) throw new Error('the dataset has no two plain traits');
      await openExplore(page);
      await addToParty(page, first);
      await showParty(page);
      await slot(page, 'Creature 4 · Fused').click();
      await addToParty(page, second);
      await searchBox(page).fill('weak OR snared');

      // On a narrow screen the link is copied from the party tab, and a link to it opens on that tab.
      await showParty(page);
      await partyPanel(page).getByRole('button', { name: 'Copy link' }).click();
      await expect(partyPanel(page).getByText('Link copied', { exact: true })).toBeVisible();

      // The copied text is the address, typed text included, even before the address has caught up with it.
      const link =
        browserName === 'chromium'
          ? await page.evaluate(() => navigator.clipboard.readText())
          : await (async () => {
              await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('weak OR snared');
              return page.url();
            })();
      expect(new URL(link).searchParams.get('q')).toBe('weak OR snared');
      expect(new URL(link).searchParams.get('party')).toContain(first.id);

      // A browser that has never seen the app: no storage, no history.
      const fresh = await browser.newContext();
      try {
        const other = await fresh.newPage();
        await other.goto(link);
        await showExplore(other);
        await expect(searchBox(other)).toHaveValue('weak OR snared');
        await showParty(other);
        await expect(slot(other, 'Creature 1 · Innate')).toHaveAccessibleName(
          `Target slot: Creature 1 · Innate, ${first.name}`,
        );
        await expect(slot(other, 'Creature 4 · Fused')).toHaveAccessibleName(
          `Target slot: Creature 4 · Fused, ${second.name}`,
        );
        await expect(partyPanel(other).getByText('2/18 slots')).toBeVisible();
      } finally {
        await fresh.close();
      }
    });

    test('opens as an empty party in a browser that has never seen the app', async ({ browser }) => {
      const fresh = await browser.newContext();
      try {
        const other = await fresh.newPage();
        await other.goto('./');
        await showParty(other);
        await expect(slot(other, 'Creature 1 · Innate')).toHaveAccessibleName(/, empty$/);
        await expect(partyPanel(other).getByText('0/18 slots')).toBeVisible();
      } finally {
        await fresh.close();
      }
    });
  });

  test.describe('the last party (ADR-0005)', () => {
    test('comes back on the next visit to the plain address, and is written into it', async ({ page, request }) => {
      const dataset = await publishedDataset(request);
      const [first] = plainTraits(dataset.traits);
      if (first === undefined) throw new Error('the dataset has no plain trait');
      await openExplore(page);
      await addToParty(page, first);
      await expect.poll(() => new URL(page.url()).searchParams.get('party')).toContain(first.id);

      await page.goto('./');
      await showParty(page);

      await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(
        `Target slot: Creature 1 · Innate, ${first.name}`,
      );
      await expect(slot(page, 'Creature 1 · Fused')).toHaveAttribute('aria-pressed', 'true');
      await expect
        .poll(() => new URL(page.url()).searchParams.get('party'))
        .toBe(`${dataset.datasetVersion},${first.id}`);
    });

    test('is not used when the address has a party of its own', async ({ page, request }) => {
      const [first, second] = plainTraits((await publishedDataset(request)).traits);
      if (first === undefined || second === undefined) throw new Error('the dataset has no two plain traits');
      await openExplore(page);
      await addToParty(page, first);
      await expect.poll(() => new URL(page.url()).searchParams.get('party')).toContain(first.id);

      await page.goto(`./?party=2.0,${second.id}`);
      await showParty(page);

      await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(
        `Target slot: Creature 1 · Innate, ${second.name}`,
      );
    });

    test('is forgotten when the party is cleared', async ({ page, request }) => {
      const [first] = plainTraits((await publishedDataset(request)).traits);
      if (first === undefined) throw new Error('the dataset has no plain trait');
      await openExplore(page);
      await addToParty(page, first);
      await showParty(page);
      await toolbarButton(page, 'Clear party').click();
      await expect(partyPanel(page).getByText('0/18 slots')).toBeVisible();

      await page.goto('./');
      await showParty(page);

      await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(/, empty$/);
    });

    test('is not needed: the planner works when the browser keeps nothing', async ({ page, request }) => {
      const [first] = plainTraits((await publishedDataset(request)).traits);
      if (first === undefined) throw new Error('the dataset has no plain trait');
      await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          get() {
            throw new DOMException('blocked', 'SecurityError');
          },
        });
      });
      await openExplore(page);

      await addToParty(page, first);
      await showParty(page);

      await expect(slot(page, 'Creature 1 · Innate')).toHaveAccessibleName(
        `Target slot: Creature 1 · Innate, ${first.name}`,
      );
      await expect.poll(() => new URL(page.url()).searchParams.get('party')).toContain(first.id);
    });
  });

  test('has no accessibility violations with a party, a refusal and the slot sheet (axe)', async ({
    page,
    request,
  }) => {
    const { traits } = await publishedDataset(request);
    const [first, second] = plainTraits(traits);
    const noMaterial = withUniqueName(traits).find((trait) => isCreature(trait) && trait.material === null);
    if (first === undefined || second === undefined || noMaterial === undefined) {
      throw new Error('the dataset has no traits for this');
    }
    await openExplore(page);
    await addToParty(page, first);
    await addToParty(page, second);
    await addToParty(page, second);
    await showParty(page);
    await slot(page, 'Creature 2 · Artifact').click();
    // The refusal is on the results; on a narrow screen the party is on its tab, so each is checked where it is.
    const refused = await findRow(page, noMaterial);
    await expect(addElsewhereButton(refused)).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);

    // The sheet that offers the other slots, open over the page.
    await addElsewhereButton(refused).click();
    await expect(slotChooser(page)).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(slotChooser(page)).toBeHidden();

    await showParty(page);
    await expect(partyPanel(page).getByText('3/18 slots')).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});
