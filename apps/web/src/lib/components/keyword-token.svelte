<script lang="ts">
  import { clickGoal, type KeywordHit } from '@atlas/core';
  import type { Snippet } from 'svelte';
  import { copy } from '../copy';

  /**
   * A keyword in a description, styled by its kind (colour) and its role (shape, so that nothing rests on colour alone,
   * DESIGN § Keyword tokens). It is a toggle button: a click puts the filter it stands for on or off (`pressed`), and its
   * name tells what the trait does with the keyword, which the shape cannot say to a screen reader, and what the click
   * shows. `text` is what the description says there: the name keeps it, as a voice command would say it.
   */
  const {
    keyword,
    text,
    pressed,
    onclick,
    children,
  }: { keyword: KeywordHit; text: string; pressed: boolean; onclick: () => void; children: Snippet } = $props();

  const name = $derived(copy.keywordButton(text, keyword.role, clickGoal(keyword)));
</script>

<button
  type="button"
  class="keyword"
  data-kind={keyword.kind}
  data-role={keyword.role}
  aria-pressed={pressed}
  aria-label={name}
  title={name}
  {onclick}>{@render children()}</button
>

<style>
  /* A button in running text: everything the browser gives it is taken back, so that it reads as the words around it. */
  .keyword {
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: none;
    color: var(--kw-mechanic);
    font: inherit;
    text-align: inherit;
    cursor: pointer;
  }

  /*
   * Rings, never a fill: a match highlight (22 % of a yellow) over a lighter fill leaves a debuff or the muted flag
   * under 4.5:1, and the token colours are only checked on the page itself. A ring is a box-shadow because the outline
   * is the shape of the role.
   */
  .keyword:hover {
    box-shadow: 0 0 0 1px var(--border-strong);
  }

  .keyword[aria-pressed='true'] {
    box-shadow: 0 0 0 2px var(--accent-border);
  }

  /* The outline of a role (below) is more specific than the page's focus ring and would stand in for it: the ring is put back. */
  .keyword:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  [data-kind='debuff'] {
    color: var(--kw-debuff);
  }

  [data-kind='buff'] {
    color: var(--kw-buff);
  }

  [data-kind='trigger'] {
    color: var(--kw-trigger);
    text-decoration: underline dotted;
    text-underline-offset: 3px;
  }

  [data-kind='flag'] {
    color: var(--text-muted);
    font-style: italic;
  }

  /* Applies: a solid bar under the name. Uses: a dashed outline. Resists: a solid outline. */
  [data-role='applies'] {
    text-decoration: underline solid 2px;
    text-underline-offset: 3px;
  }

  /* An outline takes no room, so the offset is small enough to leave the space beside the name visible. */
  [data-role='uses'] {
    outline: 1px dashed currentcolor;
    outline-offset: 1px;
  }

  [data-role='resists'] {
    outline: 1px solid currentcolor;
    outline-offset: 1px;
  }
</style>
