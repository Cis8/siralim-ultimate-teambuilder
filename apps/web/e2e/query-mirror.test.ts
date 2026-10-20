import { expect, test, type Locator, type Page } from '@playwright/test';
import { axeViolations } from './support/axe';
import { issuesBadge, openExplore, searchBox, suggestions } from './support/explore-page';

// PLAN 11.2 and QUERY_LANGUAGE §8: the text of the search field is drawn twice. The field is transparent and keeps the typing, the
// caret and the selection; under it a coloured copy of the text (the mirror, `aria-hidden`) shows each kind of piece in its colour,
// a line under what is wrong, and the rest of the suggestion Tab takes in grey. The copy has to line up with the field letter by
// letter, in each engine, scrolled or not.

const mirror = (page: Page) => page.locator('.query .mirror');
const pieces = (page: Page) => mirror(page).locator('[data-kind]');
const piecesOf = (page: Page, kind: string) => mirror(page).locator(`[data-kind="${kind}"]`);
const markedAs = (page: Page, severity: 'error' | 'warning') => mirror(page).locator(`[data-severity="${severity}"]`);

/** The kind and the text of each piece the mirror draws, in order. */
const drawn = (page: Page): Promise<[string | null, string | null][]> =>
  pieces(page).evaluateAll((elements) =>
    elements.map((element) => [element.getAttribute('data-kind'), element.textContent]),
  );

/** How far the field has scrolled its text, and how far the mirror has moved its copy. */
const fieldScroll = (page: Page): Promise<number> =>
  searchBox(page).evaluate((field: HTMLInputElement) => field.scrollLeft);
const mirrorShift = (page: Page): Promise<number> =>
  mirror(page)
    .locator('.track')
    .evaluate((track) => 0 - new DOMMatrixReadOnly(getComputedStyle(track).transform).m41);

/**
 * A query with every kind of piece, long enough to run past the end of the field on a phone. It ends in a blank, so that no term is
 * being typed (a suggestion would put its grey rest after the text) and the blank at the end has to be drawn too.
 */
const LONG =
  '(weak OR snared) -class:life "two words" applies:vulnerable uses:attack/self (stack:no OR mat:yes) -creature:wolf NOT family:clutcher trait:"dire wolf" kw:poison ';

