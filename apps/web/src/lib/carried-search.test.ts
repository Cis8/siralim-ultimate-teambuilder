import { decodePartyState, emptyParty, initialPartyState, withTraitAt, type PartyState } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { carriedSearch } from './carried-search';

const party = (target: PartyState['target']): PartyState => ({
  party: withTraitAt(
    withTraitAt(emptyParty, { member: 0, slot: 'innate' }, 'life--mender'),
    { member: 1, slot: 'innate' },
    'death--plague',
  ),
  target,
});

describe('carriedSearch', () => {
  it('is empty for an empty party, so that a link to a page is the plain address of it', () => {
    expect(carriedSearch({ party: initialPartyState, datasetVersion: '2.0' })).toBe('');
    expect(carriedSearch({ party: initialPartyState, datasetVersion: null })).toBe('');
  });

  it('writes the party the way the pages do, readable: the commas are left as they are', () => {
    const carried = { party: party({ member: 1, slot: 'fused' }), datasetVersion: '2.0' };

    expect(carriedSearch(carried)).toBe('party=2.0,life--mender,,,death--plague&target=2-fused');
  });

  it('is read back as the party it carried', () => {
    const carried = { party: party({ member: 2, slot: 'artifact' }), datasetVersion: '2.0' };

    const read = decodePartyState(new URLSearchParams(carriedSearch(carried)));

    expect(read).toEqual({ ...carried.party, datasetVersion: '2.0' });
  });

  it('writes a party that was made before the version was known under no version', () => {
    expect(carriedSearch({ party: party({ member: 1, slot: 'fused' }), datasetVersion: null })).toMatch(
      /^party=,life--mender/u,
    );
  });

  it('adds the parameters it is given after the party', () => {
    const carried = { party: party({ member: 1, slot: 'fused' }), datasetVersion: '2.0' };

    expect(carriedSearch(carried, [['tab', 'party']])).toBe(
      'party=2.0,life--mender,,,death--plague&target=2-fused&tab=party',
    );
  });

  it('is only the extra parameters for an empty party', () => {
    expect(carriedSearch({ party: initialPartyState, datasetVersion: '2.0' }, [['tab', 'party']])).toBe('tab=party');
  });
});
