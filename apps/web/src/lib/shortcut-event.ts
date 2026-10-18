/** The part of a key event that decides whether it is a shortcut; a `KeyboardEvent` has it. */
export interface ShortcutEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly target: { readonly tagName?: string; readonly isContentEditable?: boolean } | null;
}

/** Elements whose keys are the person's typing (or their own type-ahead), which a shortcut leaves to them. */
const TEXT_FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function isTextField(target: ShortcutEvent['target']): boolean {
  return target !== null && (TEXT_FIELDS.has(target.tagName ?? '') || target.isContentEditable === true);
}
