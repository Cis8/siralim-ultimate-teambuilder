import { canBeDependency } from '../model/keyword-kind';
import type { KeywordActor, KeywordKey, KeywordRole, Trait } from '../model/trait';

/** An event a trait waits for, and who does it where the text says so. */
export interface Trigger {
  readonly event: KeywordKey;
  readonly actor?: KeywordActor;
}

/**
 * What a trait says about the buffs, debuffs and effects it gives, relies on and guards against, and the events it pays off on:
 * the rows of its card. Each key is listed once per role, in the order the text names them. A conditional or random source is
 * no mention of its own (GAME_RULES R5, R10), so it is not listed here, as it is not in the lanes of what the trait enables (PLAN D27).
 */
export interface TraitFacts {
  /** Gives by name (the role `applies`). */
  readonly applies: readonly KeywordKey[];
  /** Relies on being there (`uses`). */
  readonly relies: readonly KeywordKey[];
  /** Only guards against, as in "immune to Silenced" (`resists`, GAME_RULES R9). */
  readonly guards: readonly KeywordKey[];
  /** The events it pays off on (`uses`); what it makes happen or prevents is no trigger, as in `sameTriggerOf`. */
  readonly triggers: readonly Trigger[];
}

export function traitFacts(trait: Trait): TraitFacts {
  return {
    applies: dependenciesWith(trait, 'applies'),
    relies: dependenciesWith(trait, 'uses'),
    guards: dependenciesWith(trait, 'resists'),
    triggers: triggersOf(trait),
  };
}

function dependenciesWith(trait: Trait, role: KeywordRole): KeywordKey[] {
  const keys = trait.keywords.filter((hit) => hit.role === role && canBeDependency(hit.kind)).map(({ key }) => key);
  return [...new Set(keys)];
}

function triggersOf(trait: Trait): Trigger[] {
  const triggers: Trigger[] = [];
  for (const { key, kind, role, actor } of trait.keywords) {
    if (kind !== 'event' || role !== 'uses') continue;
    if (triggers.some((seen) => seen.event === key && seen.actor === actor)) continue;
    triggers.push(actor === undefined ? { event: key } : { event: key, actor });
  }
  return triggers;
}
