import { describe, expect, it } from 'vitest';
import {
  accepted,
  comboboxView,
  keyPressOf,
  moved,
  opened,
  pressKey,
  shut,
  typed,
  type ComboboxKeyEvent,
  type ComboboxKeyPress,
  type ComboboxState,
} from './combobox-state';

const key = (name: string, overrides: Partial<ComboboxKeyPress> = {}): ComboboxKeyPress => ({
  key: name,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  isComposing: false,
  ...overrides,
});

const open = (active?: number): ComboboxState => ({ open: true, active });

describe('what a combobox does with the person typing', () => {
  it('opens on typing with the first option active, so that Tab takes the top suggestion', () => {
    expect(typed()).toEqual({ open: true, active: 0 });
  });

  it('does not show a list that has no options, but remembers the person wants one', () => {
    expect(comboboxView(typed(), 0)).toEqual({ expanded: false, active: undefined });
    expect(comboboxView(typed(), 3)).toEqual({ expanded: true, active: 0 });
  });

  it('has no option active when the list is shut, or when the active one is gone', () => {
    expect(comboboxView(shut, 5)).toEqual({ expanded: false, active: undefined });
    expect(comboboxView({ open: false, active: 2 }, 5).active).toBeUndefined();
    expect(comboboxView(open(7), 5)).toEqual({ expanded: true, active: undefined });
  });
});

describe('what a combobox does when its options are a list to browse', () => {
  it('opens on typing with no option active: the options do not complete the text, so Tab is still the field’s', () => {
    expect(typed(true)).toEqual({ open: true, active: undefined });
    expect(comboboxView(typed(true), 5)).toEqual({ expanded: true, active: undefined });
  });

  it('opens on a press in the field, with nothing chosen', () => {
    expect(opened()).toEqual({ open: true, active: undefined });
  });

  it('still lets the arrows choose among the options, and Enter then takes the one chosen', () => {
    const afterArrow = pressKey(opened(), key('ArrowDown'), 4);
    expect(afterArrow.state).toEqual({ open: true, active: 0 });
    expect(pressKey(afterArrow.state, key('Enter'), 4).accept).toBe(0);
  });

  it('leaves Tab and Enter to the field while nothing is chosen', () => {
    expect(pressKey(opened(), key('Tab'), 4).handled).toBe(false);
    expect(pressKey(opened(), key('Enter'), 4).handled).toBe(false);
  });
});

describe('what a combobox does after an option is accepted', () => {
  it('shuts after a finished term, with no option active', () => {
    expect(accepted(false)).toEqual(shut);
  });

  it('stays open when the person goes on with the term (a field was accepted, the value is next), with no option active', () => {
    expect(accepted(true)).toEqual({ open: true, active: undefined });
  });

  it('never leaves an option active, so that a Tab afterwards leaves the field', () => {
    for (const continues of [true, false]) {
      expect(comboboxView(accepted(continues), 9).active).toBeUndefined();
    }
  });
});

describe('what a combobox does when the caret moves without typing', () => {
  it('keeps the list as it is but drops the active option: the context is another', () => {
    expect(moved(open(3))).toEqual({ open: true, active: undefined });
    expect(moved(shut)).toEqual(shut);
  });
});

describe('ArrowDown', () => {
  it('opens a shut list on the first option', () => {
    const outcome = pressKey(shut, key('ArrowDown'), 4);
    expect(outcome).toEqual({ handled: true, state: { open: true, active: 0 }, accept: undefined });
  });

  it('moves to the next option and wraps from the last to the first', () => {
    expect(pressKey(open(0), key('ArrowDown'), 4).state.active).toBe(1);
    expect(pressKey(open(3), key('ArrowDown'), 4).state.active).toBe(0);
  });

  it('goes to the first option from an open list with none active', () => {
    expect(pressKey(open(), key('ArrowDown'), 4).state).toEqual({ open: true, active: 0 });
  });

  it('is left alone when there is nothing to move through', () => {
    expect(pressKey(shut, key('ArrowDown'), 0).handled).toBe(false);
    expect(pressKey(open(0), key('ArrowDown'), 0).handled).toBe(false);
  });

  it('opens the list without choosing an option with Alt', () => {
    expect(pressKey(shut, key('ArrowDown', { altKey: true }), 4)).toEqual({
      handled: true,
      state: { open: true, active: undefined },
      accept: undefined,
    });
    expect(pressKey(open(2), key('ArrowDown', { altKey: true }), 4).state).toEqual(open(2));
  });

  it.each(['ctrlKey', 'metaKey', 'shiftKey'] as const)(
    'is left to the field with %s held (it selects or jumps in the text)',
    (held) => {
      expect(pressKey(open(0), key('ArrowDown', { [held]: true }), 4).handled).toBe(false);
    },
  );
});

