import type { KeywordHit } from '../model/trait';
import { NO_STACK_KEY } from '../taxonomy/flags';
import type { ExploreState, KeywordFilter, KeywordFilterField } from './explore-state';
import { hasKeywordFilter, toggleKeywordFilter } from './facet-toggles';

/**
 * What a click on a keyword in a description shows (SPEC §8.1): the other side of what the trait does with it (a trait
 * that applies Vulnerable leads to the ones that rely on it, and the other way round), the traits that mention a keyword
 * with no side to take, or those that do not stack.
 */
export type ClickGoal = 'appliers' | 'users' | 'mentions' | 'nonStacking';

/** The part of a keyword hit that decides what a click on it does. */
export type ClickedKeyword = Pick<KeywordHit, 'key' | 'kind' | 'role'>;

type KeywordGoal = Exclude<ClickGoal, 'nonStacking'>;

const GOAL_FIELDS: Record<KeywordGoal, KeywordFilterField> = { appliers: 'applies', users: 'uses', mentions: 'kw' };

/** `applies:` and `uses:` are the two sides of one keyword: a jump to one leaves the other. */
const OTHER_SIDE: Partial<Record<KeywordFilterField, KeywordFilterField>> = { applies: 'uses', uses: 'applies' };

export function clickGoal({ key, kind, role }: ClickedKeyword): ClickGoal {
  if (kind === 'flag' && key === NO_STACK_KEY) return 'nonStacking';
  if (role === 'applies') return 'users';
  if (role === 'uses') return 'appliers';
  // A mention that only guards against the keyword (GAME_RULES R9) has no side, nor has a trigger or a mechanic.
  return 'mentions';
}

/** Whether the filter a click on this keyword stands for is on: what a toggle button says it has pressed. */
export function isClickOn(state: ExploreState, keyword: ClickedKeyword): boolean {
  const goal = clickGoal(keyword);
  if (goal === 'nonStacking') return state.doesNotStack;
  return hasKeywordFilter(state, filterOf(goal, keyword));
}

/**
 * The state after a click: the filter it stands for is added after the others, or taken off if it was on. Adding the
 * filter of one side of a keyword takes off the other side's (`applies:vulnerable` becomes `uses:vulnerable`), so that
 * the click shows the counterpart and not the traits that are both; taking it off leaves the other side as it is.
 */
export function clickKeyword(state: ExploreState, keyword: ClickedKeyword): ExploreState {
  const goal = clickGoal(keyword);
  if (goal === 'nonStacking') return { ...state, doesNotStack: !state.doesNotStack };

  const filter = filterOf(goal, keyword);
  if (hasKeywordFilter(state, filter)) return toggleKeywordFilter(state, filter);
  const otherSide = OTHER_SIDE[filter.field];
  const kept = state.keywords.filter((chosen) => chosen.key !== filter.key || chosen.field !== otherSide);
  return toggleKeywordFilter({ ...state, keywords: kept }, filter);
}

const filterOf = (goal: KeywordGoal, { key }: ClickedKeyword): KeywordFilter => ({ field: GOAL_FIELDS[goal], key });
