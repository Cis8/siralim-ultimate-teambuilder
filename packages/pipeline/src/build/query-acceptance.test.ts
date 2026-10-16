import { createTraitIndex, evaluate, parseQuery, type Trait, type TraitIndex } from '@atlas/core';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRealSheet } from '../testing/real-build';

// Acceptance criteria 1 and 2 (docs/ROADMAP.md) on the pinned snapshot of the compendium, v2.0. Each answer is compared
// with one worked out another way: a plain filter on the columns of the trait for criterion 1, the committed list of
// mentions read by hand (`snapshots/keywords-v2.0.txt`) for criterion 2. Neither goes through the lexer, the parser,
// the field registry or the index.

const KEYWORD_MENTIONS = new URL('../../snapshots/keywords-v2.0.txt', import.meta.url);

describe('the query language on the compendium v2.0', () => {
  let traits: readonly Trait[];
  let index: TraitIndex;

  const find = (query: string): string[] => evaluate(parseQuery(query).ast, index).map((trait) => trait.id);

  beforeAll(async () => {
    ({ traits } = await buildRealSheet());
    index = createTraitIndex(traits);
  });

  it('finds every trait for an empty query', () => {
    expect(find('')).toEqual(traits.map((trait) => trait.id));
  });

  it('splits the dataset between a query and its negation', () => {
    for (const query of ['weak', 'class:life', 'applies:vulnerable', 'mat:none', 'stack:no', '"does not stack"']) {
      const found = find(query);
      expect(found.length, query).toBeGreaterThan(0);
      expect(find(`-(${query})`), query).toEqual(traits.map((trait) => trait.id).filter((id) => !found.includes(id)));
    }
  });

  describe('criterion 1: (vulnerable OR weak) -stack:no', () => {
    const mentions = (trait: Trait): boolean =>
      [trait.creature, trait.family, trait.class, trait.name, trait.description, trait.material].some(
        (column) => column !== null && /vulnerable|weak/i.test(column),
      );

    it('finds exactly the traits that mention Vulnerable or Weak and stack', () => {
      const expected = traits.filter((trait) => mentions(trait) && trait.stacks).map((trait) => trait.id);
      expect(find('(vulnerable OR weak) -stack:no')).toEqual(expected);
    });

    it('is a query where each part has an effect', () => {
      const mentioning = traits.filter(mentions);
      const expected = find('(vulnerable OR weak) -stack:no');
      expect(expected.length).toBeGreaterThan(0);
      expect(expected.length).toBeLessThan(mentioning.length);
      expect(mentioning.length).toBeLessThan(traits.length);
      expect(find('vulnerable').length).toBeLessThan(mentioning.length);
      expect(find('weak').length).toBeLessThan(mentioning.length);
    });
  });

  describe('criterion 2: applies: and uses:', () => {
    const mentionsRead = readMentions();
    /** The ids of the traits with a mention of a keyword that starts with `value`, in `role`, in dataset order. */
    const idsWithMention = (role: string, value: string): string[] => {
      const ids = new Set(mentionsRead.filter((m) => m.role === role && m.key.startsWith(value)).map((m) => m.id));
      return traits.map((trait) => trait.id).filter((id) => ids.has(id));
    };
    const keysWithARole = [
      ...new Set(mentionsRead.filter((m) => m.role === 'applies' || m.role === 'uses').map((m) => m.key)),
    ];

    it.each(keysWithARole)('finds for %s the traits whose mention has that role', (key) => {
      expect(find(`applies:"${key}"`)).toEqual(idsWithMention('applies', key));
      expect(find(`uses:"${key}"`)).toEqual(idsWithMention('uses', key));
    });

    // The two sets are disjoint but for a trait that gives *and* relies on the keyword (QUERY_LANGUAGE §2). For
    // Vulnerable that is one trait: Cloudy Constitution "always has Vulnerable … creatures with Vulnerable gain".
    it('keeps Vulnerable given and Vulnerable relied on apart, but for the trait that does both', () => {
      const gives = find('applies:vulnerable');
      const relies = find('uses:vulnerable');
      expect([gives.length, relies.length]).toEqual([8, 6]);
      expect(gives.filter((id) => relies.includes(id))).toEqual(['elementasaur--cloudy-constitution']);
      expect(new Set([...gives, ...relies]).size).toBe(13);
    });

    it('leaves a mention that only guards against a keyword to kw:', () => {
      const givesOrReliesOn = new Set([
        ...idsWithMention('applies', 'silenced'),
        ...idsWithMention('uses', 'silenced'),
      ]);
      const onlyGuards = idsWithMention('resists', 'silenced').filter((id) => !givesOrReliesOn.has(id));
      expect(onlyGuards.length).toBeGreaterThan(0);
      for (const id of onlyGuards) {
        expect(find('kw:silenced'), id).toContain(id);
        expect(find('applies:silenced'), id).not.toContain(id);
        expect(find('uses:silenced'), id).not.toContain(id);
      }
    });
  });
});

interface Mention {
  readonly id: string;
  readonly key: string;
  /** `-` for a keyword with no role. */
  readonly role: string;
}

/** The mentions as the committed file lists them, one `trait | key | role` line each. */
function readMentions(): Mention[] {
  return readFileSync(KEYWORD_MENTIONS, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => {
      const [id = '', key = '', role = ''] = line.split(' | ');
      return { id, key, role };
    });
}
