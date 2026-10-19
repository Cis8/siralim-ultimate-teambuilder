<script lang="ts">
  /**
   * The arrow beside the number of a keyword's chip: up and to the right for the traits that apply it (they send it out), down and
   * to the right for the traits that rely on it (they take it in). A screen reader never meets it: the chip says the numbers in
   * words.
   */
  const { side }: { side: 'applies' | 'uses' } = $props();
</script>

<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false">
  <path
    d={side === 'applies' ? 'M2.5 9.5 9.5 2.5M4 2.5h5.5V8' : 'M2.5 2.5 9.5 9.5M9.5 4v5.5H4'}
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
