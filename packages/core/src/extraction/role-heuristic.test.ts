import { describe, expect, it } from 'vitest';
import { extractKeywords } from './extract-keywords';
import { createKeywordMatcher } from './keyword-matcher';
import { assignRoles } from './role-heuristic';
import { taxonomy } from '../taxonomy/taxonomy';

const matcher = createKeywordMatcher(taxonomy);

/** `key:role` for every mention that has a role, in order, as the whole extractor reads them. */
function rolesIn(text: string): string[] {
  return extractKeywords(text)
    .filter((hit) => hit.role !== undefined)
    .map((hit) => `${hit.key}:${hit.role}`);
}

// Texts are quoted from compendium v2.0; the roles are what a player reads in them.
const REAL_TRAITS: readonly (readonly [name: string, description: string, roles: readonly string[]])[] = [
  [
    'Flesh Rot',
    "After an enemy is afflicted with either Weak or Vulnerable, this creature afflicts them with whichever of these debuffs the target doesn't already have.",
    ['weak:uses', 'vulnerable:uses'],
  ],
  [
    'Quell',
    "When this creature attacks an enemy with Vulnerable, it deals 100% more damage. If this damage exceeds 35% of the target's Current health, the target dies.",
    ['vulnerable:uses'],
  ],
  [
    'Master of Abominations',
    'If all the creatures in your party are Abominations, enemies always have Weak and Vulnerable, and take 50% more damage. This trait does not stack.',
    ['weak:applies', 'vulnerable:applies'],
  ],
  [
    'Manipulate Fear',
    'Enemy creatures with Weak have 50% less attack and cannot deal critical damage. This trait does not stack.',
    ['weak:uses'],
  ],
  [
    'Sin and Sentence',
    'After this creature attacks an enemy with both Weak and Vulnerable, it has a 50% chance to kill the target.',
    ['weak:uses', 'vulnerable:uses'],
  ],
  [
    'Sandstorm',
    'This creature always has Blind. When your creatures with Blind cast a spell that targets more than one creature, it instead targets all creatures and has 100% more potency. This trait does not stack.',
    ['blind:applies', 'blind:uses'],
  ],
  [
    'Extra Padding',
    'At the start of battle, this creature gains a Barrier that absorbs damage equal to 200% of its highest stat.',
    ['barrier:applies'],
  ],
  [
    'Unrelenting Sun',
    "At the start of this creature's turn, each enemy has a 50% chance to be afflicted with Burning and Blind.",
    ['burning:applies', 'blind:applies'],
  ],
  [
    'Shrapnel Blast',
    'After an enemy takes damage at the start of its turn from Bomb, all other enemies take 50% of that damage as well. This trait does not stack.',
    ['bomb:uses'],
  ],
  [
    'Toxic Karma',
    'After this creature is attacked, the enemy is afflicted with Poisoned and Bomb.',
    ['poisoned:applies', 'bomb:applies'],
  ],
  [
    'Round of Applause',
    'After an ally heals an enemy, the enemy is afflicted with Mania. After an enemy with Mania casts a healing spell, this creature casts Words of Encouragement on them.',
    ['mania:applies', 'mania:uses'],
  ],
  [
    'Master of Smogs',
    'When your creatures afflict enemies with Poisoned, the potency of this debuff is increased by 50% for each Smog fighting on your side. This trait does not stack.',
    ['poisoned:uses'],
  ],
  [
    'Gemcutter',
    "Your creatures' Ultimate Spell Gems cannot be Sealed and do not consume charges. Your creatures are immune to Silenced.",
    ['sealed:resists', 'silenced:resists'],
  ],
  [
    'Horde Limits',
    'After your creatures are afflicted with a debuff, they have a 25% chance to gain Immune. This trait does not stack.',
    ['immune:applies'],
  ],
  ['Master of Crusaders', 'Your Crusaders start battles with Shelled.', ['shelled:applies']],
  [
    'Eureka!',
    'This creature always has Mania and has additional intelligence equal to 5% of the potency of its Mania. This creature cannot be immune to Mania.',
    ['mania:applies', 'mania:uses', 'mania:uses'],
  ],
  [
    'Sleepwalking',
    'This creature always has Sleeping. Your creatures with Sleeping attack or cast their top-most spell at the start of their turns. Your creatures with Sleeping have a 50% chance to afflict the target with Sleep with attacks and spells. This trait does not stack.',
    ['sleeping:applies', 'sleeping:uses', 'sleeping:uses', 'sleeping:applies'],
  ],
  [
    'Malady',
    "Enemies' Poisoned debuff lasts forever. This effect also applies to your own creatures while you have a creature with the Poison Inoculation trait.",
    ['poisoned:uses'],
  ],
  [
    'Master of Gorgons',
    'Your Gorgons deal 35% more damage to enemies with Stone for each Gorgon fighting on your side. This trait does not stack.',
    ['stoned:uses'],
  ],
  [
    "Alchemist's Fury",
    'After this creature attacks, it afflicts the target with Blind and Confused.',
    ['blind:applies', 'confused:applies'],
  ],
  [
    'Fear of Success',
    "This creature's attacks deal 75% more damage and afflict the target with Inverted.",
    ['inverted:applies'],
  ],
];

