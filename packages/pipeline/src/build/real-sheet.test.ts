import { readFileSync } from 'node:fs';
import { KNOWN_CLASSES, type Trait } from '@atlas/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildReport } from '../report/build-report';
import { buildTraits } from './build-traits';

// The pinned snapshot of the compendium, v2.0. The counts below are the ones in docs/GAME_RULES.md.
const SNAPSHOT = new URL('../../fixtures/traits-v2.0.csv', import.meta.url);

function countBy<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

describe('the compendium v2.0 snapshot', () => {
  let traits: readonly Trait[];
  let datasetVersion: string;

  beforeAll(() => {
    ({ datasetVersion, traits } = buildTraits(readFileSync(SNAPSHOT, 'utf8')));
  });

  it('is version 2.0 with 1,780 traits, each with its own id', () => {
    expect(datasetVersion).toBe('2.0');
    expect(traits).toHaveLength(1780);
    expect(new Set(traits.map((trait) => trait.id)).size).toBe(1780);
  });

  it('uses exactly the classes of GAME_RULES R7', () => {
    expect(new Set(traits.map((trait) => trait.class))).toEqual(KNOWN_CLASSES);
  });

  it('has nothing the report needs the owner to look at', () => {
    const report = buildReport({ datasetVersion, traits }, null);
    expect(report).toContain('## Needs attention\n\nNothing.');
  });

  it('has the kinds of GAME_RULES R7', () => {
    expect(countBy(traits, (trait) => trait.kind)).toEqual({
      creature: 1331,
      avatar: 31,
      mastery: 156,
      backer: 135,
      other: 127,
    });
  });

  it('has no creature on a mastery or backer trait, and one on every other', () => {
    for (const trait of traits) {
      const hasNoCreature = trait.kind === 'mastery' || trait.kind === 'backer';
      expect(trait.creature === null, trait.id).toBe(hasNoCreature);
    }
  });

  it('has the 41 traits that can never sit in the Artifact slot', () => {
    expect(traits.filter((trait) => trait.material === null)).toHaveLength(41);
  });

  it('has 723 traits that say they do not stack', () => {
    expect(traits.filter((trait) => !trait.stacks)).toHaveLength(723);
  });

  describe('mastery traits (GAME_RULES R3)', () => {
    const masteries = () => traits.filter((trait) => trait.kind === 'mastery');

    it('has the party requirements of the table', () => {
      expect(countBy(masteries(), (trait) => trait.partyRequirement?.type ?? 'missing')).toEqual({
        allFamily: 76,
        distinctFamilyCount: 2,
        perFamilyCount: 24,
        classDiversity: 1,
        familyScoped: 52,
        none: 1,
      });
    });

    it('takes the mastery family from the Family column, and only masteries have one', () => {
      for (const trait of traits) {
        expect(trait.masteryFamily, trait.id).toBe(trait.kind === 'mastery' ? trait.family : null);
      }
    });

    it('names the mastery’s own family in every requirement that names one, except two that name a pair', () => {
      for (const trait of masteries()) {
        const requirement = trait.partyRequirement;
        if (requirement === null || !('families' in requirement)) continue;
        if (trait.family === 'Imler' || trait.family === 'Imling') {
          expect(requirement.families, trait.id).toEqual(['Imler', 'Imling']);
        } else {
          expect(requirement.families, trait.id).toEqual([trait.family]);
        }
      }
    });

    it.each([
      ['abomination--master-of-abominations', { type: 'allFamily', families: ['Abomination'] }],
      ['godspawn--master-of-godspawn', { type: 'allFamily', families: ['Godspawn'] }],
      ['sanctus--master-of-sanctuses', { type: 'distinctFamilyCount', families: ['Sanctus'], count: 6 }],
      ['sin--master-of-sins', { type: 'distinctFamilyCount', families: ['Sin'], count: 6 }],
      ['arachnalisk--master-of-arachnalisks', { type: 'perFamilyCount', families: ['Arachnalisk'] }],
      ['mireling--master-of-mirelings', { type: 'classDiversity' }],
      ['hound--master-of-hounds', { type: 'familyScoped', families: ['Hound'] }],
      ['diabolic-horde--master-of-diabolic-horde', { type: 'none' }],
    ])('reads %s', (id, expected) => {
      expect(traits.find((trait) => trait.id === id)?.partyRequirement).toEqual(expected);
    });
  });

  describe('random debuffs (GAME_RULES R5)', () => {
    const sources = () => traits.filter((trait) => trait.randomDebuff !== null);

    it('has 30 traits that afflict one, 27 of them aimed at enemies only', () => {
      expect(sources()).toHaveLength(30);
      expect(sources().filter((trait) => trait.randomDebuff?.target === 'enemy')).toHaveLength(27);
    });

    it('keeps Going Mad, Dusty Struggle and Glitch In The System out of the enemy-only set', () => {
      const notEnemyOnly = sources()
        .filter((trait) => trait.randomDebuff?.target !== 'enemy')
        .map((trait) => [trait.name, trait.randomDebuff?.target]);
      expect(notEnemyOnly.toSorted()).toEqual([
        ['Dusty Struggle', 'self_or_allies'],
        ['Glitch In The System', 'both'],
        ['Going Mad', 'self_or_allies'],
      ]);
    });

    it('flags Grim Ailment and Flubris’s Entrapment as conditional, and nothing else', () => {
      const conditional = sources()
        .filter((trait) => trait.randomDebuff?.activation === 'conditional')
        .map((trait) => trait.name);
      expect(conditional.toSorted()).toEqual(["Flubris's Entrapment", 'Grim Ailment']);
    });
  });
});
