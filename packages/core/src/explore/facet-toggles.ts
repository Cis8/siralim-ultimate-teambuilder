import type { ClassName } from '../model/trait';
import type { ActorSet } from './actor-set';
import type { ExploreState, KeywordFilter } from './explore-state';

const lowerCase = (name: ClassName): ClassName => name.toLowerCase();

const isSameKeywordFilter = (a: KeywordFilter, b: KeywordFilter): boolean =>
  a.field === b.field && a.key === b.key && a.actor === b.actor;

/** Whether the class is chosen, however the dataset spells its name (the state keeps it in lower case). */
export function hasClass(state: ExploreState, name: ClassName): boolean {
  return state.classes.includes(lowerCase(name));
}

/**
 * What a press on a class in the facet panel does (SPEC §8.1): the class is chosen, after the others, which keep the order
 * they were chosen in, or taken off if it was chosen. State in, state out, like a click on a keyword (`clickKeyword`).
 */
export function toggleClass(state: ExploreState, name: ClassName): ExploreState {
  const chosen = lowerCase(name);
  return {
    ...state,
    classes: hasClass(state, name) ? state.classes.filter((other) => other !== chosen) : [...state.classes, chosen],
  };
}

export function hasKeywordFilter(state: ExploreState, filter: KeywordFilter): boolean {
  return state.keywords.some((chosen) => isSameKeywordFilter(chosen, filter));
}

/**
 * What a press on a keyword in the facet panel does: the filter is added after the others, or taken off if it was on.
 * `applies:` and `uses:` of one keyword are two filters and both may be on: the panel does what it is told, unlike a
 * click on a keyword in a description, which jumps from one side to the other.
 */
export function toggleKeywordFilter(state: ExploreState, filter: KeywordFilter): ExploreState {
  return {
    ...state,
    keywords: hasKeywordFilter(state, filter)
      ? state.keywords.filter((chosen) => !isSameKeywordFilter(chosen, filter))
      : [...state.keywords, filter],
  };
}

/** One side of a keyword: the field and the key, whoever acts. The panel's button for it does not know who does. */
export type KeywordSideFilter = Pick<KeywordFilter, 'field' | 'key'>;

const isOnSide = (chosen: KeywordFilter, { field, key }: KeywordSideFilter): boolean =>
  chosen.field === field && chosen.key === key;

/** Whether a filter on this side of the keyword is on, by anyone or by an actor: what the pressed state of its button says. */
export function hasKeywordSide(state: ExploreState, side: KeywordSideFilter): boolean {
  return state.keywords.some((chosen) => isOnSide(chosen, side));
}

/**
 * What a press on a side of an event in the facet panel does: a filter is added after the others for each of `actors`, or
 * one that names nobody when there are none, or every filter on that side is taken off, whoever it names. An event by an actor
 * is the same side as the event by anyone, so a button that looks pressed turns off what made it so (SPEC §8.1).
 */
export function toggleKeywordSide(state: ExploreState, side: KeywordSideFilter, actors: ActorSet = []): ExploreState {
  if (hasKeywordSide(state, side)) {
    return { ...state, keywords: state.keywords.filter((chosen) => !isOnSide(chosen, side)) };
  }
  const added = actors.length === 0 ? [side] : actors.map((actor) => ({ ...side, actor }));
  return { ...state, keywords: [...state.keywords, ...added] };
}
