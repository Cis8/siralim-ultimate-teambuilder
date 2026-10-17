import { decodePartyState, encodePartyState, isEmptyParty, type PartyState, type SharedParty } from '@atlas/core';

/** The part of a browser's `Storage` the store uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const LAST_PARTY_KEY = 'trait-atlas:last-party';

/** The party of the last visit, kept in the browser for the next one (ADR-0005: a convenience, never the source of truth). */
export interface LastPartyStore {
  /** The party saved last, `undefined` when there is none or the storage cannot be read. */
  load(): SharedParty | undefined;
  /** Remembers the party and its target under `datasetVersion`; forgets them when the party is empty. */
  save(state: PartyState, datasetVersion: string): void;
}

/**
 * The party is kept as its parameters in an address are written, so that one codec reads both (SPEC §7). `storage` is asked
 * for on every use: in a private window or with site data blocked it can be missing, or throw when it is asked for or used,
 * and then the store remembers nothing, which the page does not notice.
 */
export function createLastPartyStore(storage: () => StorageLike | undefined): LastPartyStore {
  function attempt<Result>(use: (storage: StorageLike) => Result): Result | undefined {
    try {
      const available = storage();
      return available === undefined ? undefined : use(available);
    } catch {
      return undefined;
    }
  }

  return {
    load() {
      const saved = attempt((available) => available.getItem(LAST_PARTY_KEY));
      if (saved === undefined || saved === null) return undefined;
      const shared = decodePartyState(new URLSearchParams(saved));
      return isEmptyParty(shared.party) ? undefined : shared;
    },
    save(state, datasetVersion) {
      if (isEmptyParty(state.party)) {
        attempt((available) => {
          available.removeItem(LAST_PARTY_KEY);
        });
        return;
      }
      const text = encodePartyState(state, datasetVersion)
        .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
        .join('&');
      attempt((available) => {
        available.setItem(LAST_PARTY_KEY, text);
      });
    },
  };
}
