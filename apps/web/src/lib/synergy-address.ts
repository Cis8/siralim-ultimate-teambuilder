import { encodePartyState, PARTY_PARAMS, type ParamReader, type PartyState, type UrlParams } from '@atlas/core';
import { readableSearch } from './readable-search';

/**
 * The parts of a Synergy page a narrow screen shows one at a time (`section=`): the trait view's four, then the keyword view's
 * two. Which of them a page has is up to the page; an address may name any, and a page that has no such part ignores it.
 */
export const SYNERGY_SECTIONS = ['enabled-by', 'enables', 'alternatives', 'related', 'appliers', 'users'] as const;
export type SynergySection = (typeof SYNERGY_SECTIONS)[number];

/** What a Synergy address says besides which page it is (the path) and the party it carries (SPEC §7). */
export interface SynergyView {
  /** Only traits that have a material, as the search's flag does (`mat=yes`). */
  readonly matOnly: boolean;
  /** The part a narrow screen shows; none: the page's first. */
  readonly section: SynergySection | undefined;
}

export const initialSynergyView: SynergyView = { matOnly: false, section: undefined };

/** The parameters of the view, in the order they are written. A page that shares its address with the party clears these first. */
export const SYNERGY_PARAMS = ['mat', 'section'] as const;

/** Everything a Synergy address stands for besides its path: the view, and the party under the version of the dataset in use. */
export interface SynergyState extends SynergyView {
  readonly party: PartyState;
  /** As `PageState.datasetVersion`: the version the party is written under, `null` when there is none yet. */
  readonly datasetVersion: string | null;
}

const spelled = (value: string | null): string | undefined => value?.trim().toLowerCase();

/** Reads the view an address stands for. Any address is one: what is missing or says nothing usable is the initial view. */
export function decodeSynergyView(params: ParamReader): SynergyView {
  const section = spelled(params.get('section'));
  return {
    matOnly: spelled(params.get('mat')) === 'yes',
    section: SYNERGY_SECTIONS.find((name) => name === section),
  };
}

/** The parameters that make an address stand for `view`: only those that differ from the initial view. */
export function encodeSynergyView({ matOnly, section }: SynergyView): UrlParams {
  return [
    ...(matOnly ? [['mat', 'yes'] as const] : []),
    ...(section === undefined ? [] : [['section', section] as const]),
  ];
}

/**
 * The address that stands for `state` on the page `current` is at. The parameters of the view and of the party are replaced;
 * the path, the hash and whatever else the address carries stay as they are.
 */
export function synergyAddress(current: URL, { party, datasetVersion, ...view }: SynergyState): URL {
  const params = new URLSearchParams(current.search);
  for (const name of [...SYNERGY_PARAMS, ...PARTY_PARAMS]) params.delete(name);
  for (const [name, value] of encodeSynergyView(view)) params.append(name, value);
  for (const [name, value] of encodePartyState(party, datasetVersion ?? '')) params.append(name, value);

  const address = new URL(current);
  address.search = readableSearch(params.toString());
  return address;
}

/** Any origin and path do: only the query string of the address is wanted. */
const NOWHERE = new URL('https://synergy.invalid/');

/**
 * The query string (without its `?`) that stands for `state`: what a link to a Synergy page carries. It is the one `synergyAddress`
 * writes, in the same order, so that a page opened by a link finds its address as the writer would have made it.
 */
export function synergySearch(state: SynergyState): string {
  return synergyAddress(NOWHERE, state).search.slice(1);
}
