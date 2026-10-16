import type { KeywordHit } from '../model/trait';
import type { Span } from '../query/span';

/** A run of a description that is all marked or all not. */
export interface TextPiece {
  readonly text: string;
  /** The query looks for this text (QUERY_LANGUAGE §4, *Highlighting*). */
  readonly marked: boolean;
}

/** A stretch of a description: one keyword, or the plain text between two. Never empty. */
export interface DescriptionPart {
  /** The keyword this stretch is, or `null` for plain text. */
  readonly keyword: KeywordHit | null;
  /** The stretch cut where the marks begin and end: in order, never empty, marked and not marked taking turns. */
  readonly pieces: readonly TextPiece[];
}

/**
 * Cuts the description of a trait into what the result list draws: its keywords (styled by kind and role) and the plain
 * text around them, each with the text a query marks inside it. A mark may begin in a keyword and end outside it, or the
 * other way round: it is then one piece in each part. The keywords are the ones of the dataset, in the order of the text
 * and apart from one another; the marks are the spans of `SearchOutcome.highlight`, in order and apart as well. Joining
 * the pieces gives back the description.
 */
export function descriptionParts(
  description: string,
  keywords: readonly KeywordHit[],
  marks: readonly Span[],
): readonly DescriptionPart[] {
  const parts: DescriptionPart[] = [];
  let end = 0;
  for (const keyword of keywords) {
    const [keywordStart, keywordEnd] = keyword.span;
    if (end < keywordStart) parts.push({ keyword: null, pieces: piecesBetween(description, end, keywordStart, marks) });
    parts.push({ keyword, pieces: piecesBetween(description, keywordStart, keywordEnd, marks) });
    end = keywordEnd;
  }
  if (end < description.length)
    parts.push({ keyword: null, pieces: piecesBetween(description, end, description.length, marks) });
  return parts;
}

/** The text in `[start, end)` split at the edges of the marks that fall in it. */
function piecesBetween(description: string, start: number, end: number, marks: readonly Span[]): TextPiece[] {
  const pieces: TextPiece[] = [];
  let at = start;
  for (const [markStart, markEnd] of marks) {
    if (markEnd <= at) continue;
    if (markStart >= end) break;
    const from = Math.max(markStart, at);
    const to = Math.min(markEnd, end);
    if (at < from) pieces.push({ text: description.slice(at, from), marked: false });
    pieces.push({ text: description.slice(from, to), marked: true });
    at = to;
  }
  if (at < end) pieces.push({ text: description.slice(at, end), marked: false });
  return pieces;
}
