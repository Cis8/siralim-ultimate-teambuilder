import { describe, expect, it } from 'vitest';
import type { KeywordHit, KeywordKind, KeywordRole, Trait } from '../model/trait';
import { emptyParty, SLOT_POSITIONS, withTraitAt, type Party, type SlotPosition } from './party';
import { partyCoverage, type TraitLookup } from './party-coverage';

function keyword(key: string, role: KeywordRole, kind: KeywordKind = 'debuff'): KeywordHit {
  return { key, kind, role, span: [0, key.length] };
}

function trait(id: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: id,
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: 'Heals an ally.',
    material: 'Ferrous Ore',
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    conditionalSources: [],
    ...overrides,
  };
}

const at = (member: SlotPosition['member'], slot: SlotPosition['slot']): SlotPosition => ({ member, slot });

/** A party with each trait in the slot given, and a lookup that knows exactly those traits. */
function setUp(placed: readonly (readonly [SlotPosition, Trait])[]): { party: Party; lookup: TraitLookup } {
  const byId = new Map(placed.map(([, placedTrait]) => [placedTrait.id, placedTrait]));
  const party = placed.reduce(
    (built, [position, placedTrait]) => withTraitAt(built, position, placedTrait.id),
    emptyParty,
  );
  return { party, lookup: (id) => byId.get(id) };
}

describe('partyCoverage: what the party applies and relies on', () => {
  it('has nothing to say about an empty party', () => {
    expect(partyCoverage(emptyParty, () => undefined)).toEqual({ applies: [], relies: [], duplicates: [] });
  });

  it('lists what the traits apply, once each, in the order of the slots', () => {
    const { party, lookup } = setUp([
      [at(2, 'innate'), trait('late--one', { keywords: [keyword('weak', 'applies')] })],
      [
        at(0, 'fused'),
        trait('early--one', { keywords: [keyword('vulnerable', 'applies'), keyword('weak', 'applies')] }),
      ],
      [at(1, 'artifact'), trait('middle--one', { keywords: [keyword('vulnerable', 'applies')] })],
    ]);

    expect(partyCoverage(party, lookup).applies).toEqual(['vulnerable', 'weak']);
  });

  it('covers what a trait relies on when another trait of the party applies it', () => {
    const { party, lookup } = setUp([
      [at(0, 'innate'), trait('needs--vulnerable', { keywords: [keyword('vulnerable', 'uses')] })],
      [at(3, 'fused'), trait('gives--vulnerable', { keywords: [keyword('vulnerable', 'applies')] })],
    ]);

    expect(partyCoverage(party, lookup).relies).toEqual([{ key: 'vulnerable', status: 'covered' }]);
  });

  it('calls missing what a trait relies on and nothing in the party applies', () => {
    const { party, lookup } = setUp([
      [at(0, 'innate'), trait('needs--snared', { keywords: [keyword('snared', 'uses')] })],
      [at(1, 'innate'), trait('gives--weak', { keywords: [keyword('weak', 'applies')] })],
    ]);

    expect(partyCoverage(party, lookup).relies).toEqual([{ key: 'snared', status: 'missing' }]);
  });

  it('lists what is relied on once, in the order of the slots, when several traits rely on it', () => {
    const { party, lookup } = setUp([
      [at(0, 'innate'), trait('a--one', { keywords: [keyword('weak', 'uses'), keyword('snared', 'uses')] })],
      [at(1, 'innate'), trait('b--two', { keywords: [keyword('snared', 'uses'), keyword('barrier', 'uses', 'buff')] })],
    ]);

    expect(partyCoverage(party, lookup).relies.map(({ key }) => key)).toEqual(['weak', 'snared', 'barrier']);
  });

  it('counts a trait that applies and relies on the same keyword as its own source', () => {
    const { party, lookup } = setUp([
      [at(0, 'innate'), trait('self--sufficient', { keywords: [keyword('weak', 'uses'), keyword('weak', 'applies')] })],
    ]);

    expect(partyCoverage(party, lookup).relies).toEqual([{ key: 'weak', status: 'covered' }]);
  });

  it('does not take a mention that only guards against a keyword for a source or a dependency (GAME_RULES R9)', () => {
    const { party, lookup } = setUp([
      [at(0, 'innate'), trait('immune--to-silence', { keywords: [keyword('silenced', 'resists')] })],
    ]);

    expect(partyCoverage(party, lookup)).toEqual({ applies: [], relies: [], duplicates: [] });
  });

  it('works for buffs and effects as it does for debuffs', () => {
    const { party, lookup } = setUp([
      [at(0, 'innate'), trait('needs--wolves', { keywords: [keyword('dire wolves', 'uses', 'effect')] })],
      [at(0, 'fused'), trait('gives--barrier', { keywords: [keyword('barrier', 'applies', 'buff')] })],
    ]);

    expect(partyCoverage(party, lookup)).toMatchObject({
      applies: ['barrier'],
      relies: [{ key: 'dire wolves', status: 'missing' }],
    });
  });

  it('ignores mechanics and flags: they have no role', () => {
    const noRole: KeywordHit = { key: 'timeline', kind: 'mechanic', span: [0, 8] };
    const { party, lookup } = setUp([[at(0, 'innate'), trait('mechanic--one', { keywords: [noRole] })]]);

    expect(partyCoverage(party, lookup)).toEqual({ applies: [], relies: [], duplicates: [] });
  });

  // GAME_RULES R12: attacking, casting and provoking are the player's choices, and turns, damage and deaths happen by
  // themselves, so a trait that waits for one never needs the party to supply it, and one that causes it supplies nothing.
  it('ignores events: none is a dependency, none is a source', () => {
    const { party, lookup } = setUp([
      [at(0, 'innate'), trait('waits--for-attack', { keywords: [keyword('attack', 'uses', 'event')] })],
      [at(0, 'fused'), trait('causes--attack', { keywords: [keyword('attack', 'applies', 'event')] })],
      [at(1, 'innate'), trait('stops--death', { keywords: [keyword('death', 'resists', 'event')] })],
      [at(1, 'fused'), trait('needs--weak', { keywords: [keyword('weak', 'uses')] })],
    ]);

    expect(partyCoverage(party, lookup)).toEqual({
      applies: [],
      relies: [{ key: 'weak', status: 'missing' }],
      duplicates: [],
    });
  });

  it('takes a mastery trait for a source, active or not (D6)', () => {
    const { party, lookup } = setUp([
      [at(0, 'innate'), trait('needs--weak', { keywords: [keyword('weak', 'uses')] })],
      [
        at(5, 'artifact'),
        trait('master-of-abominations', {
          kind: 'mastery',
          keywords: [keyword('weak', 'applies')],
          partyRequirement: { type: 'allFamily', families: ['Abomination'] },
        }),
      ],
    ]);

    expect(partyCoverage(party, lookup).relies).toEqual([{ key: 'weak', status: 'covered' }]);
  });

  it('does not take a random or a conditional source for a source: those wait for Phase 3 (GAME_RULES R5, R10)', () => {
    const { party, lookup } = setUp([
      [at(0, 'innate'), trait('needs--weak', { keywords: [keyword('weak', 'uses')] })],
      [at(1, 'innate'), trait('random--debuff', { randomDebuff: { target: 'enemy', activation: 'unconditional' } })],
      [at(2, 'innate'), trait('either--of-two', { conditionalSources: ['weak', 'snared'] })],
    ]);

    expect(partyCoverage(party, lookup).relies).toEqual([{ key: 'weak', status: 'missing' }]);
  });

  it('passes over an id the dataset does not know: a shared party can come from another version (SPEC §5)', () => {
    const { party } = setUp([[at(0, 'innate'), trait('gone--from-the-sheet')]]);

    expect(partyCoverage(party, () => undefined)).toEqual({ applies: [], relies: [], duplicates: [] });
  });
});

