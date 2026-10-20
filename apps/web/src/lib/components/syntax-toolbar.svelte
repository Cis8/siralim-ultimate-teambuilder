<script lang="ts">
  import type { SyntaxInsertionId } from '@atlas/core';
  import { copy } from '../copy';
  import { keepFieldFocus } from '../keep-field-focus';
  import { syntaxToolbar } from '../syntax-toolbar';

  /**
   * The row of buttons at the foot of the search sheet that write the pieces of the query language a phone's keyboard hides behind
   * other pages: groups, quotes, the operators, the fields people reach for most. A press writes at the caret and does not take the
   * focus from the field, so the keyboard stays up (`keepFieldFocus`). The row scrolls sideways when the screen is narrower than it.
   */
  const { onpress }: { onpress: (id: SyntaxInsertionId) => void } = $props();
</script>

<div role="toolbar" aria-label={copy.syntaxToolbarLabel}>
  {#each syntaxToolbar as { id, label, name } (id)}
    <button
      type="button"
      class={id}
      aria-label={name}
      onclick={() => {
        onpress(id);
      }}
      {@attach keepFieldFocus}>{label}</button
    >
  {/each}
</div>

<style>
  div {
    display: flex;
    gap: 6px;
    margin: 0 -12px;
    padding: 0 12px 2px;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }

  button {
    flex: none;
    min-width: var(--target-min);
    min-height: var(--target-min);
    padding: 0 12px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--surface-3);
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 14px;
    cursor: pointer;
  }

  button:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  /* The colours of the query itself: an operator is yellow in the field, a field blue. Never the only sign: the face says what it is. */
  .or,
  .and,
  .not {
    color: var(--syntax-operator);
  }

  .applies,
  .uses,
  .class,
  .material {
    color: var(--syntax-field);
  }
</style>
