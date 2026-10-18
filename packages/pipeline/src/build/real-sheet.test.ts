import { hasActor, hasRole, KNOWN_CLASSES, slotRules, taxonomy, type SlotName, type Trait } from '@atlas/core';
import { beforeAll, describe, expect, it } from 'vitest';
import type { BuiltTraits } from './build-traits';
import { buildReport } from '../report/build-report';
import { compareWithCanonicalLists } from '../report/compare-canonical';
import { REVIEWED_NON_KEYWORDS } from '../report/reviewed-non-keywords';
import { findTaxonomyCandidates } from '../report/taxonomy-candidates';
import { buildRealSheet, readOldTriggers } from '../testing/real-build';

// The pinned snapshot of the compendium, v2.0, built with the committed overrides. The counts below are the ones in
// docs/GAME_RULES.md.

/** The turns are read by a grammar, not by patterns: "start of your Phoenixes' turns", "its turn ends", "start and". */
const TURN_WORDS = /^(?:start|end)\b|\bturns? ends?$/;

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

  it('fills the slots of GAME_RULES R1 and R6 with the traits they accept', () => {
    const accepted = (slot: SlotName) => traits.filter((trait) => slotRules.canPlace(trait, slot).ok);

    // Innate: creature + Avatar. Fused: creature. Artifact: everything with a material, but the Avatars.
    expect(accepted('innate')).toHaveLength(1331 + 31);
    expect(accepted('fused')).toHaveLength(1331);
    expect(accepted('artifact')).toHaveLength(1780 - 41);
    expect(accepted('artifact').every((trait) => trait.material !== null && trait.kind !== 'avatar')).toBe(true);
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

  it('leaves no taxonomy candidate open: every frequent term is a keyword, a name or reviewed', () => {
    // If the data or the taxonomy changes, look at the new candidates (reviewed-non-keywords.ts says how).
    expect(
      findTaxonomyCandidates(traits, { ignore: REVIEWED_NON_KEYWORDS }).map((candidate) => candidate.term),
    ).toEqual([]);
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
          const entry = taxonomy.get(hit.key);
          if (entry?.kind === 'event' && entry.turnEdge !== undefined && TURN_WORDS.test(written)) continue;
          const patterns = entry?.patterns.map((pattern) => pattern.toLowerCase());
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

    it('have a role exactly when they are buffs, debuffs, effects or events', () => {
      for (const { id, keywords } of traits) {
        for (const hit of keywords) {
          expect(hit.role !== undefined, `${id}: ${hit.key}`).toBe(hasRole(hit.kind));
        }
      }
    });

    it('have an actor only when they are events, and then only where the text names one', () => {
      for (const { id, keywords } of traits) {
        for (const hit of keywords) {
          if (hit.actor !== undefined) expect(hasActor(hit.kind), `${id}: ${hit.key}`).toBe(true);
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
          ?.keywords.filter((hit) => hit.role !== undefined && hit.kind !== 'event')
          .map((hit) => `${hit.key}:${hit.role}`);
      expect(rolesOf('abomination--flesh-rot')).toEqual(['weak:uses', 'vulnerable:uses']);
      expect(rolesOf('abomination--master-of-abominations')).toEqual(['weak:applies', 'vulnerable:applies']);
    });

    it('use every key of the taxonomy at least once, so that no entry is dead', () => {
      const used = new Set(traits.flatMap((trait) => trait.keywords.map((hit) => hit.key)));
      expect(taxonomy.entries.map((entry) => entry.key).filter((key) => !used.has(key))).toEqual([]);
    });

    it('give the buffs, debuffs and effects the roles they had before there were events', () => {
      const statuses = traits.flatMap((trait) => trait.keywords).filter((hit) => hit.kind !== 'event' && hit.role);
      expect(countBy(statuses, (hit) => hit.role ?? '')).toEqual({ applies: 311, uses: 270, resists: 21 });
    });
  });

  describe('events (GAME_RULES R12, ADR-0009)', () => {
    const events = () => traits.flatMap((trait) => trait.keywords.filter((hit) => hit.kind === 'event'));
    const eventsOf = (id: string) =>
      (traits.find((trait) => trait.id === id)?.keywords ?? [])
        .filter((hit) => hit.kind === 'event')
        .map((hit) => `${hit.key}:${hit.role}${hit.actor === undefined ? '' : `/${hit.actor}`}`);

    it('are mentioned 2,149 times in 1,332 traits, out of 4,453 mentions', () => {
      expect(events()).toHaveLength(2149);
      expect(traits.filter((trait) => trait.keywords.some((hit) => hit.kind === 'event'))).toHaveLength(1332);
      expect(traits.flatMap((trait) => trait.keywords)).toHaveLength(4453);
    });

    it('have the mentions of the table in the rules', () => {
      expect(countBy(events(), (hit) => hit.key)).toEqual({
        'start of battle': 214,
        'start of turn': 134,
        'end of turn': 61,
        attack: 518,
        'cast spell': 304,
        'manual cast': 41,
        defend: 61,
        provoke: 73,
        'being attacked': 49,
        dodge: 52,
        'critical hit': 38,
        'damage taken': 149,
        heal: 122,
        kill: 19,
        death: 135,
        resurrection: 77,
        'any buff': 50,
        'any debuff': 52,
      });
    });

    it('are waited for far more than they are caused or prevented', () => {
      expect(countBy(events(), (hit) => hit.role ?? '')).toEqual({ uses: 1519, applies: 594, resists: 36 });
    });

    it('say who in most mentions: only the start of battle names nobody (and nine others)', () => {
      expect(countBy(events(), (hit) => hit.actor ?? 'nobody')).toEqual({
        self: 978,
        ally: 585,
        enemy: 285,
        any: 78,
        nobody: 223,
      });
      expect(events().filter((hit) => hit.actor === undefined && hit.key !== 'start of battle')).toHaveLength(9);
    });

    it.each([
      ['abomination--extra-padding', ['start of battle:uses']],
      ['abomination--quell', ['attack:uses/self', 'death:applies/enemy']],
      ['amaranth--crystallization', ['cast spell:uses/self']],
      ['alemental--slosh', ['manual cast:uses/ally', 'any debuff:applies/enemy']],
      ['backer--abyss-orbs', ['any debuff:applies/enemy', 'start of turn:uses/enemy', 'end of turn:uses/enemy']],
      ['clutcher--lash', ['dodge:uses/enemy', 'attack:uses/enemy', 'damage taken:applies/enemy']],
    ])('read %s as the rules do', (id, expected) => {
      expect(eventsOf(id)).toEqual(expected);
    });

    // The first version of the app had eleven trigger phrases. A shared link or a saved query that names one finds the
    // traits it found, and possibly more (ADR-0009): the event the phrase stands for, by the actor it names if it names one.
    describe('the trigger phrases of the first version', () => {
      const pinned = readOldTriggers();
      const meaningOf = (phrase: string) => {
        const event = taxonomy.ofKind('event').find((entry) => entry.key === phrase);
        if (event !== undefined) return { key: event.key, actor: undefined };
        for (const entry of taxonomy.ofKind('event')) {
          const alias = entry.aliases?.find((each) => each.key === phrase);
          if (alias !== undefined) return { key: entry.key, actor: alias.actor };
        }
        return undefined;
      };

      it('are the eleven of the snapshot, 564 traits in all', () => {
        expect(new Set(pinned.map(([phrase]) => phrase)).size).toBe(11);
        expect(pinned).toHaveLength(564);
      });

      it.each([...new Set(pinned.map(([phrase]) => phrase))])('find at least the traits they found: %s', (phrase) => {
        const meaning = meaningOf(phrase);
        expect(meaning, phrase).toBeDefined();
        const lost = pinned
          .filter(([each]) => each === phrase)
          .map(([, id]) => id)
          .filter((id) => {
            const trait = traits.find((each) => each.id === id);
            return !trait?.keywords.some(
              (hit) => hit.key === meaning?.key && (meaning.actor === undefined || hit.actor === meaning.actor),
            );
          });
        expect(lost).toEqual([]);
      });
    });
  });
});
