<script lang="ts">
  import { insertAtCaret, type QueryDiagnostic, type SyntaxInsertionId } from '@atlas/core';
  import { flushSync } from 'svelte';
  import { applyFieldEdit } from '../apply-field-edit';
  import { keyPressOf } from '../combobox-state';
  import type { ComboboxOption } from '../combobox-option';
  import { copy } from '../copy';
  import { issueTextId, type IssueSummary } from '../issue-summary';
  import { keepFieldFocus } from '../keep-field-focus';
  import type { FieldEvents, SaveRefusalLine, SheetResults } from '../search-sheet';
  import { fitToVisualViewport } from '../visual-viewport-fit';
  import Combobox from './combobox.svelte';
  import HistoryButtons from './history-buttons.svelte';
  import IssueBanner from './issue-banner.svelte';
  import QueryMirror from './query-mirror.svelte';
  import QueryTextInput from './query-text-input.svelte';
  import SaveRefusal from './save-refusal.svelte';
  import SyntaxToolbar from './syntax-toolbar.svelte';

  /** The id of the list of suggestions of the sheet: its field controls it. The page's own field has another. */
  const LIST_ID = 'search-sheet-suggestions';
  /** The id of the field, and of the text of the issue that describes it. */
  const FIELD_ID = 'search-sheet-query';
  const ISSUE_LIST_ID = 'search-sheet-issues';
  /** How long the count of traits must stay the same before a screen reader is told: typing changes it with every key. */
  const ANNOUNCE_COUNT_AFTER_MS = 400;

  /**
   * The search sheet of a phone (DESIGN § Search sheet, PLAN 11.5): a press on the search field opens a full-screen dialog with the
   * same editor in it, in the room a phone's keyboard leaves. From the top: the way back and the field, the first thing that is
   * wrong with the query, how the search reads, the suggestions (or the searches to browse) and, docked above the keyboard, the
   * button that shows the traits and the toolbar that writes the pieces of the language the keyboard hides.
   *
   * It is a view of the editor that `QueryInput` owns: the text, the issues, the suggestions and the history are the page's, and
   * the field in the sheet raises the same events (`events`). It is shown with `show()`, from the press itself: a phone raises its
   * keyboard only for a focus given while a press is being handled. It tells the page that it is open and that it is shut, by
   * whatever means (Back, the button, Escape, the system's back).
   */
  let {
    value,
    issues,
    summary,
    ghost,
    options,
    browsable,
    browsing,
    listLabel,
    results,
    canSave,
    saved,
    refusal,
    status,
    events,
    onaccept,
    onactive,
    onfix,
    onsave,
    onmanage,
    onopen,
    onclose,
    input = $bindable(),
    manageButton = $bindable(),
  }: {
    value: string;
    issues: readonly QueryDiagnostic[];
    summary: IssueSummary;
    /** The rest of the suggestion that Tab takes, for the mirror. */
    ghost: string;
    options: readonly ComboboxOption[];
    browsable: boolean;
    /** Whether the options are the searches of a blank field and not suggestions. */
    browsing: boolean;
    listLabel: string;
    /** What the search finds now; none until the dataset is there. */
    results: SheetResults | undefined;
    canSave: boolean;
    saved: boolean;
    refusal: SaveRefusalLine | undefined;
    /** The page's polite line (the issues, the star): the page behind the sheet is inert, so its live regions are not heard. */
    status: string;
    events: FieldEvents;
    onaccept: (option: ComboboxOption, index: number) => void;
    onactive: (index: number | undefined) => void;
    onfix: (issue: QueryDiagnostic) => void;
    onsave: () => void;
    onmanage: () => void;
    onopen: () => void;
    onclose: () => void;
    /** The field of the sheet, for whoever edits the text in it. */
    input?: HTMLInputElement | undefined;
    /** The button that opens the sheet of searches, for whoever gives the focus back to it. */
    manageButton?: HTMLButtonElement | undefined;
  } = $props();

  let dialog = $state<HTMLDialogElement>();
  /** Whether the sheet is open. Its content is there only then: a phone that never opens it pays for nothing. */
  let opened = $state(false);

  /**
   * Shows the sheet, with the focus in its field. The content is drawn first, in the task of the press, so that the field exists
   * to take the focus while the press is still being handled (an iPhone raises its keyboard for no other focus).
   */
  export function show(): void {
    if (dialog === undefined || opened) return;
    opened = true;
    flushSync();
    // The page knows the sheet is open before the field takes the focus: the editor then works on the field of the sheet.
    onopen();
    dialog.showModal();
    input?.focus({ preventScroll: true });
  }

  function closed(): void {
    opened = false;
    onclose();
  }

  // As tall as what the keyboard leaves of the window, so that the foot of the sheet is in sight.
  $effect(() => {
    if (!opened || dialog === undefined) return;
    return fitToVisualViewport(dialog);
  });

  // Enter sends the search when it took nothing from the list (the combobox has handled it, `defaultPrevented`, when it did): the sheet
  // shuts as the button "Show N traits" would. The page sees the key first, and remembers the search.
  function sendOnEnter(event: KeyboardEvent & { currentTarget: EventTarget & HTMLInputElement }): void {
    events.onkeydown?.(event);
    if (event.key === 'Enter' && !event.defaultPrevented && !keyPressOf(event).isComposing) dialog?.close();
  }
  const sheetEvents: FieldEvents = $derived({ ...events, onkeydown: sendOnEnter });

  function insert(id: SyntaxInsertionId): void {
    if (input === undefined) return;
    const end = input.value.length;
    const { edit, caret } = insertAtCaret(input.value, [input.selectionStart ?? end, input.selectionEnd ?? end], id);
    applyFieldEdit(input, edit, caret);
  }

  function clear(): void {
    if (input !== undefined) applyFieldEdit(input, { span: [0, input.value.length], text: '' });
  }

  const sentence = $derived(results === undefined ? '' : copy.resultCount(results.found, results.total));
  let counted = $state('');
  $effect(() => {
    const next = sentence;
    const timer = setTimeout(() => {
      counted = next;
    }, ANNOUNCE_COUNT_AFTER_MS);
    return () => {
      clearTimeout(timer);
    };
  });
