import type { QueryDiagnostic } from '@atlas/core';

/**
 * How many issues the panel lists. A pasted text can have hundreds and fixing one reveals the next, so the panel shows the first
 * few and says how many it leaves out; the badge counts them all.
 */
export const MAX_ISSUES_SHOWN = 5;

export interface IssueSummary {
  /** Every issue of the query. */
  readonly count: number;
  /** The ones the panel lists: errors first, each kind in the order of the text. */
  readonly shown: readonly QueryDiagnostic[];
  /** The issues the panel does not list. */
  readonly hidden: number;
  /** Whether the search cannot take the query as written: what the field is invalid for. */
  readonly hasErrors: boolean;
}

/** The id of the text of the `index`th issue the list `listId` shows: what the search field names as its description. */
export function issueTextId(listId: string, index: number): string {
  return `${listId}-issue-${String(index)}`;
}

const errorsFirst = (a: QueryDiagnostic, b: QueryDiagnostic): number =>
  Number(b.severity === 'error') - Number(a.severity === 'error');

export function summariseIssues(issues: readonly QueryDiagnostic[]): IssueSummary {
  // `toSorted` is stable: among errors, and among warnings, the order of the text is kept.
  const shown = issues.toSorted(errorsFirst).slice(0, MAX_ISSUES_SHOWN);
  return {
    count: issues.length,
    shown,
    hidden: issues.length - shown.length,
    hasErrors: issues.some(({ severity }) => severity === 'error'),
  };
}
