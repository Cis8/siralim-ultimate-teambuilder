import type { Trait } from '../model/trait';
import type { SlotName } from './party';

/** One thing the game does not allow in a slot (GAME_RULES R1, R6). */
export interface SlotRule {
  /** Names the rule in a refusal: lower case and hyphenated, stable, so that tests and the page can tell refusals apart. */
  readonly id: string;
  /**
   * Why `trait` cannot sit in `slot`, as a sentence to show next to the disabled button, or `null` when this rule has
   * nothing against it. It speaks of the kind of trait and the slot, not of this trait: the page already shows which.
   */
  refusal(trait: Trait, slot: SlotName): string | null;
}

export type Placement =
  { readonly ok: true } | { readonly ok: false; readonly rule: SlotRule['id']; readonly reason: string };
