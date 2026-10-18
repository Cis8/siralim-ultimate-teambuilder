<script lang="ts">
  import type { QueryDiagnostic } from '@atlas/core';
  import { onDestroy } from 'svelte';
  import { applyFieldEdit } from '../apply-field-edit';
  import { copy } from '../copy';
  import { createIssueAnnouncer } from '../issue-announcer';
  import { issueTextId, summariseIssues } from '../issue-summary';
  import { caretToLint } from '../lint-caret';
  import IssueBadge from './issue-badge.svelte';
  import QueryIssues from './query-issues.svelte';

  /** The id of the list of issues: the badge controls it and the field is described by its texts. */
  const ISSUES_ID = 'query-issues';

  /**
   * The query bar: a text field the owner of the state reads and writes, one keystroke at a time. `lint` says what is wrong
   * with a text (PLAN 9.6, QUERY_LANGUAGE §5), given the caret so that the term being typed is left alone; it is not there until
   * the data is. The issues are a badge inside the field and a list under it; a fix is one edit of the text, made in the field as a
   * person's typing is.
   */
  let {
    value,
    onchange,
    lint,
    input = $bindable(),
  }: {
    value: string;
    onchange: (value: string) => void;
    lint: ((source: string, caret: number | undefined) => readonly QueryDiagnostic[]) | undefined;
    /** The `<input>`, for whoever needs to focus it or attach to it (the `/` shortcut, the suggestions of the next slice). */
    input?: HTMLInputElement | undefined;
  } = $props();

  let container = $state<HTMLElement>();
  /** Where the caret is while the person is in the field or in what belongs to it, and none otherwise: every term is then judged as it stands. */
  let caret = $state<number>();
  let open = $state(false);
  let announced = $state('');

  const summary = $derived(summariseIssues(lint?.(value, caret) ?? []));
  const describedBy = $derived(
    summary.shown.length === 0 ? undefined : summary.shown.map((_, at) => issueTextId(ISSUES_ID, at)).join(' '),
  );

  const announcer = createIssueAnnouncer((message) => {
    announced = message;
  });
  onDestroy(() => {
    announcer.stop();
  });

  /**
   * The list opens by itself when the person types a query that has issues, and shuts when it has none. A query that arrives
   * with the address, or issues that appear for another reason, leave it shut: the badge says there are some, and a list that
   * opened would move the page under the person.
   */
  let hadIssues = false;
  let typed = false;
  $effect.pre(() => {
    if (summary.count === 0) open = false;
    else if (typed && !hadIssues) open = true;
    hadIssues = summary.count > 0;
    typed = false;
  });

  $effect(() => {
    announcer.counted(summary.count);
  });

  function readCaret(): void {
    caret = input === undefined ? undefined : caretToLint(input);
  }

  /** Focus leaving the field for something outside it (the badge and the list belong to it) takes the caret away. */
  function leave(event: FocusEvent): void {
    if (!(event.relatedTarget instanceof Node && container?.contains(event.relatedTarget))) caret = undefined;
  }

  function fix(issue: QueryDiagnostic): void {
    if (issue.fix === undefined || input === undefined) return;
    announcer.fixed();
    applyFieldEdit(input, issue.fix.edit);
    readCaret();
  }
</script>

<div class="query" bind:this={container} onfocusout={leave}>
  <div class="field">
    <label for="query">
      <span class="visually-hidden">{copy.searchLabel}</span>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
      <input
        id="query"
        type="text"
        bind:this={input}
        {value}
        oninput={(event) => {
          typed = true;
          readCaret();
          onchange(event.currentTarget.value);
        }}
        onfocus={readCaret}
        onclick={readCaret}
        onkeyup={readCaret}
        onselect={readCaret}
        aria-invalid={summary.hasErrors ? 'true' : undefined}
        aria-describedby={describedBy}
        placeholder={copy.searchPlaceholder}
        inputmode="search"
        enterkeyhint="search"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
      />
    </label>
    {#if summary.count > 0}
      <IssueBadge
        count={summary.count}
        hasErrors={summary.hasErrors}
        {open}
        controls={ISSUES_ID}
        onpress={() => {
          open = !open;
        }}
      />
    {/if}
  </div>
  <QueryIssues id={ISSUES_ID} {summary} {open} onfix={fix} />
  <p class="visually-hidden" aria-live="polite">{announced}</p>
</div>

<style>
  .query {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field {
    display: flex;
    align-items: center;
    height: var(--target-min);
    border: 1px solid var(--accent-border);
    border-radius: 8px;
    background: var(--surface-1);
    color: var(--text-faint);
  }

  .field:focus-within {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  /* The label is the whole of the frame bar the badge, over its border: a press anywhere in it, and a finger, find the field. */
  label {
    display: flex;
    flex: 1;
    align-items: center;
    align-self: stretch;
    gap: 10px;
    min-width: 0;
    margin-block: -1px;
    padding: 0 12px;
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-strong);
    font: inherit;
    font-family: var(--font-mono);
  }

  /* The field draws the focus ring around the whole bar, icon included. */
  input:focus-visible {
    outline: none;
  }

  input::placeholder {
    color: var(--text-faint);
    opacity: 1;
  }

  /* iOS zooms the page in when a field of less than 16 px takes the focus, and leaves it zoomed. */
  @media (pointer: coarse) {
    input {
      font-size: 16px;
    }
  }
</style>
