/** The part of a text field's selection that tells where its caret is. */
export interface FieldSelection {
  readonly selectionStart: number | null;
  readonly selectionEnd: number | null;
}

/**
 * Where the lint takes the caret to be (PLAN D20): the term it is in is still being typed, and its findings wait. A selection
 * is no caret, since the person is choosing text and not finishing a term; and the caller gives none when the field is not the
 * one being typed in, so that every term is judged as it stands.
 */
export function caretToLint({ selectionStart, selectionEnd }: FieldSelection): number | undefined {
  return selectionStart !== null && selectionStart === selectionEnd ? selectionStart : undefined;
}