describe('ArrowUp', () => {
  it('opens a shut list on the last option', () => {
    expect(pressKey(shut, key('ArrowUp'), 4).state).toEqual({ open: true, active: 3 });
  });

  it('moves to the previous option and wraps from the first to the last', () => {
    expect(pressKey(open(2), key('ArrowUp'), 4).state.active).toBe(1);
    expect(pressKey(open(0), key('ArrowUp'), 4).state.active).toBe(3);
  });

  it('goes to the last option from an open list with none active', () => {
    expect(pressKey(open(), key('ArrowUp'), 4).state).toEqual({ open: true, active: 3 });
  });

  it('shuts the list with Alt, and is left alone when it is shut already', () => {
    expect(pressKey(open(1), key('ArrowUp', { altKey: true }), 4)).toEqual({
      handled: true,
      state: shut,
      accept: undefined,
    });
    expect(pressKey(shut, key('ArrowUp', { altKey: true }), 4).handled).toBe(false);
  });

  it('is left alone when there is nothing to move through', () => {
    expect(pressKey(open(0), key('ArrowUp'), 0).handled).toBe(false);
  });
});

describe('Tab and Enter', () => {
  it.each(['Tab', 'Enter'])('%s accepts the active option', (name) => {
    expect(pressKey(open(2), key(name), 4)).toEqual({ handled: true, state: open(2), accept: 2 });
  });

  it.each(['Tab', 'Enter'])('%s is not taken when no option is active: the person leaves the field', (name) => {
    expect(pressKey(open(), key(name), 4).handled).toBe(false);
    expect(pressKey(shut, key(name), 4).handled).toBe(false);
  });

  it.each(['Tab', 'Enter'])('%s is not taken when the list is shut or has no options', (name) => {
    expect(pressKey({ open: false, active: 1 }, key(name), 4).handled).toBe(false);
    expect(pressKey(open(0), key(name), 0).handled).toBe(false);
  });

  it('is not taken by an active option that the list has outgrown', () => {
    expect(pressKey(open(7), key('Tab'), 5).handled).toBe(false);
  });

  it.each(['shiftKey', 'ctrlKey', 'metaKey', 'altKey'] as const)(
    'Tab with %s held is not taken (Shift+Tab goes back)',
    (held) => {
      expect(pressKey(open(1), key('Tab', { [held]: true }), 4).handled).toBe(false);
      expect(pressKey(open(1), key('Enter', { [held]: true }), 4).handled).toBe(false);
    },
  );

  it('does not take a key that ends an IME composition', () => {
    expect(pressKey(open(1), key('Enter', { isComposing: true }), 4).handled).toBe(false);
    expect(pressKey(open(1), key('ArrowDown', { isComposing: true }), 4).handled).toBe(false);
  });
});

describe('what of a keyboard event the combobox reads', () => {
  const event = (overrides: Partial<ComboboxKeyEvent> = {}): ComboboxKeyEvent => ({
    key: 'Enter',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    isComposing: false,
    keyCode: 13,
    ...overrides,
  });

  it('is the key and the modifiers held', () => {
    expect(keyPressOf(event({ key: 'Tab', shiftKey: true, keyCode: 9 }))).toEqual(key('Tab', { shiftKey: true }));
  });

  it('is a composition when the browser says so', () => {
    expect(keyPressOf(event({ isComposing: true })).isComposing).toBe(true);
  });

  it('is a composition for the key code 229 too: Safari reports the Enter that ends one after the composition has ended', () => {
    const ending = keyPressOf(event({ keyCode: 229 }));

    expect(ending.isComposing).toBe(true);
    expect(pressKey(open(1), ending, 4).handled).toBe(false);
  });
});

describe('Escape', () => {
  it('shuts a list that is showing', () => {
    expect(pressKey(open(1), key('Escape'), 4)).toEqual({ handled: true, state: shut, accept: undefined });
    expect(pressKey(open(), key('Escape'), 4).state).toEqual(shut);
  });

  it('is left to the page when no list is showing (it may close a sheet)', () => {
    expect(pressKey(shut, key('Escape'), 4).handled).toBe(false);
    expect(pressKey(open(0), key('Escape'), 0).handled).toBe(false);
  });
});

describe('the other keys', () => {
  it.each(['a', 'Backspace', 'ArrowLeft', 'ArrowRight', 'Home', 'End', ' ', 'PageDown'])(
    '%s is left to the field',
    (name) => {
      const state = open(1);
      expect(pressKey(state, key(name), 4)).toEqual({ handled: false, state, accept: undefined });
    },
  );
});
