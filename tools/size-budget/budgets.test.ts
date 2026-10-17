import { describe, expect, it } from 'vitest';
import { SIZE_BUDGETS, formatVerdicts, judge, type SizeBudget } from './budgets';
import type { BuildSizes } from './measure-build';

const sizes = (initialJs: number[], data: number[]): BuildSizes => ({
  initialJs: initialJs.map((gzipBytes, index) => ({ path: `_app/js-${String(index)}.js`, gzipBytes })),
  data: data.map((gzipBytes, index) => ({ path: `data/file-${String(index)}.json`, gzipBytes })),
});

const budgets: readonly SizeBudget[] = [
  { name: 'initial JavaScript', limitBytes: 1000, files: (built) => built.initialJs },
  { name: 'data', limitBytes: 5000, files: (built) => built.data },
];

describe('the budgets of the product', () => {
  it('are the ones of SPEC § Performance: initial JS 150 kB and data 300 kB, gzipped', () => {
    expect(SIZE_BUDGETS.map(({ name, limitBytes }) => [name, limitBytes])).toEqual([
      ['initial JavaScript', 150_000],
      ['data', 300_000],
    ]);
  });
});

describe('judge', () => {
  it('adds up the files of each budget and compares the sum with its limit', () => {
    const [initialJs, data] = judge(sizes([400, 300], [4000, 500]), budgets);
    expect(initialJs).toMatchObject({ name: 'initial JavaScript', measuredBytes: 700, limitBytes: 1000, within: true });
    expect(data).toMatchObject({ name: 'data', measuredBytes: 4500, limitBytes: 5000, within: true });
  });

  it('accepts a size exactly at the limit and rejects one byte over', () => {
    expect(judge(sizes([1000], [1]), budgets)[0]?.within).toBe(true);
    expect(judge(sizes([1001], [1]), budgets)[0]?.within).toBe(false);
  });

  it('judges each budget on its own', () => {
    const verdicts = judge(sizes([10], [5001]), budgets);
    expect(verdicts.map((verdict) => verdict.within)).toEqual([true, false]);
  });
});

describe('formatVerdicts', () => {
  it('prints one line per budget when all are met', () => {
    const report = formatVerdicts(judge(sizes([400, 300], [4000]), budgets));
    expect(report.split('\n')).toEqual([
      'ok    initial JavaScript  0.7 kB of 1.0 kB gzip',
      'ok    data                4.0 kB of 5.0 kB gzip',
    ]);
  });

  it('says by how much a budget is exceeded and lists its files, biggest first', () => {
    const report = formatVerdicts(judge(sizes([300, 1200, 500], [100]), budgets));
    expect(report.split('\n')).toEqual([
      'FAIL  initial JavaScript  2.0 kB of 1.0 kB gzip, over by 1.0 kB',
      '        1.2 kB  _app/js-1.js',
      '        0.5 kB  _app/js-2.js',
      '        0.3 kB  _app/js-0.js',
      'ok    data                0.1 kB of 5.0 kB gzip',
    ]);
  });
});
