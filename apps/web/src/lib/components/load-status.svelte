<script lang="ts">
  import { copy } from '../copy';

  /** What a page that needs the dataset shows until it is there, or for good when it could not be loaded. */
  const { failed }: { failed: boolean } = $props();
</script>

{#if failed}
  <p class="status failed" role="alert">
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
      <path d="M8 6v4M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
    {copy.traitsFailed}
  </p>
{:else}
  <p class="status" role="status">{copy.loadingSynergies}</p>
{/if}

<style>
  .status {
    margin: 0;
    color: var(--text-faint);
  }

  /*
   * The page that takes its place is longer than the window, nearly always. Holding the window's height meanwhile keeps the footer
   * below the fold, so that it does not jump out of view when the lists arrive (cumulative layout shift, as on Explore).
   */
  .status:not(.failed) {
    min-height: 100dvh;
  }

  .failed {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--status-crit);
  }
</style>
