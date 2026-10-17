import { initialExploreState, type ExploreState } from '@atlas/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createExploreUrlWriter, TYPING_PAUSE_MS, type AddressBar, type HistoryEntry } from './explore-url-writer';

const start = 'https://example.test/app/';
const stateWith = (overrides: Partial<ExploreState>): ExploreState => ({ ...initialExploreState, ...overrides });

/** An address bar that remembers where it has gone; `go` settles when the test says so unless it is given a way. */
function addressBar(initial = start) {
  let current = new URL(initial);
  const gone: { href: string; entry: HistoryEntry }[] = [];
  const pending: { settle: (outcome: 'done' | 'fail') => void }[] = [];
  let manual = false;
  const bar: AddressBar = {
    current: () => current,
    go: (url, entry) => {
      gone.push({ href: url.href, entry });
      current = url;
      if (!manual) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        pending.push({
          settle: (outcome) => {
            if (outcome === 'done') resolve();
            else reject(new Error('navigation failed'));
          },
        });
      });
    },
  };
  return {
    bar,
    gone,
    settleByHand: () => {
      manual = true;
    },
    settleNext: (outcome: 'done' | 'fail' = 'done') => pending.shift()?.settle(outcome),
    moveTo: (url: string) => {
      current = new URL(url);
    },
  };
}

const queryOf = (href: string) => new URL(href).searchParams.get('q');

