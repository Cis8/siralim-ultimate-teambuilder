# ADR-0002 — TypeScript + Vite; Svelte 5 (SvelteKit static) for the UI

- Status: Accepted (owner, 2026-10-16)
- Date: 2026-10-16

## Context
The app is data-heavy, must be fast on phones and is built mostly by Claude Code with one maintainer. The domain logic
lives in a framework-free package (ADR-0003), so the UI framework is replaceable.

## Options
| Option | For | Against |
|---|---|---|
| **Svelte 5 + SvelteKit (`adapter-static`)** | Small bundles, fine-grained reactivity, prerendering, file routing | Smaller ecosystem |
| React 19 + Vite + React Router | Largest ecosystem, most familiar | Larger runtime; virtualised lists and memoisation need more care |
| Preact + signals | Tiny, React-like API | Fewer accessible component libraries |

## Decision
TypeScript strict everywhere, Vite tooling, **Svelte 5 with SvelteKit `adapter-static`**: the runtime leaves most of the
150 KB JS budget to the app, and runes keep per-keystroke recounts cheap.

Versions at adoption: Node 24 LTS, pnpm 12, SvelteKit 3, Vite 8, Vitest 5, **TypeScript 6.0** (TypeScript 7 is not yet
supported by typescript-eslint and svelte-check; upgrade when it is).

## Consequences
- UI components stay thin; any logic worth testing moves to `core`.
- Accessible primitives (dialog, tabs) are built in-house following ARIA APG; whether to use a headless library
  (Bits UI) for the combobox is decided in Phase 2.
- SvelteKit 3 specifics: configuration lives in `apps/web/vite.config.ts` (`sveltekit({...})`), the app tsconfig extends
  `$app/tsconfig`, and `$lib` is replaced by package.json subpath imports (`#lib/*`).
