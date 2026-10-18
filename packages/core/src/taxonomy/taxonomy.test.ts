import { describe, expect, it } from 'vitest';
import { EVENT_GROUPS, TRIGGER_PHASES } from './entry';
import { taxonomy } from './taxonomy';

// The names below are transcribed from the canonical sources, not from the code under test:
//   wiki Debuffs  https://siralimultimate.wiki.gg/wiki/Debuffs
//   wiki Buffs    https://siralimultimate.wiki.gg/wiki/Buffs
//   Codex Reference https://steamcommunity.com/sharedfiles/filedetails/?id=2197484456 (same lists)
// prettier-ignore
const CANONICAL_DEBUFFS = [
  'Bleeding', 'Blighted', 'Blind', 'Bomb', 'Burning', 'Confused', 'Cursed', 'Disarmed', 'Feared', 'Frozen',
  'Inverted', 'Mania', 'Poisoned', 'Scorned', 'Silenced', 'Sleeping', 'Snared', 'Stone', 'Vulnerable', 'Weak',
];
// prettier-ignore
const CANONICAL_BUFFS = [
  'Agile', 'Arcane', 'Barrier', 'Berserk', 'Defensive', 'Immune', 'Invisible', 'Leeching', 'Mending',
  'Proficient', 'Protected', 'Rebirth', 'Repelling', 'Savage', 'Shelled', 'Splashing', 'Taunting', 'Warded',
];

const nameOf = (entry: { label: string; canonicalName?: string }) => entry.canonicalName ?? entry.label;

