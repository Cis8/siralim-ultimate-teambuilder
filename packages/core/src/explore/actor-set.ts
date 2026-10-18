import { KEYWORD_ACTORS, type KeywordActor } from '../model/trait';

/**
 * Some of the actors an event can name (GAME_RULES R12), each once, in the order of `KEYWORD_ACTORS`. The filters on one side
 * of an event name one or several of them (they are alternatives, SPEC §8.1); none stands for the event whoever acts.
 */
export type ActorSet = readonly KeywordActor[];

/** The set of these actors: the order they come in and the repeats are of no account. */
export function actorSet(actors: Iterable<KeywordActor>): ActorSet {
  const wanted = new Set(actors);
  return KEYWORD_ACTORS.filter((actor) => wanted.has(actor));
}

/** A text that two sets have in common exactly when they are the same actors, to tell them apart as a key. */
export const actorSetKey = (actors: ActorSet): string => actorSet(actors).join('+');
