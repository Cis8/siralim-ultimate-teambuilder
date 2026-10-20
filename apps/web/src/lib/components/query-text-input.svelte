<script lang="ts">
  import type { Snippet } from 'svelte';
  import { copy } from '../copy';
  import type { FieldEvents } from '../search-sheet';

  /**
   * The text field of the query and the box it shares with the mirror (QUERY_LANGUAGE §8): the one `<input>` that keeps the typing,
   * the caret, the selection, the undo and the keyboard, in the search bar of the page and in the search sheet of a phone alike. With
   * the mirror under it (`mirror`, a snippet: it is in the assist layer, which this is not) the field's own text turns transparent
   * and the mirror shows it in colour; the field then draws only the caret and the selection.
   */
  let {
    id,
    value,
    mirrored,
    invalid,
    describedBy,
    events,
    input = $bindable(),
    mirror,
  }: {
    id: string;
    value: string;
    /** Whether a mirror lies under the field, which then gives its colours up. */
    mirrored: boolean;
    /** Whether the query has an error. */
    invalid: boolean;
    /** The ids of the texts that say what is wrong with the query. */
    describedBy: string | undefined;
    events: FieldEvents;
    input?: HTMLInputElement | undefined;
    mirror?: Snippet;
  } = $props();
</script>

<span class="editor">
  {@render mirror?.()}
  <input
    {id}
    class="query-text"
    class:mirrored
    type="text"
    bind:this={input}
    {value}
    oninput={events.oninput}
    onfocus={events.onfocus}
    onblur={events.onblur}
    onkeydown={events.onkeydown}
    onkeyup={events.onkeyup}
    onclick={events.onclick}
    onselect={events.onselect}
    onmousedown={events.onmousedown}
    aria-invalid={invalid ? 'true' : undefined}
    aria-describedby={describedBy}
    placeholder={copy.searchPlaceholder}
    inputmode="search"
    enterkeyhint="search"
    autocomplete="off"
    autocapitalize="off"
    spellcheck="false"
  />
</span>

<style>
  /* The input and the mirror under it fill this box together (the font, `.query-text`, is the same for both). */
  .editor {
    position: relative;
    display: flex;
    flex: 1;
    align-self: stretch;
    min-width: 0;
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-strong);
  }

  /* The frame the field sits in draws the focus ring around the whole of itself. */
  input:focus-visible {
    outline: none;
  }

  input::placeholder {
    color: var(--text-faint);
    opacity: 1;
  }

  /*
   * With the mirror under it the field keeps the caret, the selection and the typing, and gives the colours up: its own text is
   * transparent. The selection is a share of the accent, so that the coloured text still shows through it.
   */
  input.mirrored {
    color: transparent;
    caret-color: var(--text-strong);
  }

  input.mirrored::selection {
    background: var(--field-selection);
    color: transparent;
  }

  /* A high-contrast mode forces its colours and the mirror is not drawn (query-mirror.svelte): the field shows its text itself. */
  @media (forced-colors: active) {
    input.mirrored {
      color: FieldText;
      caret-color: auto;
    }

    input.mirrored::selection {
      background: Highlight;
      color: HighlightText;
    }
  }
</style>
