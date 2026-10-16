import { KNOWN_CLASSES, taxonomy, type Trait } from '@atlas/core';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BuiltTraits } from './build-traits';
import { buildReport } from '../report/build-report';
import { compareWithCanonicalLists } from '../report/compare-canonical';
import { REVIEWED_NON_KEYWORDS } from '../report/reviewed-non-keywords';
import { findTaxonomyCandidates } from '../report/taxonomy-candidates';
import { buildRealSheet } from '../testing/real-build';

// The pinned snapshot of the compendium, v2.0, built with the committed overrides. The counts below are the ones in
// docs/GAME_RULES.md.

function countBy<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

describe('the compendium v2.0 snapshot', () => {
  let built: BuiltTraits;
  let traits: readonly Trait[];
  let datasetVersion: string;

  beforeAll(async () => {
    built = await buildRealSheet();
    ({ datasetVersion, traits } = built);
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
    const report = buildReport(built, null);
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

  it('leaves exactly the taxonomy candidates that are still open', () => {
    // The list in reviewed-non-keywords.ts says which these are; if the data or the taxonomy changes, review again.
    const open = findTaxonomyCandidates(traits, { ignore: REVIEWED_NON_KEYWORDS }).map((candidate) => candidate.term);
    expect(open.toSorted()).toEqual(
      ['Cascading', 'Charges', 'Dire Wolves', 'Fused', 'Mega Magic', 'Sealed', 'Seals', 'Zombies'].toSorted(),
    );
  });

  it('is compared with the canonical lists: only Stone is written another way', () => {
    expect(compareWithCanonicalLists(traits, taxonomy)).toEqual([
      'The canonical name "Stone" is written "Stoned" in 14 traits and "Stone" in 2 traits.',
    ]);
  });

  describe('keywords', () => {
    it('are cut out of the description by their span, and spell one of the patterns of their key', () => {
      for (const trait of traits) {
        for (const hit of trait.keywords) {
          const written = trait.description.slice(hit.span[0], hit.span[1]).replace(/\s+/g, ' ').toLowerCase();
          const patterns = taxonomy.get(hit.key)?.patterns.map((pattern) => pattern.toLowerCase());
          expect(patterns, `${trait.id}: ${hit.key}`).toContain(written);
        }
      }
    });

    it('follow the text in order and never overlap', () => {
      for (const { id, keywords } of traits) {
        const spans = keywords.map((hit) => hit.span);
        expect(
          spans.toSorted((a, b) => a[0] - b[0]),
          id,
        ).toEqual(spans);
        spans.forEach((span, index) => {
          const next = spans[index + 1];
          if (next) expect(span[1], id).toBeLessThanOrEqual(next[0]);
        });
      }
    });

    it('have a role exactly when they are buffs or debuffs', () => {
      for (const { id, keywords } of traits) {
        for (const hit of keywords) {
          expect(hit.role !== undefined, `${id}: ${hit.key}`).toBe(hit.kind === 'buff' || hit.kind === 'debuff');
        }
      }
    });

    it('make "This trait does not stack" the flag of exactly the traits that do not stack', () => {
      for (const trait of traits) {
        const flagged = trait.keywords.some((hit) => hit.key === 'nostack');
        expect(flagged, trait.id).toBe(!trait.stacks);
      }
    });

    it('read Flesh Rot as relying on Weak and Vulnerable, and Master of Abominations as giving them', () => {
      const rolesOf = (id: string) =>
        traits
          .find((trait) => trait.id === id)
          ?.keywords.filter((hit) => hit.role !== undefined)
          .map((hit) => `${hit.key}:${hit.role}`);
      expect(rolesOf('abomination--flesh-rot')).toEqual(['weak:uses', 'vulnerable:uses']);
      expect(rolesOf('abomination--master-of-abominations')).toEqual(['weak:applies', 'vulnerable:applies']);
    });

    it('use every key of the taxonomy at least once, so that no entry is dead', () => {
      const used = new Set(traits.flatMap((trait) => trait.keywords.map((hit) => hit.key)));
      expect(taxonomy.entries.map((entry) => entry.key).filter((key) => !used.has(key))).toEqual([]);
    });
  });
});
