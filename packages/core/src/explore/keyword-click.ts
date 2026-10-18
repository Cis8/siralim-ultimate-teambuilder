import type { KeywordHit } from '../model/trait';
import { NO_STACK_KEY } from '../taxonomy/flags';
import type { Taxonomy } from '../taxonomy/registry';
import { taxonomy as appTaxonomy } from '../taxonomy/taxonomy';
import type { ExploreState, KeywordFilterField } from './explore-state';
import { hasKeywordSide, toggleKeywordSide, type KeywordSideFilter } from './facet-toggles';

/**
 * What a click on a keyword in a description shows (SPEC §8.1): the other side of what the trait does with it (a trait
 * that applies Vulnerable leads to the ones that rely on it, and the other way round; a trait that reacts to an attack, to
 * the ones that cause attacks), the traits that mention a keyword with no side to take, or those that do not stack.
 */
export type ClickGoal = 'appliers' | 'users' | 'mentions' | 'nonStacking';

/** The part of a keyword hit that decides what a click on it does. */
export type ClickedKeyword = Pick<KeywordHit, 'key' | 'kind' | 'role'>;

type KeywordGoal = Exclude<ClickGoal, 'nonStacking'>;

const GOAL_FIELDS: Record<KeywordGoal, KeywordFilterField> = { appliers: 'applies', users: 'uses', mentions: 'kw' };

/** `applies:` and `uses:` are the two sides of one keyword: a jump to one leaves the other. */
const OTHER_SIDE: Partial<Record<KeywordFilterField, KeywordFilterField>> = { applies: 'uses', uses: 'applies' };

export function clickGoal({ key, kind, role }: ClickedKeyword, taxonomy: Taxonomy = appTaxonomy): ClickGoal {
  if (kind === 'flag' && key === NO_STACK_KEY) return 'nonStacking';
  // Nobody causes a moment of the battle (its start): the counterpart of a trait that waits for it is none.
  const entry = taxonomy.get(key);
  if (entry?.kind === 'event' && entry.moment === true) return 'mentions';
  if (role === 'applies') return 'users';
  if (role === 'uses') return 'appliers';
  // A mention that only guards against the keyword (GAME_RULES R9) has no side, nor has a mechanic.
  return 'mentions';
}

/**
 * Whether the filter a click on this keyword stands for is on: what a toggle button says it has pressed. An event filtered
 * for one actor in the panel is on too: a click is for the keyword, whoever acts, and the panel's button is pressed for it.
 */
export function isClickOn(state: ExploreState, keyword: ClickedKeyword, taxonomy: Taxonomy = appTaxonomy): boolean {
  const goal = clickGoal(keyword, taxonomy);
  if (goal === 'nonStacking') return state.doesNotStack;
  return hasKeywordSide(state, sideOf(goal, keyword));
}

/**
 * The state after a click: the filter it stands for is added after the others, or taken off if it was on. Adding the
 * filter of one side of a keyword takes off the other side's (`applies:vulnerable` becomes `uses:vulnerable`), so that
 * the click shows the counterpart and not the traits that are both; taking it off leaves the other side as it was.
 * The filter of a click names no actor, and the sides it takes off are those of any actor.
 */
export function clickKeyword(
  state: ExploreState,
  keyword: ClickedKeyword,
  taxonomy: Taxonomy = appTaxonomy,
): ExploreState {
  const goal = clickGoal(keyword, taxonomy);
  if (goal === 'nonStacking') return { ...state, doesNotStack: !state.doesNotStack };

  const side = sideOf(goal, keyword);
  if (hasKeywordSide(state, side)) return toggleKeywordSide(state, side);
  const otherSide = OTHER_SIDE[side.field];
  const kept = state.keywords.filter((chosen) => chosen.key !== side.key || chosen.field !== otherSide);
  return toggleKeywordSide({ ...state, keywords: kept }, side);
}

const sideOf = (goal: KeywordGoal, { key }: ClickedKeyword): KeywordSideFilter => ({ field: GOAL_FIELDS[goal], key });
