import { describe, expect, it, vi } from 'vitest';
import { fetchSheet, SheetFetchError } from './fetch-sheet';
import { csvUrl, TRAITS_SOURCE } from './sheet-source';

const csvResponse = (body: string, init: ResponseInit = {}) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8' }, ...init });

/** A `fetch` that answers with each of `answers` in turn: a response, or an error to reject with. */
function fetchAnswering(...answers: (Response | Error)[]) {
  const remaining = [...answers];
  return vi.fn<typeof fetch>(() => {
    const next = remaining.shift();
    if (next === undefined) return Promise.reject(new Error('The test gave no more answers'));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
}

const noSleep = () => vi.fn<(milliseconds: number) => Promise<void>>(() => Promise.resolve());

describe('csvUrl', () => {
  it('points at the CSV export of one tab of the spreadsheet', () => {
    expect(csvUrl({ name: 'spells', spreadsheetId: 'SHEET_ID', gid: '123' })).toBe(
      'https://docs.google.com/spreadsheets/d/SHEET_ID/gviz/tq?tqx=out:csv&gid=123',
    );
  });

  it('knows the Traits tab of the compendium', () => {
    expect(csvUrl(TRAITS_SOURCE)).toBe(
      'https://docs.google.com/spreadsheets/d/1qvWwf1fNB5jN8bJ8dFGAVzC7scgDCoBO-hglwjTT4iY/gviz/tq?tqx=out:csv&gid=0',
    );
  });
});

describe('fetchSheet', () => {
  it('returns the CSV text of the source', async () => {
    const fetchMock = fetchAnswering(csvResponse('"a","b"\n'));
    const sleep = noSleep();

    const csv = await fetchSheet(TRAITS_SOURCE, { fetch: fetchMock, sleep });

    expect(csv).toBe('"a","b"\n');
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(csvUrl(TRAITS_SOURCE));
    expect(sleep).not.toHaveBeenCalled();
  });

  describe('when the request fails for a while', () => {
    it.each([500, 502, 503, 429, 408])('tries again after a %i, waiting longer each time', async (status) => {
      const fetchMock = fetchAnswering(new Response('', { status }), new Response('', { status }), csvResponse('ok'));
      const sleep = noSleep();

      expect(await fetchSheet(TRAITS_SOURCE, { fetch: fetchMock, sleep })).toBe('ok');

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(sleep.mock.calls).toEqual([[1000], [2000]]);
    });

    it('tries again after a network error', async () => {
      const fetchMock = fetchAnswering(new TypeError('fetch failed'), csvResponse('ok'));
      expect(await fetchSheet(TRAITS_SOURCE, { fetch: fetchMock, sleep: noSleep() })).toBe('ok');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('gives up after four attempts and says what went wrong last', async () => {
      const fetchMock = fetchAnswering(...Array.from({ length: 4 }, () => new Response('', { status: 503 })));
      const sleep = noSleep();

      const failure = await fetchSheet(TRAITS_SOURCE, { fetch: fetchMock, sleep }).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(SheetFetchError);
      expect((failure as Error).message).toMatch(/after 4 attempts.*503/);
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(sleep.mock.calls).toEqual([[1000], [2000], [4000]]);
    });

    it('reports the network error it gave up on', async () => {
      const fetchMock = fetchAnswering(...Array.from({ length: 2 }, () => new TypeError('fetch failed')));
      const failure = await fetchSheet(TRAITS_SOURCE, { fetch: fetchMock, sleep: noSleep(), attempts: 2 }).catch(
        (error: unknown) => error,
      );
      expect((failure as Error).message).toMatch(/after 2 attempts.*fetch failed/);
      expect((failure as Error).cause).toBeInstanceOf(TypeError);
    });
  });

  describe('when retrying cannot help', () => {
    it.each([400, 401, 403, 404])('does not try again after a %i', async (status) => {
      const fetchMock = fetchAnswering(new Response('', { status }), csvResponse('never reached'));
      const sleep = noSleep();

      await expect(fetchSheet(TRAITS_SOURCE, { fetch: fetchMock, sleep })).rejects.toThrow(new RegExp(String(status)));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('does not try again when Google answers with a web page instead of CSV', async () => {
      const page = new Response('<!doctype html><title>Sign in</title>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
      const fetchMock = fetchAnswering(page, csvResponse('never reached'));

      const failure = await fetchSheet(TRAITS_SOURCE, { fetch: fetchMock, sleep: noSleep() }).catch(
        (error: unknown) => error,
      );

      expect(failure).toBeInstanceOf(SheetFetchError);
      expect((failure as Error).message).toMatch(/web page.*shared/i);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
