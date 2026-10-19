<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { tick, type Snippet } from 'svelte';
  import BottomSheet from './bottom-sheet.svelte';

  /**
   * A picker that a narrow screen opens as a sheet (DESIGN § Synergy pages): a button, and the picker handed over as `children`
   * in a full-height sheet, where the soft keyboard leaves room for its list and the page behind is out of the way. With
   * `focusField` the sheet opens with the focus in its text field, since typing in it is what the person came to do.
   *
   * Taking something in the picker moves the person to another page, which closes the sheet; the focus is then the page's to place
   * (on its heading), not the button's. A sheet put away by hand gives the focus back to the button that opened it.
   */
  const {
    label,
    title,
    closeLabel,
    icon,
    focusField = false,
    children,
  }: {
    label: string;
    title: string;
    closeLabel: string;
    icon: 'search' | 'keywords';
    focusField?: boolean;
    children: Snippet;
  } = $props();

  let open = $state(false);
  let button = $state<HTMLButtonElement>();
  let content = $state<HTMLElement>();
  /** The sheet was open when the person left for another page, so its close is not the person's to answer with the focus. */
  let leaving = false;

  afterNavigate(({ from, to }) => {
    if (from === null || to === null || from.url.pathname === to.url.pathname) return;
    leaving = open;
    open = false;
  });

  $effect(() => {
    if (!open || !focusField) return;
    void tick().then(() => {
      content?.querySelector('input')?.focus();
    });
  });

  function closed(): void {
    open = false;
    if (leaving) leaving = false;
    else button?.focus();
  }
</script>

<button
  type="button"
  aria-haspopup="dialog"
  bind:this={button}
  onclick={() => {
    open = true;
  }}
>
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    {#if icon === 'search'}
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" />
    {:else}
      <path d="M4 7h16M4 12h16M4 17h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    {/if}
  </svg>
  {label}
</button>

<BottomSheet {open} {title} {closeLabel} onclose={closed}>
  <div class="content" bind:this={content}>{@render children()}</div>
</BottomSheet>

<style>
  button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: var(--target-min);
    padding: 0 14px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--surface-3);
    color: var(--text-strong);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }

  /* The sheet's body scrolls and clips: the room around keeps the focus ring of a field at its top from being cut. */
  .content {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 6px 4px;
  }
</style>
