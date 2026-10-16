import type { Trait } from '@atlas/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRealSheet } from '../testing/real-build';

// What the extractor reads from the compendium, one line per mention. The files are committed, so any change to the
// taxonomy, the heuristics or `overrides.yaml` shows up as a diff of lines to read and approve. After an intended
// change, update them with `pnpm exec vitest run -u` and review the diff (docs/SPEC.md §4, ADR-0006).

describe('what is extracted from the compendium v2.0', () => {
  let traits: readonly Trait[];
  beforeAll(async () => {
    ({ traits } = await buildRealSheet());
  });

  it('keywords: trait | key | role', async () => {
    const lines = traits.flatMap((trait) =>
      trait.keywords.map((hit) => `${trait.id} | ${hit.key} | ${hit.role ?? '-'}`),
    );
    await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot('../../snapshots/keywords-v2.0.txt');
  });

  it('random debuffs: trait | target | activation | note', async () => {
    const lines = traits.flatMap((trait) =>
      trait.randomDebuff === null
        ? []
        : [
            [trait.id, trait.randomDebuff.target, trait.randomDebuff.activation, trait.randomDebuff.note ?? '-'].join(
              ' | ',
            ),
          ],
    );
    await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot('../../snapshots/random-debuffs-v2.0.txt');
  });
});
