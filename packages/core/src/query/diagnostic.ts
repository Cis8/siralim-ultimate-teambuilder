import type { Span } from './span';
import type { TextEdit } from './text-edit';

/** Why the parser had to repair the query to read it. */
export type SyntaxDiagnosticCode =
  | 'unmatched-close'
  | 'unclosed-open'
  | 'empty-group'
  | 'dangling-operator'
  | 'missing-operand'
  | 'unclosed-quote'
  | 'nested-too-deeply';

/** An error is text the search cannot take as written; a warning is text it reads but that probably is not what was meant. */
export type DiagnosticSeverity = 'error' | 'warning';

/** One edit that makes a diagnostic go away, and the words for the button that makes it. */
export interface DiagnosticFix {
  readonly label: string;
  readonly edit: TextEdit;
}

/**
 * What is wrong with a stretch of a query. The parser reports `QueryDiagnostic<SyntaxDiagnosticCode>`; a lint rule
 * reports its own `id` as the code, so the codes of the rules are open, as the registry of rules is.
 */
export interface QueryDiagnostic<Code extends string = string> {
  readonly code: Code;
  readonly severity: DiagnosticSeverity;
  /** The text at fault. */
  readonly span: Span;
  readonly message: string;
  /** Not given by the parser, which reports and repairs only (`withSyntaxFixes`); absent when no single edit mends it yet. */
  readonly fix?: DiagnosticFix;
}
