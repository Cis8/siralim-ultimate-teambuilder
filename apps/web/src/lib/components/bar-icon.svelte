<script lang="ts">
  /**
   * The icon over the name of an item of the bar at the foot of a narrow screen: decoration, the name says the rest. The link to
   * the Synergies of a trait draws the `synergies` one smaller (`size`).
   */
  const { name, size = 20 }: { name: 'explore' | 'party' | 'synergies'; size?: number } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
  {#if name === 'explore'}
    <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.8" />
    <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
  {:else if name === 'party'}
    <g fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="3" y="4" width="7" height="7" rx="1.5" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </g>
  {:else}
    <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <circle cx="6" cy="6" r="2.6" />
      <circle cx="18" cy="6" r="2.6" />
      <circle cx="12" cy="18" r="2.6" />
      <path d="M8.6 6h6.8M7.2 8.4l3.4 7.2M16.8 8.4l-3.4 7.2" />
    </g>
  {/if}
</svg>
