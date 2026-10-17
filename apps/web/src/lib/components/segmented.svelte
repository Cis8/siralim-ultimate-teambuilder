<script lang="ts" generics="Value extends string">
  /** A choice of one among a few, every option in view: a group of toggle buttons, the chosen one pressed. */
  const {
    label,
    options,
    value,
    onchange,
  }: {
    label: string;
    options: readonly { readonly value: Value; readonly label: string }[];
    value: Value;
    onchange: (value: Value) => void;
  } = $props();
</script>

<div class="segmented" role="group" aria-label={label}>
  {#each options as option (option.value)}
    <button
      type="button"
      aria-pressed={option.value === value}
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
