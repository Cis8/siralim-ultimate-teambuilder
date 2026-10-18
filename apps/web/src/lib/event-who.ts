import type { KeywordActor } from '@atlas/core';

/**
 * What the "Who" control of the Events section offers (GAME_RULES R12): nobody in particular, or one of the actors a text
 * can name. "Any creature" (`any`) is something a text says, not something to ask for, so it has no choice.
 */
export const WHO_CHOICES = ['anyone', 'self', 'ally', 'enemy'] as const;
export type WhoChoice = (typeof WHO_CHOICES)[number];

/** The actor a choice puts on an event filter: none for "Any", which finds the event whoever acts. */
export const actorOf = (choice: WhoChoice): KeywordActor | undefined => (choice === 'anyone' ? undefined : choice);

const choiceOf = (actor: KeywordActor | undefined): WhoChoice | undefined =>
  actor === undefined ? 'anyone' : actor === 'any' ? undefined : actor;

/** What the control shows and what a filter turned on now is made with. */
export interface EventWho {
  /** The choice that is pressed: none while the filters on name several actors, or the actor `any`. */
  readonly shown: WhoChoice | undefined;
  /** The actor of a filter that is turned on now, and of the counts beside the buttons. */
  readonly actor: KeywordActor | undefined;
}

/**
 * The control follows the filters: with none on it shows `chosen`, the last choice made, so that a choice made first is the
 * one the next filter gets; with some on it shows the actor they all name (`named`: `eventActors` of `core`), and nothing
 * when they differ, in which case a filter turned on has no actor either.
 */
export function eventWho(named: readonly (KeywordActor | undefined)[], chosen: WhoChoice): EventWho {
  const [first] = named;
  const shown = named.length === 0 ? chosen : named.length === 1 ? choiceOf(first) : undefined;
  return { shown, actor: shown === undefined ? undefined : actorOf(shown) };
}
