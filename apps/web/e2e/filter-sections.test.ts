import { expect, test } from '@playwright/test';
import { axeViolations } from './support/axe';
import {
  clearFiltersButton,
  closeFilters,
  facet,
  flag,
  isCompact,
  openExplore,
  openFilters,
  section,
  sectionBody,
  side,
} from './support/explore-page';

// The panel's sections open and close (SPEC §8.1): a shut one hides its filters, says how many are on inside, and keeps
// its state while the page lives, however the window moves the panel between a column and a sheet.

const SECTIONS = ['Class', 'Debuffs', 'Buffs', 'Effects', 'Events', 'Mechanics', 'Flags'] as const;

test.describe('the sections of the filters', () => {
  test('are all open to begin with, each a button that says so and what it controls', async ({ page }) => {
    await openExplore(page);
    await openFilters(page);

    for (const name of SECTIONS) {
      await expect(section(page, name), name).toHaveAttribute('aria-expanded', 'true');
      await expect(section(page, name), name).toHaveAccessibleName(new RegExp(`^${name}$`));
      await expect(await sectionBody(page, name), name).toBeVisible();
    }
  });

  test('shut with a press, which hides their filters, and open again with another', async ({ page }) => {
    await openExplore(page);
    await openFilters(page);
    await facet(page, 'Life').click();

    await section(page, 'Class').click();

    await expect(section(page, 'Class')).toHaveAttribute('aria-expanded', 'false');
    await expect(await sectionBody(page, 'Class')).toBeHidden();
    await expect(facet(page, 'Life')).toBeHidden();
    // The others stay as they were.
    await expect(section(page, 'Debuffs')).toHaveAttribute('aria-expanded', 'true');
    await expect(side(page, 'Vulnerable', 'Applies')).toBeVisible();

    await section(page, 'Class').click();

    await expect(section(page, 'Class')).toHaveAttribute('aria-expanded', 'true');
    await expect(facet(page, 'Life')).toBeVisible();
    await expect(facet(page, 'Life')).toHaveAttribute('aria-pressed', 'true');
  });

  test('say, shut, how many filters are on inside: a keyword’s two sides are two, and the flags count', async ({
    page,
  }) => {
    await openExplore(page);
    await openFilters(page);
    await side(page, 'Vulnerable', 'Applies').click();
    await side(page, 'Vulnerable', 'Relies on').click();
    await flag(page, 'Only “does not stack”').check();

    // Open, the filters say it themselves.
    await expect(section(page, 'Debuffs')).toHaveAccessibleName(/^Debuffs$/);

    await section(page, 'Debuffs').click();
    await section(page, 'Flags').click();
    await section(page, 'Buffs').click();

    await expect(section(page, 'Debuffs')).toHaveAccessibleName(/^Debuffs 2 on$/);
    await expect(section(page, 'Flags')).toHaveAccessibleName(/^Flags 1 on$/);
    await expect(section(page, 'Buffs')).toHaveAccessibleName(/^Buffs$/);
    await expect(section(page, 'Class')).toHaveAccessibleName(/^Class$/);

    // Clear filters works on what is out of sight, and leaves the sections as they were.
    await expect(clearFiltersButton(page)).toHaveAccessibleName('Clear filters (3)');
    await clearFiltersButton(page).click();

    await expect(section(page, 'Debuffs')).toHaveAccessibleName(/^Debuffs$/);
    await expect(section(page, 'Flags')).toHaveAccessibleName(/^Flags$/);
    await expect(section(page, 'Debuffs')).toHaveAttribute('aria-expanded', 'false');
    await expect(section(page, 'Flags')).toHaveAttribute('aria-expanded', 'false');
  });

  test('take a shut section’s filters out of the tab order, and are reached and worked with the keys', async ({
    page,
  }) => {
    await openExplore(page);
    await openFilters(page);
    const debuffs = section(page, 'Debuffs');

    await debuffs.focus();
    await page.keyboard.press('Enter');

    await expect(debuffs).toHaveAttribute('aria-expanded', 'false');
    await expect(debuffs).toBeFocused();
    // The next stop is the next section, not a debuff.
    await page.keyboard.press('Tab');
    await expect(section(page, 'Buffs')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(debuffs).toBeFocused();

    await page.keyboard.press('Space');

    await expect(debuffs).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Tab');
    await expect((await sectionBody(page, 'Debuffs')).locator(':focus')).toHaveCount(1);
  });

  test('stay as they were left when the window moves the panel between a column and a sheet', async ({ page }) => {
    await openExplore(page);
    await openFilters(page);
    await section(page, 'Events').click();
    await section(page, 'Flags').click();
    const expectShut = async (): Promise<void> => {
      await expect(section(page, 'Events')).toHaveAttribute('aria-expanded', 'false');
      await expect(section(page, 'Flags')).toHaveAttribute('aria-expanded', 'false');
      await expect(section(page, 'Class')).toHaveAttribute('aria-expanded', 'true');
    };
    const original = page.viewportSize();
    if (original === null) throw new Error('the project has no viewport');

    await page.setViewportSize(isCompact(page) ? { width: 1200, height: 800 } : { width: 600, height: 800 });
    await expectShut();

    await page.setViewportSize(original);
    await expectShut();
  });

  test('stay as they were left when the sheet is closed and opened again', async ({ page }) => {
    test.skip(!isCompact(page), 'A wide window has no sheet to close.');
    await openExplore(page);
    await openFilters(page);
    await section(page, 'Mechanics').click();

    await closeFilters(page);
    await openFilters(page);

    await expect(section(page, 'Mechanics')).toHaveAttribute('aria-expanded', 'false');
    await expect(await sectionBody(page, 'Mechanics')).toBeHidden();
  });

  test('have no WCAG 2.2 AA violations with some shut and a filter on in one of them', async ({ page }) => {
    await openExplore(page);
    await openFilters(page);
    await facet(page, 'Life').click();
    await section(page, 'Class').click();
    await section(page, 'Mechanics').click();

    expect(await axeViolations(page)).toEqual([]);
  });
});
