import type { Span } from './span';

/** Why the parser had to repair the query to read it. */
export type SyntaxDiagnosticCode =
  | 'unmatched-close'
  | 'unclosed-open'
  | 'empty-group'
  | 'dangling-operator'
  | 'missing-operand'
  | 'unclosed-quote'
  | 'nested-too-deeply';

export interface QueryDiagnostic {
  readonly code: SyntaxDiagnosticCode;
  readonly severity: 'error';
  /** The text at fault. */
  readonly span: Span;
  readonly message: string;
}
