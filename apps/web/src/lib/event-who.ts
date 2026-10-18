import { toggleActor, type ActorSet } from '@atlas/core';

/**
 * What the "Who" control of the Events section offers (GAME_RULES R12): nobody in particular, or one of the actors a text
 * can name. "Any creature" (`any`) is something a text says, not something to ask for, so it has no choice.
 */
export const WHO_CHOICES = ['anyone', 'self', 'ally', 'enemy'] as const;
export type WhoChoice = (typeof WHO_CHOICES)[number];

/** What the control shows and what a filter turned on now is made with. */
export interface EventWho {
  /** The actors the event filters name: none is the event whoever acts, and `undefined` is different actors on different sides. */
  readonly shown: ActorSet | undefined;
  /** The actors of a filter that is turned on now, and of the counts beside the buttons. */
  readonly actors: ActorSet;
}

/**
 * The control follows the filters: with none on it shows `chosen`, the last choice made, so that a choice made first is the
 * one the next filter gets; with some on it shows the actors they all name (`named`: `eventActors` of `core`), and nothing
 * when the sides differ, in which case a filter turned on has no actor either.
 */
export function eventWho(named: readonly ActorSet[], chosen: ActorSet): EventWho {
  const [first] = named;
  const shown = named.length === 0 ? chosen : named.length === 1 ? first : undefined;
  return { shown, actors: shown ?? [] };
}

/**
 * The buttons that are pressed: each actor named, or "Any" while none is. "Any creature" has no button, and nothing is pressed
 * while the sides differ.
 */
export function pressedChoices({ shown }: EventWho): readonly WhoChoice[] {
  if (shown === undefined) return [];
  if (shown.length === 0) return ['anyone'];
  return WHO_CHOICES.filter((choice) => choice !== 'anyone' && shown.includes(choice));
}

/** The actors after a press: "Any" takes them all off, and an actor goes in beside the others or out (`toggleActor`). */
export function pressChoice({ shown }: EventWho, choice: WhoChoice): ActorSet {
  return choice === 'anyone' ? [] : toggleActor(shown, choice);
}