describe('createExploreUrlWriter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('while the query is typed', () => {
    it('writes nothing until typing pauses, then replaces the entry once, with what was typed last', async () => {
      const { bar, gone } = addressBar();
      const writer = createExploreUrlWriter(bar);

      for (const query of ['w', 'we', 'wea', 'weak']) {
        writer.typed(stateWith({ query }));
        await vi.advanceTimersByTimeAsync(TYPING_PAUSE_MS - 1);
      }
      expect(gone).toEqual([]);

      await vi.advanceTimersByTimeAsync(1);
      expect(gone).toEqual([{ href: `${start}?q=weak`, entry: 'replace' }]);
    });

    it('writes nothing when the text is back to what the address already says', async () => {
      const { bar, gone } = addressBar();
      const writer = createExploreUrlWriter(bar);

      writer.typed(stateWith({ query: 'w' }));
      writer.typed(stateWith({ query: '' }));
      await vi.advanceTimersByTimeAsync(TYPING_PAUSE_MS);

      expect(gone).toEqual([]);
    });

    it('replaces again, not pushes, for the next pause: one entry for a stretch of typing', async () => {
      const { bar, gone } = addressBar();
      const writer = createExploreUrlWriter(bar);

      writer.typed(stateWith({ query: 'weak' }));
      await vi.advanceTimersByTimeAsync(TYPING_PAUSE_MS);
      writer.typed(stateWith({ query: 'weak OR snared' }));
      await vi.advanceTimersByTimeAsync(TYPING_PAUSE_MS);

      expect(gone.map(({ entry }) => entry)).toEqual(['replace', 'replace']);
    });
  });

  describe('when something is chosen', () => {
    it('pushes a new entry at once', async () => {
      const { bar, gone } = addressBar();
      const writer = createExploreUrlWriter(bar);

      writer.chosen(stateWith({ classes: ['life'] }));
      await vi.advanceTimersByTimeAsync(0);

      expect(gone).toEqual([{ href: `${start}?class=life`, entry: 'push' }]);
    });

    it('writes nothing for a choice that leaves the address as it is', async () => {
      const { bar, gone } = addressBar(`${start}?class=life`);
      const writer = createExploreUrlWriter(bar);

      writer.chosen(stateWith({ classes: ['life'] }));
      await vi.advanceTimersByTimeAsync(0);

      expect(gone).toEqual([]);
    });

    it('first leaves what was typed in the entry it was typed in, so that back returns to it', async () => {
      const { bar, gone } = addressBar();
      const writer = createExploreUrlWriter(bar);

      writer.typed(stateWith({ query: 'weak' }));
      writer.chosen(stateWith({ query: 'weak', classes: ['life'] }));
      await vi.advanceTimersByTimeAsync(0);

      expect(gone).toEqual([
        { href: `${start}?q=weak`, entry: 'replace' },
        { href: `${start}?q=weak&class=life`, entry: 'push' },
      ]);
    });

    it('does not write the typed text a second time when the pause runs out', async () => {
      const { bar, gone } = addressBar();
      const writer = createExploreUrlWriter(bar);

      writer.typed(stateWith({ query: 'weak' }));
      writer.chosen(stateWith({ query: 'weak', classes: ['life'] }));
      await vi.advanceTimersByTimeAsync(TYPING_PAUSE_MS * 2);

      expect(gone).toHaveLength(2);
    });
  });

  it('leaves the other parameters of the address alone', async () => {
    const { bar, gone } = addressBar(`${start}?party=abc&q=old`);
    const writer = createExploreUrlWriter(bar);

    writer.chosen(stateWith({ query: 'old', classes: ['death'] }));
    await vi.advanceTimersByTimeAsync(0);

    expect(new URL(gone[0]?.href ?? '').searchParams.get('party')).toBe('abc');
  });

  describe('writes made one after another', () => {
    it('waits for a navigation to be over before the next starts, so that none supersedes the one before', async () => {
      const { bar, gone, settleByHand, settleNext } = addressBar();
      settleByHand();
      const writer = createExploreUrlWriter(bar);

      writer.typed(stateWith({ query: 'weak' }));
      writer.chosen(stateWith({ query: 'weak', classes: ['life'] }));
      await vi.advanceTimersByTimeAsync(TYPING_PAUSE_MS);
      expect(gone.map(({ entry }) => entry)).toEqual(['replace']);

      settleNext();
      await vi.advanceTimersByTimeAsync(0);
      expect(gone.map(({ entry }) => entry)).toEqual(['replace', 'push']);
    });

    it('goes on after a navigation that failed, from where the address really is', async () => {
      const { bar, gone, settleByHand, settleNext, moveTo } = addressBar();
      settleByHand();
      const writer = createExploreUrlWriter(bar);

      writer.chosen(stateWith({ classes: ['life'] }));
      await vi.advanceTimersByTimeAsync(0);
      moveTo(`${start}?party=abc`);
      settleNext('fail');
      await vi.advanceTimersByTimeAsync(0);
      writer.chosen(stateWith({ classes: ['life', 'death'] }));
      await vi.advanceTimersByTimeAsync(0);

      const last = new URL(gone.at(-1)?.href ?? '');
      expect(gone).toHaveLength(2);
      expect(last.searchParams.get('party')).toBe('abc');
      expect(last.searchParams.get('class')).toBe('life,death');
    });
  });

  describe('when the browser goes to another address by itself (back, forward, a link)', () => {
    it('forgets the text that was waiting to be written', async () => {
      const { bar, gone } = addressBar();
      const writer = createExploreUrlWriter(bar);

      writer.typed(stateWith({ query: 'weak' }));
      writer.arrived(new URL(`${start}?class=life`));
      await vi.advanceTimersByTimeAsync(TYPING_PAUSE_MS);

      expect(gone).toEqual([]);
    });

    it('writes from the address it arrived at', async () => {
      const { bar, gone } = addressBar();
      const writer = createExploreUrlWriter(bar);

      writer.chosen(stateWith({ classes: ['life'] }));
      writer.arrived(new URL(`${start}?party=abc`));
      writer.chosen(stateWith({ query: 'weak' }));
      await vi.advanceTimersByTimeAsync(0);

      const last = gone.at(-1)?.href ?? '';
      expect(queryOf(last)).toBe('weak');
      expect(new URL(last).searchParams.get('party')).toBe('abc');
      expect(new URL(last).searchParams.has('class')).toBe(false);
    });

    it('does not write the state that is already the address', async () => {
      const { bar, gone } = addressBar();
      const writer = createExploreUrlWriter(bar);

      writer.arrived(new URL(`${start}?class=life&sort=az`));
      writer.chosen(stateWith({ classes: ['life'], sort: 'az' }));
      await vi.advanceTimersByTimeAsync(0);

      expect(gone).toEqual([]);
    });
  });
});
