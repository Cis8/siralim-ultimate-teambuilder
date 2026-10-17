import {
  decodeExploreState,
  decodePartyState,
  emptyParty,
  initialExploreState,
  initialPartyState,
  withTraitAt,
  type ExploreState,
  type PartyState,
} from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { pageAddress } from './page-address';
import type { PageState } from './page-state';

const page = new URL('https://example.test/siralim-ultimate-teambuilder/');
const stateWith = (overrides: Partial<ExploreState>): PageState => ({
  explore: { ...initialExploreState, ...overrides },
  party: initialPartyState,
  datasetVersion: '2.0',
});
const partyWith = (party: PartyState): PageState => ({ explore: initialExploreState, party, datasetVersion: '2.0' });

describe('pageAddress: the search', () => {
  it('is the page itself for the initial state', () => {
    expect(pageAddress(page, stateWith({})).href).toBe(page.href);
  });

  it('writes the state as parameters, readable the way SPEC §7 shows them', () => {
    const address = pageAddress(
      page,
      stateWith({
        query: 'weak OR snared',
        classes: ['life', 'nature'],
        keywords: [
          { field: 'applies', key: 'vulnerable' },
          { field: 'kw', key: 'start of battle' },
        ],
        keywordMode: 'any',
        artifactEligible: true,
        doesNotStack: true,
        sort: 'az',
      }),
    );

    expect(address.search).toBe(
      '?q=weak+OR+snared&class=life,nature&kw=a:vulnerable,k:start+of+battle&mode=any&mat=yes&stack=no&sort=az',
    );
  });

  it('keeps the path and the hash', () => {
    const address = pageAddress(new URL('https://example.test/base/#top'), stateWith({ query: 'weak' }));

    expect(address.pathname).toBe('/base/');
    expect(address.hash).toBe('#top');
  });

  it('replaces the parameters of a search and keeps the others, in their place', () => {
    const current = new URL('https://example.test/?tab=party&q=old&class=death');

    const address = pageAddress(current, stateWith({ query: 'new' }));

    expect(address.searchParams.get('q')).toBe('new');
    expect(address.searchParams.has('class')).toBe(false);
    expect(address.searchParams.get('tab')).toBe('party');
  });

  it('drops the parameters of a search that has gone back to the initial state', () => {
    const current = new URL('https://example.test/?q=old&sort=az&tab=party');

    expect(pageAddress(current, stateWith({})).search).toBe('?tab=party');
  });

  it('leaves the address it was given as it was', () => {
    const current = new URL('https://example.test/?q=old');

    pageAddress(current, stateWith({ query: 'new' }));

    expect(current.href).toBe('https://example.test/?q=old');
  });

  it.each<[string, Partial<ExploreState>]>([
    ['a query with operators and brackets', { query: '(vulnerable OR weak) -stack:no "start of battle"' }],
    ['characters that mean something in an address', { query: 'a&b=c#d?e+f%g/h\\i' }],
    ['blanks at both ends and between words', { query: '  two  words  ' }],
    ['letters beyond ASCII', { query: 'Čaçador “ü” 日本' }],
    ['a name with a comma and a percent sign', { classes: ['a,b', '100%'] }],
    ['a keyword with a colon', { keywords: [{ field: 'uses', key: 'time: stop' }] }],
    ['every field at once', { query: 'x', classes: ['life'], keywordMode: 'any', doesNotStack: true, sort: 'class' }],
  ])('is read back as the same state: %s', (_, overrides) => {
    const state = stateWith(overrides);

    const address = pageAddress(page, state);

    expect(decodeExploreState(address.searchParams)).toEqual(state.explore);
  });

  it('is read back as the same state after the browser has parsed it again', () => {
    const state = stateWith({ query: 'a,b:c d', classes: ['a,b'], keywords: [{ field: 'applies', key: 'x,y' }] });

    const reparsed = new URL(pageAddress(page, state).href);

    expect(decodeExploreState(reparsed.searchParams)).toEqual(state.explore);
  });
});

describe('pageAddress: the party', () => {
  const party = withTraitAt(
    withTraitAt(emptyParty, { member: 0, slot: 'innate' }, 'abomination--sin-and-sentence'),
    { member: 1, slot: 'artifact' },
    'life--mender',
  );

  it('writes the party as SPEC §7 shows it, the commas as they are', () => {
    const address = pageAddress(page, partyWith({ party, target: { member: 2, slot: 'fused' } }));

    expect(address.search).toBe('?party=2.0,abomination--sin-and-sentence,,,,,life--mender&target=3-fused');
  });

  it('is the page itself for an empty party with the target on its first slot', () => {
    expect(pageAddress(page, partyWith(initialPartyState)).href).toBe(page.href);
  });

  it('writes the search before the party, and keeps both when only one changes', () => {
    const state = { ...stateWith({ query: 'weak' }), party: { party, target: { member: 0, slot: 'fused' } as const } };

    const address = pageAddress(page, state);
    const again = pageAddress(address, { ...state, explore: { ...state.explore, query: 'snared' } });

    expect([...address.searchParams.keys()]).toEqual(['q', 'party']);
    expect(again.searchParams.get('q')).toBe('snared');
    expect(again.searchParams.get('party')).toBe(address.searchParams.get('party'));
  });

  it('replaces the parameters of an older party', () => {
    const current = new URL('https://example.test/?party=1.0,old--one&target=4-innate&tab=party');

    const address = pageAddress(current, partyWith(initialPartyState));

    expect(address.search).toBe('?tab=party');
  });

  it('writes the version the party is under, empty when there is none to state', () => {
    const state = { ...partyWith({ party, target: { member: 0, slot: 'fused' } }), datasetVersion: null };

    expect(pageAddress(page, state).searchParams.get('party')).toBe(',abomination--sin-and-sentence,,,,,life--mender');
  });

  it('is read back as the same party, target and version', () => {
    const state = partyWith({ party, target: { member: 4, slot: 'artifact' } });

    const reparsed = new URL(pageAddress(page, state).href);

    expect(decodePartyState(reparsed.searchParams)).toEqual({ ...state.party, datasetVersion: '2.0' });
  });
});
