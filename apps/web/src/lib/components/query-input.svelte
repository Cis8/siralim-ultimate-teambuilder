<script lang="ts">
  import type { CountedSuggestion, ExploreState, QueryDiagnostic, SearchService } from '@atlas/core';
  import { onDestroy } from 'svelte';
  import { afterNextPaint } from '../after-paint';
  import { applyFieldEdit, isBeingEdited } from '../apply-field-edit';
  import type { ComboboxOption } from '../combobox-option';
  import { copy } from '../copy';
  import { createIssueAnnouncer } from '../issue-announcer';
  import { issueTextId, summariseIssues } from '../issue-summary';
  import { whenIdle } from '../lazy-load';
  import { caretToLint } from '../lint-caret';
  import { loadQueryAssist, type QueryAssist } from '../query-assist-loader';

  /** The id of the list of issues: the badge controls it and the field is described by its texts. */
  const ISSUES_ID = 'query-issues';
  /** The id of the list of suggestions: the field controls it while it is a combobox. */
  const SUGGESTIONS_ID = 'query-suggestions';
  /** How long after the data arrives the assist layer is fetched, if nobody has used the field by then. */
  const FETCH_AFTER_DATA_MS = 500;
  /** What the mirror is given while the dataset, and so every issue, is not there yet. */
  const NO_ISSUES: readonly QueryDiagnostic[] = [];

  /**
   * The query bar: a text field the owner of the state reads and writes, one keystroke at a time. It is a plain `<input>` until the
   * page is idle, or the focus or a pointer arrives, and then the assist layer (ADR-0010) is fetched and attaches to the same
   * element: what is wrong with the query (QUERY_LANGUAGE §5), given the caret so that the term being typed is left alone, and
   * what may be typed at the caret (§6), counted within `filters`. Nothing is swapped, so the focus is not lost and nothing moves.
   * The issues are a badge inside the field and a list under it, the suggestions a list over the page; both are edits of the text
   * made in the field as a person's typing is. Neither is there until the layer and the data are. The layer also brings the mirror
   * (§8): a coloured copy of the text under the field, which turns transparent to let it show.
   */
  let {
    value,
    onchange,
    service,
    filters,
    input = $bindable(),
  }: {
    value: string;
    onchange: (value: string) => void;
    /** The dataset the assist reads; none until it is loaded. */
    service: SearchService | undefined;
    /** The filters of the page: a suggestion is counted among the traits they leave (D18). */
    filters: ExploreState;
    /** The `<input>`, for whoever needs to focus it or attach to it (the `/` shortcut, the assist layer). */
    input?: HTMLInputElement | undefined;
  } = $props();

  let container = $state<HTMLElement>();
  /** The assist layer, once fetched. */
  let assist = $state.raw<QueryAssist>();
  /** Where the caret is while the person is in the field or in what belongs to it, and none otherwise: every term is then judged as it stands. */
  let caret = $state<number>();
  let open = $state(false);
  let announced = $state('');

  const analysis = $derived(
    assist === undefined || service === undefined ? undefined : assist.analyse(service, filters, value, caret),
  );
  /** The suggestions of `analysis` with every one counted: they follow the list, once it is drawn. */
  let counted = $state.raw<{ of: readonly CountedSuggestion[]; suggestions: readonly CountedSuggestion[] }>();
  const suggestions = $derived(
    counted !== undefined && counted.of === analysis?.suggestions ? counted.suggestions : (analysis?.suggestions ?? []),
  );
  const options = $derived(assist?.optionsOf(suggestions) ?? []);
  /** The option that Tab would take (the list tells), whose rest the mirror shows in grey after the text. */
  let active = $state<number>();
  const ghost = $derived(
    assist === undefined || caret === undefined || active === undefined
      ? ''
      : assist.ghostText(value, caret, suggestions[active]),
  );
  const summary = $derived(summariseIssues(analysis?.issues ?? []));
  const describedBy = $derived(
    summary.shown.length === 0 ? undefined : summary.shown.map((_, at) => issueTextId(ISSUES_ID, at)).join(' '),
  );

  const announcer = createIssueAnnouncer((message) => {
    announced = message;
  });
  onDestroy(() => {
    announcer.stop();
  });

  /** Fetches the assist layer, once; a load that fails leaves the plain field, and the next focus or pointer tries again. */
  let wanted = false;
  function want(): void {
    if (wanted) return;
    wanted = true;
    loadQueryAssist().then(
      (loaded) => {
        assist = loaded;
      },
      () => {
        wanted = false;
      },
    );
  }
  // The layer has nothing to work on until the dataset is there, and fetched while the first results are being drawn it would
  // count in the largest contentful paint of a slow connection (Lighthouse): it is fetched at the first idle moment half a second
  // after the data arrives. A focus or a pointer does not wait.
  $effect(() => {
    if (service === undefined) return;
    return whenIdle(want, FETCH_AFTER_DATA_MS);
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

  // Each count is a search and nine of them hold a keystroke up: the list is drawn with its first suggestion counted, and the
  // rest follow a few at a time, each step in a task of its own after a paint. A key typed before then calls them off: they
  // would be for a list that is gone.
  $effect(() => {
    const layer = assist;
    const dataset = service;
    const current = analysis;
    if (layer === undefined || dataset === undefined || current === undefined) return;
    const text = value;
    const within = filters;
    let counting = current.suggestions;
    let cancel: () => void = () => undefined;
    const step = (): void => {
      counting = layer.countNext(dataset, within, text, counting);
      counted = { of: current.suggestions, suggestions: counting };
      if (layer.hasUncounted(counting)) cancel = afterNextPaint(step);
    };
    if (layer.hasUncounted(counting)) cancel = afterNextPaint(step);
    return () => {
      cancel();
    };
  });

  function readCaret(): void {
    caret = input === undefined ? undefined : caretToLint(input);
  }

  /** Focus leaving the field for something outside it (the badge and the lists belong to it) takes the caret away. */
  function leave(event: FocusEvent): void {
    if (!(event.relatedTarget instanceof Node && container?.contains(event.relatedTarget))) caret = undefined;
  }

  function fix(issue: QueryDiagnostic): void {
    if (issue.fix === undefined || input === undefined) return;
    announcer.fixed();
    applyFieldEdit(input, issue.fix.edit);
    readCaret();
  }

  /** A suggestion taken: its text goes in the place of the word being typed, and the caret after it. */
  function accept(_option: ComboboxOption, index: number): void {
    const suggestion = suggestions[index];
    if (suggestion === undefined || assist === undefined || input === undefined) return;
    applyFieldEdit(input, assist.acceptSuggestion(value, suggestion));
    readCaret();
  }
</script>

<!-- A pointer arriving only fetches the layer early; it asks for nothing the keyboard does not have: the focus fetches it too. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="query" bind:this={container} onfocusin={want} onfocusout={leave} onpointerenter={want}>
  <div class="field">
    <label for="query">
      <span class="visually-hidden">{copy.searchLabel}</span>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
      <span class="editor">
        {#if assist !== undefined}
          <assist.QueryMirror {input} {value} issues={analysis?.issues ?? NO_ISSUES} {ghost} />
        {/if}
        <input
          id="query"
          class="query-text"
          class:mirrored={assist !== undefined}
          type="text"
          bind:this={input}
          {value}
          oninput={(event) => {
            // An edit made for the person (a fix, a suggestion) raises this event too, and is not their typing.
            typed = !isBeingEdited(event.currentTarget);
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
      </span>
    </label>
    {#if assist !== undefined}
      {#if summary.count > 0}
        <assist.IssueBadge
          count={summary.count}
          hasErrors={summary.hasErrors}
          {open}
          controls={ISSUES_ID}
          onpress={() => {
            open = !open;
          }}
        />
      {/if}
      <assist.Combobox
        {input}
        {options}
        id={SUGGESTIONS_ID}
        label={copy.suggestionsLabel}
        onaccept={accept}
        onactive={(index: number | undefined) => {
          active = index;
        }}
      />
    {/if}
  </div>
  {#if assist !== undefined}
    <assist.QueryIssues id={ISSUES_ID} {summary} {open} onfix={fix} />
  {/if}
  <p class="visually-hidden" aria-live="polite">{announced}</p>
</div>

<style>
  /*
   * The list of suggestions is drawn against this box, under the list of issues when that is open (not over it, which would put
   * the buttons that mend them out of reach of a pointer): the issues are a panel in the flow of the page, the suggestions a popup.
   */
  .query {
    position: relative;
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

  /* The input and the mirror under it fill this box together (the font, `.query-text`, is the same for both). */
  .editor {
    position: relative;
    display: flex;
    flex: 1;
    align-self: stretch;
    min-width: 0;
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-strong);
  }

  /* The field draws the focus ring around the whole bar, icon included. */
  input:focus-visible {
    outline: none;
  }

  input::placeholder {
    color: var(--text-faint);
    opacity: 1;
  }

  /*
   * With the mirror under it the field keeps the caret, the selection and the typing, and gives the colours up: its own text is
   * transparent. The selection is a share of the accent, so that the coloured text still shows through it.
   */
  input.mirrored {
    color: transparent;
    caret-color: var(--text-strong);
  }

  input.mirrored::selection {
    background: var(--field-selection);
    color: transparent;
  }

  /* A high-contrast mode forces its colours and the mirror is not drawn (query-mirror.svelte): the field shows its text itself. */
  @media (forced-colors: active) {
    input.mirrored {
      color: FieldText;
      caret-color: auto;
    }

    input.mirrored::selection {
      background: Highlight;
      color: HighlightText;
    }
  }
</style>
