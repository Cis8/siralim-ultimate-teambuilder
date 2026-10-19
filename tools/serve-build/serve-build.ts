import { fileURLToPath } from 'node:url';
import { createBuildServer } from './build-server';

// `tsx serve-build.ts [build directory] [port]`: serves the site `pnpm build` made the way GitHub Pages does (see build-server.ts).
// Lighthouse CI starts it (apps/web/lighthouserc.cjs) and waits for the line below.
const buildDir = process.argv[2] ?? fileURLToPath(new URL('../../apps/web/build', import.meta.url));
const port = Number(process.argv[3] ?? 4174);

createBuildServer(buildDir).listen(port, () => {
  console.log(`Serving ${buildDir} at http://localhost:${String(port)}`);
});
