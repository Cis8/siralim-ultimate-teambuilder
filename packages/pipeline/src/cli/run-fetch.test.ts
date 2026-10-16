import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SheetFetchError } from '../fetch/fetch-sheet';
import { runFetch } from './run-fetch';

const csvResponse = (body: string) => new Response(body, { headers: { 'content-type': 'text/csv' } });

describe('runFetch', () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'atlas-fetch-'));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  const options = (fetchMock: typeof fetch) => ({
    cacheDirectory: join(directory, 'cache'),
    fetchOptions: { fetch: fetchMock, sleep: () => Promise.resolve() },
    log: vi.fn<(line: string) => void>(),
  });

  it('saves the sheet in the cache, named after its source', async () => {
    const settings = options(() => Promise.resolve(csvResponse('"a","b"\n')));

    const result = await runFetch(settings);

    expect(result.file).toBe(join(directory, 'cache', 'traits.csv'));
    expect(await readFile(result.file, 'utf8')).toBe('"a","b"\n');
    expect(settings.log).toHaveBeenCalledWith(expect.stringContaining('traits.csv'));
  });

  it('replaces what an earlier run cached', async () => {
    const settings = options(() => Promise.resolve(csvResponse('new')));
    await runFetch(settings);
    await writeFile(join(directory, 'cache', 'traits.csv'), 'old');

    await runFetch(settings);

    expect(await readFile(join(directory, 'cache', 'traits.csv'), 'utf8')).toBe('new');
  });

  it('keeps the earlier cache when the download fails', async () => {
    await runFetch(options(() => Promise.resolve(csvResponse('earlier'))));

    const failing = options(() => Promise.resolve(new Response('', { status: 404 })));
    await expect(runFetch(failing)).rejects.toBeInstanceOf(SheetFetchError);

    expect(await readFile(join(directory, 'cache', 'traits.csv'), 'utf8')).toBe('earlier');
  });
});
