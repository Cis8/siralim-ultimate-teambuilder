<script lang="ts">
  import { copy } from '../copy';

  /**
   * An arrow fixed at the top right of the window (DESIGN § Back to top). The page decides when it is there and what a press
   * does; this draws it and, while it is on the page, leaves room for it at the top of the window (`--top-room`, base.css),
   * so that a control that takes the focus is scrolled clear of it (WCAG 2.2 2.4.11, Focus Not Obscured).
   */
  const { onpress }: { onpress: () => void } = $props();
</script>

<button type="button" class="back-to-top" aria-label={copy.backToTop} onclick={onpress}>
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <path
      d="M5 4.5h14M12 20V9m0 0-5 5m5-5 5 5"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</button>

<style>
  /* The room is the button, its gap to the edge of the window and a little more. */
  :global(:root:has(.back-to-top)) {
    --top-room: calc(var(--target-min) + 16px);
  }

  .back-to-top {
    position: fixed;
    top: 8px;
    right: 8px;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--target-min);
    height: var(--target-min);
    padding: 0;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    background: var(--surface-3);
    color: var(--text-strong);
    cursor: pointer;
  }
</style>
