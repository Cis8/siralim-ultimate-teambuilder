import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ParamReader, UrlParams } from '../url/url-params';
import { emptyParty, SLOT_POSITIONS, traitAt, withTraitAt, type Party, type SlotPosition } from './party';
import { decodePartyState, encodePartyState, PARTY_PARAMS } from './party-url';
import { firstEmptySlot } from './target-strategy';

/** An address with exactly these parameters, as the page reads it. */
function reader(pairs: readonly (readonly [string, string])[]): ParamReader {
  const values = new Map(pairs);
  return { get: (name) => values.get(name) ?? null };
}

const decode = (...pairs: (readonly [string, string])[]) => decodePartyState(reader(pairs));

const at = (member: SlotPosition['member'], slot: SlotPosition['slot']): SlotPosition => ({ member, slot });

function partyOf(placed: readonly (readonly [SlotPosition, string])[]): Party {
  return placed.reduce((built, [position, id]) => withTraitAt(built, position, id), emptyParty);
}

describe('decodePartyState', () => {
  it('reads an address with no parameter as an empty party with the target on the first slot', () => {
    expect(decode()).toEqual({ party: emptyParty, target: at(0, 'innate'), datasetVersion: null });
  });

  it('reads the dataset version and then the slots in reading order, an empty item for an empty slot', () => {
    const shared = decode(['party', '2.0,a--one,,b--two,c--three']);

    expect(shared.datasetVersion).toBe('2.0');
    expect(shared.party).toEqual(
      partyOf([
        [at(0, 'innate'), 'a--one'],
        [at(0, 'artifact'), 'b--two'],
        [at(1, 'innate'), 'c--three'],
      ]),
    );
  });

  it('keeps the id of a trait the dataset does not know: whether it is there is for the page to say (SPEC §5)', () => {
    const shared = decode(['party', '1.5,gone--from-the-sheet']);

    expect(traitAt(shared.party, at(0, 'innate'))).toBe('gone--from-the-sheet');
  });

  it('reads a version and no slot as an empty party made on that version', () => {
    expect(decode(['party', '2.0'])).toEqual({ party: emptyParty, target: at(0, 'innate'), datasetVersion: '2.0' });
  });

  it('reads the slots of an address that states no version', () => {
    const shared = decode(['party', ',a--one']);

    expect(shared.datasetVersion).toBeNull();
    expect(traitAt(shared.party, at(0, 'innate'))).toBe('a--one');
  });

  it('ignores what is beyond the 18th slot', () => {
    const ids = Array.from({ length: 25 }, (_, index) => `t--${String(index)}`);

    const { party } = decode(['party', ['2.0', ...ids].join(',')]);

    expect(traitAt(party, at(5, 'artifact'))).toBe('t--17');
  });

  it('trims the blanks around an item and reads an item of blanks as an empty slot', () => {
    const { party } = decode(['party', ' 2.0 , a--one ,   ,b--two']);

    expect(party).toEqual(
      partyOf([
        [at(0, 'innate'), 'a--one'],
        [at(0, 'artifact'), 'b--two'],
      ]),
    );
  });

  it('reads an escaped comma or percent sign as itself', () => {
    expect(traitAt(decode(['party', '2.0,a%252Cb']).party, at(0, 'innate'))).toBe('a%2Cb');
  });

  describe('the target', () => {
    it('is the first empty slot of the party when the address names none', () => {
      const { party, target } = decode(['party', '2.0,a--one,b--two']);

      expect(target).toEqual(at(0, 'artifact'));
      expect(target).toEqual(firstEmptySlot(party));
    });

    it.each([
      ['1-innate', at(0, 'innate')],
      ['3-fused', at(2, 'fused')],
      ['6-artifact', at(5, 'artifact')],
      [' 3-Fused ', at(2, 'fused')],
    ])('is the slot %j names', (value, expected) => {
      expect(decode(['target', value]).target).toEqual(expected);
    });

    it('is read even when the address holds no party', () => {
      expect(decode(['target', '4-artifact'])).toEqual({
        party: emptyParty,
        target: at(3, 'artifact'),
        datasetVersion: null,
      });
    });

    it.each(['', '0-innate', '7-innate', '3-head', '3', 'fused', '3-fused-2', '-fused', '3 fused', '03-fused'])(
      'is the first empty slot when %j names no slot',
      (value) => {
        expect(decode(['party', '2.0,a--one'], ['target', value]).target).toEqual(at(0, 'fused'));
      },
    );
  });
});

