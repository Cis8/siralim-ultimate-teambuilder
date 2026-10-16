import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { boundaries } from './eslint/boundaries.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfigFile: true,
  overrideConfig: [{ files: ['**/*.ts'], languageOptions: { parser: tseslint.parser } }, ...boundaries],
});

async function violations(filePath: string, code: string): Promise<(string | null)[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result?.messages.map((message) => message.ruleId) ?? [];
}

const core = 'packages/core/src/fixture.ts';
const pipeline = 'packages/pipeline/src/fixture.ts';
const web = 'apps/web/src/lib/fixture.ts';

describe('package boundaries (ADR-0003)', () => {
  it.each([
    ['a node: built-in', "import { readFileSync } from 'node:fs';"],
    ['a bare Node built-in', "import path from 'path';"],
    ['svelte', "import { mount } from 'svelte';"],
    ['the web app', "import { x } from '@atlas/web';"],
    ['the pipeline', "import { x } from '@atlas/pipeline';"],
    ['the pipeline by relative path', "import { x } from '../../pipeline/src/index';"],
  ])('core cannot import %s', async (_label, code) => {
    expect(await violations(core, code)).toContain('no-restricted-imports');
  });

  it.each([
    ['window', 'export const w = window;'],
    ['fetch', "export const f = fetch('x');"],
    ['process', 'export const p = process.env;'],
  ])('core cannot use the %s global', async (_label, code) => {
    expect(await violations(core, code)).toContain('no-restricted-globals');
  });

  it('core cannot read the clock or the random source directly', async () => {
    expect(await violations(core, 'export const t = Date.now();')).toContain('no-restricted-properties');
    expect(await violations(core, 'export const r = Math.random();')).toContain('no-restricted-properties');
    expect(await violations(core, 'export const d = new Date();')).toContain('no-restricted-syntax');
  });

  it('core can import its own modules and parse explicit dates', async () => {
    expect(await violations(core, "import { a } from './a';\nexport const d = new Date(0);")).toEqual([]);
  });

  it('the pipeline can use Node and core, but not the web app or core internals', async () => {
    expect(
      await violations(pipeline, "import { readFileSync } from 'node:fs';\nimport { x } from '@atlas/core';"),
    ).toEqual([]);
    expect(await violations(pipeline, "import { x } from '@atlas/web';")).toContain('no-restricted-imports');
    expect(await violations(pipeline, "import { x } from '@atlas/core/src/model';")).toContain('no-restricted-imports');
  });

  it('the web app can use core, but not the pipeline, core internals or Node', async () => {
    expect(await violations(web, "import { x } from '@atlas/core';")).toEqual([]);
    expect(await violations(web, "import { x } from '@atlas/pipeline';")).toContain('no-restricted-imports');
    expect(await violations(web, "import { x } from '@atlas/core/src/model';")).toContain('no-restricted-imports');
    expect(await violations(web, "import { readFileSync } from 'node:fs';")).toContain('no-restricted-imports');
  });
});
