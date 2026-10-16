import { describe, expect, it } from 'vitest';
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

  describe('triggers', () => {
    it('each belong to a phase of battle, and every phase has one', () => {
      const phases = new Set(taxonomy.ofKind('trigger').map((trigger) => trigger.phase));
      expect([...phases].toSorted()).toEqual(
        ['attacking', 'beingAttacked', 'killsAndDeaths', 'spellcasting', 'startOfBattle', 'startOfTurn'].toSorted(),
      );
    });

    it('tell the start of battle from the start of the creature’s own turn', () => {
      expect(taxonomy.get('start of battle')?.patterns).toEqual(['start of battle', 'start battles']);
      expect(taxonomy.get("start of this creature's turn")).toMatchObject({ kind: 'trigger', phase: 'startOfTurn' });
    });

    it('read both "manually cast a spell" and "manually casts a spell"', () => {
      expect(taxonomy.get('manually cast a spell')?.patterns).toEqual(
        expect.arrayContaining(['manually cast a spell', 'manually casts a spell']),
      );
    });
  });

  it('has the mechanics and the flag of the prototypes', () => {
    expect(taxonomy.ofKind('mechanic').map((entry) => entry.key)).toEqual([
      'minion',
      'spell gems',
      'timeline',
      'critical damage',
      'maximum health',
    ]);
    expect(taxonomy.get('nostack')).toMatchObject({ kind: 'flag', patterns: ['This trait does not stack'] });
  });
});