test.describe('the mirror under the search field', () => {
  test('colours each kind of piece of the query', async ({ page }) => {
    await openExplore(page);

    await searchBox(page).fill('(weak OR snared) -class:life "two words"');

    expect(await drawn(page)).toEqual([
      ['paren', '('],
      ['text', 'weak'],
      ['blank', ' '],
      ['operator', 'OR'],
      ['blank', ' '],
      ['text', 'snared'],
      ['paren', ')'],
      ['blank', ' '],
      ['negation', '-'],
      ['field', 'class:'],
      ['value', 'life'],
      ['blank', ' '],
      ['phrase', '"two words"'],
    ]);
    const colours = await Promise.all(
      ['field', 'operator', 'paren', 'negation', 'phrase', 'text'].map((kind) =>
        piecesOf(page, kind)
          .first()
          .evaluate((piece) => getComputedStyle(piece).color),
      ),
    );
    // Six kinds, six colours (a value and a word share one, so it is not among them).
    expect(new Set(colours).size).toBe(colours.length);
  });

  test('is a copy of the text and nothing else: the field turns transparent, the copy is hidden from a screen reader', async ({
    page,
  }) => {
    await openExplore(page);

    await searchBox(page).fill(LONG);

    await expect(mirror(page)).toHaveAttribute('aria-hidden', 'true');
    // No character that the field has not got, and none left out: a stray blank would move every piece after it.
    expect(await mirror(page).evaluate((element) => element.textContent)).toBe(LONG);
    const transparent = await searchBox(page).evaluate((field) => getComputedStyle(field).color);
    expect(transparent).toBe('rgba(0, 0, 0, 0)');
  });

  test('draws nothing for an empty field, which shows its placeholder', async ({ page }) => {
    await openExplore(page);
    await expect(searchBox(page)).toHaveValue('');

    await expect(pieces(page)).toHaveCount(0);
    await expect(searchBox(page)).toHaveAttribute('placeholder', /\w/);
  });

  test('keeps a line break out of the copy, as the field does', async ({ page }) => {
    // A text field drops the line break of the value it is given: this is a query of two words, and the field shows one.
    await openExplore(page, './?q=weak%0Aweak');
    await expect(searchBox(page)).toHaveValue('weakweak');

    expect(await mirror(page).evaluate((element) => element.textContent)).toBe('weakweak');
    const lines = await mirror(page).evaluate((element) => element.getClientRects().length);
    expect(lines).toBe(1);
  });

  test.describe('marks what is wrong', () => {
    test('with a wavy line under an error, under the text at fault and no more', async ({ page }) => {
      await openExplore(page);

      await searchBox(page).fill('clas:life (weak OR snared');

      // The letters of the unknown field, not the colon after them, and the parenthesis that is never closed.
      await expect(markedAs(page, 'error')).toHaveText(['clas', '(']);
      await expect(markedAs(page, 'warning')).toHaveCount(0);
      const line = await markedAs(page, 'error')
        .first()
        .evaluate((piece) => {
          const { textDecorationLine, textDecorationStyle } = getComputedStyle(piece);
          return { line: textDecorationLine, style: textDecorationStyle };
        });
      expect(line).toEqual({ line: 'underline', style: 'wavy' });
      // The line is never the only sign: the badge says it in words.
      await expect(issuesBadge(page)).toHaveText('2 issues');
    });

    test('with a dotted line under a warning, which differs from an error by more than its colour', async ({
      page,
    }) => {
      await openExplore(page);

      // A family that nobody has is a warning (D21); it is settled because the caret is in the word after it.
      await searchBox(page).fill('family:zzzzzzz weak');

      await expect(markedAs(page, 'warning')).toHaveText(['zzzzzzz']);
      await expect(markedAs(page, 'error')).toHaveCount(0);
      const style = await markedAs(page, 'warning')
        .first()
        .evaluate((piece) => getComputedStyle(piece).textDecorationStyle);
      expect(style).toBe('dotted');
      await expect(issuesBadge(page)).toHaveText('1 issue');
    });

    test('takes the line away when the fix is made', async ({ page }) => {
      await openExplore(page);
      await searchBox(page).fill('clas:life');
      await expect(markedAs(page, 'error')).toHaveText(['clas']);

      await page.getByRole('button', { name: 'Change to “class:”' }).click();

      await expect(searchBox(page)).toHaveValue('class:life');
      await expect(markedAs(page, 'error')).toHaveCount(0);
    });
  });

  test.describe('shows the rest of the suggestion that Tab takes, in grey after the text', () => {
    test('while the list has an active option', async ({ page }) => {
      await openExplore(page);

      await searchBox(page).pressSequentially('applies:vul');

      await expect(suggestions(page).first()).toHaveAttribute('aria-selected', 'true');
      await expect(piecesOf(page, 'ghost')).toHaveText('nerable');
      // It is drawn after the text and is no part of it: the copy of the field is still the field's text, then the grey.
      await expect(mirror(page)).toHaveText('applies:vulnerable');
      expect(await searchBox(page).inputValue()).toBe('applies:vul');

      await page.keyboard.press('Tab');

      await expect(searchBox(page)).toHaveValue('applies:vulnerable ');
      await expect(piecesOf(page, 'ghost')).toHaveCount(0);
    });

    test('and puts it away with the list', async ({ page }) => {
      await openExplore(page);
      await searchBox(page).pressSequentially('applies:vul');
      await expect(piecesOf(page, 'ghost')).toHaveText('nerable');

      await page.keyboard.press('Escape');

      await expect(piecesOf(page, 'ghost')).toHaveCount(0);
    });

    test('and shows none for a suggestion that is another word than the one typed', async ({ page }) => {
      await openExplore(page);

      // The top suggestion for `we` is `applies:weak`, which does not go on from what was typed.
      await searchBox(page).pressSequentially('we');

      await expect(suggestions(page).first()).toBeVisible();
      await expect(piecesOf(page, 'ghost')).toHaveCount(0);
    });
  });

  test.describe('lines up with the field, letter by letter', () => {
    test('follows the scroll of a text longer than the field', async ({ page }) => {
      await openExplore(page);

      await searchBox(page).fill(LONG);

      // The caret is at the end, so the field has scrolled to show it.
      await expect.poll(() => fieldScroll(page)).toBeGreaterThan(0);
      await expect.poll(() => mirrorShift(page)).toBe(await fieldScroll(page));

      await searchBox(page).press('Home');
      await expect.poll(() => fieldScroll(page)).toBe(0);
      await expect.poll(() => mirrorShift(page)).toBe(0);

      await searchBox(page).press('End');
      await expect.poll(() => fieldScroll(page)).toBeGreaterThan(0);
      await expect.poll(() => mirrorShift(page)).toBe(await fieldScroll(page));
    });

    /**
     * What the field paints, as the pixels of its box: with the field transparent and every piece of the copy in white, and then with
     * the copy put away and the field's own text in white. The two must be the same picture, which they are only if the copy is where
     * the field's text is, in every engine.
     */
    async function pictures(page: Page): Promise<{ readonly copy: string; readonly field: string }> {
      const box: Locator = page.locator('.query .editor');
      await page.addStyleTag({
        content: `
          .query .mirror [data-kind] { color: white !important; text-decoration: none !important; }
          .query input { caret-color: transparent !important; }
        `,
      });
      const copy = (await box.screenshot()).toString('base64');
      await page.addStyleTag({
        content: `
          .query .mirror { visibility: hidden !important; }
          .query input.mirrored { color: white !important; }
        `,
      });
      const field = (await box.screenshot()).toString('base64');
      return { copy, field };
    }

    /**
     * How many pixels carry ink in the picture of the copy (`ink`), and by how many pixels, across and down, the picture of the field
     * has to be moved to be most like it (`shift`, in the pixels of the screen, and `scale` of them to a CSS pixel): none when the
     * two are where they should be. The edges of the letters are not the same in the two (the copy is moved by a transform, which
     * rasterises it in grey, and each of its pieces starts at a pixel of its own), so no two pictures are pixel for pixel alike, but
     * a letter or a line off is a different best shift.
     */
    const offsetBetween = (
      page: Page,
      pair: { copy: string; field: string },
    ): Promise<{ ink: number; shift: [number, number]; scale: number }> =>
      page.evaluate(async ({ copy, field }) => {
        const REACH = 3;
        const INK = 100;
        const light = async (base64: string): Promise<{ width: number; height: number; pixels: number[] }> => {
          const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const context = canvas.getContext('2d');
          if (context === null) throw new Error('no canvas');
          context.drawImage(bitmap, 0, 0);
          const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
          const pixels = Array.from({ length: data.length / 4 }, (_, at) =>
            Math.max(data[at * 4] ?? 0, data[at * 4 + 1] ?? 0, data[at * 4 + 2] ?? 0),
          );
          return { width: bitmap.width, height: bitmap.height, pixels };
        };
        const [a, b] = [await light(copy), await light(field)];
        if (a.width !== b.width || a.height !== b.height) throw new Error('the two pictures are not the same size');
        const { width, height } = a;

        /** How unlike the two are with the field's picture moved by `dx` across and `dy` down, over what both have in view. */
        const error = (dx: number, dy: number): number => {
          let sum = 0;
          for (let y = REACH; y < height - REACH; y++) {
            for (let x = REACH; x < width - REACH; x++) {
              sum += Math.abs((a.pixels[y * width + x] ?? 0) - (b.pixels[(y + dy) * width + x + dx] ?? 0));
            }
          }
          return sum;
        };

        // Not moving is tried first and wins a tie.
        let shift: [number, number] = [0, 0];
        let least = error(0, 0);
        for (let dy = -REACH; dy <= REACH; dy++) {
          for (let dx = -REACH; dx <= REACH; dx++) {
            const unlike = error(dx, dy);
            if (unlike < least) {
              least = unlike;
              shift = [dx, dy];
            }
          }
        }
        return { ink: a.pixels.filter((pixel) => pixel > INK).length, shift, scale: window.devicePixelRatio };
      }, pair);

    for (const [name, text, key] of [
      ['a short query', '(weak OR snared) -class:life', undefined],
      ['a long query, scrolled to its end', LONG, undefined],
      ['a long query, scrolled back to its start', LONG, 'Home'],
    ] as const) {
      test(`paints the same picture as the field does: ${name}`, async ({ page }) => {
        await openExplore(page);
        await searchBox(page).fill(text);
        if (key !== undefined) await searchBox(page).press(key);
        await expect.poll(() => mirrorShift(page)).toBe(await fieldScroll(page));

        const { ink, shift, scale } = await offsetBetween(page, await pictures(page));

        expect(ink).toBeGreaterThan(0);
        // Not a letter or a line off: at most half a CSS pixel either way. One pixel of a phone's screen is a third of one, and the field
        // and the copy round their position to the screen on their own (the runner of CI found the copy one pixel down on a Pixel 7,
        // where a PC found it one across), while a screen of 1× has no pixel to spare, so the tolerance is nothing there.
        expect(Math.abs(shift[0]) / scale).toBeLessThanOrEqual(0.5);
        expect(Math.abs(shift[1]) / scale).toBeLessThanOrEqual(0.5);
      });
    }
  });

  test('gives way to the field itself in a high-contrast mode', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Forced colours can be emulated in Chromium only.');
    await openExplore(page);
    await searchBox(page).fill('weak');
    await expect(mirror(page)).toBeVisible();

    await page.emulateMedia({ forcedColors: 'active' });

    await expect(mirror(page)).toBeHidden();
    const colour = await searchBox(page).evaluate((field) => getComputedStyle(field).color);
    expect(colour).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('is no hindrance to a screen reader or to axe', async ({ page }) => {
    await openExplore(page);

    await searchBox(page).fill('clas:life (weak OR snared) "two words"');
    await expect(markedAs(page, 'error').first()).toBeVisible();

    expect(await axeViolations(page)).toEqual([]);
  });
});
