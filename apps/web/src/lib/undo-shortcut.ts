import { isTextField, type ShortcutEvent } from './shortcut-event';

export type UndoShortcut = 'undo' | 'redo';

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