describe('encodePartyState', () => {
  it('writes nothing for an empty party with the target on its first empty slot, the initial state', () => {
    expect(encodePartyState({ party: emptyParty, target: at(0, 'innate') }, '2.0')).toEqual([]);
  });

  it('writes the version and the slots in reading order, leaving out the empty slots at the end', () => {
    const party = partyOf([
      [at(0, 'innate'), 'a--one'],
      [at(0, 'artifact'), 'b--two'],
      [at(1, 'innate'), 'c--three'],
    ]);

    expect(encodePartyState({ party, target: firstEmptySlot(party) }, '2.0')).toEqual([
      ['party', '2.0,a--one,,b--two,c--three'],
    ]);
  });

  it('writes the target only when it is not the first empty slot, 1-based as the page numbers the creatures', () => {
    const party = partyOf([[at(0, 'innate'), 'a--one']]);

    expect(encodePartyState({ party, target: at(2, 'fused') }, '2.0')).toEqual([
      ['party', '2.0,a--one'],
      ['target', '3-fused'],
    ]);
  });

  it('writes a target alone when the party is empty', () => {
    expect(encodePartyState({ party: emptyParty, target: at(5, 'artifact') }, '2.0')).toEqual([
      ['target', '6-artifact'],
    ]);
  });

  it('writes only the parameters of PARTY_PARAMS, so that a page can clear them before it writes', () => {
    const party = partyOf([[at(0, 'innate'), 'a--one']]);

    for (const [name] of encodePartyState({ party, target: at(4, 'fused') }, '2.0')) {
      expect(PARTY_PARAMS).toContain(name);
    }
  });

  it('escapes a comma or a percent sign inside an id, so that the id never splits in two', () => {
    const party = partyOf([[at(0, 'innate'), 'a,b']]);

    expect(encodePartyState({ party, target: at(0, 'fused') }, '2.0')).toEqual([['party', '2.0,a%2Cb']]);
  });
});

describe('a party written and read back', () => {
  const slug = fc.stringMatching(/^[a-z0-9]+(--?[a-z0-9]+){0,3}$/);
  const version = fc.stringMatching(/^[0-9]+(\.[0-9]+){0,2}$/);
  const party = fc
    .array(fc.tuple(fc.constantFrom(...SLOT_POSITIONS), fc.option(slug, { nil: null })), { maxLength: 40 })
    .map((writes) => writes.reduce((built, [position, id]) => withTraitAt(built, position, id), emptyParty));
  const target = fc.constantFrom(...SLOT_POSITIONS);

  function readBack(written: UrlParams) {
    return decodePartyState(reader(written));
  }

  it('is the party and the target that were written', () => {
    fc.assert(
      fc.property(party, target, version, (built, chosen, datasetVersion) => {
        const shared = readBack(encodePartyState({ party: built, target: chosen }, datasetVersion));

        expect(shared.party).toEqual(built);
        expect(shared.target).toEqual(chosen);
      }),
    );
  });

  it('carries the version, unless the party is empty and there was nothing to say it of', () => {
    fc.assert(
      fc.property(party, target, version, (built, chosen, datasetVersion) => {
        const shared = readBack(encodePartyState({ party: built, target: chosen }, datasetVersion));

        const isEmpty = SLOT_POSITIONS.every((position) => traitAt(built, position) === null);
        expect(shared.datasetVersion).toBe(isEmpty ? null : datasetVersion);
      }),
    );
  });

  it('writes the same address for the same party', () => {
    fc.assert(
      fc.property(party, target, version, (built, chosen, datasetVersion) => {
        const first = encodePartyState({ party: built, target: chosen }, datasetVersion);
        const again = readBack(first);

        expect(encodePartyState(again, datasetVersion)).toEqual(first);
      }),
    );
  });
});
