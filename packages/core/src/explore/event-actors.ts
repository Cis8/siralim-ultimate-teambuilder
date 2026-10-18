import type { KeywordActor, KeywordKey } from '../model/trait';
import { actorSet, actorSetKey, type ActorSet } from './actor-set';
import type { ExploreState, KeywordFilter } from './explore-state';
import type { KeywordSideFilter } from './facet-toggles';
import type { KeywordFacet } from './facets';

/** The keys of the events among the keywords the panel lists: only an event can name an actor (GAME_RULES R12). */
function eventKeys(keywords: readonly Pick<KeywordFacet, 'key' | 'kind'>[]): ReadonlySet<KeywordKey> {
  return new Set(keywords.filter(({ kind }) => kind === 'event').map(({ key }) => key));
}

const sideId = ({ field, key }: KeywordSideFilter): string => `${field}:${key}`;

/**
 * Who the event filters that are on name, a set of actors for each side of an event: the filters on one side are alternatives,
 * so its actors are all those they name, and none if one of them names nobody (anyone includes every actor). Each set once, in
 * the order of the sides: empty when no event is filtered on, one entry when every side names the same, which is what the
 * panel's "Who" control shows. A keyword the panel does not list is no event here, as in `activeFilterCounts`.
 */
export function eventActors(
  state: ExploreState,
  keywords: readonly Pick<KeywordFacet, 'key' | 'kind'>[],
): readonly ActorSet[] {
  const events = eventKeys(keywords);
  const sides = new Map<string, { anyone: boolean; actors: KeywordActor[] }>();
  for (const { field, key, actor } of state.keywords) {
    if (!events.has(key)) continue;
    const side = sides.get(sideId({ field, key })) ?? { anyone: false, actors: [] };
    if (actor === undefined) side.anyone = true;
    else side.actors.push(actor);
    sides.set(sideId({ field, key }), side);
  }
  const distinct = new Map<string, ActorSet>();
  for (const { anyone, actors } of sides.values()) {
    const named = anyone ? [] : actorSet(actors);
    distinct.set(actorSetKey(named), named);
  }
  return [...distinct.values()];
}

/**
 * What a press on the panel's "Who" control does to the set it shows: the actor goes into the set, or out of it if it was in.
 * `undefined` is the control showing nothing, because the filters name different actors: a press then chooses that actor alone.
 * An empty set is the event whoever acts, which is what is left when the last actor goes. "Any creature" is no button of
 * the control, so a press never takes it off.
 */
export function toggleActor(shown: ActorSet | undefined, actor: KeywordActor): ActorSet {
  if (shown === undefined) return [actor];
  return actorSet(shown.includes(actor) ? shown.filter((each) => each !== actor) : [...shown, actor]);
}

/**
 * What a press on the panel's "Who" control does to the filters that are on: every event side gets one filter for each of
 * `actors`, or one that names nobody when there are none (the event whoever acts). A filter that is already right stays where
 * it is; one that is not goes, and what is missing is added after the last filter of its side that stays, or where the first
 * one that went stood. Two filters that become the same are one, the first keeping its place. The filters of the other
 * keywords, the classes and the settings stay; the very same state comes back when nothing changes, so that the page can
 * tell there is no step to make.
 */
export function setEventActors(
  state: ExploreState,
  keywords: readonly Pick<KeywordFacet, 'key' | 'kind'>[],
  actors: ActorSet,
): ExploreState {
  const events = eventKeys(keywords);
  const wanted: readonly (KeywordActor | undefined)[] = actors.length === 0 ? [undefined] : actorSet(actors);
  const sides = new Map(
    state.keywords
      .filter(({ key }) => events.has(key))
      .map(({ field, key }) => [sideId({ field, key }), { field, key }]),
  );
  let reshaped = state.keywords;
  for (const side of sides.values()) reshaped = reshapeSide(reshaped, side, wanted);
  const unchanged =
    reshaped.length === state.keywords.length && reshaped.every((each, at) => each === state.keywords[at]);
  return unchanged ? state : { ...state, keywords: reshaped };
}

function reshapeSide(
  filters: readonly KeywordFilter[],
  side: KeywordSideFilter,
  wanted: readonly (KeywordActor | undefined)[],
): KeywordFilter[] {
  const kept = new Set<KeywordActor | undefined>();
  const reshaped: KeywordFilter[] = [];
  let insertAt: number | undefined;
  for (const chosen of filters) {
    if (sideId(chosen) !== sideId(side)) {
      reshaped.push(chosen);
    } else if (wanted.includes(chosen.actor) && !kept.has(chosen.actor)) {
      kept.add(chosen.actor);
      reshaped.push(chosen);
      insertAt = reshaped.length;
    } else {
      insertAt ??= reshaped.length;
    }
  }
  const missing = wanted
    .filter((actor) => !kept.has(actor))
    .map((actor): KeywordFilter => ({ field: side.field, key: side.key, ...(actor === undefined ? {} : { actor }) }));
  reshaped.splice(insertAt ?? reshaped.length, 0, ...missing);
  return reshaped;
}
