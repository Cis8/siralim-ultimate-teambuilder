import { ruleIdViolations } from '../registry/rule-id-violations';
import type { QueryDiagnostic } from './diagnostic';
import type { LintContext, LintRule } from './lint-rule';
import type { TermToken } from './token';

/** The rules break a rule that would make a finding impossible to name. */
export class LintRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LintRegistryError';
  }
}

export interface LintRegistry {
  /** In the order they were given. */
  readonly rules: readonly LintRule[];
  /**
   * What the rules find wrong with the term, each as a diagnostic that carries the id of its rule as the code. In the order of
   * the rules. For a term the person is still `typing`, only the rules that `reportsWhileTyping` are asked.
   */
  check(term: TermToken, context: LintContext, options?: { readonly typing?: boolean }): QueryDiagnostic[];
}

/**
 * Checks the rules and wraps them. A new thing to tell a person about their query is a new rule; `check` and the page
 * that shows what it finds do not change.
 *
 * @throws LintRegistryError listing every violation.
 */
export function createLintRegistry(rules: readonly LintRule[]): LintRegistry {
  const violations = ruleIdViolations(rules);
  if (violations.length > 0) {
    throw new LintRegistryError(`The lint rules are not valid:\n- ${violations.join('\n- ')}`);
  }

  return {
    rules,
    check(term, context, { typing = false } = {}) {
      return rules.flatMap((rule) => {
        if (typing && rule.reportsWhileTyping !== true) return [];
        const found = rule.check(term, context);
        return found === undefined ? [] : [{ code: rule.id, ...found }];
      });
    },
  };
}
