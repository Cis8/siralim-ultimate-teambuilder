import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// GitHub Pages answers an address it has no file for with 404.html (ADR-0001), and the page of a trait or a keyword is such an
// address (ADR-0011): `/<repo>/synergy/<id>` has no file. The page boots from there at any depth of the path, so every file it
// names must be an address from the root of the site, under the base path. The preview server of the other tests renders these
// routes itself and never serves this file: it is read as the build wrote it.

const base = process.env.BASE_PATH ?? '';

test.describe('404.html, the page a deep link boots from', () => {
  test('names every file of the app from the root of the site, under the base path', async () => {
    const html = await readFile('build/404.html', 'utf8');

    const files = [...html.matchAll(/["'(]([^"'()\s]*_app\/[^"'()\s]*)/gu)].map(([, file]) => file ?? '');

    // The scripts, the stylesheet, the fonts: none is read from where the page happens to be.
    expect(files.length).toBeGreaterThan(10);
    expect(files.filter((file) => !file.startsWith(`${base}/_app/`))).toEqual([]);
    expect(html).toContain(`href="${base}/favicon.svg"`);
    expect(html).toContain(`base: "${base}"`);
  });

  test('has no address relative to the page, which would point somewhere else a level down', async () => {
    const html = await readFile('build/404.html', 'utf8');

    expect(html).not.toMatch(/(?:href|src)="\.{1,2}\//u);
    expect(html).not.toMatch(/import\("\.{1,2}\//u);
  });
});
