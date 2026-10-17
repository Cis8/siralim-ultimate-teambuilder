import { fileURLToPath } from 'node:url';
import { formatVerdicts, judge } from './budgets';
import { measureBuild } from './measure-build';

// `pnpm size-budget [build directory]`: fails when the site `pnpm build` made weighs more than SPEC § Performance allows.
const buildDir = process.argv[2] ?? fileURLToPath(new URL('../../apps/web/build', import.meta.url));

try {
  const verdicts = judge(await measureBuild(buildDir));
  console.log(formatVerdicts(verdicts));
  if (verdicts.some((verdict) => !verdict.within)) process.exitCode = 1;
} catch (failure) {
  console.error(failure instanceof Error ? failure.message : failure);
  process.exitCode = 1;
}
