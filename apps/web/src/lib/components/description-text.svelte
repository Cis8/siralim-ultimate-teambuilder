<script lang="ts">
  import type { DescriptionPart } from '@atlas/core';
  import type { KeywordActions } from '../keyword-actions';
  import KeywordToken from './keyword-token.svelte';
  import MarkedText from './marked-text.svelte';

  /**
   * The description of a trait, drawn part by part: keywords as tokens (buttons that `actions` answers), the text the
   * query looks for in `<mark>`.
   */
  const { parts, actions }: { parts: readonly DescriptionPart[]; actions: KeywordActions } = $props();

  const textOf = ({ pieces }: DescriptionPart): string => pieces.map(({ text }) => text).join('');
</script>

<!-- The tags touch their text on purpose: any space here would be one more in the description. -->
{#each parts as part, index (index)}{#if part.keyword}{@const keyword = part.keyword}<KeywordToken
      {keyword}
      text={textOf(part)}
      pressed={actions.isOn(keyword)}
      onclick={() => {
        actions.click(keyword);
      }}><MarkedText pieces={part.pieces} /></KeywordToken
    >{:else}<MarkedText pieces={part.pieces} />{/if}{/each}
