import type { BuildSizes, FileSize } from './measure-build';

export interface SizeBudget {
  readonly name: string;
  readonly limitBytes: number;
  /** The files of the build this budget covers. */
  readonly files: (sizes: BuildSizes) => readonly FileSize[];
}

export interface Verdict {
  readonly name: string;
  readonly limitBytes: number;
  readonly measuredBytes: number;
  readonly within: boolean;
  readonly files: readonly FileSize[];
}

// SPEC § Performance. A kB is 1000 bytes, as in the network panel of a browser: the stricter reading of "KB".
// The two JavaScript budgets that follow the first are Phase 2's (ROADMAP criterion 8). Measured when Phase 2 closed (11.6): 94.2 kB
// initial, 37.3 lazy (the query assist with its editor and the Synergy routes) and 131.6 in all. A route has no budget
// of its own: a first visit to any page fetches no more than the total (131.6 kB, under the 150 kB the first page may weigh), and a
// route's chunks cannot be told from the build's files without reading SvelteKit's internals. The total's limit of 200 kB is room, not
// a promise about a first visit. The editor left 12.7 kB of the lazy 50, so the limits stay as they were; Phase 3's analysis route
// is the next thing to spend them, and the slice that builds it decides whether they move.
export const SIZE_BUDGETS: readonly SizeBudget[] = [
  { name: 'initial JavaScript', limitBytes: 150_000, files: (sizes) => sizes.initialJs },
  { name: 'lazy JavaScript', limitBytes: 50_000, files: (sizes) => sizes.lazyJs },
  { name: 'total JavaScript', limitBytes: 200_000, files: (sizes) => [...sizes.initialJs, ...sizes.lazyJs] },
  { name: 'data', limitBytes: 300_000, files: (sizes) => sizes.data },
];

export function judge(sizes: BuildSizes, budgets: readonly SizeBudget[] = SIZE_BUDGETS): Verdict[] {
  return budgets.map(({ name, limitBytes, files }) => {
    const covered = files(sizes);
    const measuredBytes = covered.reduce((sum, file) => sum + file.gzipBytes, 0);
    return { name, limitBytes, measuredBytes, within: measuredBytes <= limitBytes, files: covered };
  });
}

const kilobytes = (bytes: number): string => (bytes / 1000).toFixed(1);

/** One line per budget; a budget that is exceeded is followed by its files, biggest first. */
export function formatVerdicts(verdicts: readonly Verdict[]): string {
  const nameWidth = Math.max(...verdicts.map((verdict) => verdict.name.length));
  return verdicts
    .flatMap((verdict) => {
      const sizes = `${kilobytes(verdict.measuredBytes)} kB of ${kilobytes(verdict.limitBytes)} kB gzip`;
      if (verdict.within) return [`ok    ${verdict.name.padEnd(nameWidth)}  ${sizes}`];

      const over = kilobytes(verdict.measuredBytes - verdict.limitBytes);
      const biggestFirst = verdict.files.toSorted((a, b) => b.gzipBytes - a.gzipBytes);
      const sizeWidth = Math.max(...biggestFirst.map((file) => kilobytes(file.gzipBytes).length));
      return [
        `FAIL  ${verdict.name.padEnd(nameWidth)}  ${sizes}, over by ${over} kB`,
        ...biggestFirst.map((file) => `        ${kilobytes(file.gzipBytes).padStart(sizeWidth)} kB  ${file.path}`),
      ];
    })
    .join('\n');
}
