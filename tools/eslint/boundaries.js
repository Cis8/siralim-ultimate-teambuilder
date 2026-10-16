// @ts-check
// Package boundaries (ADR-0003). Kept in its own module so tools/boundaries.test.ts can verify the rules in isolation.
import { builtinModules } from 'node:module';

const nodeBuiltins = builtinModules.filter((name) => !name.startsWith('_'));

const forbidNodeBuiltins = (/** @type {string} */ message) => ({
  paths: nodeBuiltins.map((name) => ({ name, message })),
  patterns: [{ group: ['node:*'], message }],
});

/** @type {import('eslint').Linter.Config[]} */
export const boundaries = [
  {
    name: 'boundaries/core',
    files: ['packages/core/**/*.{ts,js}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: forbidNodeBuiltins('core is platform-free: no Node built-ins (ADR-0003).').paths,
          patterns: [
            ...forbidNodeBuiltins('core is platform-free: no Node built-ins (ADR-0003).').patterns,
            {
              group: ['svelte', 'svelte/*', '@sveltejs/*', '$app/*', '#lib', '#lib/*'],
              message: 'core is framework-free (ADR-0003).',
            },
            {
              group: [
                '@atlas/web',
                '@atlas/web/*',
                '@atlas/pipeline',
                '@atlas/pipeline/*',
                '**/apps/**',
                '**/pipeline/**',
              ],
              message: 'core must not depend on the pipeline or the web app (ADR-0003).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage', 'fetch'].map(
          (name) => ({ name, message: 'core has no DOM or network access; inject what you need (ADR-0003).' }),
        ),
        ...['process', 'Buffer', 'require', '__dirname', '__filename'].map((name) => ({
          name,
          message: 'core has no Node access (ADR-0003).',
        })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'core is pure: inject a clock.' },
        { object: 'Math', property: 'random', message: 'core is pure: inject a random source.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'core is pure: inject a clock.',
        },
      ],
    },
  },
  {
    name: 'boundaries/pipeline',
    files: ['packages/pipeline/**/*.{ts,js}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@atlas/web', '@atlas/web/*', '**/apps/**', 'svelte', 'svelte/*', '@sveltejs/*'],
              message: 'The pipeline must not depend on the web app.',
            },
            { group: ['@atlas/core/*'], message: 'Import core through its public entry point "@atlas/core".' },
          ],
        },
      ],
    },
  },
  {
    name: 'boundaries/web',
    files: ['apps/web/src/**/*.{ts,js,svelte}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: forbidNodeBuiltins('The web app runs in the browser: no Node built-ins.').paths,
          patterns: [
            ...forbidNodeBuiltins('The web app runs in the browser: no Node built-ins.').patterns,
            {
              group: ['@atlas/pipeline', '@atlas/pipeline/*', '**/packages/pipeline/**'],
              message: 'The web app reads the emitted dataset through a TraitRepository, never the pipeline.',
            },
            {
              group: ['@atlas/core/*', '**/packages/core/**'],
              message: 'Import core through its public entry point "@atlas/core".',
            },
          ],
        },
      ],
    },
  },
];
