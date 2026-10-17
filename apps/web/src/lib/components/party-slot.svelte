<script lang="ts">
  import { tick } from 'svelte';
  import { lostTraitSearch, type SlotPosition, type Trait } from '@atlas/core';
  import { classColour } from '../class-colour';
  import { copy } from '../copy';

  /**
   * One of the 18 slots of the party: a button that makes it the target (a toggle: `aria-pressed` says it is) and, when it
   * holds a trait, one that clears it. `id` is what the slot holds, `trait` what the dataset knows of it: an id it does not
   * know (a link made on another version) is kept and shown as it is, "not found in" the version in use, with a search for
   * the name its id keeps (SPEC §5).
   */
  const {
    at,
    id,
    trait,
    isTarget,
    datasetVersion,
    onchoose,
    onclear,
    onfindlost,
  }: {
    at: SlotPosition;
    id: string | null;
    trait: Trait | undefined;
    isTarget: boolean;
    datasetVersion: string;
    onchoose: () => void;
    onclear: () => void;
    /** Search for the trait the id stood for. */
    onfindlost: () => void;
  } = $props();

  let chooseButton = $state<HTMLButtonElement>();

  const held = $derived(id === null ? undefined : (trait?.name ?? `${id} (${copy.notFoundIn(datasetVersion)})`));
  const lostName = $derived(id !== null && trait === undefined ? lostTraitSearch(id).name : '');

  /** The clear button goes with the trait, and would take the focus with it: it goes to the slot's other button. */
  async function clear(): Promise<void> {
    onclear();
    await tick();
    chooseButton?.focus();
  }
</script>

<div class="slot" class:target={isTarget}>
  <button
    type="button"
    class="choose"
    aria-pressed={isTarget}
    aria-label={copy.targetSlot(at, held)}
    bind:this={chooseButton}
    onclick={onchoose}
  >
    <span class="kind">{copy.slotNames[at.slot]}</span>
    {#if id === null}
      <span class="name empty">{copy.emptySlot}</span>
    {:else if trait !== undefined}
      <span class="dot" style:background={classColour(trait.class)} aria-hidden="true"></span>
      <span class="name">{trait.name}</span>
    {:else}
      <span class="name unknown">{id}<span class="note"> · {copy.notFoundIn(datasetVersion)}</span></span>
    {/if}
    {#if isTarget}<span class="tag">{copy.targetTag}</span>{/if}
  </button>
  {#if held !== undefined}
    <button
      type="button"
      class="clear"
      aria-label={copy.clearSlot(at, held)}
      title={copy.clearSlot(at, held)}
      onclick={clear}
    >
      <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
        <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
      </svg>
    </button>
  {/if}
</div>
{#if lostName !== ''}
  <button type="button" class="find" onclick={onfindlost}>{copy.searchForLost(lostName)}</button>
{/if}

<style>
  .slot {
    display: flex;
    align-items: stretch;
    gap: 4px;
  }

  button {
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    background: var(--surface-3);
  }

  .choose {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    min-height: 32px;
    padding: 0 8px;
    font-size: 12.5px;
    text-align: left;
  }

  .choose[aria-pressed='true'] {
    border-color: var(--accent-border);
    background: var(--accent-surface);
    color: var(--text-strong);
  }

  .kind {
    flex: none;
    width: 58px;
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .choose[aria-pressed='true'] .kind {
    color: var(--text-muted);
  }

  .dot {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 2px;
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    color: var(--text-faint);
  }

  .unknown {
    color: var(--status-warn);
  }

  .note {
    color: var(--text-muted);
  }

  .tag {
    flex: none;
    color: var(--accent);
    font-size: 11px;
    font-weight: 600;
  }

  .find {
    align-self: flex-start;
    min-height: 28px;
    margin-top: 2px;
    padding: 0 8px;
    font-size: 12px;
  }

  .clear {
    display: grid;
    place-items: center;
    flex: none;
    width: 32px;
    color: var(--text-muted);
  }

  @media (pointer: coarse) {
    .choose {
      min-height: var(--target-min);
    }

    .clear {
      width: var(--target-min);
    }

    .find {
      min-height: var(--target-min);
    }
  }
</style>
