<script lang="ts">
  import { copy } from '../copy';
  import { tabForKey } from '../page-tab';
  import type { SynergySection } from '../synergy-address';
  import { sectionPanelId, sectionTabId } from '../synergy-sections';

  /** A tab of the list: the section it brings forward, its words, and how many traits it holds. */
  interface SectionTab {
    readonly section: SynergySection;
    readonly label: string;
    readonly count: number;
  }

  /**
   * The lists of a Synergy page as tabs, for a narrow screen where they cannot stand side by side (DESIGN § Synergy pages, ARIA tabs
   * pattern): the selected tab is the one in the tab order, the arrows, Home and End move along them and select as they go, and each
   * tab names the panel it shows. The page keeps the panels (`panelAttributes`); this says which is on show and asks for another.
   * The count is spoken as words, "Enabled by 36 traits", as the heading of the same list is.
   */
  const {
    label,
    tabs,
    selected,
    onselect,
  }: {
    label: string;
    tabs: readonly SectionTab[];
    selected: SynergySection;
    onselect: (section: SynergySection) => void;
  } = $props();

  const buttons: Partial<Record<SynergySection, HTMLButtonElement>> = {};
  const sections = $derived(tabs.map((tab) => tab.section));

  /**
   * A key goes along from the tab it was pressed on, which is where the focus is, and not from `selected`: that follows the address,
   * a navigation behind the key, so a key that repeats would start again from the tab it left (a tab list may be crossed in a blink).
   */
  function keydown(event: KeyboardEvent, from: SynergySection): void {
    const next = tabForKey(event.key, from, sections);
    if (next === undefined) return;
    event.preventDefault();
    buttons[next]?.focus();
    onselect(next);
  }
</script>

<div class="tabs" role="tablist" aria-label={label}>
  {#each tabs as tab (tab.section)}
    <button
      type="button"
      role="tab"
      id={sectionTabId(tab.section)}
      aria-selected={tab.section === selected}
      aria-controls={sectionPanelId(tab.section)}
      tabindex={tab.section === selected ? 0 : -1}
      bind:this={buttons[tab.section]}
      onkeydown={(event) => {
        keydown(event, tab.section);
      }}
      onclick={() => {
        onselect(tab.section);
      }}
    >
      <span class="name">{tab.label}</span>
      <span class="count">{tab.count}<span class="visually-hidden">{copy.countUnit(tab.count)}</span></span>
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: 2px;
    padding: 3px;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    background: var(--surface-1);
  }

  button {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    min-width: 0;
    min-height: var(--target-min);
    padding: 4px 2px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: var(--text-muted);
    font: inherit;
    font-size: 12.5px;
    cursor: pointer;
  }

  .name {
    max-width: 100%;
    overflow-wrap: anywhere;
    text-align: center;
  }

  .count {
    font-family: var(--font-mono);
    font-size: 11px;
  }

  button[aria-selected='true'] {
    border-color: var(--accent-border);
    background: var(--accent-surface);
    color: var(--text-strong);
    font-weight: 600;
  }

  button:not([aria-selected='true']):hover {
    background: var(--surface-3);
  }

  /* The ring goes inside: the tabs fill the frame, which would clip it. */
  button:focus-visible {
    outline-offset: -2px;
  }
</style>
