import { decodeExploreState, initialExploreState, type ExploreState } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { exploreAddress } from './explore-address';

const page = new URL('https://example.test/siralim-ultimate-teambuilder/');
const stateWith = (overrides: Partial<ExploreState>): ExploreState => ({ ...initialExploreState, ...overrides });

describe('exploreAddress', () => {
  it('is the page itself for the initial state', () => {
    expect(exploreAddress(page, initialExploreState).href).toBe(page.href);
  });

  it('writes the state as parameters, readable the way SPEC §7 shows them', () => {
    const address = exploreAddress(
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
    const address = exploreAddress(new URL('https://example.test/base/#top'), stateWith({ query: 'weak' }));

    expect(address.pathname).toBe('/base/');
    expect(address.hash).toBe('#top');
  });

  it('replaces the parameters of a search and keeps the others, in their place', () => {
    const current = new URL('https://example.test/?party=abc&q=old&class=death&target=3');

    const address = exploreAddress(current, stateWith({ query: 'new' }));

    expect(address.searchParams.get('q')).toBe('new');
    expect(address.searchParams.has('class')).toBe(false);
    expect(address.searchParams.get('party')).toBe('abc');
    expect(address.searchParams.get('target')).toBe('3');
  });

  it('drops the parameters of a search that has gone back to the initial state', () => {
    const current = new URL('https://example.test/?q=old&sort=az&party=abc');

    expect(exploreAddress(current, initialExploreState).search).toBe('?party=abc');
  });

  it('leaves the address it was given as it was', () => {
    const current = new URL('https://example.test/?q=old');

    exploreAddress(current, stateWith({ query: 'new' }));

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

    const address = exploreAddress(page, state);

    expect(decodeExploreState(address.searchParams)).toEqual(state);
  });

  it('is read back as the same state after the browser has parsed it again', () => {
    const state = stateWith({ query: 'a,b:c d', classes: ['a,b'], keywords: [{ field: 'applies', key: 'x,y' }] });

    const reparsed = new URL(exploreAddress(page, state).href);

    expect(decodeExploreState(reparsed.searchParams)).toEqual(state);
  });
});
