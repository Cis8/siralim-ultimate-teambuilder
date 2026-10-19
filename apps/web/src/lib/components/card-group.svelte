<script lang="ts">
  import type { Snippet } from 'svelte';
  import SectionToggle from './section-toggle.svelte';

  /**
   * Traits that give a key in a weaker way than the rest of their list (at random, under a condition), under a heading of their own
   * with a sentence that says why they are apart. A group of more than a few traits is folded: its heading holds the button that
   * opens it, and the cards are not drawn at all until then (a trait that afflicts a random debuff is one of dozens). `level` is the
   * heading's, one below the list it belongs to.
   */
  const {
    title,
    hint,
    folded,
    level,
    children,
  }: { title: string; hint: string; folded: boolean; level: 3 | 4; children: Snippet } = $props();

  const uid = $props.id();
  let open = $state(false);
</script>

<div class="group">
  <svelte:element this={`h${String(level)}`} class="title">
    {#if folded}
      <SectionToggle
        controls="{uid}-cards"
        {open}
        active={0}
        ontoggle={() => {
          open = !open;
        }}>{title}</SectionToggle
      >
    {:else}
      {title}
    {/if}
  </svelte:element>
  <p class="hint">{hint}</p>
  <!-- A folded group draws no cards; its wrapper is what the button controls. -->
  <div id="{uid}-cards">
    {#if !folded || open}
      {@render children()}
    {/if}
  </div>
</div>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .title {
    margin: 0;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
  }

  .hint {
    margin: 0;
    color: var(--text-faint);
    font-size: 12px;
  }
</style>
