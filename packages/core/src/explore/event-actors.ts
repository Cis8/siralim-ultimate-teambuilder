import type { KeywordActor, KeywordKey } from '../model/trait';
import type { ExploreState, KeywordFilter } from './explore-state';
import type { KeywordFacet } from './facets';

/** The keys of the events among the keywords the panel lists: only an event can name an actor (GAME_RULES R12). */
function eventKeys(keywords: readonly Pick<KeywordFacet, 'key' | 'kind'>[]): ReadonlySet<KeywordKey> {
  return new Set(keywords.filter(({ kind }) => kind === 'event').map(({ key }) => key));
}

/**
 * Who the event filters that are on name, each actor once, in the order the filters were chosen; `undefined` stands for a
 * filter that names none (the event whoever acts). Empty when no event is filtered on, one entry when they all agree: what the
 * panel's "Who" control shows. A keyword the panel does not list is no event here, as in `activeFilterCounts`.
 */
export function eventActors(
  state: ExploreState,
  keywords: readonly Pick<KeywordFacet, 'key' | 'kind'>[],
): readonly (KeywordActor | undefined)[] {
  const events = eventKeys(keywords);
  const actors: (KeywordActor | undefined)[] = [];
  for (const { key, actor } of state.keywords) {
    if (events.has(key) && !actors.includes(actor)) actors.push(actor);
  }
  return actors;
}

/**
 * What a press on the panel's "Who" control does to the filters that are on: every event filter gets `actor` (or none, the
 * event whoever acts), whatever it named. Two filters that become the same are one, the first keeping its place. The filters
 * of the other keywords, the classes and the settings stay; the very same state comes back when nothing changes, so that the
 * page can tell there is no step to make.
 */
export function narrowEventFilters(
  state: ExploreState,
  keywords: readonly Pick<KeywordFacet, 'key' | 'kind'>[],
  actor: KeywordActor | undefined,
): ExploreState {
  const events = eventKeys(keywords);
  const seen = new Set<string>();
  const narrowed: KeywordFilter[] = [];
  let changed = false;
  for (const chosen of state.keywords) {
    if (!events.has(chosen.key)) {
      narrowed.push(chosen);
      continue;
    }
    const side = `${chosen.field}:${chosen.key}`;
    if (seen.has(side)) {
      changed = true;
      continue;
    }
    seen.add(side);
    if (chosen.actor === actor) {
      narrowed.push(chosen);
      continue;
    }
    changed = true;
    narrowed.push(actor === undefined ? { field: chosen.field, key: chosen.key } : { ...chosen, actor });
  }
  return changed ? { ...state, keywords: narrowed } : state;
}
