import {
  decodeExploreState,
  decodePartyState,
  emptyParty,
  initialExploreState,
  initialPartyState,
  withTraitAt,
  type PartyState,
} from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { carriedSearch, traitSearch } from './carried-search';

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

describe('traitSearch', () => {
  const sinAndSentence = { name: 'Sin and Sentence', family: 'Abomination' };

  it('is a search for exactly this trait: its name and its family, which an id is made of', () => {
    const search = traitSearch(sinAndSentence, { party: initialPartyState, datasetVersion: '2.0' });

    expect(decodeExploreState(new URLSearchParams(search))).toEqual({
      ...initialExploreState,
      query: 'trait:"Sin and Sentence" family:Abomination',
    });
  });

  it('quotes a name or a family of several words, which would otherwise be read as several terms', () => {
    const search = traitSearch(
      { name: 'Master of Abominations', family: 'Master of Everything' },
      {
        party: initialPartyState,
        datasetVersion: '2.0',
      },
    );

    expect(decodeExploreState(new URLSearchParams(search)).query).toBe(
      'trait:"Master of Abominations" family:"Master of Everything"',
    );
  });

  it('carries the party, so that the search opens beside the party that was being planned', () => {
    const carried = { party: party({ member: 1, slot: 'fused' }), datasetVersion: '2.0' };

    const params = new URLSearchParams(traitSearch(sinAndSentence, carried));

    expect(decodePartyState(params)).toEqual({ ...carried.party, datasetVersion: '2.0' });
    expect(decodeExploreState(params).query).toBe('trait:"Sin and Sentence" family:Abomination');
  });
});
