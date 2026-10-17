import { readList, writeList, type ParamReader, type UrlParams } from '../url/url-params';
import {
  emptyParty,
  MEMBER_INDEXES,
  sameSlot,
  SLOT_NAMES,
  SLOT_POSITIONS,
  traitAt,
  withTraitAt,
  type SlotName,
  type SlotPosition,
} from './party';
import type { PartyState } from './party-state';
import { firstEmptySlot } from './target-strategy';

/**
 * The parameters of the party, in the order they are written (SPEC §7). A page that shares its address with other views
 * (the search) clears these and adds what `encodePartyState` returns.
 */
export const PARTY_PARAMS = ['party', 'target'] as const;

/** What an address holds: a party, and the version of the dataset it was made on (`null` when it states none). */
export interface SharedParty extends PartyState {
  readonly datasetVersion: string | null;
}

/**
 * Reads the party an address stands for. Any address is one: what is missing or says nothing usable is an empty slot, and
 * a target that names no slot is the first empty one. Ids are kept as they are, known to the dataset or not (SPEC §5).
 */
export function decodePartyState(params: ParamReader): SharedParty {
  const [datasetVersion = '', ...ids] = readList(params.get('party')).map((item) => item.trim());
  const party = SLOT_POSITIONS.reduce((built, position, index) => {
    const id = ids[index];
    return withTraitAt(built, position, id === undefined || id === '' ? null : id);
  }, emptyParty);
  return {
    party,
    target: targetOf(params.get('target')) ?? firstEmptySlot(party),
    datasetVersion: datasetVersion === '' ? null : datasetVersion,
  };
}

/**
 * The parameters that make an address stand for `state`, made on the dataset `datasetVersion`: only those that differ
 * from the initial state, so that an empty party with its target on the first slot has none.
 *
 * `party` is a list like the ones of the search: the version, then the id of each slot in reading order, empty where a slot
 * is. The empty slots at the end are left out. Ids are slugs (SPEC §5), which is what keeps this shorter than any
 * encoding that has to hide a separator: even 18 of the longest ids of v2.0 stay below 1,000 characters.
 */
export function encodePartyState({ party, target }: PartyState, datasetVersion: string): UrlParams {
  const ids = SLOT_POSITIONS.map((position) => traitAt(party, position) ?? '');
  const used = ids.findLastIndex((id) => id !== '') + 1;
  const params: readonly (readonly [string, string | undefined])[] = [
    ['party', used === 0 ? undefined : writeList([datasetVersion, ...ids.slice(0, used)])],
    ['target', sameSlot(target, firstEmptySlot(party)) ? undefined : writeTarget(target)],
  ];
  return params.flatMap(([name, value]) => (value === undefined ? [] : [[name, value] as const]));
}

/** The creatures are numbered from 1, as the page shows them: `3-fused` is the Fused slot of the third. */
const writeTarget = ({ member, slot }: SlotPosition): string => `${String(member + 1)}-${slot}`;

function targetOf(text: string | null): SlotPosition | undefined {
  const named = /^([1-6])-(innate|fused|artifact)$/u.exec(text?.trim().toLowerCase() ?? '');
  if (named === null) return undefined;
  const member = MEMBER_INDEXES[Number(named[1]) - 1];
  const slot = SLOT_NAMES.find((name: SlotName) => name === named[2]);
  return member === undefined || slot === undefined ? undefined : { member, slot };
}
