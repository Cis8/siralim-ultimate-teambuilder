import { expect, test } from '@playwright/test';
import { axeViolations } from './support/axe';

test.describe('trait data', () => {
  test('loads the dataset the build published, whole', async ({ page, request }) => {
    const manifest = (await (await request.get('./data/manifest.json')).json()) as {
      count: number;
      datasetVersion: string;
    };

    await page.goto('./');

    await expect(page.getByRole('status')).toContainText(
      `${manifest.count.toLocaleString('en-US')} traits loaded from compendium version ${manifest.datasetVersion}`,
    );
    expect(await axeViolations(page)).toEqual([]);
  });

  test('says so, and stays accessible, when the data cannot be loaded', async ({ page }) => {
    await page.route('**/data/manifest.json', (route) => route.abort());

    await page.goto('./');

    await expect(page.getByRole('alert')).toContainText('The trait data could not be loaded');
    expect(await axeViolations(page)).toEqual([]);
  });
});
