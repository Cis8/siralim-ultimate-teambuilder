import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  emptySearchHistory,
  isSaved,
  MAX_RECENT,
  MAX_SAVED,
  MAX_SEARCH_LENGTH,
  recordRecent,
  removeRecent,
  removeSaved,
  toggleSaved,
  type SearchHistory,
} from './search-history';

function recordAll(queries: readonly string[], from: SearchHistory = emptySearchHistory): SearchHistory {
  return queries.reduce(recordRecent, from);
}

/** Saves a query that the history accepts: a refusal here would be a mistake in the test. */
function saved(history: SearchHistory, query: string): SearchHistory {
  const result = toggleSaved(history, query);
  if (!result.ok) throw new Error(`the query was refused: ${result.reason}`);
  return result.history;
}

function numbered(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `weak ${String(index)}`);
}

describe('recordRecent', () => {
  it('puts the newest search first', () => {
    const history = recordAll(['weak', 'applies:snared', 'class:life']);

    expect(history.recent).toEqual(['class:life', 'applies:snared', 'weak']);
  });

  it('trims the search, as the search itself reads it', () => {
    expect(recordRecent(emptySearchHistory, '  weak OR snared \n').recent).toEqual(['weak OR snared']);
  });

  it('records nothing for a blank search and gives the very same history back', () => {
    const history = recordAll(['weak']);

    expect(recordRecent(history, '')).toBe(history);
    expect(recordRecent(history, ' \t\n')).toBe(history);
  });

  it('moves a search that is already there to the front instead of listing it twice', () => {
    const history = recordAll(['weak', 'snared', 'life']);

    expect(recordRecent(history, 'weak').recent).toEqual(['weak', 'life', 'snared']);
  });

  it('counts a search that differs only in the blanks around it as the same one', () => {
    const history = recordAll(['weak', 'snared']);

    expect(recordRecent(history, '  weak  ').recent).toEqual(['weak', 'snared']);
  });

  it('gives the very same history back when the newest search is recorded again', () => {
    const history = recordAll(['snared', 'weak']);

    expect(recordRecent(history, 'weak')).toBe(history);
  });

  it('tells searches apart by their exact text, letter case included', () => {
    expect(recordAll(['Weak', 'weak']).recent).toEqual(['weak', 'Weak']);
  });

  it('keeps the newest ten and lets the oldest go', () => {
    const history = recordAll(numbered(MAX_RECENT + 3));

    expect(history.recent).toHaveLength(MAX_RECENT);
    expect(history.recent[0]).toBe(`weak ${String(MAX_RECENT + 2)}`);
    expect(history.recent.at(-1)).toBe('weak 3');
  });

  it('does not touch the saved searches', () => {
    const history = saved(emptySearchHistory, 'weak');

    expect(recordRecent(history, 'snared').saved).toBe(history.saved);
  });

  it('refuses to remember a pasted text, which is no search', () => {
    const history = recordAll(['weak']);

    expect(recordRecent(history, 'a'.repeat(MAX_SEARCH_LENGTH + 1))).toBe(history);
    expect(recordRecent(history, 'a'.repeat(MAX_SEARCH_LENGTH)).recent).toHaveLength(2);
  });

  it('does not change the history it was given', () => {
    const history = recordAll(['weak', 'snared']);

    recordRecent(history, 'life');

    expect(history.recent).toEqual(['snared', 'weak']);
  });
});

describe('toggleSaved', () => {
  it('saves a search under its own text as the name', () => {
    const result = toggleSaved(emptySearchHistory, '  uses:vulnerable mat:yes ');

    expect(result).toEqual({
      ok: true,
      history: { recent: [], saved: [{ name: 'uses:vulnerable mat:yes', query: 'uses:vulnerable mat:yes' }] },
    });
  });

  it('lists the searches in the order they were saved', () => {
    const history = saved(saved(saved(emptySearchHistory, 'weak'), 'snared'), 'life');

    expect(history.saved.map((search) => search.query)).toEqual(['weak', 'snared', 'life']);
  });

  it('takes a saved search off when it is toggled again', () => {
    const history = saved(saved(emptySearchHistory, 'weak'), 'snared');

    const result = toggleSaved(history, ' weak ');

    expect(result).toEqual({ ok: true, history: { recent: [], saved: [{ name: 'snared', query: 'snared' }] } });
  });

  it('is its own inverse', () => {
    const history = saved(emptySearchHistory, 'weak');

    expect(toggleSaved(saved(history, 'snared'), 'snared')).toEqual({ ok: true, history });
  });

  it('refuses a blank search and says it is empty', () => {
    expect(toggleSaved(emptySearchHistory, '  ')).toEqual({ ok: false, reason: 'empty' });
  });

  it('refuses a pasted text, which is no search', () => {
    expect(toggleSaved(emptySearchHistory, 'a'.repeat(MAX_SEARCH_LENGTH + 1))).toEqual({
      ok: false,
      reason: 'too-long',
    });
    expect(toggleSaved(emptySearchHistory, 'a'.repeat(MAX_SEARCH_LENGTH)).ok).toBe(true);
  });

  it('refuses a new search once fifty are saved, and loses none of them', () => {
    const full = numbered(MAX_SAVED).reduce(saved, emptySearchHistory);

    expect(full.saved).toHaveLength(MAX_SAVED);
    expect(toggleSaved(full, 'one too many')).toEqual({ ok: false, reason: 'full' });
  });

  it('still takes a search off when fifty are saved', () => {
    const full = numbered(MAX_SAVED).reduce(saved, emptySearchHistory);

    const result = toggleSaved(full, 'weak 0');

    expect(result.ok && result.history.saved).toHaveLength(MAX_SAVED - 1);
  });

  it('does not touch the recent searches', () => {
    const history = recordAll(['weak']);

    const result = toggleSaved(history, 'snared');

    expect(result.ok && result.history.recent).toBe(history.recent);
  });
});

