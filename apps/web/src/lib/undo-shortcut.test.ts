import { describe, expect, it } from 'vitest';
import type { ShortcutEvent } from './shortcut-event';
import { undoShortcut } from './undo-shortcut';

const press = (overrides: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
  key: 'z',
  ctrlKey: true,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  target: { tagName: 'BUTTON', isContentEditable: false },
  ...overrides,
});

describe('undoShortcut', () => {
  it('is undo for Ctrl+Z, and for Cmd+Z', () => {
    expect(undoShortcut(press())).toBe('undo');
    expect(undoShortcut(press({ ctrlKey: false, metaKey: true }))).toBe('undo');
  });

  it('is redo for Ctrl+Shift+Z, and for Ctrl+Y', () => {
    expect(undoShortcut(press({ shiftKey: true }))).toBe('redo');
    expect(undoShortcut(press({ key: 'y' }))).toBe('redo');
  });

  it('does not mind the letter case a key is reported in', () => {
    expect(undoShortcut(press({ key: 'Z' }))).toBe('undo');
    expect(undoShortcut(press({ key: 'Z', shiftKey: true }))).toBe('redo');
  });

  it('is nothing without Ctrl or Cmd', () => {
    expect(undoShortcut(press({ ctrlKey: false }))).toBeUndefined();
  });

  it('is nothing for another key, or with Alt held', () => {
    expect(undoShortcut(press({ key: 'x' }))).toBeUndefined();
    expect(undoShortcut(press({ altKey: true }))).toBeUndefined();
  });

  it('is nothing for Ctrl+Shift+Y', () => {
    expect(undoShortcut(press({ key: 'y', shiftKey: true }))).toBeUndefined();
  });

  it.each(['INPUT', 'TEXTAREA', 'SELECT'])(
    'is nothing in a text field: the field has an undo of its own (%s)',
    (tagName) => {
      expect(undoShortcut(press({ target: { tagName, isContentEditable: false } }))).toBeUndefined();
    },
  );

  it('is nothing in an element that can be edited', () => {
    expect(undoShortcut(press({ target: { tagName: 'DIV', isContentEditable: true } }))).toBeUndefined();
  });

  it('works with the page itself as the target, or with no target at all', () => {
    expect(undoShortcut(press({ target: { tagName: 'BODY' } }))).toBe('undo');
    expect(undoShortcut(press({ target: null }))).toBe('undo');
  });
});
