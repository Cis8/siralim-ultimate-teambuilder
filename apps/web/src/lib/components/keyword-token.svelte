<script lang="ts">
  import type { KeywordHit } from '@atlas/core';
  import type { Snippet } from 'svelte';

  /**
   * A keyword in a description, styled by its kind (colour) and its role (shape, so that nothing rests on colour alone,
   * DESIGN § Keyword tokens). Plain text for now: 5.7 makes it the button that jumps to the counterpart.
   */
  const { keyword, children }: { keyword: KeywordHit; children: Snippet } = $props();
</script>

<span class="keyword" data-kind={keyword.kind} data-role={keyword.role}>{@render children()}</span>

<style>
  .keyword {
    border-radius: 3px;
    color: var(--kw-mechanic);
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
