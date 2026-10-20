import type { DiagnosticSeverity, QueryDiagnostic } from './diagnostic';
import type { Span } from './span';
import type { TermToken, Token } from './token';

/** What a stretch of a query is, for the colour it is drawn in. */
export type SyntaxSegmentKind = 'field' | 'value' | 'phrase' | 'operator' | 'paren' | 'negation' | 'text' | 'blank';

/** A stretch of the query that is drawn in one colour. */
export interface SyntaxSegment {
  readonly kind: SyntaxSegmentKind;
  readonly span: Span;
  /** The text of `span`. */
  readonly text: string;
  /** The worst of the diagnostics over this text; absent when none covers it. */
  readonly severity?: DiagnosticSeverity;
}

interface Piece {
  readonly kind: SyntaxSegmentKind;
  readonly span: Span;
}

/** A field is drawn with its colon, and its value, if it has one, apart; a phrase is drawn whole, quotes and all. */
function termPieces({ field, span, valueSpan, quote }: TermToken): Piece[] {
  if (field === undefined) return [{ kind: quote === 'none' ? 'text' : 'phrase', span }];
  const named: Piece = { kind: 'field', span: [span[0], valueSpan[0]] };
  return valueSpan[0] === valueSpan[1]
    ? [named]
    : [named, { kind: quote === 'none' ? 'value' : 'phrase', span: valueSpan }];
}

function tokenPieces(token: Token): Piece[] {
  if (token.kind === 'term') return termPieces(token);
  if (token.kind === 'open' || token.kind === 'close') return [{ kind: 'paren', span: token.span }];
  // The dash that negates is told from the word, which is an operator like `AND`.
  return [{ kind: token.kind === 'not' && token.text === '-' ? 'negation' : 'operator', span: token.span }];
}

/** The pieces of the tokens with a blank for each stretch between them (and before the first, and after the last). */
function piecesOf(source: string, tokens: readonly Token[]): Piece[] {
  const pieces: Piece[] = [];
  let at = 0;
  for (const piece of tokens.flatMap(tokenPieces)) {
    if (piece.span[0] > at) pieces.push({ kind: 'blank', span: [at, piece.span[0]] });
    pieces.push(piece);
    at = piece.span[1];
  }
  if (at < source.length) pieces.push({ kind: 'blank', span: [at, source.length] });
  return pieces;
}

/**
 * The place where a diagnostic starts (`delta` 1) or ends (-1) covering text. Those at one place are taken in together, so a
 * diagnostic with no text under it starts and ends in one step and marks nothing.
 */
interface Change {
  readonly at: number;
  readonly severity: DiagnosticSeverity;
  readonly delta: 1 | -1;
}

const changesOf = (diagnostics: readonly QueryDiagnostic[]): Change[] =>
  diagnostics
    .flatMap(({ span: [start, end], severity }): Change[] => [
      { at: start, severity, delta: 1 },
      { at: end, severity, delta: -1 },
    ])
    .sort((a, b) => a.at - b.at);

/**
 * The query cut into the stretches an editor draws in one colour (QUERY_LANGUAGE §8): each token by what it is, the blanks between
 * them, and every stretch a diagnostic covers marked with its severity. `tokens` and `diagnostics` are those of `source`. The
 * segments are in order, none is empty, and put together they are the text, so a mirror of the field has all of it to draw.
 *
 * - A field is a segment with its colon (`class:`) and its value another, or a phrase if it is quoted; a word with no field is
 *   `text`. A field nobody knows is drawn as a field too, since that is how it was typed; the diagnostic marks it.
 * - `NOT` is an `operator` as `AND` and `OR` are; the dash that negates is a `negation`.
 * - A diagnostic cuts a segment where it starts or ends inside it, so that a mark is drawn under the text at fault and no more
 *   (`clas` and not `clas:`). Where several cover a stretch the worst shows, and a diagnostic that covers no text marks none.
 *
 * The work is one walk over the pieces and the starts and ends of the diagnostics, in order, so a text of thousands of faults is
 * as quick as any other.
 */
export function syntaxSegments(
  source: string,
  tokens: readonly Token[],
  diagnostics: readonly QueryDiagnostic[],
): SyntaxSegment[] {
  const changes = changesOf(diagnostics);
  const covering: Record<DiagnosticSeverity, number> = { error: 0, warning: 0 };
  let next = 0;

  /** Takes in the diagnostics that start or end at or before `position`. */
  const advance = (position: number): void => {
    for (let change = changes[next]; change !== undefined && change.at <= position; change = changes[++next]) {
      covering[change.severity] += change.delta;
    }
  };
  const worst = (): DiagnosticSeverity | undefined =>
    covering.error > 0 ? 'error' : covering.warning > 0 ? 'warning' : undefined;
  const segment = (
    kind: SyntaxSegmentKind,
    start: number,
    end: number,
    severity: DiagnosticSeverity | undefined,
  ): SyntaxSegment => ({
    kind,
    span: [start, end],
    text: source.slice(start, end),
    ...(severity === undefined ? {} : { severity }),
  });

  const segments: SyntaxSegment[] = [];
  for (const {
    kind,
    span: [start, end],
  } of piecesOf(source, tokens)) {
    advance(start);
    let from = start;
    let severity = worst();
    for (let cut = changes[next]?.at; cut !== undefined && cut < end; cut = changes[next]?.at) {
      advance(cut);
      const now = worst();
      if (now === severity) continue;
      segments.push(segment(kind, from, cut, severity));
      from = cut;
      severity = now;
    }
    segments.push(segment(kind, from, end, severity));
  }
  return segments;
}
