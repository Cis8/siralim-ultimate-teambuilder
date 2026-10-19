import {
  decodePartyState,
  emptyParty,
  initialPartyState,
  withTraitAt,
  type PartyState,
  type SlotPosition,
} from '@atlas/core';
import { describe, expect, it } from 'vitest';
import {
  decodeSynergyView,
  encodeSynergyView,
  initialSynergyView,
  SYNERGY_PARAMS,
  SYNERGY_SECTIONS,
  synergyAddress,
  type SynergySection,
  type SynergyState,
} from './synergy-address';

const read = (search: string) => decodeSynergyView(new URLSearchParams(search));

const SLOTS: readonly SlotPosition[] = [
  { member: 0, slot: 'innate' },
  { member: 0, slot: 'fused' },
  { member: 0, slot: 'artifact' },
];
/** A party with these traits in the first slots of the first creature, and the target on the Fused slot of the second. */
const partyOf = (...ids: string[]): PartyState => ({
  party: SLOTS.slice(0, ids.length).reduce(
    (built, at, index) => withTraitAt(built, at, ids[index] ?? null),
    emptyParty,
  ),
  target: { member: 1, slot: 'fused' },
});
const stateWith = (overrides: Partial<SynergyState>): SynergyState => ({
  ...initialSynergyView,
  party: initialPartyState,
  datasetVersion: '2.0',
  ...overrides,
});

const page = new URL('https://example.test/siralim-ultimate-teambuilder/synergy/life--mender');

describe('decodeSynergyView', () => {
  it('is the initial view for an address that names none', () => {
    expect(read('')).toEqual(initialSynergyView);
    expect(read('party=2.0,life--mender&target=1-fused&q=weak')).toEqual(initialSynergyView);
  });

  it('reads the artifact filter from mat=yes, as the search does: whatever the case and the blanks around it', () => {
    expect(read('mat=yes').matOnly).toBe(true);
    expect(read('mat=YES').matOnly).toBe(true);
    expect(read('mat=%20yes%20').matOnly).toBe(true);
  });

  it.each(['', 'no', 'true', '1', 'yes,no', 'null', 'ye'])('does not read mat=%j as the filter', (value) => {
    expect(read(`mat=${encodeURIComponent(value)}`).matOnly).toBe(false);
  });

  it.each(SYNERGY_SECTIONS)('reads the section %s', (section) => {
    expect(read(`section=${section}`).section).toBe(section);
  });

  it('reads a section whatever the case and the blanks around it', () => {
    expect(read('section=Enables').section).toBe('enables');
    expect(read('section=%20enabled-by%20').section).toBe('enabled-by');
  });

  it.each(['', 'enabled by', 'enables,alternatives', 'party', '2', 'null', '%E0%A4%A'])(
    'has no section for a name that is none: %j',
    (value) => {
      expect(read(`section=${value}`).section).toBeUndefined();
    },
  );

  it('reads the first of two values', () => {
    expect(read('section=enables&section=related').section).toBe('enables');
    expect(read('mat=no&mat=yes').matOnly).toBe(false);
  });
});

describe('encodeSynergyView', () => {
  it('writes nothing for the initial view, so that its address is the plain one', () => {
    expect(encodeSynergyView(initialSynergyView)).toEqual([]);
  });

  it('writes the filter and the section, in that order', () => {
    expect(encodeSynergyView({ matOnly: true, section: 'alternatives' })).toEqual([
      ['mat', 'yes'],
      ['section', 'alternatives'],
    ]);
  });

  it('is read back as it was written, for every view', () => {
    for (const matOnly of [false, true]) {
      for (const section of [undefined, ...SYNERGY_SECTIONS] as (SynergySection | undefined)[]) {
        const view = { matOnly, section };
        const written = new URLSearchParams(encodeSynergyView(view).map(([name, value]) => [name, value]));
        expect(read(written.toString())).toEqual(view);
      }
    }
  });

  it('writes only parameters that SYNERGY_PARAMS lists, so that an address can be cleared of them', () => {
    const names = encodeSynergyView({ matOnly: true, section: 'enables' }).map(([name]) => name);

    expect(names.every((name) => SYNERGY_PARAMS.some((own) => own === name))).toBe(true);
  });
});

describe('synergyAddress', () => {
  it('is the page itself for the initial state', () => {
    expect(synergyAddress(page, stateWith({})).href).toBe(page.href);
  });

  it('writes the view and then the party, readable the way SPEC §7 shows them', () => {
    const address = synergyAddress(
      page,
      stateWith({ matOnly: true, section: 'enables', party: partyOf('life--mender', 'death--plague') }),
    );

    expect(address.search).toBe('?mat=yes&section=enables&party=2.0,life--mender,death--plague&target=2-fused');
  });

  it('keeps the path, the hash and the parameters that are none of its own', () => {
    const current = new URL('https://example.test/base/synergy/kw/weak?ref=chat&mat=yes&party=1.0,x#top');

    const address = synergyAddress(current, stateWith({ party: partyOf('life--mender') }));

    expect(address.pathname).toBe('/base/synergy/kw/weak');
    expect(address.hash).toBe('#top');
    expect(address.searchParams.get('ref')).toBe('chat');
    expect(address.searchParams.has('mat')).toBe(false);
    expect(address.searchParams.get('party')).toBe('2.0,life--mender');
  });

  it('drops the party and the view when the state has none', () => {
    const current = new URL(
      'https://example.test/synergy?mat=yes&section=enables&party=2.0,life--mender&target=2-fused',
    );

    expect(synergyAddress(current, stateWith({})).href).toBe('https://example.test/synergy');
  });

  it('writes a party under the version the state names, or an empty one when it has none yet', () => {
    const withVersion = (datasetVersion: string | null) =>
      synergyAddress(page, stateWith({ party: partyOf('life--mender'), datasetVersion })).searchParams.get('party');

    expect(withVersion('3.1')).toBe('3.1,life--mender');
    expect(withVersion(null)).toBe(',life--mender');
  });

  it('is read back as it was written: the view and the party', () => {
    const state = stateWith({
      matOnly: true,
      section: 'related',
      party: partyOf('life--mender', 'death--plague'),
    });

    const params = synergyAddress(page, state).searchParams;

    expect(decodeSynergyView(params)).toEqual({ matOnly: true, section: 'related' });
    expect(decodePartyState(params)).toEqual({ ...state.party, datasetVersion: '2.0' });
  });
});