describe('assignRoles', () => {
  describe('on real traits', () => {
    it.each(REAL_TRAITS)('%s', (_name, description, roles) => {
      expect(rolesIn(description)).toEqual(roles);
    });
  });

  describe('the sentence decides', () => {
    it('does not carry a signal over a full stop', () => {
      expect(rolesIn('This creature gains Barrier. Enemies with Weak take more damage.')).toEqual([
        'barrier:applies',
        'weak:uses',
      ]);
    });

    it('reads an unmarked status as one the trait relies on', () => {
      expect(rolesIn("Enemies' Poisoned debuff lasts forever.")).toEqual(['poisoned:uses']);
    });
  });

  describe('the condition a sentence opens with', () => {
    it.each(['After', 'When', 'Whenever', 'If', 'While', 'The first time'])(
      'is a status the trait relies on, after "%s"',
      (opener) => {
        expect(rolesIn(`${opener} an enemy is afflicted with Weak, it attacks.`)).toEqual(['weak:uses']);
      },
    );

    it('stops at the first comma: what follows is the effect', () => {
      expect(rolesIn('When an enemy is afflicted with Weak, this creature gains Berserk.')).toEqual([
        'weak:uses',
        'berserk:applies',
      ]);
    });

    it('holds for a whole list of statuses', () => {
      expect(rolesIn('After an enemy is afflicted with Snared, Feared or Cursed, it takes damage.')).toEqual([
        'snared:uses',
        'feared:uses',
        'cursed:uses',
      ]);
    });

    it('does not make the effect of an ordinary sentence a condition', () => {
      expect(rolesIn('Enemies are afflicted with Weak.')).toEqual(['weak:applies']);
    });
  });

  describe('the nearest signal before the status', () => {
    it.each([
      ['This creature afflicts the target with Weak.', 'weak:applies'],
      ['This creature afflicts enemies with Weak.', 'weak:applies'],
      ['It is afflicted with Weak at the start of battle.', 'weak:applies'],
      ['This creature gains Berserk.', 'berserk:applies'],
      ['Your creatures gain Berserk.', 'berserk:applies'],
      ['This creature grants allies Shelled.', 'shelled:applies'],
      ['Your Crusaders start battles with Shelled.', 'shelled:applies'],
      ['This creature always has Berserk.', 'berserk:applies'],
      ['Enemies always have Weak.', 'weak:applies'],
      ['Enemies with Weak take more damage.', 'weak:uses'],
      ['Your creatures with Berserk deal more damage.', 'berserk:uses'],
      ['This creature deals damage to enemies that have Bleeding.', 'bleeding:uses'],
      ['Enemies that already has Bleeding take damage.', 'bleeding:uses'],
      ['This creature takes damage from Poisoned.', 'poisoned:uses'],
      ['Your creatures are immune to Silenced.', 'silenced:resists'],
      ['Your creatures are resistant to Burning.', 'burning:resists'],
      ['This deals more damage for each creature on your team afflicted with Silenced.', 'silenced:uses'],
      ['Your creatures deal more damage for each enemy that is afflicted with Cursed.', 'cursed:uses'],
      ['This creature cannot be Silenced.', 'silenced:resists'],
      ['This creature no longer takes damage from Blighted.', 'blighted:resists'],
      ['This creature cannot be immune to Mania.', 'mania:uses'],
      ['Enemies cannot be resistant to Stoned.', 'stoned:uses'],
      ['Your creatures have a 50% chance to avoid Silenced.', 'silenced:resists'],
      ['They have a 25% chance to avoid damage and gain Shelled.', 'shelled:applies'],
      ['This creature gives allies Shelled.', 'shelled:applies'],
      ['At the end of its turn it resurrects an ally and gives it Shelled.', 'shelled:applies'],
      ['This creature is always Berserk, and deals more damage.', 'berserk:applies'],
      ['Your creatures are always Berserk.', 'berserk:applies'],
      ['Enemies cannot gain Invisible.', 'invisible:uses'],
      ["Your creatures can't gain Barrier.", 'barrier:uses'],
      ['This bonus is doubled if the enemy is afflicted with Frozen.', 'frozen:uses'],
      ["Enemy creatures take 50% more damage while they're afflicted with Stoned.", 'stoned:uses'],
      ['The damage is doubled when an enemy is afflicted with Bomb.', 'bomb:uses'],
    ])('%s', (text, role) => {
      expect(rolesIn(text)).toEqual([role]);
    });

    it('reads a protection against a status as resisting it, for the whole list', () => {
      expect(rolesIn('Your creatures take 90% less damage from Bleeding, Poisoned, and Bomb.')).toEqual([
        'bleeding:resists',
        'poisoned:resists',
        'bomb:resists',
      ]);
      expect(rolesIn('This creature is immune to Blighted, Confused, and Poisoned.')).toEqual([
        'blighted:resists',
        'confused:resists',
        'poisoned:resists',
      ]);
    });

    describe('effects', () => {
      it.each([
        ["This creature Seals one of the target's Spell Gems.", 'sealed:applies'],
        ['This creature seals the enemy Spell Gems.', 'sealed:applies'],
        ['After an enemy casts a spell, that Spell Gem is Sealed.', 'sealed:applies'],
        ['After this creature casts a spell, it is Sealed.', 'sealed:applies'],
        ['Enemies deal 10% less damage for each Sealed Spell Gem they have.', 'sealed:uses'],
        ['It deals 15% more damage for each Sealed Spell Gem the target has.', 'sealed:uses'],
        ['Your creatures cannot be Sealed.', 'sealed:resists'],
        ['At the start of battle, this creature gains Mega Magic.', 'mega magic:applies'],
        ["Your creatures' Mega Magic now deals a devastating amount of damage.", 'mega magic:uses'],
        ['After this creature attacks, one of your creatures gains 3 stacks of Dire Wolves.', 'dire wolves:applies'],
        ['Your creatures start battles with 3 stacks of Dire Wolves.', 'dire wolves:applies'],
        ['Your creatures can have 5 additional stacks of Dire Wolves.', 'dire wolves:uses'],
        [
          'Your creatures deal 2% more damage for each stack of Dire Wolves each of your creatures have.',
          'dire wolves:uses',
        ],
        ["Your creatures' Zombies minions now deal damage based on their master's highest stat.", 'zombies:uses'],
      ])('%s', (text, role) => {
        expect(rolesIn(text)).toEqual([role]);
      });

      it('waits for the sealing when it is in the condition a sentence opens with', () => {
        expect(rolesIn('When an enemy Seals a Spell Gem, this creature gains Berserk.')).toEqual([
          'sealed:uses',
          'berserk:applies',
        ]);
      });

      it('takes "is" before a buff or debuff for a check, as before: only an effect is given that way', () => {
        expect(rolesIn('Enemies take 50% more damage while they are Frozen.')).toEqual(['frozen:uses']);
        expect(rolesIn('Enemies that are Disarmed fail 50% of their attacks.')).toEqual(['disarmed:uses']);
      });

      it('has Spell Gem properties and Fused without a role', () => {
        expect(rolesIn('Their Spell Gems gain 1 charge and the "Cascading" property for a Fused creature.')).toEqual(
          [],
        );
      });

      it('lets the caller say which written forms are the trait doing it', () => {
        const text = 'It Seals gems. For each Sealed gem it deals damage.';
        const roles = (activeForms?: ReadonlyMap<string, ReadonlySet<string>>) =>
          assignRoles(text, matcher.match(text), activeForms === undefined ? {} : { activeForms }).map(
            (hit) => hit.role,
          );
        expect(roles(new Map([['sealed', new Set(['seals'])]]))).toEqual(['applies', 'uses']);
        expect(roles()).toEqual(['uses', 'uses']);
      });
    });

    it('lets a later signal win over an earlier one', () => {
      expect(rolesIn('This creature gains Barrier and its enemies with Weak take damage.')).toEqual([
        'barrier:applies',
        'weak:uses',
      ]);
    });
  });

  describe('a list of statuses', () => {
    it('shares the role of its first status', () => {
      expect(rolesIn('This creature afflicts the target with Poisoned, Burning, and Bomb.')).toEqual([
        'poisoned:applies',
        'burning:applies',
        'bomb:applies',
      ]);
      expect(rolesIn('Enemy creatures with Weak or Vulnerable take more damage.')).toEqual([
        'weak:uses',
        'vulnerable:uses',
      ]);
    });

    it('ends where the words between statuses are not just "and" or "or"', () => {
      expect(rolesIn('This creature afflicts enemies with Weak and then takes damage from Poisoned.')).toEqual([
        'weak:applies',
        'poisoned:uses',
      ]);
    });
  });

  describe('what gets a role', () => {
    it('is buffs and debuffs only', () => {
      const text =
        'At the start of battle, this creature gains Barrier and casts Spell Gems. This trait does not stack.';
      const hits = assignRoles(text, matcher.match(text));
      expect(hits.map((hit) => [hit.key, hit.role])).toEqual([
        ['start of battle', undefined],
        ['barrier', 'applies'],
        ['spell gems', undefined],
        ['nostack', undefined],
      ]);
      for (const hit of hits.filter((hit) => hit.kind !== 'buff' && hit.kind !== 'debuff')) {
        expect(hit).not.toHaveProperty('role');
      }
    });

    it('keeps the kind and the span of every match', () => {
      const text = 'Enemies with Weak.';
      expect(assignRoles(text, matcher.match(text))).toEqual([
        { key: 'weak', kind: 'debuff', span: [13, 17], role: 'uses' },
      ]);
    });

    it('gives nothing for nothing', () => {
      expect(assignRoles('Deals damage.', [])).toEqual([]);
    });
  });
});
