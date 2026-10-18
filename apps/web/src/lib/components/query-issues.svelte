<script lang="ts">
  import type { QueryDiagnostic } from '@atlas/core';
  import { copy } from '../copy';
  import { issueTextId, type IssueSummary } from '../issue-summary';
  import { keepFieldFocus } from '../keep-field-focus';
  import IssueIcon from './issue-icon.svelte';

  /**
   * What is wrong with the query, under the search field: the severity in an icon and a word, what is wrong, and when one edit
   * mends it, the button that makes it. The field points to the texts (`issueTextId`) as its description. The wrapper is always
   * on the page, so that the badge's `aria-controls` finds it; it is hidden while the list is shut.
   */
  const {
    id,
    summary,
    open,
    onfix,
  }: { id: string; summary: IssueSummary; open: boolean; onfix: (issue: QueryDiagnostic) => void } = $props();
</script>

<div {id} hidden={!open}>
  {#if summary.count > 0}
    <ul aria-label={copy.issuesLabel}>
      {#each summary.shown as issue, index (index)}
        <li class={issue.severity}>
          <span class="text" id={issueTextId(id, index)}>
            <span class="severity"><IssueIcon severity={issue.severity} />{copy.issueSeverity[issue.severity]}</span>
            {issue.message}
          </span>
          {#if issue.fix !== undefined}
            <button
              type="button"
              onclick={() => {
                onfix(issue);
              }}
              {@attach keepFieldFocus}>{issue.fix.label}</button
            >
          {/if}
        </li>
      {/each}
      {#if summary.hidden > 0}
        <li class="more">{copy.moreIssues(summary.hidden)}</li>
      {/if}
    </ul>
  {/if}
</div>

<style>
  ul {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 13px;
  }

  li.error {
    border-color: var(--issue-error-border);
    background: var(--issue-error-surface);
  }

  li.warning {
    border-color: var(--issue-warn-border);
    background: var(--issue-warn-surface);
  }

  li.more {
    color: var(--text-muted);
  }

  .text {
    flex: 1 1 240px;
    min-width: 0;
    color: var(--text);
    overflow-wrap: anywhere;
  }

  .severity {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-right: 6px;
    font-weight: 600;
    white-space: nowrap;
  }

  .error .severity {
    color: var(--status-crit);
  }

  .warning .severity {
    color: var(--status-warn);
  }

  button {
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-3);
    color: var(--text);
    font: inherit;
    font-size: 12.5px;
    cursor: pointer;
  }

  button:hover {
    background: var(--surface-2);
  }

  @media (pointer: coarse) {
    button {
      min-height: var(--target-min);
    }
  }
</style>
