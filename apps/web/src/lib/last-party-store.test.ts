import { emptyParty, withTraitAt, type PartyState } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { createLastPartyStore, LAST_PARTY_KEY, type StorageLike } from './last-party-store';

/** A storage that remembers in a map, and can be made to fail the way a blocked one does. */
function fakeStorage(fail: 'never' | 'always' = 'never') {
  const items = new Map<string, string>();
  const refuse = (): never => {
    throw new Error('storage is blocked');
  };
  const storage: StorageLike = {
    getItem: (key) => (fail === 'always' ? refuse() : (items.get(key) ?? null)),
    setItem: (key, value) => {
      if (fail === 'always') refuse();
      items.set(key, value);
    },
    removeItem: (key) => {
      if (fail === 'always') refuse();
      items.delete(key);
    },
  };
  return { storage, items };
}

const party = withTraitAt(
  withTraitAt(emptyParty, { member: 0, slot: 'innate' }, 'abomination--sin-and-sentence'),
  { member: 2, slot: 'artifact' },
  'life--mender',
);
const state: PartyState = { party, target: { member: 4, slot: 'fused' } };

describe('createLastPartyStore', () => {
  it('has nothing to load before anything was saved', () => {
    const { storage } = fakeStorage();

    expect(createLastPartyStore(() => storage).load()).toBeUndefined();
  });

  it('loads the party, the target and the version that were saved', () => {
    const { storage } = fakeStorage();
    const store = createLastPartyStore(() => storage);

    store.save(state, '2.0');

    expect(store.load()).toEqual({ ...state, datasetVersion: '2.0' });
  });

  it('keeps it for the next visit: a store made later over the same storage loads it', () => {
    const { storage } = fakeStorage();
    createLastPartyStore(() => storage).save(state, '2.0');

    expect(createLastPartyStore(() => storage).load()).toEqual({ ...state, datasetVersion: '2.0' });
  });

  it('keeps the party in the form an address has, under one key', () => {
    const { storage, items } = fakeStorage();

    createLastPartyStore(() => storage).save(state, '2.0');

    expect([...items.keys()]).toEqual([LAST_PARTY_KEY]);
    expect(new URLSearchParams(items.get(LAST_PARTY_KEY) ?? '').get('party')).toBe(
      '2.0,abomination--sin-and-sentence,,,,,,,,life--mender',
    );
  });

  it('replaces what was saved before', () => {
    const { storage } = fakeStorage();
    const store = createLastPartyStore(() => storage);
    store.save(state, '2.0');

    const other = { party: withTraitAt(emptyParty, { member: 1, slot: 'innate' }, 'a--one'), target: state.target };
    store.save(other, '2.1');

    expect(store.load()).toEqual({ ...other, datasetVersion: '2.1' });
  });

  it('forgets the party when it is empty: clearing it is the last thing the player did', () => {
    const { storage, items } = fakeStorage();
    const store = createLastPartyStore(() => storage);
    store.save(state, '2.0');

    store.save({ party: emptyParty, target: { member: 0, slot: 'innate' } }, '2.0');

    expect(items.size).toBe(0);
    expect(store.load()).toBeUndefined();
  });

  it('has nothing to load from a value that holds no party', () => {
    const { storage, items } = fakeStorage();
    items.set(LAST_PARTY_KEY, 'target=3-fused');

    expect(createLastPartyStore(() => storage).load()).toBeUndefined();
  });

  it('has nothing to load from a value that is not an address at all', () => {
    const { storage, items } = fakeStorage();
    items.set(LAST_PARTY_KEY, '%%%not a party%%%');

    expect(createLastPartyStore(() => storage).load()).toBeUndefined();
  });

  describe('when the storage cannot be used (a private window, blocked site data)', () => {
    it('loads nothing and does not throw', () => {
      const { storage } = fakeStorage('always');

      expect(createLastPartyStore(() => storage).load()).toBeUndefined();
    });

    it('saves nothing and does not throw', () => {
      const { storage } = fakeStorage('always');

      expect(() => {
        createLastPartyStore(() => storage).save(state, '2.0');
        createLastPartyStore(() => storage).save({ party: emptyParty, target: state.target }, '2.0');
      }).not.toThrow();
    });

    it('copes with there being no storage, or one that throws when it is asked for', () => {
      const none = createLastPartyStore(() => undefined);
      const throwing = createLastPartyStore(() => {
        throw new Error('SecurityError');
      });

      for (const store of [none, throwing]) {
        expect(store.load()).toBeUndefined();
        expect(() => {
          store.save(state, '2.0');
        }).not.toThrow();
      }
    });
  });
});
