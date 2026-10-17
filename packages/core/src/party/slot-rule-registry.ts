import type { Trait } from '../model/trait';
import type { SlotName } from './party';
import type { Placement, SlotRule } from './slot-rule';

/** The rules break a rule that would make a refusal impossible to name. */
export class SlotRuleRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlotRuleRegistryError';
  }
}

export interface SlotRuleRegistry {
  /** In the order they were given. */
  readonly rules: readonly SlotRule[];
  /**
   * Whether the trait may sit in the slot. When several rules refuse, the first one in the registry's order gives the
   * reason: put the rule about what the trait is before the ones about its details.
   */
  canPlace(trait: Trait, slot: SlotName): Placement;
}

/**
 * Checks the rules and wraps them. A new rule of the game is a new entry; `canPlace` and the page that shows the reason
 * do not change.
 *
 * @throws SlotRuleRegistryError listing every violation.
 */
export function createSlotRuleRegistry(rules: readonly SlotRule[]): SlotRuleRegistry {
  const violations = [...idViolations(rules), ...duplicateViolations(rules)];
  if (violations.length > 0) {
    throw new SlotRuleRegistryError(`The slot rules are not valid:\n- ${violations.join('\n- ')}`);
  }

  return {
    rules,
    canPlace(trait, slot) {
      for (const rule of rules) {
        const reason = rule.refusal(trait, slot);
        if (reason !== null) return { ok: false, rule: rule.id, reason };
      }
      return { ok: true };
    },
  };
}

function idViolations(rules: readonly SlotRule[]): string[] {
  return rules
    .filter(({ id }) => !/^[a-z]+(-[a-z]+)*$/.test(id))
    .map(({ id }) => `id ${JSON.stringify(id)} must be lower case words joined by hyphens`);
}

function duplicateViolations(rules: readonly SlotRule[]): string[] {
  const counts = new Map<string, number>();
  for (const { id } of rules) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([id, count]) => `id ${JSON.stringify(id)} is used by ${count} rules`);
}
