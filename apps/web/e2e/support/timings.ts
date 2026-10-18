import type { JSHandle, Page } from '@playwright/test';

/** Slowing the CPU down 4× is what Lighthouse calls a mobile profile; SPEC §Performance holds a keystroke to 16 ms on it. */
export const CPU_SLOWDOWN = 4;
export const BUDGET_MS = 16;
/** A person types a key about every 100 ms at the fastest. */
export const KEY_DELAY_MS = 120;

/** Slows the CPU of the page down (the DevTools protocol: Chromium only). */
export async function slowDownCpu(page: Page, rate = CPU_SLOWDOWN): Promise<void> {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate });
}

/** Collects the duration of every User Timing measure called `name` that the page makes from now on; the array is live. */
export function collectMeasures(page: Page, name: string): Promise<JSHandle<number[]>> {
  return page.evaluateHandle((measure) => {
    const durations: number[] = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntriesByName(measure)) durations.push(entry.duration);
    }).observe({ type: 'measure' });
    return durations;
  }, name);
}

/** The value `share` of the way up the sorted samples (the nearest rank). */
export const percentile = (samples: readonly number[], share: number): number => {
  const sorted = samples.toSorted((a, b) => a - b);
  return sorted[Math.min(sorted.length, Math.ceil(share * sorted.length)) - 1] ?? Number.NaN;
};

/** The figures of a run, for the annotation of the report. */
export const describeTimings = (samples: readonly number[]): string =>
  `p50 ${percentile(samples, 0.5).toFixed(1)} ms, p95 ${percentile(samples, 0.95).toFixed(1)} ms, max ${Math.max(...samples).toFixed(1)} ms`;
