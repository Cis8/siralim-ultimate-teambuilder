import { expect, test, type Page } from '@playwright/test';
import { axeViolations } from './support/axe';

/** The count a screen reader is told; it follows the typing once it pauses. */
const announcedCount = (page: Page) => page.getByRole('status');

const rows = (page: Page) => page.getByRole('listitem');

/** The total the build published: the tests read it so that a data refresh does not break them. */
async function publishedCount(page: Page): Promise<number> {
  const manifest = (await (await page.request.get('./data/manifest.json')).json()) as { count: number };
  return manifest.count;
}

test.describe('explore', () => {
  test('has the filters, the results and the party side by side', async ({ page }) => {
    await page.goto('./');

    await expect(page.getByRole('heading', { level: 1, name: 'Explore traits' })).toBeAttached();
    await expect(page.getByRole('region', { name: 'Filters' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Results' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Party' })).toBeVisible();
  });

  test('shows each trait with its creature, family, class, description and material', async ({ page }) => {
    await page.goto('./');

    const first = rows(page).first();
    await expect(first.getByRole('heading', { level: 3 })).not.toBeEmpty();
    await expect(first.locator('.creature')).not.toBeEmpty();
    await expect(first.locator('.origin')).toContainText('·');
    await expect(first.locator('.description')).not.toBeEmpty();
    await expect(first.locator('.material')).not.toBeEmpty();
  });

  test('narrows the results as you type and says how many are left', async ({ page }) => {
    const total = await publishedCount(page);
    await page.goto('./');
    await expect(announcedCount(page)).toContainText(`of ${total.toLocaleString('en-US')} traits`);

    await page.getByRole('textbox', { name: 'Search traits' }).fill('class:death');

    await expect(announcedCount(page)).not.toContainText(`${total.toLocaleString('en-US')} of`);
    const origins = await rows(page).locator('.origin').allTextContents();
    expect(origins.length).toBeGreaterThan(0);
    for (const origin of origins) expect(origin).toMatch(/· Death$/);
  });

  test('says so when no trait matches, and comes back when the query is cleared', async ({ page }) => {
    const total = await publishedCount(page);
    await page.goto('./');
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
    await page.goto('./');
    await expect(rows(page).first()).toBeVisible();

    await page.getByLabel('Sort').selectOption({ label: 'Class, then family' });

    const classes = (await rows(page).locator('.origin').allTextContents()).map(
      (origin) => origin.split('· ').pop() ?? '',
    );
    expect(classes.length).toBeGreaterThan(1);
    expect(classes).toEqual([...classes].sort((a, b) => a.localeCompare(b)));
  });

  test('has no WCAG 2.2 AA violations, with results and with a query typed', async ({ page }) => {
    await page.goto('./');
    await expect(rows(page).first()).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);

    await page.getByRole('textbox', { name: 'Search traits' }).fill('(vulnerable OR weak) -stack:no');
    await expect(rows(page).first()).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});
