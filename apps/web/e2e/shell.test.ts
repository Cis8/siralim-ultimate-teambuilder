import { expect, test } from '@playwright/test';
import { axeViolations } from './support/axe';

test.describe('app shell', () => {
  test('renders the page heading and the data credits', async ({ page }) => {
    await page.goto('./');

    await expect(page).toHaveTitle(/Trait Atlas/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const footer = page.getByRole('contentinfo');
    await expect(footer).toContainText('Unofficial');
    await expect(footer.getByRole('link', { name: 'Siralim Ultimate Compendium' })).toHaveAttribute(
      'href',
      /docs\.google\.com\/spreadsheets/,
    );
  });

  test('skip link moves focus to the main content', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Keyboard navigation is checked on desktop');
    await page.goto('./');

    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

  test('has no WCAG 2.2 AA violations', async ({ page }) => {
    await page.goto('./');
    expect(await axeViolations(page)).toEqual([]);
  });
});
