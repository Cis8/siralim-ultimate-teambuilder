import type { Trait } from '../model/trait';
import { SLOT_NAMES, type SlotName } from './party';
import type { SlotRuleRegistry } from './slot-rule-registry';
import { slotRules } from './slot-rules';

/**
 * The slots of a creature that take the trait, in the order of the creature (Innate, Fused, Artifact): every slot the
 * rules do not refuse it for (GAME_RULES R1, R6). Empty when no slot takes it, a special trait with no material.
 */
export function allowedSlots(trait: Trait, rules: SlotRuleRegistry = slotRules): readonly SlotName[] {
  return SLOT_NAMES.filter((slot) => rules.canPlace(trait, slot).ok);
}
