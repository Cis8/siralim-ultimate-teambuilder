<script lang="ts">
  import { MAX_FILE_LENGTH, type SearchHistory } from '@atlas/core';
  import { tick } from 'svelte';
  import { copy } from '../copy';
  import { saveTextFile } from '../save-text-file';
  import type { SearchHistorySession } from '../search-history-session';
  import BottomSheet from './bottom-sheet.svelte';
  import SearchRow from './search-row.svelte';

  /**
   * The sheet where the recent and saved searches are managed (SPEC §8.3): each can be put in the search field or forgotten, and the
   * lists can be kept as a file (Export) and read back (Import, which adds to what is here). The sheet changes the history it is
   * given and tells the page only what the page has to do: put a search in the field (`onuse`), and that it is shut (`onclose`,
   * by whatever means, as `BottomSheet` says).
   */
  const {
    open,
    history,
    onuse,
    onclose,
  }: {
    open: boolean;
    history: SearchHistorySession;
    onuse: (query: string) => void;
    onclose: () => void;
  } = $props();

  /** A file that is this big in bytes holds more than `MAX_FILE_LENGTH` characters whatever it says (UTF-8 takes three at most for one). */
  const UNREADABLE_BYTES = 3 * MAX_FILE_LENGTH;

  type List = 'recent' | 'saved';

  const searches = $derived<SearchHistory>(history.history);
  /** Both lists as rows: a recent search has no name but itself. */
  const lists = $derived<Record<List, readonly { query: string; name: string }[]>>({
    saved: searches.saved,
    recent: searches.recent.map((query) => ({ query, name: query })),
  });
  /** What a screen reader is told, politely: the live regions of the page behind the sheet are inert. */
  let status = $state('');
  /** What Export or Import did, in words that stay on screen. */
  let outcome = $state('');
  let fileSection = $state<HTMLElement>();
  let fileInput = $state<HTMLInputElement>();
  const sections: Record<List, HTMLElement | undefined> = $state({ recent: undefined, saved: undefined });
  const headings: Record<List, HTMLElement | undefined> = $state({ recent: undefined, saved: undefined });

  function report(message: string): void {
    status = message;
    outcome = message;
  }

  /** Forgets a search; the focus goes to the search that took its place, or to the heading of the list when there is none. */
  async function forget(list: List, query: string, at: number): Promise<void> {
    if (list === 'saved') history.removeSaved(query);
    else history.removeRecent(query);
    status = copy.searchRemoved(query, list);
    await tick();
    const uses = sections[list]?.querySelectorAll<HTMLElement>('button.use') ?? [];
    (uses[Math.min(at, uses.length - 1)] ?? headings[list])?.focus();
  }

  function exportFile(): void {
    if (fileSection === undefined) return;
    saveTextFile(fileSection, copy.searchesFileName, history.exportFile(), 'application/json');
    report(copy.searchesExported(searches.saved.length, searches.recent.length));
  }

  async function importChosen(): Promise<void> {
    const file = fileInput?.files?.[0];
    if (fileInput === undefined || file === undefined) return;
    let message: string;
    try {
      // A file too big to be one of ours is not read: it could be anything, and as large.
      const result =
        file.size > UNREADABLE_BYTES
          ? ({ ok: false, reason: 'too-large' } as const)
          : history.importFile(await file.text());
      message = result.ok ? copy.searchesImported(result.added, result.leftOut) : copy.importRefusals[result.reason];
    } catch {
      message = copy.importUnreadable;
    }
    // The same file can be chosen again: the field would not say it changed.
    fileInput.value = '';
    report(message);
  }
</script>

<BottomSheet
  {open}
  title={copy.manageSearches}
  closeLabel={copy.manageSearchesDone}
  {status}
  variant="choice"
  {onclose}
>
  {#if open}
    {#each ['saved', 'recent'] as const as list (list)}
      {@const found = lists[list]}
      <section bind:this={sections[list]} aria-labelledby="searches-{list}">
        <h3 id="searches-{list}" tabindex="-1" bind:this={headings[list]}>
          {list === 'saved' ? copy.savedSearchesHeading(found.length) : copy.recentSearchesHeading(found.length)}
        </h3>
        {#if found.length === 0}
          <p class="none">{list === 'saved' ? copy.noSavedSearches : copy.noRecentSearches}</p>
        {:else}
          <ul>
            {#each found as { query, name }, at (query)}
              <SearchRow
                {query}
                {name}
                removeLabel={copy.removeSearch(query, list)}
                onuse={() => {
                  onuse(query);
                }}
                onremove={() => {
                  void forget(list, query, at);
                }}
              />
            {/each}
          </ul>
        {/if}
      </section>
    {/each}

    <section class="file" bind:this={fileSection} aria-labelledby="searches-file">
      <h3 id="searches-file">{copy.searchesFileHeading}</h3>
      <p class="hint">{copy.searchesFileHint}</p>
      <div class="actions">
        <button type="button" onclick={exportFile}>{copy.exportSearches}</button>
        <button
          type="button"
          onclick={() => {
            fileInput?.click();
          }}>{copy.importSearches}</button
        >
        <input
          type="file"
          accept="application/json,.json"
          hidden
          aria-label={copy.importSearches}
          bind:this={fileInput}
          onchange={importChosen}
        />
      </div>
      {#if outcome !== ''}<p class="outcome">{outcome}</p>{/if}
    </section>
  {/if}
</BottomSheet>

<style>
  section {
    padding-top: 12px;
  }

  h3 {
    margin: 0 0 4px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h3:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  p {
    margin: 0;
  }

  .none,
  .hint {
    color: var(--text-muted);
    font-size: 13px;
  }

  .file {
    margin-top: 12px;
    border-top: 1px solid var(--border);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  .actions button {
    min-height: var(--target-min);
    padding: 0 16px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--surface-3);
    color: var(--text-strong);
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }

  .actions button:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  .outcome {
    margin-top: 10px;
    color: var(--text);
    font-size: 13px;
  }
</style>
