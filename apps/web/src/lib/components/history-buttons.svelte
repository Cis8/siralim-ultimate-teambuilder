<script lang="ts">
  import { copy } from '../copy';
  import { keepFieldFocus } from '../keep-field-focus';

  /**
   * The two buttons of the recent and saved searches, inside the frame of the search field at its right end (SPEC §8.3): a star that
   * keeps the search in the field, which is there while the field has something to keep, and the button that opens the sheet
   * where the lists are managed. Both are as tall as the field, over its border, as the issues badge is.
   */
  let {
    canSave,
    saved,
    onsave,
    onmanage,
    manageButton = $bindable(),
  }: {
    /** Whether the field holds a search to keep: the star is not there for a blank field. */
    canSave: boolean;
    /** Whether the search in the field is one of the saved ones. */
    saved: boolean;
    onsave: () => void;
    onmanage: () => void;
    /** The button that opens the sheet, for whoever gives the focus back to it when the sheet is shut. */
    manageButton?: HTMLButtonElement | undefined;
  } = $props();
</script>

{#if canSave}
  <!-- The name does not change with the state: a toggle button says it is pressed by `aria-pressed`, not by another name. -->
  <button
    type="button"
    class="star"
    aria-pressed={saved}
    aria-label={copy.saveSearch}
    title={copy.saveSearch}
    onclick={onsave}
    {@attach keepFieldFocus}
  >
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linejoin="round"
      />
    </svg>
  </button>
{/if}
<button
  type="button"
  class="manage"
  aria-haspopup="dialog"
  aria-label={copy.manageSearches}
  title={copy.manageSearches}
  bind:this={manageButton}
  onclick={onmanage}
>
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <path
      d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v4l3 2"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</button>

<style>
  button {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    align-self: stretch;
    width: var(--target-min);
    margin-block: -1px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text-muted);
    cursor: pointer;
  }

  button:hover {
    color: var(--text-strong);
  }

  /* A saved search is a filled star: the shape says it, not the colour alone. */
  .star[aria-pressed='true'] {
    color: var(--status-warn);
  }

  /* The field draws a ring around the whole of itself while any of its controls has the focus; the button has one of its own around the glyph. */
  button:focus-visible {
    outline: var(--focus-ring);
    outline-offset: -8px;
    border-radius: 8px;
  }
</style>
