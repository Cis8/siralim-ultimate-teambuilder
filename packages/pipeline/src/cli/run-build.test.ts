import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatasetManifest, TraitDataset } from '@atlas/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverridesError } from '../overrides/overrides-error';
import { SheetFormatError } from '../sheet/sheet-format-error';
import { CliError } from './cli-error';
import { runBuild } from './run-build';

const SNAPSHOT = new URL('../../fixtures/traits-v2.0.csv', import.meta.url);
const COMMITTED_OVERRIDES = fileURLToPath(new URL('../../overrides.yaml', import.meta.url));

describe('runBuild', () => {
  let directory: string;
  let snapshot: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'atlas-build-'));
    snapshot = await readFile(SNAPSHOT, 'utf8');
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const settings = (inputFile: string, now = '2026-10-16T10:00:00.000Z', overridesFile = COMMITTED_OVERRIDES) => ({
    inputFile,
    overridesFile,
    outputDirectory: join(directory, 'data'),
    reportFile: join(directory, 'cache', 'report.md'),
    now: () => new Date(now),
    log: vi.fn<(line: string) => void>(),
  });
  const writeInput = async (name: string, csv: string) => {
    const file = join(directory, name);
    await writeFile(file, csv);
    return file;
  };
  const readManifest = async () =>
    JSON.parse(await readFile(join(directory, 'data', 'manifest.json'), 'utf8')) as DatasetManifest;

  it('turns the cached sheet into the dataset, its manifest and a report', async () => {
    const input = await writeInput('traits.csv', snapshot);
    const run = settings(input);

    const result = await runBuild(run);

    expect(result.changed).toBe(true);
    const manifest = await readManifest();
    expect(manifest).toMatchObject({ datasetVersion: '2.0', count: 1780, generatedAt: '2026-10-16T10:00:00.000Z' });
    expect(result.manifest).toEqual(manifest);
    expect((await readdir(join(directory, 'data'))).toSorted()).toEqual([
      'manifest.json',
      `traits.${manifest.hash}.json`,
    ]);
    expect(await readFile(run.reportFile, 'utf8')).toContain('No previous build to compare with.');
    expect(run.log).toHaveBeenCalledWith(expect.stringContaining('1780 traits'));
  });

  it('changes nothing the second time, and the report says so', async () => {
    const input = await writeInput('traits.csv', snapshot);
    await runBuild(settings(input));
    const first = await readFile(join(directory, 'data', 'manifest.json'), 'utf8');

    const second = settings(input, '2026-10-17T10:00:00.000Z');
    const result = await runBuild(second);

    expect(result.changed).toBe(false);
    expect(await readFile(join(directory, 'data', 'manifest.json'), 'utf8')).toBe(first);
    expect(await readFile(second.reportFile, 'utf8')).toContain('No trait was added, removed or changed.');
    expect(second.log).toHaveBeenCalledWith(expect.stringContaining('unchanged'));
  });

  it('reports what an edit of the sheet changed, and replaces the old dataset file', async () => {
    await runBuild(settings(await writeInput('traits.csv', snapshot)));
    const before = await readManifest();

    const edited = snapshot.replace('After an enemy is afflicted', 'After an enemy is hit');
    expect(edited).not.toBe(snapshot);
    const run = settings(await writeInput('edited.csv', edited), '2026-10-17T10:00:00.000Z');
    const result = await runBuild(run);

    expect(result.changed).toBe(true);
    const after = await readManifest();
    expect(after.hash).not.toBe(before.hash);
    expect((await readdir(join(directory, 'data'))).toSorted()).toEqual(['manifest.json', `traits.${after.hash}.json`]);
    expect(await readFile(run.reportFile, 'utf8')).toMatch(
      /### Changed \(1\)\n\n- `abomination--flesh-rot`: description/,
    );
  });

  it('tells to fetch the sheet first when there is nothing to build from', async () => {
    const run = settings(join(directory, 'missing.csv'));
    await expect(runBuild(run)).rejects.toThrow(CliError);
    await expect(runBuild(run)).rejects.toThrow(/pipeline:fetch/);
  });

  it('writes nothing from a sheet that is not valid', async () => {
    const run = settings(await writeInput('bad.csv', '"Siralim Ultimate","","Version 2.0"\n"Foo","Bar"\n'));

    await expect(runBuild(run)).rejects.toBeInstanceOf(SheetFormatError);

    expect(existsSync(join(directory, 'data'))).toBe(false);
    expect(existsSync(run.reportFile)).toBe(false);
  });

  describe('overrides', () => {
    const FLESH_ROT_WEAK = `roles:
  - { trait: abomination--flesh-rot, keyword: weak, role: applies, reason: 'Test: pretend Flesh Rot gives Weak.' }
`;
    const writeOverrides = (yaml: string) => writeInput('overrides.yaml', yaml);
    const fleshRotWeak = async () => {
      const manifest = await readManifest();
      const dataset = JSON.parse(
        await readFile(join(directory, 'data', `traits.${manifest.hash}.json`), 'utf8'),
      ) as TraitDataset;
      return dataset.traits
        .find((trait) => trait.id === 'abomination--flesh-rot')
        ?.keywords.find((hit) => hit.key === 'weak');
    };

    it('are put over the extracted keywords before the dataset is written', async () => {
      const input = await writeInput('traits.csv', snapshot);
      await runBuild(settings(input, undefined, await writeOverrides(FLESH_ROT_WEAK)));
      expect((await fleshRotWeak())?.role).toBe('applies');
    });

    it('leave Flesh Rot as read when there are none', async () => {
      await runBuild(settings(await writeInput('traits.csv', snapshot)));
      expect((await fleshRotWeak())?.role).toBe('uses');
    });

    it('stop the build, and write nothing, when one does not fit the sheet', async () => {
      const input = await writeInput('traits.csv', snapshot);
      const overrides = await writeOverrides(FLESH_ROT_WEAK.replace('flesh-rot', 'no-such-trait'));
      const run = settings(input, undefined, overrides);

      await expect(runBuild(run)).rejects.toBeInstanceOf(OverridesError);

      expect(existsSync(join(directory, 'data'))).toBe(false);
      expect(existsSync(run.reportFile)).toBe(false);
    });

    it('stop the build when the file is missing', async () => {
      const input = await writeInput('traits.csv', snapshot);
      await expect(runBuild(settings(input, undefined, join(directory, 'missing.yaml')))).rejects.toBeInstanceOf(
        OverridesError,
      );
    });

    it('are reported when they change nothing', async () => {
      const input = await writeInput('traits.csv', snapshot);
      const run = settings(input, undefined, await writeOverrides(FLESH_ROT_WEAK.replace('applies', 'uses')));

      await runBuild(run);

      expect(run.log).toHaveBeenCalledWith(expect.stringMatching(/^Warning, override roles\[0\].*already/));
      expect(await readFile(run.reportFile, 'utf8')).toMatch(/- Override roles\[0\].*already/);
    });
  });
});
