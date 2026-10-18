import { emptyParty, withTraitAt, type MemberIndex, type SlotName, type Trait, type TraitLookup } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { slotChoices } from './slot-choices';

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

const mastery = trait('master-of-mirelings', { kind: 'mastery', creature: null });
const flesh = trait('abomination--flesh-rot', { name: 'Flesh Rot' });
const known: readonly Trait[] = [mastery, flesh];
const lookup: TraitLookup = (id) => known.find((candidate) => candidate.id === id);

const withIn = (member: MemberIndex, slot: SlotName, id: string | null, party = emptyParty) =>
  withTraitAt(party, { member, slot }, id);

describe('slotChoices', () => {
  it('lists the slots of the creature that take the trait, in the order of the creature', () => {
    const choices = slotChoices(emptyParty, 2, trait('plain'), lookup);

    expect(choices.map(({ position }) => position)).toEqual([
      { member: 2, slot: 'innate' },
      { member: 2, slot: 'fused' },
      { member: 2, slot: 'artifact' },
    ]);
  });

  it('leaves out the slots the rules refuse: a trait with no material has no Artifact slot to go in', () => {
    const choices = slotChoices(emptyParty, 0, trait('plain', { material: null }), lookup);

    expect(choices.map(({ position }) => position.slot)).toEqual(['innate', 'fused']);
  });

  it('is only the Artifact slot for a mastery, the one a mastery can go in', () => {
    const choices = slotChoices(emptyParty, 4, mastery, lookup);

    expect(choices).toEqual([{ position: { member: 4, slot: 'artifact' }, holds: { kind: 'empty' } }]);
  });

  it('is empty when no slot takes the trait: a mastery with no material', () => {
    expect(slotChoices(emptyParty, 0, { ...mastery, material: null }, lookup)).toEqual([]);
  });

  it('says a slot is empty', () => {
    const choices = slotChoices(withIn(0, 'innate', flesh.id), 0, mastery, lookup);

    expect(choices).toEqual([{ position: { member: 0, slot: 'artifact' }, holds: { kind: 'empty' } }]);
  });

  it('names the trait a slot holds, which the trait added would replace', () => {
    const party = withIn(0, 'artifact', flesh.id);

    const choices = slotChoices(party, 0, mastery, lookup);

    expect(choices).toEqual([
      { position: { member: 0, slot: 'artifact' }, holds: { kind: 'other', name: 'Flesh Rot' } },
    ]);
  });

  it('gives the id of a trait the dataset does not know, since a shared party can hold one', () => {
    const party = withIn(0, 'artifact', 'gone--from-the-sheet');

    const choices = slotChoices(party, 0, mastery, lookup);

    expect(choices[0]?.holds).toEqual({ kind: 'other', name: 'gone--from-the-sheet' });
  });

  it('says a slot holds this very trait already, which adding it again would change nothing in', () => {
    const party = withIn(0, 'artifact', mastery.id);

    const choices = slotChoices(party, 0, mastery, lookup);

    expect(choices[0]?.holds).toEqual({ kind: 'this' });
  });

  it('looks at the creature it is asked about, and at no other', () => {
    const party = withIn(1, 'artifact', flesh.id, withIn(0, 'artifact', mastery.id));

    expect(slotChoices(party, 2, mastery, lookup)[0]?.holds).toEqual({ kind: 'empty' });
  });
});
