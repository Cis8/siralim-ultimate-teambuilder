<script lang="ts">
  import FacetButton from './facet-button.svelte';

  /**
   * A keyword of the filter panel that has two sides (what a trait does with it): its name, and a toggle button for each
   * side with the number of traits it would show. The sides are columns of their own, `widths` wide, so that the buttons of
   * every keyword of a list line up.
   */
  const {
    label,
    sides,
    widths,
  }: {
    label: string;
    sides: readonly {
      readonly name: string;
      readonly count: number;
      readonly pressed: boolean;
      readonly press: () => void;
    }[];
    widths: string;
  } = $props();
</script>

<div class="keyword" role="group" aria-label={label} style:--sides={widths}>
  <span class="name">{label}</span>
  {#each sides as side (side.name)}
    <FacetButton size="compact" pressed={side.pressed} count={side.count} onclick={side.press}>{side.name}</FacetButton>
  {/each}
</div>

<style>
  .keyword {
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--sides);
    align-items: center;
    gap: 6px;
  }

  .name {
    min-width: 0;
    font-size: 13px;
    overflow-wrap: anywhere;
  }
</style>
