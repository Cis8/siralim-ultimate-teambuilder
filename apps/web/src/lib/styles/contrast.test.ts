import { describe, expect, it } from 'vitest';
import markedText from '../components/marked-text.svelte?raw';
import tokensCss from './tokens.css?raw';

// DESIGN § Accessibility asks for 4.5:1 for text and 3:1 for the lines that show a state or frame a field (WCAG 1.4.3,
// 1.4.11). axe checks the colours of the page it is shown, in the states a test reaches; this checks the palette itself, on
// every surface a colour can sit on, so that a token changed in `tokens.css` cannot fail a state nobody opened.

type Rgb = readonly [number, number, number];

const TEXT_CONTRAST = 4.5;
const UI_CONTRAST = 3;

const channel = (hex: string, at: number): number => parseInt(hex.slice(at, at + 2), 16) / 255;
const fromHex = (hex: string): Rgb => [channel(hex, 0), channel(hex, 2), channel(hex, 4)];

/** The custom properties of `tokens.css` that are a plain `#rrggbb`, and those that are another one (`--a: var(--b);`). */
const palette = new Map<string, Rgb>(
  Array.from(tokensCss.matchAll(/--([a-z0-9-]+):\s*#([0-9a-f]{6})\b/g), ([, name, hex]): [string, Rgb] => {
    if (name === undefined || hex === undefined) throw new Error('a token matched without its parts');
    return [name, fromHex(hex)];
  }),
);
for (const [, name, of] of tokensCss.matchAll(/--([a-z0-9-]+):\s*var\(--([a-z0-9-]+)\);/g)) {
  const colour = of === undefined ? undefined : palette.get(of);
  if (name === undefined || colour === undefined) throw new Error(`${name ?? 'a token'} is an alias of no colour`);
  palette.set(name, colour);
}

function token(name: string): Rgb {
  const colour = palette.get(name);
  if (colour === undefined) throw new Error(`tokens.css has no colour --${name}`);
  return colour;
}

