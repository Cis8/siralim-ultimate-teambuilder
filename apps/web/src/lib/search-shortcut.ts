import { isTextField, type ShortcutEvent } from './shortcut-event';

/**
 * Whether a key press asks to go to the search field (QUERY_LANGUAGE §6): the slash, from anywhere but a field that can be
 * typed in, where it is a character. Shift is allowed because some layouts type the slash with it (Italian: Shift+7); Ctrl, Cmd
 * and Alt are not, as they belong to the browser and the system.
 */
export function isSearchShortcut(event: ShortcutEvent): boolean {
  return event.key === '/' && !(event.ctrlKey || event.metaKey || event.altKey) && !isTextField(event.target);
}
