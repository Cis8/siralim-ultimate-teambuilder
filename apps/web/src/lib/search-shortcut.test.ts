import { describe, expect, it } from 'vitest';
import { isSearchShortcut } from './search-shortcut';
import type { ShortcutEvent } from './shortcut-event';

const press = (overrides: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
  key: '/',
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  target: { tagName: 'BODY', isContentEditable: false },
  ...overrides,
});

describe('isSearchShortcut', () => {
  it('is the slash key', () => {
    expect(isSearchShortcut(press())).toBe(true);
  });

  it('is the slash key where it needs Shift (an Italian keyboard types it with Shift+7)', () => {
    expect(isSearchShortcut(press({ shiftKey: true }))).toBe(true);
  });

  it.each(['?', 'a', '7', 'Enter', 'Escape'])('is not %s', (key) => {
    expect(isSearchShortcut(press({ key }))).toBe(false);
  });

  it.each(['ctrlKey', 'metaKey', 'altKey'] as const)(
    'is not the slash with %s held: the browser or the system has it',
    (held) => {
      expect(isSearchShortcut(press({ [held]: true }))).toBe(false);
    },
  );

  it.each(['INPUT', 'TEXTAREA', 'SELECT'])('is not a key typed in a %s', (tagName) => {
    expect(isSearchShortcut(press({ target: { tagName, isContentEditable: false } }))).toBe(false);
  });

  it('is not a key typed in an element that can be edited', () => {
    expect(isSearchShortcut(press({ target: { tagName: 'DIV', isContentEditable: true } }))).toBe(false);
  });

  it('works from a button, a link, the body and the window', () => {
    expect(isSearchShortcut(press({ target: { tagName: 'BUTTON' } }))).toBe(true);
    expect(isSearchShortcut(press({ target: { tagName: 'A' } }))).toBe(true);
    expect(isSearchShortcut(press({ target: null }))).toBe(true);
  });
});
