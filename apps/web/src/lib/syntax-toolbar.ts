import { SYNTAX_INSERTION_IDS, type SyntaxInsertionId } from '@atlas/core';
import { copy } from './copy';

/** One button of the toolbar at the foot of the search sheet: what it shows, what it is called, and what it writes (`insertAtCaret`). */
export interface SyntaxButton {
  readonly id: SyntaxInsertionId;
  readonly label: string;
  readonly name: string;
}

/** The buttons, in the order of the query language's list of insertions. */
export const syntaxToolbar: readonly SyntaxButton[] = SYNTAX_INSERTION_IDS.map((id) => ({
  id,
  ...copy.syntaxButtons[id],
}));
