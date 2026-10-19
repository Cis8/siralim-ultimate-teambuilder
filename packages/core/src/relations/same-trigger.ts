import type { KeywordActor, KeywordKey, Trait, TraitId } from '../model/trait';
import { eligibleTraits, type RelationOptions } from './relation-options';
import { compareByOverlap } from './trait-order';

/** A trait that waits for some of the events the focus waits for, with an actor that can be the same one. */
export interface TriggerMatch {
  readonly trait: Trait;
  /** The events both wait for, in the order the focus names them. Never empty. */
  readonly shared: readonly KeywordKey[];
}

export interface SameTrigger {
  /** The events the focus waits for, once each, in the order it names them. Empty: it has no trigger, and nobody is listed. */
  readonly triggers: readonly KeywordKey[];
  /** Ranked by the number of events shared, then by name. */
  readonly entries: readonly TriggerMatch[];
}

interface Trigger {
  readonly event: KeywordKey;
  readonly waiting: readonly Trait[];
  /** What the focus says about who does it, a mention at a time: `undefined` where the text names nobody. */
  readonly actors: readonly (KeywordActor | undefined)[];
}

/**
 * The traits that pay off on an event the focus pays off on (the role `uses`): what it makes happen or prevents is no trigger,
 * and an event is no dependency (GAME_RULES R12), so this is the only place events tie traits together (PLAN D16). Two mentions
 * of one event are the same happening when the actor is the same, or when either text names nobody or says any creature
 * (`start of battle` is a moment and has no actor). Pure: the index hands it who waits for each event it knows.
 */
export function sameTriggerOfTrait(
  focus: Trait,
  waitingFor: (event: KeywordKey) => readonly Trait[] | undefined,
  options: RelationOptions,
): SameTrigger {
  const eligible = eligibleTraits(options);
  const triggers = triggersOf(focus, waitingFor);
  const found = new Map<TraitId, { trait: Trait; shared: KeywordKey[] }>();
  for (const { event, waiting, actors } of triggers) {
    for (const trait of waiting) {
      if (trait.id === focus.id || !eligible(trait)) continue;
      if (!actorsOf(trait, event).some((theirs) => actors.some((ours) => canBeTheSame(ours, theirs)))) continue;
      const entry = found.get(trait.id);
      if (entry === undefined) found.set(trait.id, { trait, shared: [event] });
      else entry.shared.push(event);
    }
  }
  return { triggers: triggers.map(({ event }) => event), entries: [...found.values()].toSorted(compareByOverlap) };
}

/** Each event the focus waits for, once, in the order it names them: an event the index lacks is no trigger. */
function triggersOf(focus: Trait, waitingFor: (event: KeywordKey) => readonly Trait[] | undefined): Trigger[] {
  const triggers: Trigger[] = [];
  for (const { key, role } of focus.keywords) {
    if (role !== 'uses') continue;
    const waiting = waitingFor(key);
    if (waiting === undefined || triggers.some(({ event }) => event === key)) continue;
    triggers.push({ event: key, waiting, actors: actorsOf(focus, key) });
  }
  return triggers;
}

const actorsOf = (trait: Trait, event: KeywordKey) =>
  trait.keywords.filter((hit) => hit.role === 'uses' && hit.key === event).map((hit) => hit.actor);

function canBeTheSame(a: KeywordActor | undefined, b: KeywordActor | undefined): boolean {
  return a === undefined || b === undefined || a === 'any' || b === 'any' || a === b;
}