describe('isSaved', () => {
  it('knows a saved search by its text, whatever blanks surround it', () => {
    const history = saved(emptySearchHistory, 'weak');

    expect(isSaved(history, 'weak')).toBe(true);
    expect(isSaved(history, '  weak\n')).toBe(true);
    expect(isSaved(history, 'Weak')).toBe(false);
    expect(isSaved(history, 'snared')).toBe(false);
    expect(isSaved(history, '')).toBe(false);
  });

  it('does not take a recent search for a saved one', () => {
    expect(isSaved(recordAll(['weak']), 'weak')).toBe(false);
  });
});

describe('removeRecent', () => {
  it('takes one search off the recent list and keeps the order of the others', () => {
    const history = recordAll(['weak', 'snared', 'life']);

    expect(removeRecent(history, 'snared').recent).toEqual(['life', 'weak']);
  });

  it('gives the very same history back for a search that is not there', () => {
    const history = recordAll(['weak']);

    expect(removeRecent(history, 'snared')).toBe(history);
  });

  it('leaves a saved search of the same text alone', () => {
    const history = recordAll(['weak'], saved(emptySearchHistory, 'weak'));

    expect(removeRecent(history, 'weak')).toEqual({ recent: [], saved: [{ name: 'weak', query: 'weak' }] });
  });
});

describe('removeSaved', () => {
  it('takes one search off the saved list and keeps the order of the others', () => {
    const history = ['weak', 'snared', 'life'].reduce(saved, emptySearchHistory);

    expect(removeSaved(history, 'snared').saved.map((search) => search.query)).toEqual(['weak', 'life']);
  });

  it('gives the very same history back for a search that is not saved', () => {
    const history = saved(emptySearchHistory, 'weak');

    expect(removeSaved(history, 'snared')).toBe(history);
  });

  it('leaves a recent search of the same text alone', () => {
    const history = saved(recordAll(['weak']), 'weak');

    expect(removeSaved(history, 'weak')).toEqual({ recent: ['weak'], saved: [] });
  });
});

describe('the limits, whatever is done', () => {
  /** One thing a person can do to the history. */
  interface Step {
    readonly type: 'record' | 'toggle' | 'remove-recent' | 'remove-saved';
    readonly query: string;
  }

  // A short alphabet, so that the same search comes up again; blanks around it, and nothing at all, are searches too.
  const step: fc.Arbitrary<Step> = fc.record({
    type: fc.constantFrom('record', 'toggle', 'remove-recent', 'remove-saved'),
    query: fc.stringMatching(/^ ?[abc]{0,4} ?$/),
  });

  function applied(history: SearchHistory, taken: Step): SearchHistory {
    switch (taken.type) {
      case 'record':
        return recordRecent(history, taken.query);
      case 'toggle': {
        const result = toggleSaved(history, taken.query);
        return result.ok ? result.history : history;
      }
      case 'remove-recent':
        return removeRecent(history, taken.query);
      default:
        return removeSaved(history, taken.query);
    }
  }

  it('keeps both lists within their limits, trimmed, never blank and without a repeat', () => {
    fc.assert(
      fc.property(fc.array(step, { maxLength: 200 }), (steps) => {
        const history = steps.reduce(applied, emptySearchHistory);
        const saves = history.saved.map((search) => search.query);

        expect(history.recent.length).toBeLessThanOrEqual(MAX_RECENT);
        expect(history.saved.length).toBeLessThanOrEqual(MAX_SAVED);
        expect(new Set(history.recent).size).toBe(history.recent.length);
        expect(new Set(saves).size).toBe(saves.length);
        for (const query of [...history.recent, ...saves]) {
          expect(query).toBe(query.trim());
          expect(query).not.toBe('');
        }
      }),
    );
  });
});
