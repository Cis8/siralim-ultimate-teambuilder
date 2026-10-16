<script lang="ts">
  import type { TextPiece } from '@atlas/core';

  /** Text with the part a query looks for in `<mark>`. */
  const { pieces }: { pieces: readonly TextPiece[] } = $props();
</script>

<!-- The tags touch their text on purpose: any space here would be one more in the description. -->
{#each pieces as piece, index (index)}{#if piece.marked}<mark>{piece.text}</mark>{:else}{piece.text}{/if}{/each}

<style>
  /* The match stays readable on every token colour (DESIGN § Keyword tokens: a yellow highlight). */
  mark {
    border-radius: 2px;
    background: color-mix(in srgb, var(--status-warn) 22%, transparent);
    color: inherit;
  }
</style>
