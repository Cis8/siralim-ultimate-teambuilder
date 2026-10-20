import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { exportHistory, importHistory, MAX_FILE_LENGTH, type ImportRefusal } from './search-history-file';
import {
  emptySearchHistory,
  MAX_RECENT,
  MAX_SAVED,
  MAX_SEARCH_LENGTH,
  type SavedSearch,
  type SearchHistory,
} from './search-history';

function savedSearch(query: string, name = query): SavedSearch {
  return { name, query };
}

function history(recent: readonly string[], saved: readonly SavedSearch[] = []): SearchHistory {
  return { recent, saved };
}

/** A file as this app writes it, with `changes` laid over it: what a test breaks, it breaks on purpose. */
function fileText(changes: Record<string, unknown> = {}): string {
  return JSON.stringify({
    app: 'trait-atlas',
    kind: 'search-history',
    version: 1,
    recent: ['snared'],
    saved: [{ name: 'Payoffs', query: 'uses:vulnerable' }],
    ...changes,
  });
}

function numbered(count: number, prefix: string): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix} ${String(index)}`);
}

/** What `importHistory` gives for a file read into an empty history, which it must have accepted. */
function importedAlone(text: string): SearchHistory {
  const result = importHistory(text, emptySearchHistory);
  if (!result.ok) throw new Error(`the file was refused: ${result.reason}`);
  return result.history;
}

describe('exportHistory', () => {
  it('writes a file that says what it is, in which version, with both lists', () => {
    const text = exportHistory(history(['snared', 'weak'], [savedSearch('uses:vulnerable', 'Payoffs')]));

    expect(JSON.parse(text)).toEqual({
      app: 'trait-atlas',
      kind: 'search-history',
      version: 1,
      recent: ['snared', 'weak'],
      saved: [{ name: 'Payoffs', query: 'uses:vulnerable' }],
    });
  });

  it('writes the same text for the same history, to be read and diffed by a person', () => {
    const searches = history(['weak'], [savedSearch('weak')]);

    expect(exportHistory(searches)).toBe(exportHistory({ recent: [...searches.recent], saved: [...searches.saved] }));
    expect(exportHistory(searches)).toContain('\n');
  });

  it('writes an empty history as a file that holds nothing', () => {
    expect(JSON.parse(exportHistory(emptySearchHistory))).toMatchObject({ recent: [], saved: [] });
  });
});

describe('importHistory', () => {
  describe('into an empty history', () => {
    it('gives back what was exported', () => {
      const searches = history(
        ['snared', 'weak OR "start of battle"'],
        [savedSearch('class:life'), savedSearch('a', 'B')],
      );

      expect(importedAlone(exportHistory(searches))).toEqual(searches);
    });

    it('gives back an empty history for an empty file', () => {
      expect(importedAlone(exportHistory(emptySearchHistory))).toEqual(emptySearchHistory);
    });

    it('says how many it took of each', () => {
      const result = importHistory(
        fileText({ recent: ['a', 'b', 'c'], saved: [savedSearch('x'), savedSearch('y')] }),
        emptySearchHistory,
      );

      expect(result).toMatchObject({ ok: true, added: { recent: 3, saved: 2 }, leftOut: { recent: 0, saved: 0 } });
    });

    it('survives text that JSON has to escape', () => {
      const searches = history(['"a\\b" \n\u0001 é 😀'], [savedSearch('quote " backslash \\', 'tab\tstop')]);

      expect(importedAlone(exportHistory(searches))).toEqual(searches);
    });
  });

  describe('into a history that has searches already', () => {
    const current = history(['mine'], [savedSearch('mine saved', 'My name')]);

    it('keeps what is there first and adds what is new after it', () => {
      const result = importHistory(fileText({ recent: ['theirs'], saved: [savedSearch('theirs saved')] }), current);

      expect(result).toMatchObject({
        ok: true,
        history: {
          recent: ['mine', 'theirs'],
          saved: [savedSearch('mine saved', 'My name'), savedSearch('theirs saved')],
        },
        added: { recent: 1, saved: 1 },
      });
    });

    it('merges by search: one that is there already is not added, and the name already there stays', () => {
      const result = importHistory(
        fileText({ recent: ['mine', 'theirs'], saved: [savedSearch('mine saved', 'Their name')] }),
        current,
      );

      expect(result).toMatchObject({
        ok: true,
        history: { recent: ['mine', 'theirs'], saved: [savedSearch('mine saved', 'My name')] },
        added: { recent: 1, saved: 0 },
      });
    });

    it('is idempotent: the second time the file adds nothing and the very same history comes back', () => {
      const text = fileText({ recent: ['theirs'], saved: [savedSearch('theirs saved')] });
      const first = importHistory(text, current);
      if (!first.ok) throw new Error('the file was refused');

      const second = importHistory(text, first.history);

      expect(second).toMatchObject({ ok: true, added: { recent: 0, saved: 0 } });
      expect(second.ok && second.history).toBe(first.history);
    });

    it('gives the very same history back for a file that adds nothing', () => {
      const result = importHistory(exportHistory(current), current);

      expect(result.ok && result.history).toBe(current);
    });

    it('stops at the limit of each list and says how many it left out', () => {
      const nearlyFull = history(
        numbered(MAX_RECENT - 2, 'mine'),
        numbered(MAX_SAVED - 1, 'mine').map((query) => savedSearch(query)),
      );

      const result = importHistory(
        fileText({
          recent: numbered(5, 'theirs'),
          saved: numbered(4, 'theirs').map((query) => savedSearch(query)),
        }),
        nearlyFull,
      );

      expect(result).toMatchObject({ ok: true, added: { recent: 2, saved: 1 }, leftOut: { recent: 3, saved: 3 } });
      expect(result.ok && result.history.recent).toHaveLength(MAX_RECENT);
      expect(result.ok && result.history.saved).toHaveLength(MAX_SAVED);
      expect(result.ok && result.history.recent.slice(-2)).toEqual(['theirs 0', 'theirs 1']);
    });

    it('does not count a repeat as left out', () => {
      const full = history(
        [],
        numbered(MAX_SAVED, 'mine').map((query) => savedSearch(query)),
      );

      const result = importHistory(fileText({ recent: [], saved: [savedSearch('mine 3')] }), full);

      expect(result).toMatchObject({ ok: true, added: { saved: 0 }, leftOut: { saved: 0 } });
    });
  });

  describe('a file that is read leniently', () => {
    it('reads a file that starts with a byte order mark, as some editors on Windows save it', () => {
      const byteOrderMark = String.fromCharCode(0xfeff);

      expect(importedAlone(`${byteOrderMark}${fileText()}`).recent).toEqual(['snared']);
    });

    it('trims the searches and the names', () => {
      const text = fileText({ recent: ['  snared \n'], saved: [{ name: ' Payoffs ', query: ' uses:vulnerable ' }] });

      expect(importedAlone(text)).toEqual(history(['snared'], [savedSearch('uses:vulnerable', 'Payoffs')]));
    });

    it('drops a blank search and keeps one search once, the first place it has', () => {
      const text = fileText({
        recent: ['weak', '', '   ', 'snared', ' weak'],
        saved: [savedSearch('a', 'First'), { name: 'x', query: '' }, savedSearch('a', 'Second')],
      });

      expect(importedAlone(text)).toEqual(history(['weak', 'snared'], [savedSearch('a', 'First')]));
    });

    it('names a saved search after its text when the name is blank', () => {
      const text = fileText({ recent: [], saved: [{ name: '  ', query: 'class:life' }] });

      expect(importedAlone(text).saved).toEqual([savedSearch('class:life')]);
    });

    it('ignores what it does not know, which a later version may add', () => {
      const text = fileText({
        exportedAt: '2026-10-20',
        saved: [{ name: 'Payoffs', query: 'uses:vulnerable', starred: true }],
      });

      expect(importedAlone(text)).toEqual(history(['snared'], [savedSearch('uses:vulnerable', 'Payoffs')]));
    });
  });

  describe('a file that is refused, and changes nothing', () => {
    const current = history(['mine'], [savedSearch('mine saved')]);

    function expectRefused(text: string, reason: ImportRefusal): void {
      expect(importHistory(text, current)).toEqual({ ok: false, reason });
    }

    it('says "not-json" for text that is not JSON: a file cut short, a page, nothing at all', () => {
      expectRefused('', 'not-json');
      expectRefused('   ', 'not-json');
      expectRefused('<!doctype html>', 'not-json');
      expectRefused(fileText().slice(0, -10), 'not-json');
      expectRefused(`${fileText()}${fileText()}`, 'not-json');
    });

    it('says "foreign" for JSON that is not a search history of this app', () => {
      for (const text of ['null', '42', '"text"', 'true', '[]', '[1, 2]', '{}']) expectRefused(text, 'foreign');
      expectRefused(JSON.stringify({ recent: ['a'], saved: [] }), 'foreign');
      expectRefused(fileText({ app: 'another-app' }), 'foreign');
      expectRefused(fileText({ app: undefined }), 'foreign');
      expectRefused(fileText({ kind: 'party' }), 'foreign');
      expectRefused(fileText({ kind: undefined }), 'foreign');
    });

    it('says "wrong-version" for a file of another version, a number or not, or of none', () => {
      expectRefused(fileText({ version: 2 }), 'wrong-version');
      expectRefused(fileText({ version: 0 }), 'wrong-version');
      expectRefused(fileText({ version: '1' }), 'wrong-version');
      expectRefused(fileText({ version: 1.5 }), 'wrong-version');
      expectRefused(fileText({ version: null }), 'wrong-version');
      expectRefused(fileText({ version: undefined }), 'wrong-version');
    });

    it('says "malformed" when a list is not a list of what it should hold', () => {
      expectRefused(fileText({ recent: undefined }), 'malformed');
      expectRefused(fileText({ recent: 'snared' }), 'malformed');
      expectRefused(fileText({ recent: ['snared', 7] }), 'malformed');
      expectRefused(fileText({ recent: [null] }), 'malformed');
      expectRefused(fileText({ saved: undefined }), 'malformed');
      expectRefused(fileText({ saved: {} }), 'malformed');
      expectRefused(fileText({ saved: ['uses:vulnerable'] }), 'malformed');
      expectRefused(fileText({ saved: [null] }), 'malformed');
      expectRefused(fileText({ saved: [[]] }), 'malformed');
      expectRefused(fileText({ saved: [{ name: 'Payoffs' }] }), 'malformed');
      expectRefused(fileText({ saved: [{ name: 'Payoffs', query: 3 }] }), 'malformed');
      expectRefused(fileText({ saved: [{ name: 3, query: 'weak' }] }), 'malformed');
      expectRefused(fileText({ saved: [{ query: 'weak' }] }), 'malformed');
    });

    it('says "too-large" for a file with more searches than the app ever keeps', () => {
      expectRefused(fileText({ recent: numbered(MAX_RECENT + 1, 'a') }), 'too-large');
      expectRefused(fileText({ saved: numbered(MAX_SAVED + 1, 'a').map((query) => savedSearch(query)) }), 'too-large');
    });

    it('says "too-large" for a search that is a pasted text, and for a name that is one', () => {
      const pasted = 'a'.repeat(MAX_SEARCH_LENGTH + 1);

      expectRefused(fileText({ recent: [pasted] }), 'too-large');
      expectRefused(fileText({ saved: [savedSearch(pasted)] }), 'too-large');
      expectRefused(fileText({ saved: [savedSearch('weak', pasted)] }), 'too-large');
    });

    it('says "too-large" for a file bigger than any this app writes, without reading it', () => {
      expectRefused(`[${'0,'.repeat(MAX_FILE_LENGTH)}0]`, 'too-large');
    });

    it('accepts the limits themselves', () => {
      const edge = 'a'.repeat(MAX_SEARCH_LENGTH);
      const text = fileText({
        recent: numbered(MAX_RECENT, 'a'),
        saved: [...numbered(MAX_SAVED - 1, 'b').map((query) => savedSearch(query)), savedSearch(edge)],
      });

      expect(importHistory(text, emptySearchHistory).ok).toBe(true);
    });
  });

  it('takes the biggest file the app can write: the longest searches, every character escaped', () => {
    // A control character is written as six (`\u0001`): the worst case for the size of the text.
    const heaviest = (prefix: string) => `${prefix}${'\u0001'.repeat(MAX_SEARCH_LENGTH - prefix.length)}`;
    const searches = history(
      numbered(MAX_RECENT, 'r').map((query) => heaviest(query)),
      numbered(MAX_SAVED, 's').map((query) => savedSearch(heaviest(query), heaviest(`${query} named`))),
    );
    const text = exportHistory(searches);

    expect(text.length).toBeLessThanOrEqual(MAX_FILE_LENGTH);
    expect(importedAlone(text)).toEqual(searches);
  });

  describe('whatever the text', () => {
    /** Any JSON, and the file with the right words around it but anything inside. */
    const anyText = fc.oneof(
      fc.string(),
      fc.jsonValue().map((value) => JSON.stringify(value)),
      fc
        .record({ recent: fc.jsonValue(), saved: fc.jsonValue(), version: fc.oneof(fc.constant(1), fc.jsonValue()) })
        .map(({ recent, saved, version }) =>
          JSON.stringify({ app: 'trait-atlas', kind: 'search-history', version, recent, saved }),
        ),
    );

    it('never throws, and gives a history within the limits or a refusal that leaves the current one alone', () => {
      const current = history(['mine'], [savedSearch('mine saved')]);

      fc.assert(
        fc.property(anyText, (text) => {
          const result = importHistory(text, current);
          if (!result.ok) return;

          const saves = result.history.saved.map((search) => search.query);
          expect(result.history.recent.length).toBeLessThanOrEqual(MAX_RECENT);
          expect(result.history.saved.length).toBeLessThanOrEqual(MAX_SAVED);
          expect(new Set(result.history.recent).size).toBe(result.history.recent.length);
          expect(new Set(saves).size).toBe(saves.length);
          for (const query of [...result.history.recent, ...saves]) {
            expect(query).toBe(query.trim());
            expect(query).not.toBe('');
          }
          expect(result.history.recent.slice(0, current.recent.length)).toEqual(current.recent);
          expect(result.history.saved.slice(0, current.saved.length)).toEqual(current.saved);
        }),
      );
    });

    it('imports what it exports, for any history the lists allow', () => {
      const search = fc.stringMatching(/^[^\s](.{0,20}[^\s])?$/);
      const anyHistory = fc.record({
        recent: fc.uniqueArray(search, { maxLength: MAX_RECENT }),
        saved: fc.uniqueArray(fc.record({ name: search, query: search }), {
          selector: (saved) => saved.query,
          maxLength: MAX_SAVED,
        }),
      });

      fc.assert(
        fc.property(anyHistory, (searches) => {
          expect(importedAlone(exportHistory(searches))).toEqual(searches);
        }),
      );
    });

    it('is idempotent for any file', () => {
      fc.assert(
        fc.property(anyText, (text) => {
          const first = importHistory(text, emptySearchHistory);
          if (!first.ok) return;

          const second = importHistory(text, first.history);

          expect(second.ok && second.history).toEqual(first.history);
        }),
      );
    });
  });
});
