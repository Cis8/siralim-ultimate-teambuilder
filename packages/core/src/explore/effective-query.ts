import type { ClassName } from '../model/trait';
import type { QueryNode } from '../query/ast';
import { writeKeywordReference } from '../query/keyword-reference';
import { serialise, serialiseTerm } from '../query/serialise';
import type { ExploreState } from './explore-state';

/**
 * The filters of an Explore state as a query of the language (SPEC §8.1). The state stands for the text: typed in the
 * query bar, it finds the same traits, so the effective-query line can be copied and shared.
 */
export interface FilterQuery {
  /** The classes. The class facet counts the traits without them. */
  readonly classes: string;
  /** The keywords and the flags. */
  readonly rest: string;
}

/** The terms the two flags of an Explore state stand for (QUERY_LANGUAGE §2). */
export const FLAG_TERMS = {
  artifactEligible: { field: 'mat', value: 'yes' },
  doesNotStack: { field: 'stack', value: 'no' },
} as const;

const flagTerm = ({ field, value }: { readonly field: string; readonly value: string }): string =>
  serialiseTerm(field, value);

/**
 * `knownClasses` are the classes of the dataset. `class:` looks for a name inside the class, so `class:boss` finds the
 * traits of Nether Boss too; the query leaves those classes out again, to find the traits of the classes chosen and no
 * others. A class left out takes with it every class whose name contains its own, which matters only if one of those is
 * chosen too (A is part of B, B of C, A and C chosen); no class of the compendium is like that.
 */
export function filterQuery(state: ExploreState, knownClasses: readonly ClassName[]): FilterQuery {
  const flags = [
    state.artifactEligible ? flagTerm(FLAG_TERMS.artifactEligible) : '',
    state.doesNotStack ? flagTerm(FLAG_TERMS.doesNotStack) : '',
  ];
  return {
    classes: classesQuery(state.classes, knownClasses),
    rest: joined([keywordsQuery(state), ...flags]),
  };
}

/** The query bar as it is read, with the filters in front of it: classes, keywords, flags, then what was typed. */
export function effectiveQuery(filters: FilterQuery, ast: QueryNode | undefined): string {
  const filtered = joined([filters.classes, filters.rest]);
  const typed = serialise(ast);
  // An OR is the weakest operator: beside a filter it needs its own parentheses to stay one operand of the AND.
  return joined([filtered, ast?.kind === 'or' && filtered !== '' ? `(${typed})` : typed]);
}

function classesQuery(chosen: readonly ClassName[], known: readonly ClassName[]): string {
  if (chosen.length === 0) return '';
  const terms = chosen.map((name) => serialiseTerm('class', name));
  const anyOf = terms.length === 1 ? terms : [`(${terms.join(' OR ')})`];
  const leftOut = classesNamedInside(chosen, known).map((name) => `-${serialiseTerm('class', name)}`);
  return joined([...anyOf, ...leftOut]);
}

/** The classes, not chosen, that a chosen one is part of the name of. */
function classesNamedInside(chosen: readonly ClassName[], known: readonly ClassName[]): ClassName[] {
  const wanted = chosen.map((name) => name.toLowerCase());
  const candidates = [...new Set(known.map((name) => name.toLowerCase()))];
  return candidates.filter((name) => !wanted.includes(name) && wanted.some((part) => name.includes(part)));
}

function keywordsQuery({ keywords, keywordMode }: ExploreState): string {
  const terms = keywords.map(({ field, ...reference }) => serialiseTerm(field, writeKeywordReference(reference)));
  return keywordMode === 'any' && terms.length > 1 ? `(${terms.join(' OR ')})` : joined(terms);
}

/** The parts that are not empty, apart by a blank: an AND. */
const joined = (parts: readonly string[]): string => parts.filter((part) => part !== '').join(' ');
