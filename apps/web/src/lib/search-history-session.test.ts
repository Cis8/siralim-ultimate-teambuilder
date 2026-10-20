import {
  emptySearchHistory,
  exportHistory,
  importHistory,
  MAX_SAVED,
  type SearchHistory,
  type SavedSearch,
} from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { createSearchHistorySession } from './search-history-session';
import type { SearchHistoryStore } from './search-history-store';

/**
 * A store in memory that counts what is written to it, and can be made to lose the browser's storage (`'lost'`: it cannot be read).
 * Each load gives a history of its own, as reading the text of a storage does.
 */
function memoryStore(start: SearchHistory | 'lost' = emptySearchHistory) {
  const state: { kept: SearchHistory | undefined; saves: number } = {
    kept: start === 'lost' ? undefined : start,
    saves: 0,
  };
  const store: SearchHistoryStore = {
    load: () => state.kept && { recent: [...state.kept.recent], saved: [...state.kept.saved] },
    save: (history) => {
      state.saves += 1;
      if (state.kept !== undefined) state.kept = history;
    },
  };
  return { store, state };
}

const saved = (query: string): SavedSearch => ({ name: query, query });

describe('createSearchHistorySession', () => {
  it('starts empty, and reads what the browser kept once it is loaded', () => {
    const kept: SearchHistory = { recent: ['weak'], saved: [saved('uses:weak')] };
    const session = createSearchHistorySession({ store: memoryStore(kept).store });
    expect(session.history).toEqual(emptySearchHistory);

    session.load();

    expect(session.history).toEqual(kept);
  });

  describe('record', () => {
    it('remembers a search as the newest, and keeps it for the next visit', () => {
      const { store, state } = memoryStore();
      const session = createSearchHistorySession({ store });

      session.record('weak');
      session.record('applies:snared');

      expect(session.history.recent).toEqual(['applies:snared', 'weak']);
      expect(state.kept?.recent).toEqual(['applies:snared', 'weak']);
    });

    it('writes nothing for a search that changes nothing: a blank one, or the newest again', () => {
      const { store, state } = memoryStore();
      const session = createSearchHistorySession({ store });
      session.record('weak');
      const writes = state.saves;

      session.record('   ');
      session.record(' weak ');

      expect(state.saves).toBe(writes);
    });
  });

  describe('toggleSaved', () => {
    it('saves a search and remembers it as recent: saving is a way of having searched it', () => {
      const { store, state } = memoryStore();
      const session = createSearchHistorySession({ store });

      const result = session.toggleSaved('uses:weak');

      expect(result.ok).toBe(true);
      expect(session.history).toEqual({ recent: ['uses:weak'], saved: [saved('uses:weak')] });
      expect(state.kept).toEqual(session.history);
    });

    it('takes a saved search off again and leaves it among the recent ones', () => {
      const session = createSearchHistorySession({ store: memoryStore().store });
      session.toggleSaved('uses:weak');

      const result = session.toggleSaved('uses:weak');

      expect(result.ok).toBe(true);
      expect(session.history).toEqual({ recent: ['uses:weak'], saved: [] });
    });

    it('says why it did not save, and changes nothing', () => {
      const session = createSearchHistorySession({ store: memoryStore().store });

      expect(session.toggleSaved('   ')).toEqual({ ok: false, reason: 'empty' });
      expect(session.toggleSaved('x'.repeat(2001))).toEqual({ ok: false, reason: 'too-long' });
      expect(session.history).toEqual(emptySearchHistory);
    });

    it('refuses a search when the places are taken, never swapping one the person kept', () => {
      const full: SearchHistory = {
        recent: [],
        saved: Array.from({ length: MAX_SAVED }, (_, at) => saved(`weak ${String(at)}`)),
      };
      const { store, state } = memoryStore(full);
      const session = createSearchHistorySession({ store });
      session.load();

      expect(session.toggleSaved('one more')).toEqual({ ok: false, reason: 'full' });

      expect(session.history).toEqual(full);
      expect(state.saves).toBe(0);
    });
  });

  describe('removeRecent and removeSaved', () => {
    it('forget one list at a time', () => {
      const session = createSearchHistorySession({ store: memoryStore().store });
      session.toggleSaved('uses:weak');
      session.record('applies:snared');

      session.removeRecent('uses:weak');
      expect(session.history).toEqual({ recent: ['applies:snared'], saved: [saved('uses:weak')] });

      session.removeSaved('uses:weak');
      expect(session.history).toEqual({ recent: ['applies:snared'], saved: [] });
    });
  });

  describe('importFile and exportFile', () => {
    it('gives the file back whole, so that importing it into an empty session restores the history', () => {
      const first = createSearchHistorySession({ store: memoryStore().store });
      first.toggleSaved('uses:weak');
      first.record('applies:snared');
      const file = first.exportFile();

      const second = createSearchHistorySession({ store: memoryStore().store });
      const result = second.importFile(file);

      expect(result.ok).toBe(true);
      expect(second.history).toEqual(first.history);
    });

    it('merges a file into what the session has, keeps the outcome for the browser and says what it added', () => {
      const { store, state } = memoryStore();
      const session = createSearchHistorySession({ store });
      session.record('weak');
      const file = exportHistory({ recent: ['weak', 'snared'], saved: [saved('uses:weak')] });

      const result = session.importFile(file);

      expect(result).toMatchObject({ ok: true, added: { recent: 1, saved: 1 } });
      expect(session.history.recent).toEqual(['weak', 'snared']);
      expect(state.kept).toEqual(session.history);
    });

    it('refuses a file that is not this app’s whole, and leaves everything as it was', () => {
      const { store, state } = memoryStore();
      const session = createSearchHistorySession({ store });
      session.record('weak');
      const writes = state.saves;
      const before = session.history;

      const result = session.importFile('{ "not": "a history" }');

      expect(result).toEqual({ ok: false, reason: 'foreign' });
      expect(session.history).toBe(before);
      expect(state.saves).toBe(writes);
    });

    it('writes nothing for a file that adds nothing', () => {
      const { store, state } = memoryStore();
      const session = createSearchHistorySession({ store });
      session.record('weak');
      const writes = state.saves;

      const result = session.importFile(exportHistory(session.history));

      expect(result).toMatchObject({ ok: true, added: { recent: 0, saved: 0 } });
      expect(state.saves).toBe(writes);
    });

    it('agrees with the core on what a file holds', () => {
      const session = createSearchHistorySession({ store: memoryStore().store });
      session.record('weak');

      expect(importHistory(session.exportFile(), emptySearchHistory)).toMatchObject({
        ok: true,
        history: { recent: ['weak'] },
      });
    });
  });

  describe('two pages of the app open at once', () => {
    it('applies a change to what the browser keeps, not to what this page last saw', () => {
      const { store, state } = memoryStore();
      const session = createSearchHistorySession({ store });
      session.record('weak');
      // Another tab saved a search meanwhile.
      state.kept = { recent: ['uses:weak', 'weak'], saved: [saved('uses:weak')] };

      session.record('applies:snared');

      expect(state.kept).toEqual({ recent: ['applies:snared', 'uses:weak', 'weak'], saved: [saved('uses:weak')] });
      expect(session.history).toEqual(state.kept);
    });
  });

  describe('when the browser keeps nothing (a private window, blocked site data)', () => {
    it('still holds the history of this visit', () => {
      const { store } = memoryStore('lost');
      const session = createSearchHistorySession({ store });

      session.record('weak');
      session.toggleSaved('uses:weak');
      session.record('applies:snared');

      expect(session.history).toEqual({
        recent: ['applies:snared', 'uses:weak', 'weak'],
        saved: [saved('uses:weak')],
      });
    });

    it('does not drop the history it holds when it loads', () => {
      const { store } = memoryStore('lost');
      const session = createSearchHistorySession({ store });
      session.record('weak');

      session.load();

      expect(session.history.recent).toEqual(['weak']);
    });
  });

  describe('subscribe', () => {
    it('tells the listener after each change, and stops when it is told to', () => {
      const session = createSearchHistorySession({ store: memoryStore().store });
      let told = 0;
      const stop = session.subscribe(() => {
        told += 1;
      });

      session.record('weak');
      session.toggleSaved('uses:weak');
      session.removeRecent('weak');
      expect(told).toBe(3);

      stop();
      session.record('applies:snared');
      expect(told).toBe(3);
    });

    it('tells nothing of a change that changes nothing', () => {
      const session = createSearchHistorySession({ store: memoryStore().store });
      session.record('weak');
      let told = 0;
      session.subscribe(() => {
        told += 1;
      });

      session.record('weak');
      session.record('  ');
      session.removeSaved('never saved');
      session.toggleSaved('');

      expect(told).toBe(0);
    });
  });
});
