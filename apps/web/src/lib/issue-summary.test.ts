import type { DiagnosticSeverity, QueryDiagnostic } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { issueTextId, MAX_ISSUES_SHOWN, summariseIssues } from './issue-summary';

const issue = (severity: DiagnosticSeverity, at: number): QueryDiagnostic => ({
  code: 'a-rule',
  severity,
  span: [at, at + 1],
  message: `${severity} at ${String(at)}`,
});

describe('issueTextId', () => {
  it('names the text of each issue of a list apart from the others', () => {
    expect(issueTextId('query-issues', 0)).toBe('query-issues-issue-0');
    expect(issueTextId('query-issues', 3)).not.toBe(issueTextId('query-issues', 0));
  });
});

describe('summariseIssues', () => {
  it('has nothing to show for a query without issues', () => {
    expect(summariseIssues([])).toEqual({ count: 0, shown: [], hidden: 0, hasErrors: false });
  });

  it('counts every issue and says whether one of them is an error', () => {
    expect(summariseIssues([issue('warning', 0)]).hasErrors).toBe(false);
    expect(summariseIssues([issue('warning', 0), issue('error', 3)])).toMatchObject({ count: 2, hasErrors: true });
  });

  it('puts the errors before the warnings and keeps the order of the text among each', () => {
    const issues = [issue('warning', 0), issue('error', 4), issue('warning', 6), issue('error', 9)];

    expect(summariseIssues(issues).shown.map(({ message }) => message)).toEqual([
      'error at 4',
      'error at 9',
      'warning at 0',
      'warning at 6',
    ]);
  });

  it('shows no more than the panel has room for, and counts the rest', () => {
    const issues = Array.from({ length: MAX_ISSUES_SHOWN + 3 }, (_, at) => issue('error', at));

    const summary = summariseIssues(issues);

    expect(summary.shown).toEqual(issues.slice(0, MAX_ISSUES_SHOWN));
    expect(summary.hidden).toBe(3);
    expect(summary.count).toBe(MAX_ISSUES_SHOWN + 3);
  });

  it('shows the errors a long list of warnings would otherwise push out', () => {
    const warnings = Array.from({ length: MAX_ISSUES_SHOWN }, (_, at) => issue('warning', at));

    const summary = summariseIssues([...warnings, issue('error', 99)]);

    expect(summary.shown[0]).toMatchObject({ severity: 'error' });
    expect(summary.hidden).toBe(1);
  });
});
