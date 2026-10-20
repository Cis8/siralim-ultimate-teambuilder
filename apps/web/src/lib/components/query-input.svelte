<script lang="ts">
  import {
    isSaved,
    type CountedSuggestion,
    type ExploreState,
    type QueryDiagnostic,
    type SearchService,
  } from '@atlas/core';
  import { onDestroy, onMount } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { afterNextPaint } from '../after-paint';
  import { applyFieldEdit, isBeingEdited } from '../apply-field-edit';
  import { keyPressOf } from '../combobox-state';
  import type { ComboboxOption } from '../combobox-option';
  import { copy } from '../copy';
  import { createIssueAnnouncer } from '../issue-announcer';
  import { issueTextId, summariseIssues } from '../issue-summary';
  import { whenIdle } from '../lazy-load';
  import { caretToLint } from '../lint-caret';
  import { loadQueryAssist, type QueryAssist } from '../query-assist-loader';
  import type { SearchHistorySession } from '../search-history-session';
  import { SEARCH_SHEET_MEDIA, type FieldEvents, type SheetResults } from '../search-sheet';
  import QueryTextInput from './query-text-input.svelte';

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
   *
   * The recent and saved searches (SPEC §8.3) are remembered here, in the first script, whether or not the layer arrives: a search is
   * remembered when Enter is pressed in the field, when the field is left with its text changed, and when it is saved or taken from
   * a list. What the layer adds is the use of them: a blank field offers them as a list to browse, a star keeps the search in the
   * field, and a sheet manages the lists.
   *
   * On a phone (a narrow screen that is touched) a press on the field opens the search sheet (PLAN 11.5), which the layer brings: the
   * same editor in a full-screen dialog, with its own `<input>`. This component stays its owner. The editor works on whichever of
   * the two fields is the one being typed in (`field`), and the sheet is a view of it. A keyboard, a mouse and the `/` shortcut edit
   * in the page at any width, and so does a press before the layer has arrived.
   */
  let {
    value,
    onchange,
    service,
    filters,
    history,
    results,
    onreturn,
    input = $bindable(),
  }: {
    value: string;
    onchange: (value: string) => void;
    /** The dataset the assist reads; none until it is loaded. */
    service: SearchService | undefined;
    /** The filters of the page: a suggestion is counted among the traits they leave (D18). */
    filters: ExploreState;
    /** The searches the person has made and kept. */
    history: SearchHistorySession;
    /** What the search finds for `value` now, for the search sheet; none until the dataset is there. */
    results: SheetResults | undefined;
    /** Told when the search sheet has been shut: the page puts the focus where the person goes on from, which is not this field (a phone would raise its keyboard). */
    onreturn: () => void;
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

  const phone = new MediaQuery(SEARCH_SHEET_MEDIA, false);
  /** The search sheet, the field in it, and the button in it that opens the sheet of searches. */
  let sheet = $state<{ show: () => void }>();
  let sheetInput = $state<HTMLInputElement>();
  let sheetManageButton = $state<HTMLButtonElement>();
  let sheetOpen = $state(false);
  /** Whether a press on the field opens the sheet: on a phone, once the layer that has it is here and there is data to search. */
  const sheetWanted = $derived(sheet !== undefined && service !== undefined && phone.current);
  /** The field being typed in: the one in the sheet while it is open, the one in the page otherwise. */
  const field = $derived(sheetOpen ? sheetInput : input);

  const analysis = $derived(
    assist === undefined || service === undefined ? undefined : assist.analyse(service, filters, value, caret),
  );
  /** The suggestions of `analysis` with every one counted: they follow the list, once it is drawn. */
  let counted = $state.raw<{ of: readonly CountedSuggestion[]; suggestions: readonly CountedSuggestion[] }>();
  const suggestions = $derived(
    counted !== undefined && counted.of === analysis?.suggestions ? counted.suggestions : (analysis?.suggestions ?? []),
  );
  const blank = $derived(value.trim() === '');
  /** What a blank field offers, if the person has any: its own searches (SPEC §8.3), a list to browse and no completion of the text. */
  const historyRows = $derived(assist?.historyRows(history.history) ?? []);
  const browsable = $derived(historyRows.length > 0);
  const browsing = $derived(assist !== undefined && browsable && blank);
  const options = $derived(
    assist === undefined ? [] : browsing ? assist.historyOptions(historyRows) : assist.optionsOf(suggestions),
  );
  /** The option that Tab would take (the list tells), whose rest the mirror shows in grey after the text. */
  let active = $state<number>();
  const ghost = $derived(
    assist === undefined || browsing || caret === undefined || active === undefined
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
  // The prerendered page has no storage to read: the history is read once the page runs.
  onMount(() => {
    history.load();
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
    caret = field === undefined ? undefined : caretToLint(field);
  }

  /** Focus leaving the field for something outside it (the badge and the lists belong to it) takes the caret away. */
  function leave(event: FocusEvent): void {
    if (!(event.relatedTarget instanceof Node && container?.contains(event.relatedTarget))) caret = undefined;
  }

  function fix(issue: QueryDiagnostic): void {
    if (issue.fix === undefined || field === undefined) return;
    announcer.fixed();
    applyFieldEdit(field, issue.fix.edit);
    readCaret();
  }

  /**
   * An option taken. A suggestion's text goes in the place of the word being typed, and the caret after it. A search of the history
   * is the whole of the text, which it takes the place of; it is remembered again, as the newest.
   */
  function accept(_option: ComboboxOption, index: number): void {
    if (assist === undefined || field === undefined) return;
    if (browsing) {
      const row = historyRows[index];
      if (row === undefined) return;
      applyFieldEdit(field, { span: [0, value.length], text: row.query });
      history.record(row.query);
    } else {
      const suggestion = suggestions[index];
      if (suggestion === undefined) return;
      applyFieldEdit(field, assist.acceptSuggestion(value, suggestion));
    }
    readCaret();
  }

  // A search is remembered when it is sent (Enter) and when the field is left with its text changed since it was entered.
  let valueOnFocus = '';
  function focused(): void {
    valueOnFocus = value;
    readCaret();
  }
  function blurred(): void {
    if (value === valueOnFocus) return;
    history.record(value);
    valueOnFocus = value;
  }
  /** The Enter that ends an IME composition is the IME's, and an Enter the list took (it accepted a suggestion) sent nothing. */
  function sent(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.defaultPrevented && !keyPressOf(event).isComposing) history.record(value);
  }

  /** The press that opens the sheet takes no focus: the page behind would raise its keyboard, and the field of the sheet has to. */
  function hold(event: MouseEvent): void {
    if (sheetWanted) event.preventDefault();
  }
  function pressed(): void {
    if (sheetWanted) sheet?.show();
    else readCaret();
  }
  function sheetOpened(): void {
    sheetOpen = true;
  }
  /** The sheet is shut, by whatever means: the search is remembered (the field of the sheet does not always say it was left). */
  function sheetClosed(): void {
    sheetOpen = false;
    caret = undefined;
    blurred();
    onreturn();
  }

  /** What the field raises that the editor hears, in the sheet as in the page; the page's field adds what opens the sheet. */
  const fieldEvents: FieldEvents = {
    oninput: (event) => {
      // An edit made for the person (a fix, a suggestion) raises this event too, and is not their typing. Typing in the sheet opens
      // no list in the page behind it.
      typed = !sheetOpen && !isBeingEdited(event.currentTarget);
      readCaret();
      onchange(event.currentTarget.value);
    },
    onfocus: focused,
    onblur: blurred,
    onkeydown: sent,
    onkeyup: readCaret,
    onselect: readCaret,
    onclick: readCaret,
  };
  const pageEvents: FieldEvents = { ...fieldEvents, onclick: pressed, onmousedown: hold };

  const saved = $derived(isSaved(history.history, value));
  /** Why the star did nothing, for the text it was pressed on: it goes when the text changes. */
  let refusal = $state.raw<{ readonly text: string; readonly message: string; readonly full: boolean }>();
  const shownRefusal = $derived(refusal?.text === value ? refusal : undefined);

  function toggleSaved(): void {
    const wasSaved = saved;
    const result = history.toggleSaved(value);
    if (result.ok) {
      refusal = undefined;
      announced = wasSaved ? copy.searchUnsaved : copy.searchSaved;
    } else {
      const message = copy.saveRefusals[result.reason];
      refusal = { text: value, message, full: result.reason === 'full' };
      announced = message;
    }
  }

  let managing = $state(false);
  let manageButton = $state<HTMLButtonElement>();
  function manage(): void {
    refusal = undefined;
    want();
    managing = true;
  }
  /** The sheet is shut, however: the focus goes back to the button that opened it. */
  function managed(): void {
    managing = false;
    (sheetOpen ? sheetManageButton : manageButton)?.focus();
  }
  /** A search taken from the sheet goes in the field and is remembered as the newest; the sheet shuts itself, and says so. */
  function useSearch(query: string): void {
    onchange(query);
    history.record(query);
    managing = false;
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
      <QueryTextInput
        id="query"
        {value}
        mirrored={assist !== undefined}
        invalid={summary.hasErrors}
        {describedBy}
        events={pageEvents}
        bind:input
      >
        {#snippet mirror()}
          {#if assist !== undefined}
            <assist.QueryMirror {input} {value} issues={analysis?.issues ?? NO_ISSUES} {ghost} />
          {/if}
        {/snippet}
      </QueryTextInput>
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
      <assist.HistoryButtons canSave={!blank} {saved} onsave={toggleSaved} onmanage={manage} bind:manageButton />
      <assist.Combobox
        {input}
        {options}
        {browsable}
        id={SUGGESTIONS_ID}
        label={browsing ? copy.historyLabel : copy.suggestionsLabel}
        suspended={sheetOpen}
        onaccept={accept}
        onactive={sheetOpen
          ? undefined
          : (index: number | undefined) => {
              active = index;
            }}
      />
    {/if}
  </div>
  {#if assist !== undefined}
    <assist.QueryIssues id={ISSUES_ID} {summary} {open} onfix={fix} />
    {#if shownRefusal !== undefined}
      <!-- Said aloud with the polite line below (`announced`), so that it is not a live region of its own. -->
      <assist.SaveRefusal refusal={shownRefusal} onmanage={manage} />
    {/if}
    <assist.SearchesSheet open={managing} {history} onuse={useSearch} onclose={managed} />
    <assist.SearchSheet
      bind:this={sheet}
      {value}
      issues={analysis?.issues ?? NO_ISSUES}
      {summary}
      {ghost}
      {options}
      {browsable}
      {browsing}
      listLabel={browsing ? copy.historyLabel : copy.suggestionsLabel}
      {results}
      canSave={!blank}
      {saved}
      refusal={shownRefusal}
      status={announced}
      events={fieldEvents}
      onaccept={accept}
      onactive={(index: number | undefined) => {
        active = index;
      }}
      onfix={fix}
      onsave={toggleSaved}
      onmanage={manage}
      onopen={sheetOpened}
      onclose={sheetClosed}
      bind:input={sheetInput}
      bind:manageButton={sheetManageButton}
    />
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
</style>
