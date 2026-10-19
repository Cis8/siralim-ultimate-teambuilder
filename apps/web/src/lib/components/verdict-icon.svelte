<script lang="ts">
  import type { VerdictTone } from '../keyword-summary';

  /** The shape that says a verdict beside its words: a check, a warning triangle, a crossed circle (status is never colour alone). */
  const { tone }: { tone: VerdictTone } = $props();
</script>

<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
  {#if tone === 'good'}
    <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5" />
    <path d="M5 8.2 7.1 10.3 11 5.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  {:else if tone === 'bad'}
    <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5" />
    <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  {:else}
    <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M8 6v4M8 11.5v.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  {/if}
</svg>
