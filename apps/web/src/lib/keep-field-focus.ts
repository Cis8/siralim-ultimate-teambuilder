/**
 * A button that acts on the search field must not take the focus from it: the keyboard of a phone would drop, and the caret
 * with it. Pressing the button with a pointer then leaves the focus where it was. Used as an attachment: `{@attach keepFieldFocus}`.
 */
export function keepFieldFocus(button: HTMLElement): () => void {
  const hold = (event: MouseEvent): void => {
    event.preventDefault();
  };
  button.addEventListener('mousedown', hold);
  return () => {
    button.removeEventListener('mousedown', hold);
  };
}
