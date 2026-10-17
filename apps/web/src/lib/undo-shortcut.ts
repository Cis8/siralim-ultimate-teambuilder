export type UndoShortcut = 'undo' | 'redo';

/** The part of a key event that decides whether it is an undo or a redo; a `KeyboardEvent` has it. */
export interface ShortcutEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly target: { readonly tagName?: string; readonly isContentEditable?: boolean } | null;
}

/** Elements whose text has an undo of its own, which the shortcut leaves to them. */
const TEXT_FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * What a key press asks of the party: Ctrl or Cmd with Z is undo, with Shift too (or Ctrl+Y, the habit of Windows) redo.
 * Nothing in a field that can be typed in, where the same keys undo the typing.
 */
export function undoShortcut(event: ShortcutEvent): UndoShortcut | undefined {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return undefined;
  if (isTextField(event.target)) return undefined;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && !event.shiftKey) return 'redo';
  return undefined;
}

function isTextField(target: ShortcutEvent['target']): boolean {
  return target !== null && (TEXT_FIELDS.has(target.tagName ?? '') || target.isContentEditable === true);
}
