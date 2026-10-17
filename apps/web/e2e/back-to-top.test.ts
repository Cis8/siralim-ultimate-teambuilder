import { expect, test, type Page } from '@playwright/test';
import { axeViolations } from './support/axe';
import {
  backToTopButton,
  isTabbed,
  openExplore,
  pageHeading,
  rows,
  scrollScreens,
  scrolledBy,
  searchBox,
} from './support/explore-page';
import { addButton, showExplore, showParty } from './support/party-page';

// A long list is a long way down: once the page is scrolled more than a screen, a button fixed at the top right of the window
// takes it back to the top (DESIGN § Back to top, SPEC §8.1).

/** The page scrolled well into the list, with the button on it. */
async function scrolledIntoTheList(page: Page): Promise<void> {
  await openExplore(page);
  await expect(backToTopButton(page)).toHaveCount(0);
  await scrollScreens(page, 3);
  await expect(backToTopButton(page)).toBeVisible();
}

/** Waits for the page to be drawn twice: the browser scrolls a control into view after the call that asked for it. */
const afterTwoFrames = (page: Page): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            done();
          });
        });
      }),
  );

test.describe('the Back to top button', () => {
  test('is on the page once it is scrolled more than a screen, and off when it is back within one', async ({
    page,
  }) => {
    await openExplore(page);
    await expect(backToTopButton(page)).toHaveCount(0);

    await scrollScreens(page, 2);
    await expect(backToTopButton(page)).toBeVisible();

    await scrollScreens(page, 0.5);
    await expect(backToTopButton(page)).toHaveCount(0);
  });

  test('is a 44 px square at the top right of the window', async ({ page }) => {
    await scrolledIntoTheList(page);

    const box = await backToTopButton(page).boundingBox();
    if (box === null) throw new Error('the button is not drawn');
    const windowWidth = await page.evaluate(() => document.documentElement.clientWidth);

    expect(box.width).toBeCloseTo(44, 0);
    expect(box.height).toBeCloseTo(44, 0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeLessThanOrEqual(16);
    expect(windowWidth - (box.x + box.width)).toBeGreaterThanOrEqual(0);
    expect(windowWidth - (box.x + box.width)).toBeLessThanOrEqual(16);
  });

  // Far down the list, where the rows above the window have not been measured: the virtual list corrects the scroll as it
  // measures the ones it passes, which stopped a smooth scroll a few pixels after it began. The page jumps.
  test('takes the page to its top at once, from far down the list', async ({ page }) => {
    await openExplore(page);
    await scrollScreens(page, 20);
    await expect(backToTopButton(page)).toBeVisible();

    await backToTopButton(page).click();

    expect(await scrolledBy(page)).toBe(0);
    await expect(backToTopButton(page)).toHaveCount(0);
    await expect(rows(page).first()).toBeVisible();
  });

  test('puts the focus on the heading of the page, not on the search field, which would raise the keyboard', async ({
    page,
  }) => {
    await scrolledIntoTheList(page);

    await backToTopButton(page).click();

    await expect(pageHeading(page)).toBeFocused();
    await expect(searchBox(page)).not.toBeFocused();
  });

  test('is not on offer on the Party tab, and is again when the list is back in view', async ({ page }) => {
    test.skip(!isTabbed(page), 'A wide window has the party beside the list: there is no other view to be on.');
    await scrolledIntoTheList(page);

    await showParty(page);
    await expect(backToTopButton(page)).toHaveCount(0);

    await showExplore(page);
    await expect(backToTopButton(page)).toBeVisible();
  });

  test.describe('at the top of the window, where a control scrolled into view from above is left (WCAG 2.4.11)', () => {
    const scrollPaddingTop = (page: Page) =>
      page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop));

    test('leaves room for itself while it is on the page, and none once it is gone', async ({ page }) => {
      await openExplore(page);
      expect(await scrollPaddingTop(page)).toBe(0);

      await scrollScreens(page, 3);
      await expect(backToTopButton(page)).toBeVisible();
      const button = await backToTopButton(page).boundingBox();
      if (button === null) throw new Error('the button is not drawn');
      expect(await scrollPaddingTop(page)).toBeGreaterThanOrEqual(button.y + button.height);

      await scrollScreens(page, 0);
      await expect(backToTopButton(page)).toHaveCount(0);
      expect(await scrollPaddingTop(page)).toBe(0);
    });

    test('does not draw over a control that is brought to the top edge, as the browser does for one that takes the focus', async ({
      page,
    }) => {
      await scrolledIntoTheList(page);
      const button = await backToTopButton(page).boundingBox();
      if (button === null) throw new Error('the button is not drawn');
      // One element, found once: the list draws other rows as the page moves, and a locator would find another one.
      const control = await addButton(rows(page).nth(3)).elementHandle();

      await control.evaluate((element) => {
        element.scrollIntoView({ block: 'start' });
      });
      await afterTwoFrames(page);
      const box = await control.boundingBox();
      if (box === null) throw new Error('the add button is not drawn');

      const overlaps =
        box.x < button.x + button.width &&
        button.x < box.x + box.width &&
        box.y < button.y + button.height &&
        button.y < box.y + box.height;
      expect(overlaps, 'the button is drawn over the control').toBe(false);
    });
  });

  test('has no accessibility violations while it is on the page', async ({ page }) => {
    await scrolledIntoTheList(page);

    expect(await axeViolations(page)).toEqual([]);
  });
});
