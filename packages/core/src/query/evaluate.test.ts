import { describe, expect, it } from 'vitest';
import type { KeywordRole, Trait } from '../model/trait';
import { compileQuery, evaluate } from './evaluate';
import { createFieldRegistry } from './field-registry';
import type { TraitMatcher } from './field';
import { parseQuery } from './parser';
import { createTraitIndex } from './trait-index';

function trait(id: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: id,
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: 'Afflicts a debuff.',
    material: 'Brute Stitches',
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    conditionalSources: [],
    ...overrides,
  };
}

const mentions = (key: string, role: KeywordRole): Trait['keywords'] => [{ key, kind: 'debuff', role, span: [0, 1] }];

const traits = [
  trait('vulnerable-stacks', { description: 'Applies Vulnerable.' }),
  trait('vulnerable-no-stack', { description: 'Applies Vulnerable.', stacks: false }),
  trait('weak-stacks', { description: 'Applies Weak.' }),
  trait('weak-no-stack', { description: 'Applies Weak.', stacks: false }),
  trait('neither', { description: 'Heals an ally.' }),
];
const index = createTraitIndex(traits);

/** The ids of the traits a query finds, in the order the index gives them. */
const found = (query: string): string[] => evaluate(parseQuery(query).ast, index).map((each) => each.id);

describe('evaluate', () => {
  it('finds every trait for a query with no term', () => {
    expect(found('')).toEqual(traits.map((each) => each.id));
    expect(found('   ')).toEqual(traits.map((each) => each.id));
  });

  it('finds the traits a term matches', () => {
    expect(found('weak')).toEqual(['weak-stacks', 'weak-no-stack']);
  });

  it('finds no trait when none matches', () => {
    expect(found('zombies')).toEqual([]);
  });

  it('finds the traits all operands match for AND, written or juxtaposed', () => {
    expect(found('weak AND stack:no')).toEqual(['weak-no-stack']);
    expect(found('weak stack:no')).toEqual(['weak-no-stack']);
  });

  it('finds the traits any operand matches for OR, once each, in index order', () => {
    expect(found('weak OR vulnerable')).toEqual([
      'vulnerable-stacks',
      'vulnerable-no-stack',
      'weak-stacks',
      'weak-no-stack',
    ]);
    expect(found('weak OR weak')).toEqual(['weak-stacks', 'weak-no-stack']);
  });

  it('finds the traits an operand does not match for NOT', () => {
    expect(found('-weak')).toEqual(['vulnerable-stacks', 'vulnerable-no-stack', 'neither']);
    expect(found('NOT stack:no')).toEqual(['vulnerable-stacks', 'weak-stacks', 'neither']);
  });

  it('follows precedence: NOT binds tighter than AND, AND tighter than OR', () => {
    expect(found('weak OR vulnerable stack:no')).toEqual(['vulnerable-no-stack', 'weak-stacks', 'weak-no-stack']);
    expect(found('(weak OR vulnerable) stack:no')).toEqual(['vulnerable-no-stack', 'weak-no-stack']);
    expect(found('(vulnerable OR weak) -stack:no')).toEqual(['vulnerable-stacks', 'weak-stacks']);
  });

  it('reads a double negation as the term', () => {
    expect(found('--weak')).toEqual(found('weak'));
  });

  it('negates a group as a whole', () => {
    expect(found('-(weak OR vulnerable)')).toEqual(['neither']);
  });

  it('evaluates a query repaired by the parser as the repaired query', () => {
    expect(found('(weak OR')).toEqual(found('weak'));
    expect(found('weak) stack:no')).toEqual(found('weak stack:no'));
  });

  it('returns the traits themselves, not copies', () => {
    expect(evaluate(parseQuery('neither').ast, index)[0]).toBe(traits[4]);
  });

  it('returns no trait for an empty index', () => {
    expect(evaluate(parseQuery('weak').ast, createTraitIndex([]))).toEqual([]);
    expect(evaluate(undefined, createTraitIndex([]))).toEqual([]);
  });

  it('reads the fields of the app', () => {
    const withRoles = createTraitIndex([
      trait('gives', { keywords: mentions('vulnerable', 'applies') }),
      trait('relies', { keywords: mentions('vulnerable', 'uses') }),
      trait('both', { keywords: [...mentions('vulnerable', 'applies'), ...mentions('vulnerable', 'uses')] }),
    ]);
    const idsFor = (query: string) => evaluate(parseQuery(query).ast, withRoles).map((each) => each.id);
    expect(idsFor('applies:vulnerable')).toEqual(['gives', 'both']);
    expect(idsFor('uses:vulnerable')).toEqual(['relies', 'both']);
  });

  describe('which registry it asks', () => {
    it('asks the registry for the matcher of a term once, not once per trait', () => {
      const asked: string[] = [];
      const registry = createFieldRegistry([], (value) => {
        asked.push(value);
        return ({ trait: subject }) => subject.description.toLowerCase().includes(value);
      });
      const result = evaluate(parseQuery('weak OR (weak -vulnerable)').ast, index, registry);
      expect(result.map((each) => each.id)).toEqual(['weak-stacks', 'weak-no-stack']);
      expect(asked).toEqual(['weak', 'weak', 'vulnerable']);
    });

    it('uses the matcher a field gives for its term', () => {
      const idStartsWithWeak: TraitMatcher = ({ trait: subject }) => subject.id.startsWith('weak');
      const registry = createFieldRegistry(
        [
          {
            name: 'idea',
            aliases: [],
            help: 'the id of the trait',
            matcher: () => idStartsWithWeak,
            describe: (value) => `idea is “${value}”`,
          },
        ],
        () => () => false,
      );
      expect(evaluate(parseQuery('idea:x').ast, index, registry).map((each) => each.id)).toEqual([
        'weak-stacks',
        'weak-no-stack',
      ]);
    });
  });
});

describe('compileQuery', () => {
  const compiled = (query: string, registry?: Parameters<typeof compileQuery>[1]) =>
    index.entries.filter(compileQuery(parseQuery(query).ast, registry)).map(({ trait: each }) => each.id);

  it('is the test evaluate runs on every trait', () => {
    for (const query of ['weak', 'weak -stack:no', '(vulnerable OR weak) -stack:no', '-(weak OR vulnerable)']) {
      expect(compiled(query), query).toEqual(found(query));
    }
  });

  it('accepts every trait for a query with no term', () => {
    expect(compiled('')).toEqual(traits.map((each) => each.id));
  });

  it('reads the fields from the registry it is given', () => {
    const registry = createFieldRegistry([], () => () => false);
    expect(compiled('weak', registry)).toEqual([]);
  });
});
