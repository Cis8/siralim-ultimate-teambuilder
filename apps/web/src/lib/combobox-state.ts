/**
 * The state of an editable combobox with a list (ARIA APG), apart from the page: whether the list is wanted, and which option
 * is active. The options themselves, and so how many there are, come from outside and change with every key, so each function
 * that needs the count is given it. Pure, so that the keyboard table is a table of tests.
 */
export interface ComboboxState {
  /** Whether the person wants the list: it shows when it is also not empty. */
  readonly open: boolean;
  /**
   * The option Tab and Enter accept, which `aria-activedescendant` names. None until the person types or uses the arrows, and none
   * again after an accept, a caret move or a dismissal: a Tab that is not meant for the list must be free to leave the field.
   * It may point past the end of a list that has shrunk since (`comboboxView` says so).
   */
  readonly active: number | undefined;
}

export const shut: ComboboxState = { open: false, active: undefined };

/** What of a key press the combobox reads. `isComposing` is an IME in the middle of a word, whose keys are its own. */
export interface ComboboxKeyPress {
  readonly key: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  readonly isComposing: boolean;
}

/** What of a `KeyboardEvent` `keyPressOf` reads. */
export type ComboboxKeyEvent = Pick<
  KeyboardEvent,
  'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing' | 'keyCode'
>;

/** The key code that every browser gives to a key an IME has taken. */
const KEY_CODE_IN_COMPOSITION = 229;

/**
 * The key press of an event. Safari reports the Enter that ends an IME composition after the composition is over (`isComposing`
 * false), and only the key code 229 says that the key was the IME's: without it that Enter would accept the active option.
 */
export function keyPressOf(event: ComboboxKeyEvent): ComboboxKeyPress {
  return {
    key: event.key,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- the key code is the only sign of that Enter in Safari
    isComposing: event.isComposing || event.keyCode === KEY_CODE_IN_COMPOSITION,
  };
}

export interface KeyOutcome {
  /** Whether the combobox used the key: the page then keeps it from doing what it does by itself (moving the caret, leaving the field). */
  readonly handled: boolean;
  readonly state: ComboboxState;
  /** The option to accept, when the key accepts one; the page then makes the edit and tells `accepted`. */
  readonly accept: number | undefined;
}

/** What the page shows and says for a state, given how many options the list has now. */
export interface ComboboxView {
  readonly expanded: boolean;
  /** The active option; none when the list is not showing or the option is no longer in it. */
  readonly active: number | undefined;
}

/**
 * What is shown for `state`. A `permanent` list is the one the sheet of a phone draws in the flow of the page: it shows whenever
 * it has options, whether or not the person asked, and what `open` holds is of no matter.
 */
export function comboboxView({ open, active }: ComboboxState, size: number, permanent = false): ComboboxView {
  const expanded = (permanent || open) && size > 0;
  return { expanded, active: expanded && active !== undefined && active < size ? active : undefined };
}

/**
 * The person typed: the list is wanted, and the first option, the best fit, is the one Tab takes (the ghost text shows it). When the
 * options are a list to browse (`browsing`: the history that an empty field offers) they complete nothing that was typed, so none
 * is active and Tab is still the field's own.
 */
export function typed(browsing = false): ComboboxState {
  return { open: true, active: browsing ? undefined : 0 };
}

/** The list was asked for by a press in the field: it shows, and the person has chosen nothing in it yet. */
export function opened(): ComboboxState {
  return { open: true, active: undefined };
}

/**
 * An option was accepted. A finished term shuts the list; one the person goes on with (a field whose value is next) keeps it open.
 * Either way nothing is active: a Tab after an accept moves on, it does not take what the next list puts first.
 */
export function accepted(continues: boolean): ComboboxState {
  return continues ? { open: true, active: undefined } : shut;
}

/** The caret moved without typing: the suggestions are for another place, and the person has not chosen among them. */
export function moved(state: ComboboxState): ComboboxState {
  return state.active === undefined ? state : { ...state, active: undefined };
}

const handled = (state: ComboboxState, accept?: number): KeyOutcome => ({ handled: true, state, accept });

/**
 * What a key press does to the list; unhandled keys are the field's own. A `permanent` list has nothing to put away, so Escape is
 * the sheet's own (it closes it) unless an option is active, which it then lets go of.
 */
export function pressKey(state: ComboboxState, press: ComboboxKeyPress, size: number, permanent = false): KeyOutcome {
  const unhandled: KeyOutcome = { handled: false, state, accept: undefined };
  if (press.isComposing) return unhandled;
  const { expanded, active } = comboboxView(state, size, permanent);
  const plain = !(press.altKey || press.ctrlKey || press.metaKey || press.shiftKey);

  switch (press.key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      if (size === 0) return unhandled;
      const down = press.key === 'ArrowDown';
      if (press.altKey && !(press.ctrlKey || press.metaKey || press.shiftKey)) {
        // Alt+Down shows the list without choosing, Alt+Up puts it away.
        if (down) return handled(expanded ? state : { open: true, active: undefined });
        return expanded && !permanent ? handled(shut) : unhandled;
      }
      if (!plain) return unhandled;
      if (!expanded) return handled({ open: true, active: down ? 0 : size - 1 });
      const next = active === undefined ? (down ? 0 : size - 1) : (active + (down ? 1 : size - 1)) % size;
      return handled({ open: true, active: next });
    }
    case 'Tab':
    case 'Enter':
      return plain && expanded && active !== undefined ? handled(state, active) : unhandled;
    case 'Escape':
      return expanded && (!permanent || active !== undefined) ? handled(shut) : unhandled;
    default:
      return unhandled;
  }
}
