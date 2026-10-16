import type { QueryNode } from './ast';
import type { FieldRegistry } from './field-registry';
import { fieldRegistry } from './fields';
import type { Span } from './span';
import { visitQuery, type QueryVisitor } from './visitor';

/** The spans of a text that the query marks, in the order of the text and apart from one another. Never HTML. */
export type Highlighter = (text: string) => readonly Span[];

/**
 * What the terms under a node look for, split by what a trait that the node finds has to say about it: it has the text
 * (`wanted`) or it does not (`unwanted`). A NOT swaps the two, so a term under two NOTs is wanted again.
 */
interface Looked {
  readonly wanted: readonly string[];
  readonly unwanted: readonly string[];
}

const nothing: Looked = { wanted: [], unwanted: [] };

/** Collects the text of the terms that look in the description. The fields say which do: this knows none. */
const lookedFor = (registry: FieldRegistry): QueryVisitor<Looked> => ({
  term: ({ term }) => {
    const text = registry.highlightedText(term);
    return text === undefined ? nothing : { wanted: [text], unwanted: [] };
  },
  not: (_node, { wanted, unwanted }) => ({ wanted: unwanted, unwanted: wanted }),
  and: (_node, operands) => together(operands),
  or: (_node, operands) => together(operands),
});

const together = (operands: readonly Looked[]): Looked => ({
  wanted: operands.flatMap((operand) => operand.wanted),
  unwanted: operands.flatMap((operand) => operand.unwanted),
});

/**
 * Works out once what the query marks, then marks any text: the description of each result. A term is marked when it
 * looks in the description (free text and `desc:`) and is not under a NOT; the ones under two NOTs are marked, since
 * they are what a trait found has to contain. The fields are read from `registry`, which is the one of the app unless a
 * test brings its own.
 */
export function createHighlighter(ast: QueryNode | undefined, registry: FieldRegistry = fieldRegistry): Highlighter {
  const words = ast === undefined ? [] : [...new Set(visitQuery(ast, lookedFor(registry)).wanted)];
  // The search is a case-insensitive pattern on the text as it is: lower-casing the text first would move the spans
  // (the lower case of "İ" is two characters), and they are positions in the text the page shows.
  const patterns = words.map((word) => new RegExp(escapeForPattern(word), 'giu'));
  return (text) =>
    joinSpans(
      patterns.flatMap((pattern) => [...text.matchAll(pattern)].map(({ index, 0: found }) => spanOf(index, found))),
    );
}

const spanOf = (start: number, found: string): Span => [start, start + found.length];

const escapeForPattern = (word: string): string => word.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

/** In the order of the text, with the spans that overlap or touch made one. */
function joinSpans(spans: readonly Span[]): Span[] {
  const joined: Span[] = [];
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    const last = joined.at(-1);
    if (last !== undefined && start <= last[1]) joined[joined.length - 1] = [last[0], Math.max(last[1], end)];
    else joined.push([start, end]);
  }
  return joined;
}
