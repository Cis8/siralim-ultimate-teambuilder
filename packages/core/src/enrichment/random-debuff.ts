import type { RandomDebuffSource } from '../model/trait';

const RANDOM_DEBUFF = /\brandom debuffs?\b/i;

/** Who gets the debuff when it is not an enemy: the creature itself or its allies. */
const SELF_OR_ALLIES = [/\bit gains (?:an?|\d+) random debuffs?\b/i, /\bit and its (?:\w+ )*allies are afflicted\b/i];
/** "A creature" without a side: any creature, yours or the enemy's. */
const ANY_CREATURE = /\bwhen a creature would gain\b/i;

/** A trigger that only fires if some debuff was applied, or a debuff dealt damage: other sources must exist. */
const NEEDS_ANOTHER_DEBUFF = [/\b(?:apply|applies|afflict|afflicts)\b.*\bdebuffs?\b/i, /\btakes? damage from [A-Z]/];

/**
 * Whether a trait afflicts "a random debuff" (GAME_RULES R5), at whom, and whether it can do so on its own.
 * A first reading by wording; reviewed corrections go in `overrides.yaml`.
 *
 * Each sentence that mentions a random debuff is judged on its own: the trait targets enemies unless a sentence says
 * otherwise, and it is conditional only if every such sentence waits for another debuff.
 */
export function detectRandomDebuff(description: string): RandomDebuffSource | null {
  const sentences = description.split(/(?<=[.!?])\s+/).filter((sentence) => RANDOM_DEBUFF.test(sentence));
  if (sentences.length === 0) return null;

  const target = sentences.map(targetOf).reduce((a, b) => (a === b ? a : 'both'));
  const conditions = sentences.map(conditionOf);
  const unconditional = conditions.includes(undefined);
  const note = conditions.find((condition) => condition !== undefined);

  if (unconditional || note === undefined) return { target, activation: 'unconditional' };
  return { target, activation: 'conditional', note };
}

function targetOf(sentence: string): RandomDebuffSource['target'] {
  if (ANY_CREATURE.test(sentence)) return 'both';
  if (SELF_OR_ALLIES.some((pattern) => pattern.test(sentence))) return 'self_or_allies';
  return 'enemy';
}

/** The trigger the sentence waits for, if it is one that needs another debuff. */
function conditionOf(sentence: string): string | undefined {
  const comma = sentence.indexOf(',');
  if (comma === -1) return undefined; // No trigger: everything in the sentence is the effect.
  const trigger = sentence.slice(0, comma);
  return NEEDS_ANOTHER_DEBUFF.some((pattern) => pattern.test(trigger)) ? trigger : undefined;
}
