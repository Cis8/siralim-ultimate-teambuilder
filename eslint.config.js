// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { boundaries } from './tools/eslint/boundaries.js';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/',
      '**/build/',
      '**/.svelte-kit/',
      '**/.cache/',
      '**/coverage/',
      '**/test-results/',
      '**/playwright-report/',
      'docs/prototype/',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-restricted-syntax': [
        'error',
        { selector: 'ExportDefaultDeclaration', message: 'Use named exports (CLAUDE.md conventions).' },
      ],
    },
  },
  {
    // Plain JS (tool configs) is not part of any TS project, so type-aware rules are off there.
    files: ['**/*.js', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // Tool configuration files must use default exports.
    files: ['*.config.{js,ts}', 'apps/web/*.config.{js,ts}', 'tools/**/*.js', '.dependency-cruiser.cjs'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  boundaries,
);
