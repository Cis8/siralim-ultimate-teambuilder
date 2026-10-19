<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import type { KeywordStats } from '@atlas/core';
  import { copy } from '../copy';
  import { countsOf, otherSources, type TogetherEntry, type VerdictLine } from '../keyword-summary';
  import KeyPill from './key-pill.svelte';
  import VerdictIcon from './verdict-icon.svelte';

  /**
   * The head of the page of a keyword (DESIGN § Synergy pages): its name as a pill in the colour of its kind, with the kind in words,
   * how many traits apply it and how many rely on it, the verdict with its icon and its reason, and the keywords its appliers also
   * apply. The `h1` takes the focus when the page moves to another keyword, which the page does through `heading`.
   */
  let {
    label,
    kind,
    stats,
    verdict,
    together,
    heading = $bindable(),
  }: {
    label: string;
    kind: 'debuff' | 'buff' | 'effect';
    stats: KeywordStats;
    verdict: VerdictLine;
    together: readonly TogetherEntry<ResolvedPathname>[];
    heading?: HTMLHeadingElement | undefined;
  } = $props();

  const counts = $derived(countsOf(stats));
  const others = $derived(otherSources(stats));
</script>

<header class="summary">
  <div class="title">
    <h1 tabindex="-1" bind:this={heading}><KeyPill {kind} large>{label}</KeyPill></h1>
    <p class="kind">{copy.keywordKindName[kind]}</p>
  </div>

  <p class="counts">
    <span><strong>{counts.appliers.number}</strong> {counts.appliers.phrase}</span>
    <span aria-hidden="true">·</span>
    <span><strong>{counts.users.number}</strong> {counts.users.phrase}</span>
  </p>
  {#if others !== undefined}<p class="others">{others}</p>{/if}

  <p class="verdict" data-tone={verdict.tone}>
    <span class="icon"><VerdictIcon tone={verdict.tone} /></span>
    <span class="words"><strong>{verdict.title}</strong> <span class="detail">{verdict.detail}</span></span>
  </p>

  {#if together.length > 0}
    <div class="together">
      <p class="lead">{copy.oftenTogether}</p>
      <ul>
        {#each together as entry (entry.key)}
          <li data-kind={entry.kind}>
            <a href={entry.href}>{entry.label}</a>
            <span class="number" aria-hidden="true">{entry.count}</span>
            <span class="visually-hidden">{copy.togetherSpoken(entry.count)}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</header>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 18px;
    border: 1px solid var(--accent-border);
    border-radius: 12px;
    background: var(--surface-1);
  }

  .title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
  }

  h1 {
    display: flex;
  }

  p {
    margin: 0;
  }

  .kind {
    color: var(--text-muted);
    font-size: 13px;
  }

  .counts {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    color: var(--text);
    font-size: 14px;
  }

  .counts strong {
    color: var(--text-strong);
    font-weight: 600;
  }

  .others {
    color: var(--text-muted);
    font-size: 12.5px;
  }

  .verdict {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 13px;
  }

  .icon {
    display: inline-flex;
    flex: none;
    padding-top: 1px;
  }

  .detail {
    color: var(--text-muted);
  }

  .verdict[data-tone='good'] .icon,
  .verdict[data-tone='good'] strong {
    color: var(--status-good);
  }

  .verdict[data-tone='caution'] .icon,
  .verdict[data-tone='caution'] strong {
    color: var(--status-warn);
  }

  .verdict[data-tone='bad'] .icon,
  .verdict[data-tone='bad'] strong {
    color: var(--status-crit);
  }

  .together {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .lead {
    color: var(--text-faint);
    font-size: 12.5px;
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  a {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 10px;
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

  .number {
    margin-left: -2px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 12px;
  }

  @media (pointer: coarse) {
    a {
      min-height: var(--target-min);
    }
  }
</style>
