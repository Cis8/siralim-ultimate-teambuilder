import { applyEdit, caretAfterEdit, type TextEdit } from '@atlas/core';

/** What `applyFieldEdit` uses of a text field: an `HTMLInputElement` has all of it. */
export interface EditableField {
  value: string;
  readonly selectionStart: number | null;
  readonly ownerDocument: { execCommand?: (command: string, showUI?: boolean, value?: string) => boolean };
  focus(options?: FocusOptions): void;
  setSelectionRange(start: number, end: number): void;
  setRangeText(replacement: string, start: number, end: number, selectionMode: 'end'): void;
  dispatchEvent(event: Event): boolean;
}

/** Replaces the selection as typing does, through the browser's editing command; whether it did. */
function replaceSelection({ ownerDocument: document }: EditableField, text: string): boolean {
  try {
    // An empty text inserts nothing: deleting the selection is what removes it.
    return (
      (text === '' ? document.execCommand?.('delete') : document.execCommand?.('insertText', false, text)) ?? false
    );
  } catch {
    return false; // Not allowed here (a sandbox, say).
  }
}

/** The fields an `applyFieldEdit` is changing at this moment. */
const editing = new WeakSet<object>();

/**
 * Whether `field` is being changed by `applyFieldEdit` right now, so that the `input` event the page hears is an edit made for
 * the person (a fix, an accepted suggestion) and not their typing: typing opens the list of suggestions, an edit does not. The
 * events are raised inside the call, by the browser's command or by the function itself, so this is true for exactly those.
 */
export function isBeingEdited(field: object): boolean {
  return editing.has(field);
}

/**
 * Makes one `TextEdit` in the field (a fix or an accepted suggestion) and leaves the caret where a person expects it
 * (`caretAfterEdit`: the same text lies after it as before). The field takes the focus, without scrolling the page to it.
 *
 * The edit goes through the browser's own editing command, as typing does: the page hears an `input` event as for a key press,
 * and the person's undo (Ctrl+Z in the field) takes the edit back. A browser without the command, or one that does not leave
 * the text it was asked for, gets the text written directly and the same event; that edit cannot be undone.
 *
 * An edit that knows where the person goes on typing (a pair of quotes, with the caret between) says so in `placeCaret`, a place in
 * the new text; otherwise the caret is placed as `caretAfterEdit` says.
 */
export function applyFieldEdit(field: EditableField, edit: TextEdit, placeCaret?: number): void {
  const before = field.value;
  const expected = applyEdit(before, edit);
  if (expected === before) return;
  const caret = placeCaret ?? caretAfterEdit(field.selectionStart ?? before.length, edit);
  const {
    span: [start, end],
    text,
  } = edit;

  field.focus({ preventScroll: true });
  field.setSelectionRange(start, end);
  editing.add(field);
  try {
    if (!replaceSelection(field, text) || field.value !== expected) {
      // What a command left other than expected is put back first, so that the edit is made on the text it was computed for.
      if (field.value !== before) field.value = before;
      field.setRangeText(text, start, end, 'end');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } finally {
    editing.delete(field);
  }
  field.setSelectionRange(caret, caret);
  // A framework that writes the value back once it has flushed moves the caret to the end: after its turn it is put back.
  queueMicrotask(() => {
    if (field.selectionStart !== caret) field.setSelectionRange(caret, caret);
  });
}
