import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { KeywordHit } from '../model/trait';
import type { Span } from '../query/span';
import { descriptionParts, type DescriptionPart } from './description-parts';

const hit = (key: string, span: Span): KeywordHit => ({ key, kind: 'debuff', role: 'applies', span });

/** The description of a result as a short outline: `[Vulnerable]` for a keyword, `«…»` for the text a query marks. */
const outline = (parts: readonly DescriptionPart[]): string =>
  parts
    .map(({ keyword, pieces }) => {
      const text = pieces.map(({ text: piece, marked }) => (marked ? `«${piece}»` : piece)).join('');
      return keyword === null ? text : `[${text}]`;
    })
    .join('');

const text = 'Applies Vulnerable to all enemies at the start of battle.';
const vulnerable = hit('vulnerable', [8, 18]);
const startOfBattle = hit('start of battle', [41, 56]);

describe('descriptionParts', () => {
  it('has no parts for an empty description', () => {
    expect(descriptionParts('', [], [])).toEqual([]);
  });

  it('is the whole text as plain text when there is no keyword and no mark', () => {
    expect(descriptionParts(text, [], [])).toEqual([{ keyword: null, pieces: [{ text, marked: false }] }]);
  });

  it('splits the text around the keywords, which come through as they are', () => {
    const parts = descriptionParts(text, [vulnerable, startOfBattle], []);

    expect(outline(parts)).toBe('Applies [Vulnerable] to all enemies at the [start of battle].');
    expect(parts.map(({ keyword }) => keyword)).toEqual([null, vulnerable, null, startOfBattle, null]);
  });

  it('has no empty part for a keyword at either end of the text, or for keywords side by side', () => {
    expect(outline(descriptionParts('Poison Bleed', [hit('poison', [0, 6]), hit('bleed', [7, 12])], []))).toBe(
      '[Poison] [Bleed]',
    );
    expect(outline(descriptionParts('PoisonBleed', [hit('poison', [0, 6]), hit('bleed', [6, 11])], []))).toBe(
      '[Poison][Bleed]',
    );
  });

  describe('marks', () => {
    it('marks the text a query looks for, in the plain text', () => {
      expect(outline(descriptionParts(text, [], [[0, 7]]))).toBe(
        '«Applies» Vulnerable to all enemies at the start of battle.',
      );
      expect(outline(descriptionParts(text, [], [[19, 27]]))).toBe(
        'Applies Vulnerable «to all e»nemies at the start of battle.',
      );
    });

    it('marks all of a text that is marked from end to end', () => {
      expect(descriptionParts('Weak', [], [[0, 4]])).toEqual([
        { keyword: null, pieces: [{ text: 'Weak', marked: true }] },
      ]);
    });

    it('marks inside a keyword, which stays one part', () => {
      const parts = descriptionParts(text, [vulnerable], [[10, 13]]);

      expect(outline(parts)).toBe('Applies [Vu«lne»rable] to all enemies at the start of battle.');
      expect(parts).toHaveLength(3);
    });

    it('marks a whole keyword', () => {
      expect(outline(descriptionParts(text, [vulnerable], [[8, 18]]))).toBe(
        'Applies [«Vulnerable»] to all enemies at the start of battle.',
      );
    });

    it('splits a mark that runs across the edge of a keyword between the two parts', () => {
      const parts = descriptionParts(text, [vulnerable], [[5, 12]]);

      expect(outline(parts)).toBe('Appli«es »[«Vuln»erable] to all enemies at the start of battle.');
    });

    it('marks the text on both sides of a keyword', () => {
      expect(
        outline(
          descriptionParts(
            text,
            [vulnerable],
            [
              [2, 3],
              [19, 21],
            ],
          ),
        ),
      ).toBe('Ap«p»lies [Vulnerable] «to» all enemies at the start of battle.');
    });
  });

  describe('on any description', () => {
    /** Increasing positions in `[0, length]`, in pairs: the spans of a text, apart from one another and never empty. */
    const spansIn = (length: number): fc.Arbitrary<Span[]> =>
      fc.uniqueArray(fc.integer({ min: 0, max: length }), { minLength: 0, maxLength: 12 }).map((positions) => {
        const sorted = positions.toSorted((a, b) => a - b);
        const spans: Span[] = [];
        for (let i = 0; i + 1 < sorted.length; i += 2) spans.push([sorted[i] ?? 0, sorted[i + 1] ?? 0]);
        return spans;
      });

    const descriptions = fc.string({ maxLength: 60 }).chain((description) =>
      fc.record({
        description: fc.constant(description),
        keywords: spansIn(description.length).map((spans) => spans.map((span, i) => hit(`k${i}`, span))),
        marks: spansIn(description.length),
      }),
    );

    it('keeps every character in order, exactly once', () => {
      fc.assert(
        fc.property(descriptions, ({ description, keywords, marks }) => {
          const parts = descriptionParts(description, keywords, marks);

          expect(parts.flatMap(({ pieces }) => pieces.map((piece) => piece.text)).join('')).toBe(description);
        }),
      );
    });

    it('has a part for each keyword, with the text of its span, and no empty part or piece', () => {
      fc.assert(
        fc.property(descriptions, ({ description, keywords, marks }) => {
          const parts = descriptionParts(description, keywords, marks);

          const keywordParts = parts.filter(({ keyword }) => keyword !== null);
          expect(keywordParts.map(({ keyword }) => keyword)).toEqual(keywords);
          for (const { keyword, pieces } of keywordParts) {
            const [start, end] = keyword?.span ?? [0, 0];
            expect(pieces.map((piece) => piece.text).join('')).toBe(description.slice(start, end));
          }
          for (const { pieces } of parts) {
            expect(pieces.length).toBeGreaterThan(0);
            for (const piece of pieces) expect(piece.text).not.toBe('');
          }
        }),
      );
    });

    it('marks a character exactly when a mark covers it', () => {
      fc.assert(
        fc.property(descriptions, ({ description, keywords, marks }) => {
          const parts = descriptionParts(description, keywords, marks);

          const markedByParts = parts.flatMap(({ pieces }) =>
            pieces.flatMap(({ text: piece, marked }) => Array.from({ length: piece.length }, () => marked)),
          );
          const markedByMarks = Array.from({ length: description.length }, (_, i) =>
            marks.some(([start, end]) => start <= i && i < end),
          );
          expect(markedByParts).toEqual(markedByMarks);
        }),
      );
    });

    it('never has two marked pieces, or two unmarked ones, one after the other in a part', () => {
      fc.assert(
        fc.property(descriptions, ({ description, keywords, marks }) => {
          for (const { pieces } of descriptionParts(description, keywords, marks)) {
            pieces.slice(1).forEach(({ marked }, i) => {
              expect(marked).not.toBe(pieces[i]?.marked);
            });
          }
        }),
      );
    });
  });
});
