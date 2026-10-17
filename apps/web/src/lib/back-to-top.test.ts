import { describe, expect, it } from 'vitest';
import { showsBackToTop } from './back-to-top';

describe('showsBackToTop', () => {
  it('is off at the top of the page and while the first screen is still in sight', () => {
    expect(showsBackToTop(0, 800)).toBe(false);
    expect(showsBackToTop(799, 800)).toBe(false);
    expect(showsBackToTop(800, 800)).toBe(false);
  });

  it('is on once the page is scrolled more than a screen', () => {
    expect(showsBackToTop(801, 800)).toBe(true);
    expect(showsBackToTop(20_000, 800)).toBe(true);
  });

  it('counts a screen as the height of the window, so a taller window asks for more scroll', () => {
    expect(showsBackToTop(1000, 1200)).toBe(false);
    expect(showsBackToTop(1000, 600)).toBe(true);
  });
});
