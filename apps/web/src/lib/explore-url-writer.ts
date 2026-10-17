import type { ExploreState } from '@atlas/core';
import { exploreAddress } from './explore-address';

/** How long the query must stay as typed before the address follows it. */
export const TYPING_PAUSE_MS = 400;

export type HistoryEntry = 'replace' | 'push';

/** The address bar and the history behind it: the router in the page, a stand-in in a test. */
export interface AddressBar {
  /** Where the history is now. */
  current(): URL;
  /** Goes to `url`, in place of the current history entry or as a new one; settles once the page is there. */
  go(url: URL, entry: HistoryEntry): Promise<void>;
}

/**
 * Keeps the address in step with the Explore state (SPEC §7, ADR-0005). It only writes: the page reads an address when it
 * is opened and when the browser arrives at another one.
 */
export interface ExploreUrlWriter {
  /**
   * The query bar changed. Typing is a stretch of one history entry: the address is replaced once the text has stayed as
   * it is for `TYPING_PAUSE_MS`, which also keeps a browser's limit on how often the history may be changed far away.
   */
  typed(state: ExploreState): void;
  /** A facet, a chip, a click on a keyword or the sort changed: a new history entry, so that back undoes just that. */
  chosen(state: ExploreState): void;
  /** The browser went to `address` by itself (back, forward, a link): what was waiting to be written is out of date. */
  arrived(address: URL): void;
}

export function createExploreUrlWriter(bar: AddressBar, pauseMs: number = TYPING_PAUSE_MS): ExploreUrlWriter {
  // Where the history will be once what was asked has been done; read from the bar when first needed, as it is not there
  // when the page is prerendered.
  let address: URL | undefined;
  let typing: { readonly state: ExploreState; readonly timer: ReturnType<typeof setTimeout> } | undefined;
  // One navigation at a time: a router drops the one in flight when another starts, and with it a history entry.
  let writes: Promise<void> = Promise.resolve();

  function write(state: ExploreState, entry: HistoryEntry): void {
    const from = (address ??= bar.current());
    const next = exploreAddress(from, state);
    if (next.href === from.href) return;
    address = next;
    writes = writes
      .then(() => bar.go(next, entry))
      // The history is a convenience: after a failure the next write starts from where it really is.
      .catch(() => {
        address = bar.current();
      });
  }

  function settleTyping(): void {
    if (typing === undefined) return;
    clearTimeout(typing.timer);
    const { state } = typing;
    typing = undefined;
    write(state, 'replace');
  }

  return {
    typed(state) {
      if (typing !== undefined) clearTimeout(typing.timer);
      typing = { state, timer: setTimeout(settleTyping, pauseMs) };
    },
    chosen(state) {
      settleTyping();
      write(state, 'push');
    },
    arrived(arrivedAt) {
      if (typing !== undefined) clearTimeout(typing.timer);
      typing = undefined;
      address = arrivedAt;
    },
  };
}
