import { describe, expect, it } from 'vitest';
import { detectRandomDebuff } from './random-debuff';

/** Every trait of compendium v2.0 whose text says "random debuff", with the classification the owner confirmed (R5). */
const REAL_TRAITS: readonly (readonly [name: string, description: string, target: string, activation: string])[] = [
  [
    'Slosh',
    'After your creatures manually cast a spell, a random enemy is afflicted with a random debuff. This trait does not stack.',
    'enemy',
    'unconditional',
  ],
  [
    'Grim Ailment',
    'After your creatures apply a debuff, they apply an additional random debuff, but their debuffs only last for 1 turn. This trait does not stack.',
    'enemy',
    'conditional',
  ],
  [
    'Pandemic',
    "At the start of this creature's turn, it afflicts enemies with a random debuff.",
    'enemy',
    'unconditional',
  ],
  [
    'The Nether',
    "At the start of your other creatures' turns, this creature performs an action depending on that creature's class. Chaos - Attack a random enemy. Death - Enemies are afflicted with a random debuff. Life - Your creatures gain a random buff. Nature - Your creatures gain 10% stats. Sorcery - Cast one of their Spell Gems. This trait does not stack.",
    'enemy',
    'unconditional',
  ],
  [
    'Abyss Orbs',
    'If an enemy has taken at least 2 turns, they are afflicted with a random debuff at the start and end of their turn. This trait does not stack.',
    'enemy',
    'unconditional',
  ],
  [
    'Glitch In The System',
    'When a creature would gain a buff, it is afflicted with a random debuff instead.',
    'both',
    'unconditional',
  ],
  [
    'Toxic Cloud',
    'After an enemy attacks, each other enemy has a 35% chance to be afflicted with a random debuff. This trait does not stack.',
    'enemy',
    'unconditional',
  ],
  [
    'Sluuurp!',
    'After an ally attacks, this creature afflicts the enemy with a random debuff.',
    'enemy',
    'unconditional',
  ],
  [
    "Forest's Curse",
    'After an enemy attacks, the target afflicts the enemy with 2 random debuffs. This trait does not stack.',
    'enemy',
    'unconditional',
  ],
  [
    'Unrevealed Secret',
    'After this creature dodges an attack, enemies are afflicted with a random debuff.',
    'enemy',
    'unconditional',
  ],
  [
    'Dusty Struggle',
    'After this creature attacks, casts, defends, or provokes, it and its adjacent allies are afflicted with a random debuff and have a 20% chance to be sent to the top of the Timeline. This trait will not activate if another creature in your party has it as well.',
    'self_or_allies',
    'unconditional',
  ],
  [
    'Going Mad',
    'After this creature takes damage from an attack or spell, it gains a random buff. After this creature is healed, it gains a random debuff. After this creature takes damage from an attack or spell while it has at least 15 buffs and debuffs, it deals damage to enemies equal to 50% of its lowest stat (other than health).',
    'self_or_allies',
    'unconditional',
  ],
  [
    'Condiments',
    'The first time an enemy casts a spell each turn, this creature afflicts enemies with a random debuff. The first time this creature attacks each turn, it afflicts the target with 2 random debuffs.',
    'enemy',
    'unconditional',
  ],
  [
    'Revolt',
    'After this creature attacks or is damaged by an attack or spell, it afflicts the enemy with a random debuff.',
    'enemy',
    'unconditional',
  ],
  [
    'Pus and Pox',
    "At the start of each enemy's turn, this creature afflicts them with a random debuff. This trait does not stack.",
    'enemy',
    'unconditional',
  ],
  [
    'Hugs and Kisses',
    'After this creature takes damage from an attack or spell, it afflicts the enemy with a random debuff.',
    'enemy',
    'unconditional',
  ],
  [
    "Loid's Pustulant Pimples",
    'After an enemy defends or provokes, it is afflicted with 3 random debuffs. This trait does not stack.',
    'enemy',
    'unconditional',
  ],
  [
    'Master of Marionettes',
    'When your Marionettes perform an action, the enemy in the corresponding position performs the same action on the opposite target, and then gains a random debuff. This trait does not stack.',
    'enemy',
    'unconditional',
  ],
  [
    'Binary Affliction',
    'After this creature attacks, it gains a random buff and afflicts its target with a random debuff.',
    'enemy',
    'unconditional',
  ],
  [
    'Swell',
    'After this creature attacks, it afflicts the target with a random debuff for each debuff the target already has.',
    'enemy',
    'unconditional',
  ],
  [
    'Accelerated Harvest',
    'After your creatures attack, they have a 20% chance to afflict the target with a random debuff. This trait does not stack.',
    'enemy',
    'unconditional',
  ],
  [
    'Lingering Incantation',
    'After your creatures cast a Sorcery spell, 3 random enemies are afflicted with a random debuff. This trait does not stack.',
    'enemy',
    'unconditional',
  ],
  [
    'Stricken',
    'At the start of battle, this creature afflicts each enemy with 2 random debuffs. This trait does not stack.',
    'enemy',
    'unconditional',
  ],
  [
    'Maximize',
    "After this creature attacks, it converts each of the target's buffs into random debuffs.",
    'enemy',
    'unconditional',
  ],
  [
    'Black to White',
    "After an enemy's debuff wears off, it is afflicted with a random debuff. This trait does not stack.",
    'enemy',
    'unconditional',
  ],
  [
    'Soul Corruption',
    'After this creature attacks a creature with less than 35% health, it is killed, then this creature afflicts enemies with a random debuff for each buff the target had before it died.',
    'enemy',
    'unconditional',
  ],
  ['Despair', 'After an enemy loses stats, it is afflicted with a random debuff.', 'enemy', 'unconditional'],
  [
    "Flubris's Entrapment",
    'When an enemy takes damage from Poisoned or Burning, they have a 50% chance to be afflicted with a random debuff. This trait does not stack.',
    'enemy',
    'conditional',
  ],
  ['Currents', 'After an enemy gains stats, this creature afflicts it with a random debuff.', 'enemy', 'unconditional'],
  [
    "Zantai's Envy",
    "At the start of battle, this creature gains Mega Magic. Your creatures' Mega Magic now afflicts enemies with 3 random debuffs.",
    'enemy',
    'unconditional',
  ],
];

