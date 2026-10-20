<script lang="ts">
  import type { QueryDiagnostic } from '@atlas/core';
  import { copy } from '../copy';
  import { keepFieldFocus } from '../keep-field-focus';
  import type { IssueSummary } from '../issue-summary';
  import IssueIcon from './issue-icon.svelte';

  /**
   * The first thing that is wrong with the query, as a line under the search field of the sheet (the list of the page has room for
   * five; a phone's keyboard leaves room for one): the severity in an icon and a word, what is wrong, the button that mends it when
   * one edit does, and how many more there are. Errors come first (`summariseIssues`). The field is described by the text (`textId`).
   */
  const { summary, textId, onfix }: { summary: IssueSummary; textId: string; onfix: (issue: QueryDiagnostic) => void } =
    $props();

  const issue = $derived(summary.shown[0]);
  const more = $derived(summary.count - 1);
</script>

{#if issue !== undefined}
  <div class="banner {issue.severity}">
    <span class="text" id={textId}>
      <span class="severity"><IssueIcon severity={issue.severity} />{copy.issueSeverity[issue.severity]}</span>
      {issue.message}
      {#if more > 0}<span class="more">{copy.moreIssuesInBanner(more)}</span>{/if}
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
  </div>
{/if}

<style>
  .banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    margin: 10px 12px 0;
    padding: 8px 8px 8px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 13px;
  }

  .error {
    border-color: var(--issue-error-border);
    background: var(--issue-error-surface);
  }

  .warning {
    border-color: var(--issue-warn-border);
    background: var(--issue-warn-surface);
  }

  .text {
    flex: 1 1 200px;
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

  .more {
    margin-left: 6px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  button {
    min-height: var(--target-min);
    padding: 0 12px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface-3);
    color: var(--text);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }

  button:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
</style>
