import { describe, expect, it, vi } from 'vitest';
import { fieldRegistry } from './fields';
import type { LintContext, LintFinding, LintRule } from './lint-rule';
import { createLintRegistry, LintRegistryError } from './lint-registry';
import { taxonomy } from '../taxonomy/taxonomy';
import type { TermToken } from './token';

const context: LintContext = {
  fields: fieldRegistry,
  taxonomy,
  vocabulary: { class: [], family: [], creature: [], name: [] },
  hits: () => 0,
};

const term: TermToken = {
  kind: 'term',
  text: 'weak',
  span: [0, 4],
  value: 'weak',
  valueSpan: [0, 4],
  quote: 'none',
};

const finding = (message: string): LintFinding => ({ severity: 'warning', span: [0, 4], message });
const otherFinding = (message: string): LintFinding => ({ severity: 'error', span: [1, 2], message });

const reports = (id: string, found: LintFinding): LintRule => ({ id, check: () => found });
const quiet = (id: string): LintRule => ({ id, check: () => undefined });

function problems(rules: LintRule[]): string {
  try {
    createLintRegistry(rules);
  } catch (error) {
    if (error instanceof LintRegistryError) return error.message;
    throw error;
  }
  throw new Error('Expected createLintRegistry to throw');
}

describe('createLintRegistry', () => {
  describe('check', () => {
    it('finds nothing when no rule has anything against the term', () => {
      expect(createLintRegistry([quiet('one'), quiet('two')]).check(term, context)).toEqual([]);
    });

    it('finds nothing when there are no rules at all', () => {
      expect(createLintRegistry([]).check(term, context)).toEqual([]);
    });

    it('gives what a rule found the code of the rule', () => {
      const registry = createLintRegistry([quiet('one'), reports('two', finding('Because.'))]);

      expect(registry.check(term, context)).toEqual([
        { code: 'two', severity: 'warning', span: [0, 4], message: 'Because.' },
      ]);
    });

    it('keeps the fix a rule found', () => {
      const withFix: LintFinding = {
        ...finding('Because.'),
        fix: { label: 'Mend it', edit: { span: [0, 4], text: 'weak!' } },
      };

      expect(createLintRegistry([reports('one', withFix)]).check(term, context)).toEqual([{ code: 'one', ...withFix }]);
    });

    it('gives every finding, in the order of the rules, when several rules find something', () => {
      const registry = createLintRegistry([
        reports('first', finding('First.')),
        quiet('quiet'),
        reports('second', otherFinding('Second.')),
      ]);

      expect(registry.check(term, context).map(({ code, message }) => [code, message])).toEqual([
        ['first', 'First.'],
        ['second', 'Second.'],
      ]);
    });

    it('asks every rule, with the term and the context', () => {
      const asked = vi.fn<LintRule['check']>(() => undefined);
      const other = vi.fn<LintRule['check']>(() => undefined);

      createLintRegistry([
        { id: 'one', check: asked },
        { id: 'two', check: other },
      ]).check(term, context);

      expect(asked).toHaveBeenCalledExactlyOnceWith(term, context);
      expect(other).toHaveBeenCalledExactlyOnceWith(term, context);
    });
  });

  describe('check, for a term the person is still typing (D20)', () => {
    const asked = vi.fn<LintRule['check']>(() => finding('Unfinished.'));
    const alwaysSaid = vi.fn<LintRule['check']>(() => otherFinding('Always.'));
    const registry = createLintRegistry([
      { id: 'waits', check: asked },
      { id: 'speaks', reportsWhileTyping: true, check: alwaysSaid },
    ]);

    it('asks only the rules whose findings are worth showing before the term is finished', () => {
      asked.mockClear();
      alwaysSaid.mockClear();

      expect(registry.check(term, context, { typing: true }).map(({ code }) => code)).toEqual(['speaks']);
      expect(asked).not.toHaveBeenCalled();
      expect(alwaysSaid).toHaveBeenCalledOnce();
    });

    it('asks every rule when the term is finished, or when nothing is said about it', () => {
      expect(registry.check(term, context, { typing: false }).map(({ code }) => code)).toEqual(['waits', 'speaks']);
      expect(registry.check(term, context).map(({ code }) => code)).toEqual(['waits', 'speaks']);
    });
  });

  describe('the rules it accepts', () => {
    it('keeps them in the order given', () => {
      const rules = [quiet('b'), quiet('a')];

      expect(createLintRegistry(rules).rules).toEqual(rules);
    });

    it('rejects two rules with the same id', () => {
      expect(problems([quiet('same'), quiet('other'), quiet('same')])).toContain('id "same" is used by 2 rules');
    });

    it.each(['', ' ', ' padded', 'Upper Case', '-leading', 'trailing-', 'double--hyphen', 'digit1'])(
      'rejects the id %j: it must be lower case words joined by hyphens',
      (id) => {
        expect(problems([quiet(id)])).toContain(`id ${JSON.stringify(id)} must be`);
      },
    );

    it.each(['unknown-field', 'empty-value', 'one'])('accepts the id %j', (id) => {
      expect(() => createLintRegistry([quiet(id)])).not.toThrow();
    });

    it('lists every violation at once', () => {
      const message = problems([quiet('same'), quiet('same'), quiet('')]);

      expect(message).toContain('id "same" is used by 2 rules');
      expect(message).toContain('id "" must be');
    });
  });
});
