import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/** WCAG 2.2 AA rule set used by every e2e accessibility check (DESIGN § Accessibility). */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export async function axeViolations(page: Page): Promise<readonly { id: string; help: string; nodes: unknown[] }[]> {
  // A sheet that is still rising is half transparent, and axe reads the blend as a lack of contrast: it measures what rests.
  await page.evaluate(() => Promise.all(document.getAnimations().map((animation) => animation.finished)));
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations;
}
