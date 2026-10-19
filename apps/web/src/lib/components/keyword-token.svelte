<script lang="ts">
  import { clickGoal, type KeywordHit } from '@atlas/core';
  import type { Snippet } from 'svelte';
  import { copy } from '../copy';

  /**
   * A keyword in a description, styled by its kind (colour) and its role (shape, so that nothing rests on colour alone,
   * DESIGN § Keyword tokens; the look is `styles/keyword.css`). It is a toggle button: a click puts the filter it stands for on
   * or off (`pressed`), and its name tells what the trait does with the keyword, who acts when it is an event (the colour and
   * the shape say neither to a screen reader), and what the click shows. `text` is what the description says there: the name
   * keeps it, as a voice command would say it.
   */
  const {
    keyword,
    text,
    pressed,
    onclick,
    children,
  }: { keyword: KeywordHit; text: string; pressed: boolean; onclick: () => void; children: Snippet } = $props();

  const name = $derived(copy.keywordButton(keyword, text, clickGoal(keyword)));
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
