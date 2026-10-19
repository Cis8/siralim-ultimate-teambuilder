<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import { taxonomy, type KeywordKey, type KeywordStats } from '@atlas/core';
  import { copy } from '../copy';
  import { chipCounts } from '../keyword-summary';
  import CountMark from './count-mark.svelte';

  /**
   * The keywords that traits give and rely on, as links to their pages, a group for each kind of them. The page that shows it
   * names the list (a heading above); `current` is the keyword whose page this is, if any. With `stats` each link also says how many
   * traits apply the keyword and how many rely on it: two numbers with an arrow each, which are spoken as words.
   */
  const {
    keys,
    current,
    hrefOf,
    stats,
  }: {
    keys: readonly KeywordKey[];
    current?: KeywordKey | undefined;
    hrefOf: (key: KeywordKey) => ResolvedPathname;
    stats?: ReadonlyMap<KeywordKey, KeywordStats> | undefined;
  } = $props();

  const KINDS = ['debuff', 'buff', 'effect'] as const;

  const groups = $derived(
    KINDS.map((kind) => ({
      kind,
      entries: keys.flatMap((key) => {
        const entry = taxonomy.get(key);
        return entry?.kind === kind ? [{ key, label: entry.label }] : [];
      }),
    })).filter(({ entries }) => entries.length > 0),
  );
</script>

{#if stats !== undefined}
  <!-- For the eye: a screen reader is told the numbers in words, link by link. -->
  <p class="legend" aria-hidden="true">
    <span><CountMark side="applies" /> {copy.chipLegend.applies}</span>
    <span><CountMark side="uses" /> {copy.chipLegend.uses}</span>
  </p>
{/if}

{#each groups as { kind, entries } (kind)}
  <section class="group" data-kind={kind}>
    <h3>{copy.keywordGroups[kind]}</h3>
    <ul>
      {#each entries as { key, label } (key)}
        {@const counts = stats?.get(key)}
        <li>
          <a href={hrefOf(key)} aria-current={key === current ? 'page' : undefined}>
            {label}
            {#if counts !== undefined}
              <span class="visually-hidden">, {chipCounts(counts)}</span>
              <span class="counts" aria-hidden="true">
                <span><CountMark side="applies" />{counts.appliers}</span>
                <span><CountMark side="uses" />{counts.users}</span>
              </span>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  </section>
{/each}

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  h3 {
    margin: 0;
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 0;
    color: var(--text-muted);
    font-size: 12px;
  }

  .legend span,
  .counts span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .counts {
    display: inline-flex;
    gap: 8px;
    margin-left: 8px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 400;
  }

  a {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    padding: 0 12px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-2);
    color: var(--kw-mechanic);
    text-decoration: none;
  }

  [data-kind='debuff'] a {
    color: var(--kw-debuff);
  }

  [data-kind='buff'] a {
    color: var(--kw-buff);
  }

  a:hover {
    background: var(--surface-3);
  }

  /* The page the person is on has a ring and a fill: the colour of the name is the kind's. */
  a[aria-current='page'] {
    border-color: var(--accent-border);
    background: var(--accent-surface);
    font-weight: 600;
  }

  @media (pointer: coarse) {
    a {
      min-height: var(--target-min);
    }
  }
</style>