describe('the taxonomy', () => {
  describe('debuffs (GAME_RULES R8)', () => {
    const debuffs = taxonomy.ofKind('debuff');

    it('are exactly the canonical ones', () => {
      expect(debuffs.map(nameOf).toSorted()).toEqual([...CANONICAL_DEBUFFS].toSorted());
    });

    it('can all be randomly applied except Inverted and Mania', () => {
      const notRandom = debuffs.filter((entry) => !entry.canBeRandomlyApplied).map((entry) => entry.key);
      expect(notRandom.toSorted()).toEqual(['inverted', 'mania']);
    });

    it('go by the name the compendium uses when it differs: Stone is written Stoned', () => {
      const stoned = taxonomy.get('stoned');
      expect(stoned).toMatchObject({ kind: 'debuff', label: 'Stoned', canonicalName: 'Stone' });
      expect(stoned?.patterns).toEqual(expect.arrayContaining(['Stoned', 'Stone']));
      expect(taxonomy.get('stone')).toBeUndefined();
    });

    it('know Sleeping is sometimes written Sleep', () => {
      expect(taxonomy.get('sleeping')?.patterns).toEqual(['Sleeping', 'Sleep']);
    });

    it('do not take Weakness for Weak', () => {
      expect(taxonomy.get('weak')?.patterns).toEqual(['Weak']);
    });
  });

  describe('buffs', () => {
    const buffs = taxonomy.ofKind('buff');

    it('are exactly the canonical ones', () => {
      expect(buffs.map(nameOf).toSorted()).toEqual([...CANONICAL_BUFFS].toSorted());
    });

    it('include Barrier: the compendium itself speaks of "Barrier buffs"', () => {
      expect(taxonomy.get('barrier')).toMatchObject({ kind: 'buff', label: 'Barrier' });
    });
  });

  describe('every entry', () => {
    it('is reachable by the key a query uses: the lower-cased label for buffs and debuffs', () => {
      for (const entry of [...taxonomy.ofKind('debuff'), ...taxonomy.ofKind('buff')]) {
        expect(entry.key, entry.label).toBe(entry.label.toLowerCase());
      }
    });

    it('matches its own label, whatever the case', () => {
      for (const entry of [...taxonomy.ofKind('debuff'), ...taxonomy.ofKind('buff')]) {
        expect(entry.patterns.map((pattern) => pattern.toLowerCase())).toContain(entry.label.toLowerCase());
      }
    });
  });

  describe('events (GAME_RULES R12, ADR-0009)', () => {
    const events = taxonomy.ofKind('event');

    it('are the eighteen of the rules, in the order the rules give them', () => {
      expect(events.map((event) => event.key)).toEqual([
        'start of battle',
        'start of turn',
        'end of turn',
        'attack',
        'cast spell',
        'manual cast',
        'defend',
        'provoke',
        'being attacked',
        'dodge',
        'critical hit',
        'damage taken',
        'heal',
        'kill',
        'death',
        'resurrection',
        'any buff',
        'any debuff',
      ]);
    });

    it('belong to a phase of battle, except the three that can happen at any time, and every phase has one', () => {
      expect(events.filter((event) => event.phase === undefined).map((event) => event.key)).toEqual([
        'heal',
        'any buff',
        'any debuff',
      ]);
      expect(new Set(events.map((event) => event.phase))).toEqual(new Set([...TRIGGER_PHASES, undefined]));
    });

    // The semicolons of the list in GAME_RULES R12: the filters show the events in these five groups, and since the groups
    // follow one another in the list, the order of the events is also the order of the panel.
    it('stand in the five groups of the rules', () => {
      expect(
        EVENT_GROUPS.map((group) => events.filter((event) => event.group === group).map((event) => event.key)),
      ).toEqual([
        ['start of battle', 'start of turn', 'end of turn'],
        ['attack', 'cast spell', 'manual cast', 'defend', 'provoke'],
        ['being attacked', 'dodge', 'critical hit', 'damage taken'],
        ['heal', 'kill', 'death', 'resurrection'],
        ['any buff', 'any debuff'],
      ]);
    });

    it.each([
      ['start of turn', 'startOfTurn'],
      ['end of turn', 'endOfTurn'],
      ['defend', 'defending'],
      ['provoke', 'defending'],
      ['manual cast', 'spellcasting'],
      ['dodge', 'beingAttacked'],
      ['resurrection', 'killsAndDeaths'],
    ])('put %s in the phase %s', (key, phase) => {
      expect(taxonomy.get(key)).toMatchObject({ kind: 'event', phase });
    });

    it('read the two edges of a turn by the grammar of turns, and nothing else by it', () => {
      expect(
        events.filter((event) => event.turnEdge !== undefined).map((event) => [event.key, event.turnEdge]),
      ).toEqual([
        ['start of turn', 'start'],
        ['end of turn', 'end'],
      ]);
    });

    it('read every inflection: "dies", "died" and "dead" are a death, "kills" a kill', () => {
      expect(taxonomy.get('death')?.patterns).toEqual(
        expect.arrayContaining(['die', 'dies', 'died', 'dead', 'killed']),
      );
      expect(taxonomy.get('kill')?.patterns).toEqual(expect.arrayContaining(['kill', 'kills']));
    });

    it('know that "attack" is also a stat, and "attacks" is not', () => {
      expect(taxonomy.get('attack')).toMatchObject({ statPatterns: ['attack'] });
    });

    it('keep the manual cast apart from the cast: the one pays off only the player’s own spells (R12)', () => {
      expect(taxonomy.get('manual cast')?.patterns).toEqual(
        expect.arrayContaining(['manually cast', 'manually casts']),
      );
      expect(taxonomy.get('cast spell')?.patterns).not.toContain('manually cast');
    });

    // The eleven trigger phrases of Phase 1. A query or an address that names one finds the event, and who did it where the
    // phrase said (a phrase with no one in it is the event of any creature). "start of battle" is a key of its own.
    it.each([
      ["start of this creature's turn", 'start of turn', 'self'],
      ["this creature's attacks", 'attack', 'self'],
      ['when this creature attacks', 'attack', 'self'],
      ['after this creature attacks', 'attack', 'self'],
      ['deals critical damage', 'critical hit', undefined],
      ['after this creature is attacked', 'being attacked', 'self'],
      ['after an enemy dodges', 'dodge', 'enemy'],
      ['manually cast a spell', 'manual cast', undefined],
      ['manually casts a spell', 'manual cast', undefined],
      ['kills a creature', 'kill', undefined],
      ['is killed', 'death', undefined],
    ])('keep the old trigger "%s" as an alias of %s by %s', (old, key, actor) => {
      const named = events.flatMap((event) =>
        (event.aliases ?? [])
          .filter((alias) => alias.key === old)
          .map((alias) => ({ key: event.key, actor: alias.actor })),
      );
      expect(named).toEqual([{ key, actor }]);
    });

    it('keep the key of the old trigger that is still a key', () => {
      expect(taxonomy.get('start of battle')).toMatchObject({ kind: 'event', phase: 'startOfBattle' });
    });
  });

  describe('effects: what builds are made of, beyond the canonical buffs and debuffs (GAME_RULES R11)', () => {
    it('are Sealed Spell Gems, Dire Wolves, Zombies and Mega Magic', () => {
      expect(
        taxonomy
          .ofKind('effect')
          .map((entry) => entry.key)
          .toSorted(),
      ).toEqual(['dire wolves', 'mega magic', 'sealed', 'zombies']);
    });

    it('read Seal, Seals and Sealed as one effect, and know which forms are the trait doing it', () => {
      const sealed = taxonomy.get('sealed');
      expect(sealed?.patterns).toEqual(['Sealed', 'Seals', 'Seal']);
      expect(sealed).toMatchObject({ kind: 'effect', activePatterns: ['Seals', 'Seal'] });
    });
  });

  it('has the mechanics of the prototypes, the Spell Gem properties and Fused (R11), Spells and Stats (R12)', () => {
    expect(taxonomy.ofKind('mechanic').map((entry) => entry.key)).toEqual([
      'minion',
      'spell gems',
      'timeline',
      'critical damage',
      'maximum health',
      'charges',
      'cascading',
      'fused',
      'spells',
      'stats',
    ]);
    expect(taxonomy.get('charges')?.patterns).toEqual(['charges', 'charge']);
  });

  it('reads "spell" and "stat" as the mechanics Spells and Stats: the traits about them that cast or change none', () => {
    expect(taxonomy.get('spells')?.patterns).toEqual(['spell', 'spells']);
    expect(taxonomy.get('stats')?.patterns).toEqual(['stat', 'stats']);
  });

  it('has the flag of the prototypes', () => {
    expect(taxonomy.get('nostack')).toMatchObject({ kind: 'flag', patterns: ['This trait does not stack'] });
  });
});
