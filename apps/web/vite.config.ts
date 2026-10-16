import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

type BasePath = '' | `/${string}`;

function isRootRelative(value: string): value is `/${string}` {
  return value.startsWith('/') && !value.endsWith('/');
}

/** GitHub Pages serves the app from `/<repo>`; CI passes it as BASE_PATH. Local dev uses the root. */
function basePath(value: string | undefined): BasePath {
  if (value === undefined || value === '') return '';
  if (!isRootRelative(value)) throw new Error(`BASE_PATH must start with "/" and not end with "/", got "${value}"`);
  return value;
}

export default defineConfig({
  plugins: [
    sveltekit({
      // 404.html doubles as the SPA fallback for deep links on GitHub Pages (ADR-0001).
      adapter: adapter({ fallback: '404.html' }),
      paths: { base: basePath(process.env.BASE_PATH) },
    }),
  ],
  ssr: {
    // SvelteKit 3 leaves its `cookie` dependency external in the prerender bundle, where pnpm's strict
    // node_modules layout cannot resolve it from apps/web. Bundling it keeps the build hermetic.
    noExternal: ['cookie'],
  },
});
