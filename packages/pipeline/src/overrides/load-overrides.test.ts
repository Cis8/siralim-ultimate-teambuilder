import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadOverrides } from './load-overrides';
import { OverridesError } from './overrides-error';

describe('loadOverrides', () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'atlas-overrides-'));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('reads the overrides in a file', async () => {
    const file = join(directory, 'overrides.yaml');
    await writeFile(file, 'roles:\n  - { trait: x, keyword: weak, role: uses, reason: Because. }\n');
    expect((await loadOverrides(file)).roles).toHaveLength(1);
  });

  it('refuses a file that is not there: the build must not quietly go without its corrections', async () => {
    const failure = await loadOverrides(join(directory, 'missing.yaml')).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(OverridesError);
    expect((failure as Error).message).toMatch(/no overrides file at .*missing\.yaml/);
  });

  it('refuses a file that is not valid', async () => {
    const file = join(directory, 'bad.yaml');
    await writeFile(file, 'roles:\n  - { trait: x }\n');
    await expect(loadOverrides(file)).rejects.toBeInstanceOf(OverridesError);
  });
});
