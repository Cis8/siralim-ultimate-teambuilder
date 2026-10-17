<script lang="ts">
  import { onDestroy } from 'svelte';

  /** How long the answer stays up, so that the line does not keep saying it to someone who has moved on. */
  const FEEDBACK_MS = 2500;

  /**
   * A button that puts `text` on the clipboard, and a polite line that says it did, or that it could not (no clipboard: an
   * insecure page, a browser that refuses). The two are siblings, for the parent to lay out; `feedback` is bindable so that
   * a parent can show the text itself when the copy failed.
   */
  let {
    text,
    label,
    copied,
    failed,
    feedback = $bindable(),
  }: {
    text: string;
    label: string;
    copied: string;
    failed: string;
    feedback?: 'copied' | 'failed' | undefined;
  } = $props();

  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copyText(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      feedback = 'copied';
    } catch {
      feedback = 'failed';
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      feedback = undefined;
    }, FEEDBACK_MS);
  }

  onDestroy(() => {
    clearTimeout(timer);
  });
</script>

<button type="button" onclick={copyText}>{label}</button>
<span class="feedback" class:failed={feedback === 'failed'} aria-live="polite"
  >{feedback === 'copied' ? copied : feedback === 'failed' ? failed : ''}</span
>

<style>
  button {
    min-height: 28px;
    padding: 0 10px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-3);
    color: var(--text);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  button:hover {
    background: var(--surface-2);
  }

  .feedback {
    min-width: 6ch;
    color: var(--status-good);
    font-size: 12px;
  }

  .feedback.failed {
    color: var(--status-crit);
  }

  @media (pointer: coarse) {
    button {
      min-height: var(--target-min);
    }
  }
</style>
