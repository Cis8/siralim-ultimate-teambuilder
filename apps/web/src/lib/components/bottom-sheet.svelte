<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A modal sheet that rises from the foot of the window (DESIGN § Accessibility). It is a native `<dialog>` opened with
   * `showModal()`: the browser keeps the focus inside, makes the page behind inert and closes the sheet on Esc. A tap on
   * the dimmed page behind and the close button close it too. `onclose` tells the owner of `open` that it is shut, by
   * whatever means, and the owner puts the focus back on what opened it (a browser may not have focused a button that
   * was only clicked, so the dialog cannot be left to remember it). `status` is read out politely while the sheet is
   * open: the live regions of the page behind it are inert.
   */
  const {
    open,
    title,
    closeLabel,
    status,
    onclose,
    children,
  }: {
    open: boolean;
    title: string;
    closeLabel: string;
    status: string;
    onclose: () => void;
    children: Snippet;
  } = $props();

  const uid = $props.id();
  const titleId = `${uid}-title`;
  let dialog = $state<HTMLDialogElement>();
  let heading = $state<HTMLHeadingElement>();

  $effect(() => {
    if (dialog === undefined) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Left to the browser, the focus goes to the first thing it can scroll or press: the scrolled panel itself in Chrome,
      // the first facet in Safari. The title is the same stop everywhere, and says where the person is.
      heading?.focus({ preventScroll: true });
    } else if (!open && dialog.open) dialog.close();
  });
</script>

<!--
  A tap on the dimmed page behind is a click on the dialog itself, since the backdrop belongs to it. It is a pointer
  shortcut: the keyboard closes the sheet with Esc or with the button.
-->
<dialog
  bind:this={dialog}
  aria-labelledby={titleId}
  {onclose}
  onclick={(event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  }}
>
  <h2 id={titleId} tabindex="-1" bind:this={heading}>{title}</h2>
  <div class="body">{@render children()}</div>
  <div class="foot">
    <p class="visually-hidden" aria-live="polite">{status}</p>
    <button type="button" onclick={() => dialog?.close()}>{closeLabel}</button>
  </div>
</dialog>

<style>
  /* A modal dialog is centred and as wide as its content: here it is as wide as the window, on its foot. */
  dialog {
    width: 100%;
    max-width: none;
    height: min(88dvh, 720px);
    max-height: none;
    margin: auto 0 0;
    padding: 0;
    border: 0;
    border-top: 1px solid var(--border-strong);
    border-radius: 16px 16px 0 0;
    background: var(--surface-1);
    color: var(--text);
    overflow: hidden;
  }

  dialog[open] {
    display: flex;
    flex-direction: column;
    animation: rise 160ms ease-out;
  }

  dialog::backdrop {
    background: var(--scrim);
  }

  /* The page behind does not scroll under a finger that is on the dimmed part. */
  :global(body:has(dialog[open])) {
    overflow: hidden;
  }

  h2 {
    margin: 0;
    padding: 16px 16px 8px;
    color: var(--text-strong);
    font-size: 17px;
    font-weight: 600;
  }

  /* It has the focus when the sheet opens, and is as wide as the sheet: the ring goes inside, where the sheet does not clip it. */
  h2:focus-visible {
    outline-offset: -2px;
  }

  /*
   * Positioned, so that what is placed absolutely inside it (the units a screen reader hears after the counts) stays in
   * its scrolled area: left to the dialog, it makes the whole sheet scrollable and the title can scroll out of view.
   */
  .body {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    padding: 0 16px 16px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .foot {
    padding: 10px 16px 16px;
    border-top: 1px solid var(--border);
  }

  button {
    width: 100%;
    min-height: 50px;
    border: 0;
    border-radius: 10px;
    background: var(--accent);
    color: var(--bg-bar);
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }

  @keyframes rise {
    from {
      transform: translateY(24px);
      opacity: 0;
    }
  }
</style>