describe('detectRandomDebuff', () => {
  describe('on the 30 real traits that mention a random debuff (GAME_RULES R5)', () => {
    it.each(REAL_TRAITS)('%s', (_name, description, target, activation) => {
      expect(detectRandomDebuff(description)).toMatchObject({ target, activation });
    });

    it('puts exactly 27 of them in the enemy-only set', () => {
      const enemyOnly = REAL_TRAITS.filter(([, description]) => detectRandomDebuff(description)?.target === 'enemy');
      expect(enemyOnly).toHaveLength(27);
    });

    it("flags exactly Grim Ailment and Flubris's Entrapment as conditional", () => {
      const conditional = REAL_TRAITS.filter(
        ([, description]) => detectRandomDebuff(description)?.activation === 'conditional',
      ).map(([name]) => name);
      expect(conditional).toEqual(['Grim Ailment', "Flubris's Entrapment"]);
    });
  });

  describe('what a conditional source depends on', () => {
    it('quotes the trigger of Grim Ailment', () => {
      const description = REAL_TRAITS.find(([name]) => name === 'Grim Ailment')?.[1] ?? '';
      expect(detectRandomDebuff(description)?.note).toBe('After your creatures apply a debuff');
    });

    it("quotes the trigger of Flubris's Entrapment", () => {
      const description = REAL_TRAITS.find(([name]) => name === "Flubris's Entrapment")?.[1] ?? '';
      expect(detectRandomDebuff(description)?.note).toBe('When an enemy takes damage from Poisoned or Burning');
    });

    it('has no note on an unconditional source', () => {
      expect(detectRandomDebuff('At the start of each turn, it afflicts enemies with a random debuff.')).toEqual({
        target: 'enemy',
        activation: 'unconditional',
      });
    });
  });

  describe('what is not a random debuff', () => {
    it.each([
      ['no mention', 'This creature deals 10% more damage.'],
      ['a random buff', 'After this creature attacks, it gains a random buff.'],
      ['a random enemy', 'Attack a random enemy.'],
      ['a specific debuff', 'Afflicts enemies with Weak.'],
      ['an empty text', ''],
    ])('ignores %s', (_label, description) => {
      expect(detectRandomDebuff(description)).toBeNull();
    });
  });

  describe('wording', () => {
    it('reads the plural and any capitalisation', () => {
      expect(detectRandomDebuff('Afflicts enemies with 2 Random Debuffs.')).toMatchObject({ target: 'enemy' });
    });

    it('judges each sentence on its own: one sentence about an enemy and one about itself is both', () => {
      const description =
        'After this creature attacks, it afflicts the target with a random debuff. After this creature is healed, it gains a random debuff.';
      expect(detectRandomDebuff(description)?.target).toBe('both');
    });

    it('is unconditional as soon as one source of a random debuff is', () => {
      const description =
        'After your creatures apply a debuff, they apply an additional random debuff. At the start of battle, enemies are afflicted with a random debuff.';
      expect(detectRandomDebuff(description)?.activation).toBe('unconditional');
    });

    it('does not read the effect of a sentence without a trigger as its condition', () => {
      expect(detectRandomDebuff('A random enemy is afflicted with a random debuff.')?.activation).toBe('unconditional');
    });
  });
});
