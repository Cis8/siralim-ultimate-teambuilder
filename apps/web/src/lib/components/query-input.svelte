<script lang="ts">
  import { copy } from '../copy';

  /** The query bar: a text field the owner of the state reads and writes, one keystroke at a time. */
  const { value, onchange }: { value: string; onchange: (value: string) => void } = $props();
</script>

<label class="field" for="query">
  <span class="visually-hidden">{copy.searchLabel}</span>
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
    <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" />
  </svg>
  <input
    id="query"
    type="text"
    {value}
    oninput={(event) => {
      onchange(event.currentTarget.value);
    }}
    placeholder={copy.searchPlaceholder}
    inputmode="search"
    enterkeyhint="search"
    autocomplete="off"
    autocapitalize="off"
    spellcheck="false"
  />
</label>

<style>
  .field {
    display: flex;
    align-items: center;
    gap: 10px;
    height: var(--target-min);
    padding: 0 12px;
    border: 1px solid var(--accent-border);
    border-radius: 8px;
    background: var(--surface-1);
    color: var(--text-faint);
  }

  .field:focus-within {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-strong);
    font: inherit;
    font-family: var(--font-mono);
  }

  /* The field draws the focus ring around the whole bar, icon included. */
  input:focus-visible {
    outline: none;
  }

  input::placeholder {
    color: var(--text-faint);
    opacity: 1;
  }
</style>