describe('partyCoverage: duplicates of a non-stacking trait (GAME_RULES R4)', () => {
  const noStack = trait('manipulate--fear', { name: 'Manipulate Fear', stacks: false });

  it('flags a non-stacking trait that appears twice, with where', () => {
    const { party, lookup } = setUp([
      [at(1, 'innate'), noStack],
      [at(4, 'artifact'), noStack],
    ]);

    expect(partyCoverage(party, lookup).duplicates).toEqual([
      { trait: noStack, positions: [at(1, 'innate'), at(4, 'artifact')] },
    ]);
  });

  it('flags it once with every place when it appears three times', () => {
    const { party, lookup } = setUp([
      [at(0, 'artifact'), noStack],
      [at(2, 'fused'), noStack],
      [at(5, 'innate'), noStack],
    ]);

    expect(partyCoverage(party, lookup).duplicates).toEqual([
      { trait: noStack, positions: [at(0, 'artifact'), at(2, 'fused'), at(5, 'innate')] },
    ]);
  });

  it('flags several traits in the order their first copy appears', () => {
    const other = trait('other--one', { stacks: false });
    const { party, lookup } = setUp([
      [at(0, 'innate'), other],
      [at(1, 'innate'), noStack],
      [at(2, 'innate'), noStack],
      [at(3, 'innate'), other],
    ]);

    expect(partyCoverage(party, lookup).duplicates.map((duplicate) => duplicate.trait.id)).toEqual([
      'other--one',
      'manipulate--fear',
    ]);
  });

  it('does not flag a non-stacking trait that appears once', () => {
    const { party, lookup } = setUp([[at(0, 'innate'), noStack]]);

    expect(partyCoverage(party, lookup).duplicates).toEqual([]);
  });

  it('does not flag two copies of a trait that stacks', () => {
    const stacking = trait('stacks--fine');
    const { party, lookup } = setUp([
      [at(0, 'innate'), stacking],
      [at(1, 'innate'), stacking],
    ]);

    expect(partyCoverage(party, lookup).duplicates).toEqual([]);
  });

  it('does not flag an id the dataset does not know, since it cannot tell whether that trait stacks', () => {
    const party = withTraitAt(withTraitAt(emptyParty, at(0, 'innate'), 'gone--one'), at(1, 'innate'), 'gone--one');

    expect(partyCoverage(party, () => undefined).duplicates).toEqual([]);
  });

  it('flags two copies wherever they are: any two of the 18 slots (acceptance criterion 7)', () => {
    for (const [index, first] of SLOT_POSITIONS.entries()) {
      for (const second of SLOT_POSITIONS.slice(index + 1)) {
        const { party, lookup } = setUp([
          [first, noStack],
          [second, noStack],
        ]);

        expect(partyCoverage(party, lookup).duplicates).toEqual([{ trait: noStack, positions: [first, second] }]);
      }
    }
  });
});
