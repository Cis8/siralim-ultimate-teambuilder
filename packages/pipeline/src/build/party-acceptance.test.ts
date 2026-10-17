import {
  decodePartyState,
  emptyParty,
  encodePartyState,
  partyCoverage,
  SLOT_POSITIONS,
  withTraitAt,
  type Party,
  type Trait,
  type UrlParams,
} from '@atlas/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRealSheet } from '../testing/real-build';

// Acceptance criteria 6 and 7 (docs/ROADMAP.md) on the pinned snapshot of the compendium, v2.0: a party link restores the
// same party, and two copies of a non-stacking trait are flagged. The address is also kept short enough to be pasted into
// a chat (docs/PLAN.md, 6.5).

/** Where the app is served from (ADR-0001): the longest address a party link starts with. */
const APP_ADDRESS = 'https://cis8.github.io/siralim-ultimate-teambuilder/';

/** The address of the app with these parameters, every comma escaped as the browser's serializer writes it. */
function addressOf(params: UrlParams): URL {
  const address = new URL(APP_ADDRESS);
  for (const [name, value] of params) address.searchParams.append(name, value);
  return address;
}

/** The traits in the first slots, in reading order. */
function partyOf(traits: readonly Trait[]): Party {
  return SLOT_POSITIONS.slice(0, traits.length).reduce(
    (party, at, index) => withTraitAt(party, at, traits[index]?.id ?? null),
    emptyParty,
  );
}

/** One trait in two slots far from each other. */
const twoCopiesOf = (trait: Trait): Party =>
  withTraitAt(
    withTraitAt(emptyParty, { member: 0, slot: 'innate' }, trait.id),
    { member: 4, slot: 'artifact' },
    trait.id,
  );

describe('the party planner on the compendium v2.0', () => {
  let datasetVersion: string;
  let traits: readonly Trait[];

  beforeAll(async () => {
    ({ datasetVersion, traits } = await buildRealSheet());
  });

  const lookupOf = () => {
    const byId = new Map(traits.map((trait) => [trait.id, trait]));
    return (id: string) => byId.get(id);
  };

  describe('the party link (criterion 6)', () => {
    it('restores a party of real traits with its target and its version', () => {
      const party = partyOf(traits.filter((_, index) => index % 97 === 0).slice(0, 18));
      const target = { member: 3, slot: 'fused' } as const;

      const address = addressOf(encodePartyState({ party, target }, datasetVersion));

      expect(decodePartyState(address.searchParams)).toEqual({ party, target, datasetVersion });
    });

    it('stays below 1,000 characters for a full party of the 18 longest ids', () => {
      const longest = [...traits].sort((a, b) => b.id.length - a.id.length).slice(0, 18);
      const party = partyOf(longest);

      const address = addressOf(encodePartyState({ party, target: { member: 5, slot: 'artifact' } }, datasetVersion));

      expect(address.href.length).toBeLessThan(1000);
    });
  });

  describe('non-stacking duplicates (criterion 7)', () => {
    it('flags two copies of any trait that says it does not stack, wherever they are', () => {
      const lookup = lookupOf();
      const notFlagged = traits
        .filter((trait) => !trait.stacks)
        .filter((trait) => {
          const { duplicates } = partyCoverage(twoCopiesOf(trait), lookup);
          return duplicates.length !== 1 || duplicates[0]?.trait.id !== trait.id;
        });

      expect(notFlagged.map(({ id }) => id)).toEqual([]);
    });

    it('flags no trait that stacks', () => {
      const lookup = lookupOf();
      const flagged = traits
        .filter((trait) => trait.stacks)
        .filter((trait) => partyCoverage(twoCopiesOf(trait), lookup).duplicates.length > 0);

      expect(flagged.map(({ id }) => id)).toEqual([]);
    });
  });
});
