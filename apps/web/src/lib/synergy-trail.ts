import type { TraitId } from '@atlas/core';

/** How many traits the trail remembers. */
export const TRAIL_LENGTH = 6;

/**
 * The trail of traits the person has centred on, after they centre on `id`: it goes at the end, and the trail keeps the last
 * few. A trait already on the trail cuts it back to there (Back, or a click on a crumb): what followed it was another way.
 *
 * The trail is the memory of a session of exploring: whoever holds it starts from `[]` when the app opens, so a deep link or a
 * reload has none.
 */
export function extendTrail(trail: readonly TraitId[], id: TraitId): readonly TraitId[] {
  const at = trail.indexOf(id);
  if (at >= 0) return trail.slice(0, at + 1);
  return [...trail, id].slice(-TRAIL_LENGTH);
}
