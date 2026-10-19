import { describe, expect, it } from 'vitest';
import { synergyPlaceOf } from './synergy-place';

describe('synergyPlaceOf', () => {
  it('is the picker for the route of /synergy', () => {
    expect(synergyPlaceOf('/synergy', {})).toEqual({ page: 'picker' });
  });

  it('is a trait for the route that has its id in the path', () => {
    expect(synergyPlaceOf('/synergy/[traitId]', { traitId: 'life--mender' })).toEqual({
      page: 'trait',
      traitId: 'life--mender',
    });
  });

  it('is a keyword for the route that has its slug in the path', () => {
    expect(synergyPlaceOf('/synergy/kw/[slug]', { slug: 'mega-magic' })).toEqual({
      page: 'keyword',
      slug: 'mega-magic',
    });
  });

  it('is nowhere for a route whose parameter is missing or empty', () => {
    expect(synergyPlaceOf('/synergy/[traitId]', {})).toBeUndefined();
    expect(synergyPlaceOf('/synergy/[traitId]', { traitId: '' })).toBeUndefined();
    expect(synergyPlaceOf('/synergy/kw/[slug]', { slug: undefined })).toBeUndefined();
  });

  it.each([null, '/', '/synergy/other', '/synergy/[traitId]/extra', '/[...rest]'])(
    'is nowhere for a route that is none of the Synergy pages: %j',
    (route) => {
      expect(synergyPlaceOf(route, { traitId: 'x', slug: 'y' })).toBeUndefined();
    },
  );
});
