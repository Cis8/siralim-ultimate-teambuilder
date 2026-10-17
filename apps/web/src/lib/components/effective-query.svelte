<script lang="ts">
  import { onDestroy } from 'svelte';
  import { copy } from '../copy';

  /** How long "Copied" stays up, so that the line does not keep saying it to someone who has moved on. */
  const FEEDBACK_MS = 2500;

  /**
   * The query the whole state stands for, filters included, as text to read and to copy (SPEC §8.1): typed in the query
   * bar anywhere, it finds the same traits. Nothing is shown while there is no filter and no query.
   */
  const { query }: { query: string } = $props();

  let feedback = $state<'copied' | 'failed' | undefined>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copyQuery(): Promise<void> {
    try {
      await navigator.clipboard.writeText(query);
      feedback = 'copied';
    } catch {
      // No clipboard (an insecure page, a browser that refuses): the text is on the page, to select.
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

{#if query !== ''}
  <div class="effective">
    <span class="label">{copy.effectiveQueryLabel}</span>
    <code>{query}</code>
    <button type="button" onclick={copyQuery}>{copy.copyQuery}</button>
    <span class="feedback" class:failed={feedback === 'failed'} aria-live="polite"
      >{feedback === 'copied' ? copy.copiedQuery : feedback === 'failed' ? copy.copyFailed : ''}</span
    >
  </div>
{/if}

<style>
  .effective {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    font-size: 12.5px;
  }

  .label {
    color: var(--text-faint);
  }

  code {
    flex: 1 1 280px;
    min-width: 0;
    color: var(--text);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

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
