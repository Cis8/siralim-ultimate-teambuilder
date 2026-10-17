import { describe, expect, it, vi } from 'vitest';
import type { Trait } from '../model/trait';
import type { SlotRule } from './slot-rule';
import { createSlotRuleRegistry, SlotRuleRegistryError } from './slot-rule-registry';

/** The rules here read nothing from the trait; which rule refuses, and why, is the observation. */
const anyTrait = {} as Trait;

const refusing = (id: string, reason: string): SlotRule => ({ id, refusal: () => reason });
const allowing = (id: string): SlotRule => ({ id, refusal: () => null });

function problems(rules: SlotRule[]): string {
  try {
    createSlotRuleRegistry(rules);
  } catch (error) {
    if (error instanceof SlotRuleRegistryError) return error.message;
    throw error;
  }
  throw new Error('Expected createSlotRuleRegistry to throw');
}

describe('createSlotRuleRegistry', () => {
  describe('canPlace', () => {
    it('places a trait that no rule has anything against', () => {
      const registry = createSlotRuleRegistry([allowing('one'), allowing('two')]);

      expect(registry.canPlace(anyTrait, 'innate')).toEqual({ ok: true });
    });

    it('places any trait when there are no rules at all', () => {
      expect(createSlotRuleRegistry([]).canPlace(anyTrait, 'artifact')).toEqual({ ok: true });
    });

    it('refuses with the reason of the rule, and says which rule it was', () => {
      const registry = createSlotRuleRegistry([allowing('one'), refusing('two', 'Because.')]);

      expect(registry.canPlace(anyTrait, 'fused')).toEqual({ ok: false, rule: 'two', reason: 'Because.' });
    });

    it('gives the reason of the first rule, in the order given, when several refuse', () => {
      const registry = createSlotRuleRegistry([refusing('first', 'First.'), refusing('second', 'Second.')]);

      expect(registry.canPlace(anyTrait, 'fused')).toEqual({ ok: false, rule: 'first', reason: 'First.' });
    });

    it('stops asking at the first refusal', () => {
      const later = vi.fn<SlotRule['refusal']>(() => null);
      const registry = createSlotRuleRegistry([refusing('first', 'First.'), { id: 'later', refusal: later }]);

      registry.canPlace(anyTrait, 'innate');

      expect(later).not.toHaveBeenCalled();
    });

    it('asks every rule about the trait and the slot', () => {
      const asked = vi.fn<SlotRule['refusal']>(() => null);
      const trait = { id: 'a--one' } as Trait;

      createSlotRuleRegistry([{ id: 'one', refusal: asked }]).canPlace(trait, 'artifact');

      expect(asked).toHaveBeenCalledExactlyOnceWith(trait, 'artifact');
    });
  });

  describe('the rules it accepts', () => {
    it('keeps them in the order given', () => {
      const rules = [allowing('b'), allowing('a')];

      expect(createSlotRuleRegistry(rules).rules).toEqual(rules);
    });

    it('rejects two rules with the same id', () => {
      expect(problems([allowing('same'), allowing('other'), allowing('same')])).toContain(
        'id "same" is used by 2 rules',
      );
    });

    it.each(['', ' ', ' padded', 'Upper Case'])('rejects the id %j: it must be a lower-case, hyphenated word', (id) => {
      expect(problems([allowing(id)])).toContain(`id ${JSON.stringify(id)} must be`);
    });

    it('lists every violation at once', () => {
      const message = problems([allowing('same'), allowing('same'), allowing('')]);

      expect(message).toContain('id "same" is used by 2 rules');
      expect(message).toContain('id "" must be');
    });
  });
});
