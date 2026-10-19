<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import type { KeywordHit } from '@atlas/core';
  import type { Snippet } from 'svelte';
  import { copy } from '../copy';

  /**
   * A buff, debuff or effect in the description of the trait in focus: a link to the page of that keyword, who applies it and who
   * relies on it. It wears the kind and the role as the tokens of Explore do (`styles/keyword.css`), and its name says what the
   * trait does with it, since the shape does not reach a screen reader. `text` is what the description says there.
   */
  const {
    keyword,
    text,
    href,
    children,
  }: { keyword: KeywordHit; text: string; href: ResolvedPathname; children: Snippet } = $props();

  const name = $derived(copy.keywordLink(keyword, text));
</script>

<a class="keyword" data-kind={keyword.kind} data-role={keyword.role} {href} aria-label={name} title={name}
  >{@render children()}</a
>
