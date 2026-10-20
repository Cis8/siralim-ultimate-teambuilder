import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Trait } from '../model/trait';
import { evaluate } from './evaluate';
import { explainQuery } from './explain-query';
import type { FieldDefinition } from './field';
import { createFieldRegistry } from './field-registry';
import { parseQuery } from './parser';
import { serialise } from './serialise';
import { createTraitIndex } from './trait-index';

const explain = (source: string): string => explainQuery(parseQuery(source).ast);

describe('explainQuery', () => {
  it('says that a query with no term finds every trait', () => {
    expect(explainQuery(undefined)).toBe('every trait');
    expect(explain('')).toBe('every trait');
    expect(explain('   ')).toBe('every trait');
  });

  describe('a term', () => {
    it.each([
      ['weak', 'mentions “weak”'],
      ['"rodian master"', 'mentions “rodian master”'],
      ['class:life', 'class contains “life”'],
      ['c:life', 'class contains “life”'],
      ['family:clutcher', 'family contains “clutcher”'],
      ['creature:"clutcher bruiser"', 'creature contains “clutcher bruiser”'],
      ['trait:"last stand"', 'trait name contains “last stand”'],
      ['desc:dodges', 'description contains “dodges”'],
      ['applies:vulnerable', 'applies “vulnerable”'],
      ['a:vul', 'applies “vul”'],
      ['uses:weak', 'relies on “weak”'],
      ['kw:"start of battle"', 'has keyword “start of battle”'],
      ['uses:attack/self', 'relies on “attack” by this creature'],
      ['u:provoke/enemy', 'relies on “provoke” by an enemy'],
      ['mat:yes', 'has a material'],
      ['mat:none', 'has no material'],
      ['stack:yes', 'stacks'],
      ['stack:no', 'does not stack'],
    ])('reads %j as %j', (source, words) => {
      expect(explain(source)).toBe(words);
    });

    it('says the value in lower case, since the search ignores letter case', () => {
      expect(explain('Weak')).toBe('mentions “weak”');
      expect(explain('CLASS:Life')).toBe('class contains “life”');
      expect(explain('Applies:Vulnerable')).toBe('applies “vulnerable”');
    });

    it('says a value that its field does not take as what was asked for', () => {
      expect(explain('mat:maybe')).toBe('mat is “maybe”');
    });

    it('reads a field nobody knows as the word the search then looks for, colon included', () => {
      expect(explain('clas:life')).toBe('mentions “clas:life”');
      expect(explain('clas:"Rodian Master"')).toBe('mentions “clas:rodian master”');
      expect(explain('clas:')).toBe('mentions “clas:”');
    });

    it.each(['applies:', 'class:', '""', 'applies:""', 'uses:/'])('says that %j asks for nothing', (source) => {
      expect(explain(source)).toBe('asks for nothing');
    });
  });

  describe('the operators', () => {
    it.each([
      ['a b', 'mentions “a” AND mentions “b”'],
      ['a AND b', 'mentions “a” AND mentions “b”'],
      ['a & b', 'mentions “a” AND mentions “b”'],
      ['a OR b', 'mentions “a” OR mentions “b”'],
      ['a | b', 'mentions “a” OR mentions “b”'],
      ['a OR b OR c', 'mentions “a” OR mentions “b” OR mentions “c”'],
      ['a b c', 'mentions “a” AND mentions “b” AND mentions “c”'],
      ['-a', 'NOT mentions “a”'],
      ['NOT a', 'NOT mentions “a”'],
      ['-stack:no', 'NOT does not stack'],
      ['-class:life', 'NOT class contains “life”'],
    ])('reads %j as %j', (source, words) => {
      expect(explain(source)).toBe(words);
    });

    it('reads two negations as two, as the search takes them', () => {
      expect(explain('--weak')).toBe('NOT NOT mentions “weak”');
      expect(explain('NOT NOT weak')).toBe('NOT NOT mentions “weak”');
      expect(explain('---weak')).toBe('NOT NOT NOT mentions “weak”');
    });
  });

  describe('the parentheses: only where precedence needs them', () => {
    it.each([
      // NOT > AND > OR: nothing to add
      ['a OR b c', 'mentions “a” OR mentions “b” AND mentions “c”'],
      ['a b OR c', 'mentions “a” AND mentions “b” OR mentions “c”'],
      ['a OR (b c)', 'mentions “a” OR mentions “b” AND mentions “c”'],
      ['-a b', 'NOT mentions “a” AND mentions “b”'],
      ['a OR -b', 'mentions “a” OR NOT mentions “b”'],
      // an OR inside an AND
      ['(a OR b) c', '(mentions “a” OR mentions “b”) AND mentions “c”'],
      ['a (b OR c)', 'mentions “a” AND (mentions “b” OR mentions “c”)'],
      ['(a OR b) (c OR d)', '(mentions “a” OR mentions “b”) AND (mentions “c” OR mentions “d”)'],
      // what a NOT covers
      ['-(a OR b)', 'NOT (mentions “a” OR mentions “b”)'],
      ['-(a b)', 'NOT (mentions “a” AND mentions “b”)'],
      ['NOT (a b)', 'NOT (mentions “a” AND mentions “b”)'],
      ['-(-a)', 'NOT NOT mentions “a”'],
      ['-(a OR -(b c))', 'NOT (mentions “a” OR NOT (mentions “b” AND mentions “c”))'],
      // the parentheses of the query that make no difference
      ['(a)', 'mentions “a”'],
      ['((a OR b))', 'mentions “a” OR mentions “b”'],
      ['(-a)', 'NOT mentions “a”'],
    ])('reads %j as %j', (source, words) => {
      expect(explain(source)).toBe(words);
    });

    it('flattens a group inside a group of its own kind: one chain reads as one', () => {
      expect(explain('a (b c)')).toBe('mentions “a” AND mentions “b” AND mentions “c”');
      expect(explain('(a b) (c d)')).toBe('mentions “a” AND mentions “b” AND mentions “c” AND mentions “d”');
      expect(explain('a OR (b OR c)')).toBe('mentions “a” OR mentions “b” OR mentions “c”');
      expect(explain('(a OR b) OR c')).toBe('mentions “a” OR mentions “b” OR mentions “c”');
      expect(explain('a AND (b AND (c AND d))')).toBe(
        'mentions “a” AND mentions “b” AND mentions “c” AND mentions “d”',
      );
    });

    it('keeps the parentheses of a group of another kind inside a flattened one', () => {
      expect(explain('a (b (c OR d))')).toBe('mentions “a” AND mentions “b” AND (mentions “c” OR mentions “d”)');
      expect(explain('a OR (b OR (c d))')).toBe('mentions “a” OR mentions “b” OR mentions “c” AND mentions “d”');
    });
  });

  describe('a query of the app', () => {
    it.each([
      ['(vulnerable OR weak) -stack:no', '(mentions “vulnerable” OR mentions “weak”) AND NOT does not stack'],
      [
        'clas:life (weak OR snared applies:vul',
        'mentions “clas:life” AND (mentions “weak” OR mentions “snared” AND applies “vul”)',
      ],
      ['uses:vulnerable mat:yes', 'relies on “vulnerable” AND has a material'],
      ['"start of battle" kw:barrier', 'mentions “start of battle” AND has keyword “barrier”'],
      ['family:clutcher "after an enemy dodges"', 'family contains “clutcher” AND mentions “after an enemy dodges”'],
      [
        '(uses:attack/self OR uses:attack/enemy) mat:yes -stack:no',
        '(relies on “attack” by this creature OR relies on “attack” by an enemy) AND has a material AND NOT does not stack',
      ],
      [
        'class:life (class:death OR class:nature) -(family:clutcher OR family:abomination)',
        'class contains “life” AND (class contains “death” OR class contains “nature”) AND NOT (family contains “clutcher” OR family contains “abomination”)',
      ],
    ])('reads %j as %j', (source, words) => {
      expect(explain(source)).toBe(words);
    });
  });

  describe('a query that needed repairs', () => {
    it.each([
      ['a OR', 'mentions “a”'],
      ['OR a', 'mentions “a”'],
      ['(a OR b', 'mentions “a” OR mentions “b”'],
      ['a b)', 'mentions “a” AND mentions “b”'],
      ['a ()', 'mentions “a”'],
      ['class:"rodian master', 'class contains “rodian master”'],
    ])('reads %j as the query it was read as: %j', (source, words) => {
      expect(explain(source)).toBe(words);
    });
  });

  describe('the fields it reads', () => {
    it('are the ones of the registry it is given', () => {
      const field: FieldDefinition = {
        name: 'size',
        aliases: ['s'],
        help: 'how big the creature is',
        matcher: () => () => true,
        describe: (value) => `is ${value}-sized`,
      };
      const registry = createFieldRegistry([field], () => () => true);
      const text = (source: string) => explainQuery(parseQuery(source).ast, registry);
      expect(text('S:Big')).toBe('is big-sized');
      expect(text('size:big -class:life')).toBe('is big-sized AND NOT mentions “class:life”');
    });
  });

  describe('consistent with the search', () => {
    const trait = (name: string, overrides: Partial<Trait>): Trait => ({
      id: name.toLowerCase().replaceAll(' ', '-'),
      name,
      creature: 'Clutcher Bruiser',
      family: 'Clutcher',
      class: 'Life',
      kind: 'creature',
      description: 'Applies Weak.',
      material: null,
      stacks: true,
      randomDebuff: null,
      masteryFamily: null,
      partyRequirement: null,
      keywords: [],
      conditionalSources: [],
      ...overrides,
    });
    const index = createTraitIndex([
      trait('Last Stand', { description: 'Applies Vulnerable after an enemy dodges.', material: 'Knight Helm' }),
      trait('Flesh Rot', { class: 'Death', family: 'Abomination', stacks: false }),
      trait('Mother’s Love', { class: 'Nature', description: 'Heals allies.', stacks: false, material: 'Soft Cloth' }),
      trait('Quiet Step', { class: 'Life', description: 'Nothing happens.' }),
    ]);
    const found = (source: string): string[] => evaluate(parseQuery(source).ast, index).map(({ name }) => name);

    it('reads two queries that mean the same as one text: the same parts, in the same order', () => {
      // `a OR (b OR c)` and `a OR b OR c` find the same traits, so they must say the same thing.
      const pairs = [
        ['weak OR (class:death OR class:nature)', 'weak OR class:death OR class:nature'],
        ['life (clutcher (stack:yes))', 'life clutcher stack:yes'],
        ['(weak) -(stack:no)', 'weak -stack:no'],
        ['((class:life))', 'class:life'],
      ] as const;
      for (const [first, second] of pairs) {
        expect(found(first), `${first} and ${second}`).toEqual(found(second));
        expect(explain(first), `${first} and ${second}`).toBe(explain(second));
      }
    });

    it('says something different for two queries that find different traits', () => {
      const sources = [
        'weak',
        'life',
        'class:life',
        'class:death',
        'class:life OR class:death',
        'class:life class:death',
        '-stack:no',
        'stack:no',
        'mat:yes',
        'weak OR mat:yes',
        'weak mat:yes',
        '(weak OR mat:yes) stack:no',
        'weak OR (mat:yes stack:no)',
        'weak OR mat:yes stack:no',
        '-(class:life OR class:death)',
        '-class:life OR class:death',
        '--class:life',
      ];
      for (const [first, second] of sources.flatMap((a, i) => sources.slice(i + 1).map((b) => [a, b] as const))) {
        if (found(first).join() !== found(second).join()) {
          expect(explain(first), `${first} and ${second} find different traits`).not.toBe(explain(second));
        }
      }
    });
  });

  describe('for any query', () => {
    const piece = fc.constantFrom(
      '(',
      ')',
      '"',
      '-',
      'weak',
      'Class:life',
      'class:',
      'applies:vul',
      'uses:attack/self',
      'mat:yes',
      'stack:no',
      'clas:life',
      'OR',
      'AND',
      'NOT',
      '|',
      '&',
      'é',
    );
    const queryLike = fc.array(piece, { maxLength: 30 }).map((pieces) => pieces.join(' '));
    const anyText = fc.oneof(queryLike, queryLike, fc.string({ unit: 'binary' }));

    it('never throws and always says something', () => {
      fc.assert(
        fc.property(anyText, (source) => {
          expect(explain(source).length, source).toBeGreaterThan(0);
        }),
      );
    });

    it('depends on what the query means, not on how it is spelt: the canonical text says the same', () => {
      fc.assert(
        fc.property(anyText, (source) => {
          const { ast } = parseQuery(source);
          expect(explain(serialise(ast)), source).toBe(explainQuery(ast));
        }),
      );
    });
  });
});
