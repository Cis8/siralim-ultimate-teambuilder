<script lang="ts" generics="Value extends string">
  /**
   * A few toggle buttons in a frame, every option in view; the options whose value is in `pressed` are pressed. The owner
   * decides what a press does to the others, so the same row is a choice of one (the match mode) or of several (who acts).
   * None is pressed while `pressed` is empty, when the state lies between the options. In one row, or in `columns` columns
   * when the options are too long to share a row of the panel.
   */
  const {
    label,
    options,
    pressed,
    columns,
    onchange,
  }: {
    label: string;
    options: readonly { readonly value: Value; readonly label: string }[];
    pressed: readonly Value[];
    columns?: number;
    onchange: (value: Value) => void;
  } = $props();
</script>

<div class="segmented" class:grid={columns !== undefined} style:--columns={columns} role="group" aria-label={label}>
  {#each options as option (option.value)}
    <button
      type="button"
      aria-pressed={pressed.includes(option.value)}
      onclick={() => {
        onchange(option.value);
      }}>{option.label}</button
    >
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-2);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  }

  button {
    min-height: 26px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: none;
    color: var(--text-muted);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  button[aria-pressed='true'] {
    border-color: var(--accent-border);
    background: var(--accent-surface);
    color: var(--text-strong);
  }

  /* The buttons are the targets, not the frame around them: the frame is 6 px taller than they are. */
  @media (pointer: coarse) {
    button {
      min-height: var(--target-min);
    }
  }
</style>