/** WCAG 2 relative luminance of an sRGB colour. */
function luminance([red, green, blue]: Rgb): number {
  const linear = (channel: number): number =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function contrast(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  if (lighter === undefined || darker === undefined) throw new Error('two colours always have a luminance');
  return (lighter + 0.05) / (darker + 0.05);
}

/** `top` laid over `under` at `alpha`, as the browser mixes them in sRGB. */
function over(top: Rgb, under: Rgb, alpha: number): Rgb {
  const mix = (at: 0 | 1 | 2): number => top[at] * alpha + under[at] * (1 - alpha);
  return [mix(0), mix(1), mix(2)];
}

/** Every background a line of text is drawn on. */
const SURFACES = ['bg', 'bg-bar', 'surface-1', 'surface-2', 'surface-3', 'accent-surface'] as const;

/** Every colour text is drawn in. */
const TEXT = [
  'text',
  'text-strong',
  'text-muted',
  'text-faint',
  'accent',
  'status-good',
  'status-warn',
  'status-crit',
  'kw-debuff',
  'kw-buff',
  'kw-mechanic',
  'kw-event',
] as const;

/** Where the match highlight is drawn: in the description of a result, which sits on the page, and in what that holds. */
const HIGHLIGHT_ON = 'bg';
const IN_A_DESCRIPTION = ['text', 'text-muted', 'kw-debuff', 'kw-buff', 'kw-mechanic', 'kw-event'] as const;

/** The highlight as `marked-text.svelte` draws it: a share of one token over what is behind. */
function highlight(): { readonly colour: Rgb; readonly share: number } {
  const match = /color-mix\(in srgb, var\(--([a-z-]+)\) (\d+)%, transparent\)/.exec(markedText);
  const [, name, percent] = match ?? [];
  if (name === undefined || percent === undefined) throw new Error('marked-text.svelte no longer mixes its highlight');
  return { colour: token(name), share: Number(percent) / 100 };
}

describe('the contrast maths', () => {
  it('is 21:1 for black on white and 1:1 for a colour on itself', () => {
    expect(contrast([0, 0, 0], [1, 1, 1])).toBeCloseTo(21, 5);
    expect(contrast(token('text'), token('text'))).toBe(1);
  });

  it('does not depend on which colour comes first', () => {
    expect(contrast(token('text'), token('bg'))).toBe(contrast(token('bg'), token('text')));
  });

  it('reads the palette it is meant to check', () => {
    for (const name of [...SURFACES, ...TEXT, 'accent-border']) expect(palette.has(name), name).toBe(true);
  });
});

describe('the colours of text', () => {
  const pairs = TEXT.flatMap((text) => SURFACES.map((surface) => [text, surface] as const));

  it.each(pairs)('%s is at least 4.5:1 on %s', (text, surface) => {
    expect(contrast(token(text), token(surface))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it('keeps the text of a description at 4.5:1 under a match highlight', () => {
    const { colour, share } = highlight();
    const behind = over(colour, token(HIGHLIGHT_ON), share);

    for (const text of IN_A_DESCRIPTION) {
      expect(contrast(token(text), behind), `${text} under the highlight on ${HIGHLIGHT_ON}`).toBeGreaterThanOrEqual(
        TEXT_CONTRAST,
      );
    }
  });
});

describe('the colours of the issues of a query', () => {
  // A row of the list sits on a surface of its own, and says its severity in a status colour (beside an icon and a word). The
  // border is a frame that carries nothing the icon and the word do not say, so it is not held to 3:1.
  const rows = [
    { surface: 'issue-error-surface', severity: 'status-crit' },
    { surface: 'issue-warn-surface', severity: 'status-warn' },
  ] as const;
  const pairs = rows.flatMap(({ surface, severity }) => [['text', surface] as const, [severity, surface] as const]);

  it.each(pairs)('%s is at least 4.5:1 on %s', (text, surface) => {
    expect(contrast(token(text), token(surface))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it('reads the surfaces it is meant to check', () => {
    for (const { surface } of rows) expect(palette.has(surface), surface).toBe(true);
  });
});

describe('the colours of a query in the search field', () => {
  // The mirror draws the text of the field on the surface of the field, in a colour for each kind of piece; the rest of a suggestion
  // is grey after it, and a line under the text at fault says its severity beside the badge. A selection is a share of --accent over
  // the field with the coloured text still showing through it (the ghost text is never selected: it is there only for a caret).
  const ON = 'surface-1';
  const PIECES = [
    'syntax-field',
    'syntax-value',
    'syntax-text',
    'syntax-phrase',
    'syntax-operator',
    'syntax-paren',
    'syntax-negation',
  ] as const;
  const UNDERLINES = ['underline-error', 'underline-warning'] as const;

  /** The selection as `tokens.css` writes it: a share of one token over what is behind. */
  function selection(): { readonly colour: Rgb; readonly share: number } {
    const match = /--field-selection:\s*color-mix\(in srgb, var\(--([a-z-]+)\) (\d+)%, transparent\)/.exec(tokensCss);
    const [, name, percent] = match ?? [];
    if (name === undefined || percent === undefined) throw new Error('tokens.css no longer mixes the field selection');
    return { colour: token(name), share: Number(percent) / 100 };
  }

  it.each([...PIECES, 'syntax-ghost'] as const)('%s is at least 4.5:1 on the field', (text) => {
    expect(contrast(token(text), token(ON))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it.each(PIECES)('%s is at least 4.5:1 under the selection of the field', (text) => {
    const { colour, share } = selection();
    expect(contrast(token(text), over(colour, token(ON), share))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it.each(UNDERLINES)('%s is at least 3:1 on the field', (line) => {
    expect(contrast(token(line), token(ON))).toBeGreaterThanOrEqual(UI_CONTRAST);
  });
});

describe('the colours of a query in the search sheet of a phone', () => {
  // The field of the sheet is on --surface-2, a little lighter than the field of the page, and the buttons of the toolbar under it are on
  // --surface-3 with the colour of an operator or of a field on their face.
  const FIELD = 'surface-2';
  const BUTTON = 'surface-3';
  const PIECES = [
    'syntax-field',
    'syntax-value',
    'syntax-text',
    'syntax-phrase',
    'syntax-operator',
    'syntax-paren',
    'syntax-negation',
    'syntax-ghost',
  ] as const;

  it.each(PIECES)('%s is at least 4.5:1 on the field of the sheet', (text) => {
    expect(contrast(token(text), token(FIELD))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it.each(['underline-error', 'underline-warning'] as const)('%s is at least 3:1 on the field of the sheet', (line) => {
    expect(contrast(token(line), token(FIELD))).toBeGreaterThanOrEqual(UI_CONTRAST);
  });

  it.each(['syntax-operator', 'syntax-field', 'text-strong'] as const)(
    '%s is at least 4.5:1 on a button of the toolbar',
    (text) => {
      expect(contrast(token(text), token(BUTTON))).toBeGreaterThanOrEqual(TEXT_CONTRAST);
    },
  );
});

describe('the lines that show a state or frame a field', () => {
  // The focus ring is `--accent`; a pressed control and the frame of the search field are outlined in `--accent-border`.
  // `--border` and `--border-strong` are dividers and the frame of buttons that name themselves in words: not required.
  const lines = ['accent', 'accent-border'] as const;
  const pairs = lines.flatMap((line) => SURFACES.map((surface) => [line, surface] as const));

  it.each(pairs)('%s is at least 3:1 on %s', (line, surface) => {
    expect(contrast(token(line), token(surface))).toBeGreaterThanOrEqual(UI_CONTRAST);
  });
});
