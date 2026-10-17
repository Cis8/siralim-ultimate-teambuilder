import type { Locator, Page } from '@playwright/test';
import { CONTROLS } from './controls';

/** The property of the window that keeps the elements the tab key has been to: the walk asks for them again when it is done. */
const SEEN = '__tabStopsSeen';

/** One stop of the tab key: the control that took the focus, and what a person sees of it. */
export interface TabStop {
  /** The tag and the name of the control, to say which one it is. */
  readonly name: string;
  /** A ring of at least 2 px, on the control or on what holds it. */
  readonly ring: boolean;
  /** Drawn at a size: a control one pixel wide takes the focus and shows nothing of it. */
  readonly drawn: boolean;
  /** At least partly inside the window. */
  readonly inView: boolean;
  /** What is drawn over the middle of it, as a bar fixed to the foot of the window would be (WCAG 2.4.11), or null. */
  readonly coveredBy: string | null;
}

export interface TabWalk {
  readonly stops: readonly TabStop[];
  /** The controls drawn that the tab key never stopped at (those that the arrow keys move to are not among them). */
  readonly unreached: readonly string[];
}

/** `nothing` when the focus is not on a control of the page (it left the document), `again` when it has been there before. */
type Focus = TabStop | 'nothing' | 'again';

/**
 * Describes the element that has the focus, in the page. It is self-contained, as it is sent to the browser as it stands.
 * The browser scrolls a control into view after the key press (WebKit not in the same task): the description waits for it.
 */
async function observeFocus(key: string): Promise<Focus> {
  await new Promise<void>((done) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        done();
      });
    });
  });
  const focused = document.activeElement;
  if (focused === null || focused === document.body || focused === document.documentElement) return 'nothing';
  const known: unknown = Reflect.get(window, key);
  const seen = known instanceof WeakSet ? known : new WeakSet<object>();
  Reflect.set(window, key, seen);
  if (seen.has(focused)) return 'again';
  seen.add(focused);

  const words = (text: string | null): string => (text ?? '').replace(/\s+/g, ' ').trim();
  const fieldLabels =
    focused instanceof HTMLInputElement || focused instanceof HTMLSelectElement ? focused.labels : null;
  const labelled = Array.from(fieldLabels ?? [], (label) => words(label.textContent)).join(' ');
  const name = focused.getAttribute('aria-label') ?? (labelled === '' ? words(focused.textContent) : labelled);

  const drawsRing = (element: Element): boolean => {
    const style = getComputedStyle(element);
    return (
      style.outlineStyle !== 'none' &&
      Number.parseFloat(style.outlineWidth) >= 2 &&
      style.outlineColor !== 'rgba(0, 0, 0, 0)'
    );
  };
  let ring = drawsRing(focused);
  for (let holder = focused.parentElement; holder !== null && !ring; holder = holder.parentElement) {
    ring = drawsRing(holder);
  }

  // A control that wraps over two lines has no middle in its box: the first line is where to look.
  const box = focused.getClientRects()[0] ?? focused.getBoundingClientRect();
  const centre = {
    x: Math.min(Math.max(box.left + box.width / 2, 0), window.innerWidth - 1),
    y: Math.min(Math.max(box.top + box.height / 2, 0), window.innerHeight - 1),
  };
  const onTop = document.elementFromPoint(centre.x, centre.y);
  return {
    name: `${focused.tagName.toLowerCase()} “${name}”`,
    ring,
    drawn: box.width > 1 && box.height > 1,
    inView: box.bottom > 0 && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth,
    coveredBy:
      onTop !== null && focused.contains(onTop)
        ? null
        : `${onTop?.tagName.toLowerCase() ?? 'nothing'}.${onTop?.className ?? ''}`,
  };
}

/**
 * Presses Tab from the start of the page until it comes round (or leaves the document), and notes each control it stops at.
 * `within` is the part of the page whose controls must all have been reached: the open filters sheet, say, holds the focus
 * and the page behind it is out of reach. A control that has the focus already counts as the first stop.
 *
 * The page must be one the test has only opened: a field filled in before would be where the walk starts from.
 */
export async function walkTabOrder(page: Page, { within = 'body', limit = 800 } = {}): Promise<TabWalk> {
  await page.evaluate((key) => {
    Reflect.deleteProperty(window, key);
  }, SEEN);

  const stops: TabStop[] = [];
  const first = await page.evaluate(observeFocus, SEEN);
  if (first !== 'nothing' && first !== 'again') stops.push(first);

  let cameRound = false;
  for (let press = 0; press < limit && !cameRound; press++) {
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(observeFocus, SEEN);
    if (focus === 'nothing' || focus === 'again') cameRound = true;
    else stops.push(focus);
  }
  if (!cameRound) throw new Error(`the tab key did not come round in ${String(limit)} presses`);

  const unreached = await page.evaluate(
    ({ key, controls, scope }) => {
      const known: unknown = Reflect.get(window, key);
      const seen = known instanceof WeakSet ? known : new WeakSet<object>();
      const root = document.querySelector(scope);
      if (root === null) throw new Error(`nothing on the page matches ${scope}`);
      return Array.from(root.querySelectorAll(controls))
        .filter(
          (control) =>
            control.checkVisibility({ checkVisibilityCSS: true }) &&
            !seen.has(control) &&
            // The tabs are one stop of the tab key, and the arrow keys go along them (ARIA tabs pattern).
            !(control.getAttribute('role') === 'tab' && control.getAttribute('aria-selected') === 'false'),
        )
        .map(
          (control) =>
            `${control.tagName.toLowerCase()} “${control.getAttribute('aria-label') ?? control.textContent.trim()}”`,
        );
    },
    { key: SEEN, controls: CONTROLS, scope: within },
  );
  return { stops, unreached };
}

/** What is wrong with the stops of a walk, one line each: no ring, not drawn, out of the window, under a bar. */
export function problemsOf({ stops }: TabWalk): string[] {
  return stops.flatMap((stop) =>
    [
      stop.ring ? null : 'shows no focus ring of 2 px',
      stop.drawn ? null : 'is not drawn',
      stop.inView ? null : 'is out of the window',
      stop.coveredBy === null ? null : `has ${stop.coveredBy} drawn over it`,
    ].flatMap((problem) => (problem === null ? [] : [`${stop.name} ${problem}`])),
  );
}

/** Whether `target` is the element that has the focus. */
const hasFocus = (target: Locator): Promise<boolean> =>
  target.evaluate((element) => element === document.activeElement);

/**
 * Presses Tab (Shift+Tab with `backwards`) until `target` has the focus, and says how many presses it took. A control that
 * the tab key cannot reach fails here, with the limit named, instead of being focused by the test.
 */
export async function tabTo(page: Page, target: Locator, { backwards = false, limit = 250 } = {}): Promise<number> {
  for (let presses = 1; presses <= limit; presses++) {
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
    if (await hasFocus(target)) return presses;
  }
  throw new Error(`${String(limit)} presses of ${backwards ? 'Shift+Tab' : 'Tab'} did not reach ${String(target)}`);
}
