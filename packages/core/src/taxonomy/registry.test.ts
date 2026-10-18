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
const event = (key: string, extra: Partial<Extract<TaxonomyEntry, { kind: 'event' }>> = {}): TaxonomyEntry => ({
  kind: 'event',
  key,
  label: key,
  patterns: [key],
  phase: 'startOfBattle',
  ...extra,
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
    const taxonomy = createTaxonomy([debuff('weak'), buff('shelled'), debuff('snared'), event('start of battle')]);

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
      expect(taxonomy.ofKind('event')[0]?.phase).toBe('startOfBattle');
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

    // A query finds a keyword by the start of its key, and so does the filter of a facet, which is a query: `applies:seal`
    // would find both, and the one could never be asked for alone.
    it('refuses a key that is the start of another', () => {
      expect(violations([debuff('sealed', ['Sealed']), buff('seal', ['Seal'])])).toMatch(
        /key "seal" is the start of key "sealed"/,
      );
    });

    it('accepts keys that only share their first words', () => {
      expect(createTaxonomy([event('start of battle'), event('start of turn')]).entries).toHaveLength(2);
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

    it('refuses a stat word that is not one of the patterns', () => {
      expect(violations([event('attack', { patterns: ['attack'], statPatterns: ['strike'] })])).toMatch(
        /"attack" lists the stat word "strike", which is not one of its patterns/,
      );
    });

    it('accepts a stat word that is a pattern, whatever its case', () => {
      const attack = event('attack', { patterns: ['attack', 'attacks'], statPatterns: ['Attack'] });
      expect(createTaxonomy([attack]).get('attack')).toMatchObject({ kind: 'event' });
    });

    it('refuses an empty label', () => {
      expect(violations([{ ...debuff('weak'), label: ' ' }])).toMatch(/"weak" needs a label/);
    });
  });

  // An old key (a trigger phrase of Phase 1) names an event and an actor in addresses and queries (ADR-0009). A query is
  // read by the start of a key, so an alias that was one could not be told from it.
  describe('refusing aliases that would be ambiguous', () => {
    const aliased = (...aliases: { key: string; actor?: 'self' | 'ally' | 'enemy' | 'any' }[]) =>
      event('attack', { patterns: ['attack'], aliases });

    it('accepts an alias that is neither a key nor the start of one', () => {
      const taxonomy = createTaxonomy([aliased({ key: 'after this creature attacks', actor: 'self' }), event('dodge')]);
      expect(taxonomy.get('attack')).toMatchObject({
        aliases: [{ key: 'after this creature attacks', actor: 'self' }],
      });
    });

    it('refuses an alias that is the key of an entry', () => {
      expect(violations([aliased({ key: 'dodge' }), event('dodge')])).toMatch(
        /alias "dodge" of "attack" is the key "dodge"/,
      );
    });

    it('refuses an alias that is the start of a key', () => {
      expect(violations([aliased({ key: 'start of' }), event('start of battle')])).toMatch(
        /alias "start of" of "attack" is the start of key "start of battle"/,
      );
    });

    it('accepts an alias that starts with a key: a query for the alias is no start of the key', () => {
      expect(
        createTaxonomy([event('dodge', { aliases: [{ key: 'attack on' }] }), event('attack')]).entries,
      ).toHaveLength(2);
    });

    describe('looking an alias up', () => {
      const taxonomy = createTaxonomy([
        aliased({ key: 'after this creature attacks', actor: 'self' }, { key: 'strike' }),
        event('dodge', { aliases: [{ key: 'after an enemy dodges', actor: 'enemy' }] }),
        buff('shelled'),
      ]);

      it('names the event, and the actor when the alias gives one', () => {
        expect(taxonomy.alias('after this creature attacks')).toEqual({ key: 'attack', actor: 'self' });
        expect(taxonomy.alias('after an enemy dodges')).toEqual({ key: 'dodge', actor: 'enemy' });
      });

      it('names the event of any creature when the alias gives no actor', () => {
        expect(taxonomy.alias('strike')).toEqual({ key: 'attack' });
      });

      it('knows nothing of a key, of the start of an alias or of a text it was not given', () => {
        expect(taxonomy.alias('attack')).toBeUndefined();
        expect(taxonomy.alias('shelled')).toBeUndefined();
        expect(taxonomy.alias('after this creature')).toBeUndefined();
        expect(taxonomy.alias('constructor')).toBeUndefined();
      });

      it('has none in a taxonomy whose events have no alias', () => {
        expect(createTaxonomy([event('dodge'), debuff('weak')]).alias('dodge')).toBeUndefined();
      });
    });

    it('refuses an alias given twice, in one entry or in two', () => {
      expect(violations([aliased({ key: 'strike' }, { key: 'strike' })])).toMatch(/alias "strike" is given twice/);
      expect(
        violations([aliased({ key: 'strike' }), event('dodge', { aliases: [{ key: 'strike', actor: 'enemy' }] })]),
      ).toMatch(/alias "strike" belongs to both "attack" and "dodge"/);
    });

    it.each([
      ['empty', ''],
      ['not lower case', 'Strike'],
      ['padded', ' strike'],
    ])('refuses an alias that is %s', (_label, key) => {
      expect(violations([aliased({ key })])).toMatch(/alias .* must be lower case, plain text/);
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
