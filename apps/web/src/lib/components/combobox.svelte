<script lang="ts">
  import { onDestroy } from 'svelte';
  import { isBeingEdited } from '../apply-field-edit';
  import {
    accepted,
    comboboxView,
    keyPressOf,
    moved,
    pressKey,
    shut,
    typed,
    type ComboboxState,
  } from '../combobox-state';
  import type { ComboboxOption } from '../combobox-option';
  import { createListAnnouncer } from '../list-announcer';
  import { keepFieldFocus } from '../keep-field-focus';

  /**
   * The list of an editable combobox (ARIA APG, "list autocomplete"), attached to a text field the host owns. It gives the field
   * `role="combobox"` and the `aria-*` that tie it to the list, and listens to it: a key moves the active option, Tab and Enter
   * accept it, Escape puts the list away. Focus never leaves the field (`aria-activedescendant`), and a press on an option does
   * not take it either. Nothing is active until the person types or uses the arrows, so a Tab on a plain focus is the field's own.
   *
   * The host decides what the options are, from the text and the caret, and what accepting one does (`onaccept`: one edit of the
   * text, made with `applyFieldEdit`). The `input` event of an edit made that way, this one or a fix, is not a keystroke and does
   * not bring the list back. The list is drawn against the nearest positioned ancestor, under it: the host makes the box that holds
   * the field (and whatever else sits under it) one.
   */
  const {
    input,
    options,
    id,
    label,
    onaccept,
  }: {
    input: HTMLInputElement | undefined;
    options: readonly ComboboxOption[];
    /** The id of the list; the options are `${id}-option-0` and so on. */
    id: string;
    /** The name of the list for a screen reader. */
    label: string;
    /** The option taken, and its place in `options`. */
    onaccept: (option: ComboboxOption, index: number) => void;
  } = $props();

  let status = $state.raw<ComboboxState>(shut);
  let announced = $state('');
  let list = $state<HTMLElement>();

  const view = $derived(comboboxView(status, options.length));
  const optionId = (index: number): string => `${id}-option-${String(index)}`;

  const announcer = createListAnnouncer((message) => {
    announced = message;
  });
  onDestroy(() => {
    announcer.stop();
  });

  $effect(() => {
    announcer.sized(view.expanded ? options.length : 0);
  });

  function accept(index: number): void {
    const option = options[index];
    if (option === undefined) return;
    onaccept(option, index);
    status = accepted(option.continues);
  }

  // What the field does on its own: the role and the list it controls, and the keys and events that drive the state.
  $effect(() => {
    const field = input;
    if (field === undefined) return;

    field.setAttribute('role', 'combobox');
    field.setAttribute('aria-autocomplete', 'list');
    field.setAttribute('aria-controls', id);

    const onKeydown = (event: KeyboardEvent): void => {
      const outcome = pressKey(status, keyPressOf(event), options.length);
      if (!outcome.handled) return;
      event.preventDefault();
      status = outcome.state;
      if (outcome.accept !== undefined) accept(outcome.accept);
    };
    const onInput = (): void => {
      if (!isBeingEdited(field)) status = typed();
    };
    // The caret moved without typing, by a press in the text or by the keys that move it.
    const onKeyup = (event: KeyboardEvent): void => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) status = moved(status);
    };
    const onClick = (): void => {
      status = moved(status);
    };
    const onBlur = (): void => {
      status = shut;
    };

    field.addEventListener('keydown', onKeydown);
    field.addEventListener('input', onInput);
    field.addEventListener('keyup', onKeyup);
    field.addEventListener('click', onClick);
    field.addEventListener('blur', onBlur);
    return () => {
      field.removeEventListener('keydown', onKeydown);
      field.removeEventListener('input', onInput);
      field.removeEventListener('keyup', onKeyup);
      field.removeEventListener('click', onClick);
      field.removeEventListener('blur', onBlur);
      for (const name of ['role', 'aria-autocomplete', 'aria-controls', 'aria-expanded', 'aria-activedescendant']) {
        field.removeAttribute(name);
      }
    };
  });

  // What the field says about the list now.
  $effect(() => {
    input?.setAttribute('aria-expanded', String(view.expanded));
    if (view.active === undefined) input?.removeAttribute('aria-activedescendant');
    else input?.setAttribute('aria-activedescendant', optionId(view.active));
  });

  // The active option stays in sight: the list is as tall as its options (at most nine) and does not scroll, so the page does,
  // where a phone's keyboard leaves little room under the field. A scroll area of its own would need a tab stop (axe).
  $effect(() => {
    if (view.active !== undefined) list?.children[view.active]?.scrollIntoView({ block: 'nearest' });
  });
