<script lang="ts">
  import type { DiagnosticSeverity } from '@atlas/core';

  /** The shape that says a severity beside its word (DESIGN § Colour rules: status is never colour alone). */
  const { severity }: { severity: DiagnosticSeverity } = $props();
</script>

<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
  {#if severity === 'error'}
    <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5" />
    <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  {:else}
    <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    <path d="M8 6v4M8 11.5v.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  {/if}
</svg>
