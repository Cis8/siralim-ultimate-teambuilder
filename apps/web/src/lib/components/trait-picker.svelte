<script lang="ts">
  import { MAX_SUGGESTIONS, type RelationService, type Trait } from '@atlas/core';
  import type { ComboboxOption } from '../combobox-option';
  import { copy } from '../copy';
  import Combobox from './combobox.svelte';

  /**
   * The field that picks the trait to look at: the traits whose name, creature or family the text points at, in a list under it
   * (an editable combobox, as the search's). Taking one tells `onpick` and empties the field. Nothing is listed for an empty field.
   * `initial` is the text the field starts with, for a search that is offered rather than typed.
   */
  const {
    relations,
    initial = '',
    onpick,
  }: { relations: RelationService; initial?: string; onpick: (trait: Trait) => void } = $props();

  const uid = $props.id();
  // Read once, on purpose: the field is the person's from then on.
  // svelte-ignore state_referenced_locally
  let text = $state(initial);
  let input = $state<HTMLInputElement>();

  const found = $derived(text.trim() === '' ? [] : relations.findTraits(text, MAX_SUGGESTIONS));
  const options = $derived(
    found.map((trait): ComboboxOption => ({
      badge: copy.suggestionKinds.trait,
      tone: 'neutral',
      label: trait.name,
      detail: copy.traitOrigin(trait.creature, trait.family, trait.class, trait.kind),
      continues: false,
    })),
  );

  function accept(_option: ComboboxOption, index: number): void {
    const trait = found[index];
    if (trait === undefined) return;
    text = '';
    onpick(trait);
  }
</script>

<!-- The list is drawn against this box, under the field. -->
<search class="picker">
  <div class="field">
    <label>
      <span class="visually-hidden">{copy.findTraitLabel}</span>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
      <input
        type="text"
        bind:this={input}
        bind:value={text}
        placeholder={copy.findTraitPlaceholder}
        inputmode="search"
        enterkeyhint="go"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
      />
    </label>
  </div>
  <Combobox {input} {options} id={`${uid}-traits`} label={copy.findTraitSuggestions} onaccept={accept} />
</search>

<style>
  .picker {
    position: relative;
    display: block;
    width: min(100%, 520px);
  }

  /* The frame of the search field of Explore (`query-input.svelte`), whose list this one shares. */
  .field {
    display: flex;
    align-items: center;
    height: var(--target-min);
    border: 1px solid var(--accent-border);
    border-radius: 8px;
    background: var(--surface-1);
    color: var(--text-faint);
  }

  .field:focus-within {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  label {
    display: flex;
    flex: 1;
    align-items: center;
    align-self: stretch;
    gap: 10px;
    min-width: 0;
    margin-block: -1px;
    padding: 0 12px;
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
  }

  /* The field draws the focus ring around the whole bar, icon included. */
  input:focus-visible {
    outline: none;
  }

  input::placeholder {
    color: var(--text-faint);
    opacity: 1;
  }

  /* iOS zooms the page in when a field of less than 16 px takes the focus, and leaves it zoomed. */
  @media (pointer: coarse) {
    input {
      font-size: 16px;
    }
  }
</style>
