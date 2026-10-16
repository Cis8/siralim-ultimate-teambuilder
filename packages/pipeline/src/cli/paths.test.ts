import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromWhereTheCommandWasRun } from './paths';

describe('fromWhereTheCommandWasRun', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('takes a relative path from the directory the command was typed in', () => {
    vi.stubEnv('INIT_CWD', '/work/repo');
    expect(fromWhereTheCommandWasRun('fixtures/traits.csv')).toBe(resolve('/work/repo', 'fixtures/traits.csv'));
  });

  it('leaves an absolute path alone', () => {
    vi.stubEnv('INIT_CWD', '/work/repo');
    expect(fromWhereTheCommandWasRun('/elsewhere/traits.csv')).toBe(resolve('/elsewhere/traits.csv'));
  });

  it('falls back to the current directory when the command was not started by pnpm', () => {
    vi.stubEnv('INIT_CWD', undefined);
    expect(fromWhereTheCommandWasRun('traits.csv')).toBe(resolve(process.cwd(), 'traits.csv'));
  });
});
