import { describe, expect, it } from 'vitest';
import type { TaxonomyEntry } from './entry';
import { createTaxonomy, TaxonomyError } from './registry';

const debuff = (key: string, patterns: string[] = [key]): TaxonomyEntry => ({
  kind: 'debuff',
  key,
  label: key,
  patterns,
  canBeRandomlyApplied: true,
});
const buff = (key: string, patterns: string[] = [key]): TaxonomyEntry => ({ kind: 'buff', key, label: key, patterns });
const trigger = (key: string): TaxonomyEntry => ({
  kind: 'trigger',
  key,
  label: key,
  patterns: [key],
  phase: 'startOfBattle',
});

function violations(entries: TaxonomyEntry[]): string {
  try {
    createTaxonomy(entries);
  } catch (error) {
    if (error instanceof TaxonomyError) return error.message;
    throw error;
  }
  throw new Error('Expected createTaxonomy to throw');
}

describe('createTaxonomy', () => {
  describe('looking entries up', () => {
    const taxonomy = createTaxonomy([debuff('weak'), buff('shelled'), debuff('snared'), trigger('start of battle')]);

    it('keeps the entries in the order given', () => {
      expect(taxonomy.entries.map((entry) => entry.key)).toEqual(['weak', 'shelled', 'snared', 'start of battle']);
    });

    it('finds an entry by key', () => {
      expect(taxonomy.get('shelled')).toMatchObject({ kind: 'buff', key: 'shelled' });
      expect(taxonomy.get('nothing')).toBeUndefined();
    });

    it('lists the entries of one kind, with the type of that kind', () => {
      const debuffs = taxonomy.ofKind('debuff');
      expect(debuffs.map((entry) => entry.key)).toEqual(['weak', 'snared']);
      expect(debuffs.every((entry) => entry.canBeRandomlyApplied)).toBe(true);
      expect(taxonomy.ofKind('trigger')[0]?.phase).toBe('startOfBattle');
      expect(taxonomy.ofKind('mechanic')).toEqual([]);
    });

    it('accepts an empty taxonomy', () => {
      expect(createTaxonomy([]).entries).toEqual([]);
    });
  });

  describe('refusing a taxonomy that would match ambiguously', () => {
    it('refuses two entries with the same key', () => {
      expect(violations([debuff('weak'), buff('weak', ['strong'])])).toMatch(/key "weak" is used by 2 entries/);
    });

    it('refuses a pattern that two entries share, whatever its case', () => {
      expect(violations([debuff('weak', ['Weak']), buff('feeble', ['weak'])])).toMatch(
        /pattern "weak" belongs to both "weak" and "feeble"/,
      );
    });

    it('refuses a pattern repeated inside one entry', () => {
      expect(violations([debuff('stoned', ['Stoned', 'stoned'])])).toMatch(/"stoned" lists the pattern "stoned" twice/);
    });
  });

  describe('refusing entries that could never match', () => {
    it('refuses an entry with no pattern', () => {
      expect(violations([debuff('weak', [])])).toMatch(/"weak" has no pattern/);
    });

    it.each([
      ['empty', ''],
      ['padded', ' weak'],
      ['with a double space', 'start  of battle'],
      ['with a curly apostrophe', 'creature’s turn'],
      ['with a line break', 'start\nof battle'],
    ])('refuses a pattern that is %s', (_label, pattern) => {
      expect(violations([debuff('x', [pattern])])).toMatch(/pattern .* must be plain text/);
    });

    it.each([
      ['empty', ''],
      ['not lower case', 'Weak'],
      ['padded', 'weak '],
    ])('refuses a key that is %s', (_label, key) => {
      expect(violations([debuff(key, ['weak'])])).toMatch(/key .* must be lower case and trimmed/);
    });

    it('refuses an active form that is not one of the patterns', () => {
      const effect: TaxonomyEntry = {
        kind: 'effect',
        key: 'sealed',
        label: 'Sealed',
        patterns: ['Sealed', 'Seals'],
        activePatterns: ['Sealing'],
      };
      expect(violations([effect])).toMatch(
        /"sealed" lists the active form "Sealing", which is not one of its patterns/,
      );
    });

    it('accepts an active form that is a pattern, whatever its case', () => {
      const effect: TaxonomyEntry = {
        kind: 'effect',
        key: 'sealed',
        label: 'Sealed',
        patterns: ['Sealed', 'Seals'],
        activePatterns: ['seals'],
      };
      expect(createTaxonomy([effect]).get('sealed')).toMatchObject({ kind: 'effect' });
    });

    it('refuses an empty label', () => {
      expect(violations([{ ...debuff('weak'), label: ' ' }])).toMatch(/"weak" needs a label/);
    });
  });

  it('reports every violation at once', () => {
    const message = violations([debuff('weak'), buff('weak', ['strong']), debuff('snared', []), debuff('Bad', ['x'])]);
    expect(message).toMatch(/key "weak" is used by 2 entries/);
    expect(message).toMatch(/"snared" has no pattern/);
    expect(message).toMatch(/key "Bad" must be lower case and trimmed/);
    expect(message.split('\n- ')).toHaveLength(4);
  });
});
