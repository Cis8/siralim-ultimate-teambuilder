<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The name of a buff, debuff or effect as a pill in the colour of its kind: the head of a lane. The words in it say what the
   * trait does with the key, so that the colour is never all there is to tell.
   */
  const { kind, children }: { kind: 'debuff' | 'buff' | 'effect'; children: Snippet } = $props();
</script>

<span class="pill" data-kind={kind}>{@render children()}</span>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 0 8px;
    border: 1px solid currentcolor;
    border-radius: 5px;
    color: var(--kw-mechanic);
    font-size: 12px;
    font-weight: 500;
  }

  [data-kind='debuff'] {
    color: var(--kw-debuff);
  }

  [data-kind='buff'] {
    color: var(--kw-buff);
  }
</style>
