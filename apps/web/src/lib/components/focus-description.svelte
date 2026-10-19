<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import { canBeDependency, descriptionParts, type KeywordKey, type Trait } from '@atlas/core';
  import KeywordLink from './keyword-link.svelte';

  /**
   * The description of the trait in focus, with its keywords drawn as DESIGN § Keyword tokens has them: a buff, a debuff or an
   * effect is a link to the page of that keyword; an event, a mechanic or a flag leads nowhere (no event is a dependency, GAME_RULES
   * R12) and is the colour of its kind, as text.
   */
  const { trait, hrefOf }: { trait: Trait; hrefOf: (key: KeywordKey) => ResolvedPathname } = $props();

  const parts = $derived(descriptionParts(trait.description, trait.keywords, []));
  const textOf = ({ pieces }: { pieces: readonly { text: string }[] }): string =>
    pieces.map(({ text }) => text).join('');
</script>

<!-- The tags touch their text on purpose: any space here would be one more in the description. -->
{#each parts as part, index (index)}{#if part.keyword === null}{textOf(
      part,
    )}{:else if canBeDependency(part.keyword.kind)}<KeywordLink
      keyword={part.keyword}
      text={textOf(part)}
      href={hrefOf(part.keyword.key)}>{textOf(part)}</KeywordLink
    >{:else}<span class="keyword" data-kind={part.keyword.kind}>{textOf(part)}</span>{/if}{/each}
