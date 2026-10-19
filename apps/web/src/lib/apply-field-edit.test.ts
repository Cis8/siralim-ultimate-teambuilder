import { describe, expect, it } from 'vitest';
import { applyFieldEdit, isBeingEdited, type EditableField } from './apply-field-edit';

type ExecCommand = (command: string, showUI?: boolean, value?: string) => boolean;

/**
 * A text field as far as `applyFieldEdit` uses one, with what a browser does: the selection, a value that moves the caret to
 * the end when it is set, and an editing command that edits at the selection and tells the field (an `input` event).
 */
class FakeField implements EditableField {
  value: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  focused: { preventScroll?: boolean } | undefined;
  readonly events: string[] = [];
  readonly commands: string[] = [];
  /** What the page does when the field tells it the text changed (a framework's flush, say). */
  onInput: () => void = () => undefined;
  readonly ownerDocument: { execCommand?: ExecCommand };

  constructor(value: string, caret: number, { editing = true }: { editing?: boolean } = {}) {
    this.value = value;
    this.selectionStart = caret;
    this.selectionEnd = caret;
    this.ownerDocument = editing ? { execCommand: (command, _ui, text) => this.run(command, text) } : {};
  }

  private run(command: string, text = ''): boolean {
    this.commands.push(text === '' ? command : `${command} ${text}`);
    if (command !== 'insertText' && command !== 'delete') return false;
    const start = this.selectionStart ?? 0;
    this.replace(text, start, this.selectionEnd ?? start);
    this.onInput();
    return true;
  }

  private replace(text: string, start: number, end: number): void {
    this.value = this.value.slice(0, start) + text + this.value.slice(end);
    this.selectionStart = this.selectionEnd = start + text.length;
  }

  focus(options?: FocusOptions): void {
    this.focused = options ?? {};
  }

  setSelectionRange(start: number, end: number): void {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  setRangeText(replacement: string, start: number, end: number): void {
    this.commands.push('setRangeText');
    this.replace(replacement, start, end);
  }

  dispatchEvent(event: Event): boolean {
    this.events.push(`${event.type}${event.bubbles ? ' (bubbles)' : ''}`);
    this.onInput();
    return true;
  }
}

describe('applyFieldEdit', () => {
  it('replaces the span through the editing command of the browser, which keeps the undo of the field', () => {
    const field = new FakeField('clas:life', 9);

    applyFieldEdit(field, { span: [0, 4], text: 'class' });

    expect(field.value).toBe('class:life');
    expect(field.commands).toEqual(['insertText class']);
    // The browser told the page itself: the edit is not announced twice.
    expect(field.events).toEqual([]);
  });

  it('deletes with the delete command, since an empty text inserts nothing', () => {
    const field = new FakeField('a ) b', 5);

    applyFieldEdit(field, { span: [2, 4], text: '' });

    expect(field.value).toBe('a b');
    expect(field.commands).toEqual(['delete']);
  });

  it('writes the text itself and tells the page when the browser has no editing command', () => {
    const field = new FakeField('(weak', 5, { editing: false });

    applyFieldEdit(field, { span: [5, 5], text: ')' });

    expect(field.value).toBe('(weak)');
    expect(field.commands).toEqual(['setRangeText']);
    expect(field.events).toEqual(['input (bubbles)']);
  });

  it('does the same when the editing command refuses', () => {
    const field = new FakeField('(weak', 5);
    field.ownerDocument.execCommand = () => false;

    applyFieldEdit(field, { span: [5, 5], text: ')' });

    expect(field.value).toBe('(weak)');
    expect(field.events).toEqual(['input (bubbles)']);
  });

  it('does the same when the editing command throws', () => {
    const field = new FakeField('(weak', 5);
    field.ownerDocument.execCommand = () => {
      throw new Error('not allowed here');
    };

    applyFieldEdit(field, { span: [5, 5], text: ')' });

    expect(field.value).toBe('(weak)');
    expect(field.events).toEqual(['input (bubbles)']);
  });

  it('writes the right text when the editing command succeeds and leaves another one (a limit on the field, say)', () => {
    const field = new FakeField('clas:life', 9);
    field.ownerDocument.execCommand = (_command, _ui, text) => {
      field.value = `${text ?? ''}?`;
      return true;
    };

    applyFieldEdit(field, { span: [0, 4], text: 'class' });

    expect(field.value).toBe('class:life');
    expect(field.events).toEqual(['input (bubbles)']);
  });

  it('puts the focus in the field without scrolling the page to it', () => {
    const field = new FakeField('clas:life', 9);

    applyFieldEdit(field, { span: [0, 4], text: 'class' });

    expect(field.focused).toEqual({ preventScroll: true });
  });

  it('leaves the caret in front of the text it was in front of', () => {
    const atTheEnd = new FakeField('clas:life (weak', 15);
    applyFieldEdit(atTheEnd, { span: [0, 4], text: 'class' });
    expect([atTheEnd.selectionStart, atTheEnd.selectionEnd]).toEqual([16, 16]);

    const atTheStart = new FakeField('weak clas:life', 0);
    applyFieldEdit(atTheStart, { span: [5, 9], text: 'class' });
    expect([atTheStart.selectionStart, atTheStart.selectionEnd]).toEqual([0, 0]);
  });

  it('puts the caret after the text written when it was in the text replaced', () => {
    const field = new FakeField('clas:life', 2);

    applyFieldEdit(field, { span: [0, 4], text: 'class' });

    expect([field.selectionStart, field.selectionEnd]).toEqual([5, 5]);
  });

  it('puts the caret back after the page has had its turn, if the page moved it', async () => {
    const field = new FakeField('weak clas:life', 0);
    // A framework that writes the value back once it has flushed leaves the caret at the end.
    field.onInput = () => {
      queueMicrotask(() => {
        field.selectionStart = field.selectionEnd = field.value.length;
      });
    };

    applyFieldEdit(field, { span: [5, 9], text: 'class' });
    expect(field.selectionStart).toBe(0);

    await Promise.resolve();

    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 0]);
  });

