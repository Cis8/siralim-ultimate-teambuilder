<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import type { TraitId } from '@atlas/core';
  import { copy } from '../copy';

  /**
   * The traits the person has centred on, oldest first, the last of them being the one in focus: a way back to any of them
   * (DESIGN § Synergy pages). The steps before the last are links; the last is the page the person is on, which `aria-current`
   * says. A trail of one step is not shown: it has nothing to go back to.
   */
  const {
    steps,
    hrefOf,
  }: { steps: readonly { readonly id: TraitId; readonly name: string }[]; hrefOf: (id: TraitId) => ResolvedPathname } =
    $props();

  let trail = $state<HTMLElement>();

  // Under 700 px the steps are a row of pills that scrolls sideways, and the last of them, where the person is, is the one to see.
  $effect(() => {
    // `bind:this` hands back null, not undefined, once the nav is gone (a trail of one step has none).
    if (trail instanceof HTMLElement && steps.length > 0) trail.scrollLeft = trail.scrollWidth;
  });
</script>

{#if steps.length > 1}
  <nav aria-label={copy.trailLabel} bind:this={trail}>
    <span class="caption" aria-hidden="true">{copy.trailCaption}</span>
    <ol>
      {#each steps as step, index (step.id)}
        <li>
          {#if index > 0}
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
              <path
                d="M6 3l5 5-5 5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          {/if}
          {#if index === steps.length - 1}
            <span class="here" aria-current="location">{step.name}</span>
          {:else}
            <a href={hrefOf(step.id)} aria-label={copy.recentre(step.name)}>{step.name}</a>
          {/if}
        </li>
      {/each}
    </ol>
  </nav>
{/if}

<style>
  nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
  }

  .caption {
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-faint);
  }

  a,
  .here {
    padding: 4px 2px;
    font-size: 13px;
  }

  a {
    color: var(--text-muted);
    text-decoration: none;
  }

  a:hover {
    color: var(--text-strong);
    text-decoration: underline;
  }

  .here {
    color: var(--text-strong);
    font-weight: 500;
  }

  @media (pointer: coarse) {
    a {
      display: inline-flex;
      align-items: center;
      min-width: var(--target-min);
      min-height: var(--target-min);
    }
  }

  /*
   * A phone: one row that scrolls sideways, each step a pill the size of a finger (the page scrolls up and down, and this is the one
   * thing that scrolls the other way). The chevrons and the caption have no room to spare; the name of the nav says what it is.
   */
  @media (width < 700px) {
    nav {
      flex-wrap: nowrap;
      margin-inline: -16px;
      padding-inline: 16px;
      overflow-x: auto;
      scrollbar-width: thin;
    }

    .caption,
    svg {
      display: none;
    }

    ol {
      flex-wrap: nowrap;
      gap: 8px;
    }

    li {
      flex: none;
    }

    a,
    .here {
      display: inline-flex;
      align-items: center;
      min-height: var(--target-min);
      padding: 0 16px;
      border: 1px solid var(--border-strong);
      border-radius: 22px;
      background: var(--surface-2);
      font-size: 13.5px;
      white-space: nowrap;
    }

    .here {
      border-color: var(--accent-border);
      background: var(--accent-surface);
    }

    a:hover {
      text-decoration: none;
    }
  }
</style>