</script>

<dialog bind:this={dialog} aria-label={copy.searchSheetLabel} onclose={closed}>
  {#if opened}
    <div class="head">
      <button type="button" class="back" aria-label={copy.searchSheetBack} onclick={() => dialog?.close()}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
          <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" />
        </svg>
      </button>
      <div class="frame" class:invalid={summary.hasErrors}>
        <label class="visually-hidden" for={FIELD_ID}>{copy.searchLabel}</label>
        <QueryTextInput
          id={FIELD_ID}
          {value}
          mirrored
          invalid={summary.hasErrors}
          describedBy={summary.shown.length === 0 ? undefined : issueTextId(ISSUE_LIST_ID, 0)}
          events={sheetEvents}
          bind:input
        >
          {#snippet mirror()}
            <QueryMirror {input} {value} {issues} {ghost} />
          {/snippet}
        </QueryTextInput>
        {#if value !== ''}
          <button type="button" class="clear" aria-label={copy.clearSearch} onclick={clear} {@attach keepFieldFocus}>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" />
            </svg>
          </button>
        {/if}
      </div>
    </div>

    <IssueBanner {summary} textId={issueTextId(ISSUE_LIST_ID, 0)} {onfix} />
    {#if refusal !== undefined}
      <div class="refusal"><SaveRefusal {refusal} {onmanage} /></div>
    {/if}
    {#if results !== undefined}
      <p class="reads"><span class="label">{copy.readsAsLabel}</span> {results.reading}</p>
    {/if}

    <div class="scroll">
      <div class="heading">
        <h2>{browsing ? copy.historyLabel : copy.suggestionsLabel}</h2>
        <div class="tools"><HistoryButtons {canSave} {saved} {onsave} {onmanage} bind:manageButton /></div>
      </div>
      <Combobox {input} {options} {browsable} id={LIST_ID} label={listLabel} flow {onaccept} {onactive} />
    </div>

    <div class="foot">
      <button type="button" class="show" onclick={() => dialog?.close()}>
        {results === undefined ? copy.closeSheet : copy.showTraits(results.found)}
      </button>
      <SyntaxToolbar onpress={insert} />
    </div>

    <p class="visually-hidden" aria-live="polite">{status}</p>
    <p class="visually-hidden" aria-live="polite">{counted}</p>
  {/if}
</dialog>

<style>
  /*
   * A modal dialog is centred and as wide as its content: here it is the whole window, or the part of it that the keyboard leaves
   * (`--sheet-top` and `--sheet-height` follow the visual viewport). The page behind does not scroll: the global rule of
   * bottom-sheet.svelte covers every open dialog.
   */
  dialog {
    position: fixed;
    inset: var(--sheet-top, 0px) auto auto 0;
    width: 100%;
    max-width: none;
    height: var(--sheet-height, 100dvh);
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: var(--surface-1);
    color: var(--text);
    overflow: hidden;
  }

  dialog[open] {
    display: flex;
    flex-direction: column;
  }

  .head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 8px 10px 4px;
    border-bottom: 1px solid var(--border);
  }

  .back,
  .clear {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--target-min);
    height: var(--target-min);
    padding: 0;
    border: 0;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }

  .back:focus-visible,
  .clear:focus-visible {
    outline: var(--focus-ring);
    outline-offset: -6px;
    border-radius: 8px;
  }

  /* The frame of the field: as high as the one in the page, with the ring around the whole of it while the field has the focus. */
  .frame {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0;
    height: 46px;
    padding-left: 10px;
    border: 1px solid var(--accent-border);
    border-radius: 9px;
    background: var(--surface-2);
  }

  .frame.invalid {
    border-color: var(--issue-error-border);
  }

  .frame:focus-within {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  .refusal {
    flex: none;
    margin: 10px 12px 0;
  }

  .reads {
    flex: none;
    margin: 0;
    padding: 10px 16px 4px;
    color: var(--text);
    font-size: 12.5px;
    overflow-wrap: anywhere;
  }

  .label {
    margin-right: 6px;
    color: var(--text-faint);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* The list takes what the rest leaves and scrolls inside it; the buttons of the heading are what makes it a keyboard stop for axe. */
  .scroll {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  /* As tall as a finger: the buttons at its right end are as tall as the row (they are made to fill the frame of a field). */
  .heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--target-min);
    padding: 0 8px 0 16px;
  }

  /* As tall as the row, so that the two buttons, which fill their parent, are as tall as a finger. */
  .tools {
    display: flex;
    align-self: stretch;
  }

  h2 {
    margin: 0;
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .foot {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    background: var(--bg-bar);
  }

  .show {
    min-height: 46px;
    border: 0;
    border-radius: 10px;
    background: var(--accent);
    color: var(--bg-bar);
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }

  .show:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
</style>
