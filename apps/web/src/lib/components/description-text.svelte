<script lang="ts">
  import type { DescriptionPart } from '@atlas/core';
  import KeywordToken from './keyword-token.svelte';
  import MarkedText from './marked-text.svelte';

  /** The description of a trait, drawn part by part: keywords as tokens, the text the query looks for in `<mark>`. */
  const { parts }: { parts: readonly DescriptionPart[] } = $props();
</script>

<!-- The tags touch their text on purpose: any space here would be one more in the description. -->
{#each parts as part, index (index)}{#if part.keyword}<KeywordToken keyword={part.keyword}
      ><MarkedText pieces={part.pieces} /></KeywordToken
    >{:else}<MarkedText pieces={part.pieces} />{/if}{/each}