  it('does nothing for an edit that changes nothing', () => {
    const field = new FakeField('weak', 2);

    applyFieldEdit(field, { span: [1, 1], text: '' });
    applyFieldEdit(field, { span: [0, 4], text: 'weak' });

    expect(field.commands).toEqual([]);
    expect(field.events).toEqual([]);
    expect(field.focused).toBeUndefined();
  });
});

describe('isBeingEdited', () => {
  /** Whether the page, told that the text changed, finds the field being edited for the person (the answer at each `input` event). */
  const watched = (field: FakeField): boolean[] => {
    const seen: boolean[] = [];
    field.onInput = () => {
      seen.push(isBeingEdited(field));
    };
    return seen;
  };

  it('is true while the page hears of an edit made through the editing command, and not before or after', () => {
    const field = new FakeField('clas:life', 9);
    const seen = watched(field);
    expect(isBeingEdited(field)).toBe(false);

    applyFieldEdit(field, { span: [0, 4], text: 'class' });

    expect(seen).toEqual([true]);
    expect(isBeingEdited(field)).toBe(false);
  });

  it('is true for the event of the edit the field makes itself, when the browser has no editing command', () => {
    const field = new FakeField('(weak', 5, { editing: false });
    const seen = watched(field);

    applyFieldEdit(field, { span: [5, 5], text: ')' });

    expect(seen).toEqual([true]);
    expect(isBeingEdited(field)).toBe(false);
  });

  it('is false again when the edit fails', () => {
    const field = new FakeField('(weak', 5);
    field.setRangeText = () => {
      throw new Error('the field is gone');
    };
    field.ownerDocument.execCommand = () => false;

    expect(() => {
      applyFieldEdit(field, { span: [5, 5], text: ')' });
    }).toThrow('the field is gone');

    expect(isBeingEdited(field)).toBe(false);
  });

  it('is about one field: another one, typed in, is not being edited', () => {
    const edited = new FakeField('clas:life', 9);
    const typedIn = new FakeField('weak', 4);
    const seen: boolean[] = [];
    edited.onInput = () => {
      seen.push(isBeingEdited(typedIn));
    };

    applyFieldEdit(edited, { span: [0, 4], text: 'class' });

    expect(seen).toEqual([false]);
  });
});