</script>

<div class="popup" hidden={!view.expanded}>
  <ul {id} role="listbox" aria-label={label} bind:this={list} {@attach keepFieldFocus}>
    {#each options as option, index (index)}
      <!-- The keys act on the field, which keeps the focus (aria-activedescendant): a press is the pointer's way to the same accept. -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <li
        id={optionId(index)}
        role="option"
        tabindex="-1"
        aria-selected={view.active === index}
        class:active={view.active === index}
        onclick={() => {
          accept(index);
        }}
      >
        <span class="badge" data-tone={option.tone}>{option.badge}</span>
        <span class="text">
          <span class="label">{option.label}</span>
          <span class="detail">{option.detail}</span>
        </span>
        {#if option.trailing !== undefined}
          <!-- The space is a text of its own, so that the number and the unit are two words in whatever reads the name. -->
          <span class="trailing"
            >{option.trailing} <span class="visually-hidden">{option.trailingUnit ?? ''}</span></span
          >
        {/if}
      </li>
    {/each}
  </ul>
</div>
<p class="visually-hidden" aria-live="polite">{announced}</p>

<style>
  /*
   * Over the page, under the field, and under the bars fixed to the foot of the window (z-index 5 and 6): on a phone nine rows reach
   * down to them, and the Filters button and the tabs must stay in reach. The page scrolls to the active option, clear of the bars
   * (`scroll-padding-bottom`). It has no `display` of its own, so `hidden` shuts it.
   */
  .popup {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    left: 0;
    z-index: 4;
    padding: 6px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-2);
    box-shadow: var(--shadow-popup);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    /* The count has a column of its own, held while it is not there yet: the counts follow the list by a moment. */
    grid-template-columns: 5.5rem minmax(0, 1fr) 3.5rem;
    align-items: center;
    gap: 12px;
    min-height: 38px;
    padding: 4px 12px;
    border-radius: var(--radius);
    cursor: pointer;
  }

  li:hover {
    background: var(--surface-3);
  }

  /* The active option is also marked by a bar, which a high-contrast mode keeps (below), since a fill alone would not show. */
  li.active {
    background: var(--accent-surface);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .badge {
    justify-self: start;
    padding: 2px 6px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .badge[data-tone='debuff'] {
    color: var(--kw-debuff);
  }

  .badge[data-tone='buff'] {
    color: var(--kw-buff);
  }

  .badge[data-tone='mechanic'] {
    color: var(--kw-mechanic);
  }

  .badge[data-tone='event'] {
    color: var(--kw-event);
  }

  .text {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 10px;
    min-width: 0;
  }

  .label {
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 13.5px;
    overflow-wrap: anywhere;
  }

  .detail {
    color: var(--text-faint);
    font-size: 12px;
  }

  li.active .detail {
    color: var(--text-muted);
  }

  .trailing {
    grid-column: 3;
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 11.5px;
    text-align: right;
  }

  li.active .trailing {
    color: var(--text-muted);
  }

  @media (pointer: coarse) {
    li {
      min-height: var(--target-min);
    }
  }

  @media (forced-colors: active) {
    li.active {
      outline: 2px solid Highlight;
      outline-offset: -2px;
    }
  }
</style>
