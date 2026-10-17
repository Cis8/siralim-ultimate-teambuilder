<script lang="ts">
  import { tick } from 'svelte';
  import {
    canRedo,
    canUndo,
    MEMBER_INDEXES,
    partyCoverage,
    sameSlot,
    SLOT_NAMES,
    SLOT_POSITIONS,
    traitAt,
    type ClickedKeyword,
    type MemberIndex,
    type Planner,
    type SlotPosition,
    type TraitId,
    type TraitLookup,
  } from '@atlas/core';
  import { copy } from '../copy';
  import CopyButton from './copy-button.svelte';
  import PartyCoverage from './party-coverage.svelte';
  import PartySlot from './party-slot.svelte';

  /**
   * The party planner (SPEC §8.2): six creatures of three slots each, the slot that results fill, undo and redo, and the
   * coverage of what is in it. It shows `planner` and says what the player asked for; the page changes the planner.
   */
  const {
    planner,
    lookup,
    datasetVersion,
    address,
    onchoose,
    onclear,
    onclearall,
    onundo,
    onredo,
    onfind,
    onfindlost,
  }: {
    planner: Planner;
    lookup: TraitLookup;
    /** The version of the dataset in use: the one an id that is not in it was not found in. */
    datasetVersion: string;
    /** The link to this party and this search, for the copy button. */
    address: string;
    onchoose: (at: SlotPosition) => void;
    onclear: (at: SlotPosition) => void;
    onclearall: () => void;
    onundo: () => void;
    onredo: () => void;
    onfind: (keyword: ClickedKeyword) => void;
    onfindlost: (id: TraitId) => void;
  } = $props();

  let panel = $state<HTMLDivElement>();
  let linkFeedback = $state<'copied' | 'failed'>();

  const party = $derived(planner.history.party);
  const filled = $derived(SLOT_POSITIONS.filter((at) => traitAt(party, at) !== null).length);
  const coverage = $derived(partyCoverage(party, lookup));
  const undoable = $derived(canUndo(planner.history));
  const redoable = $derived(canRedo(planner.history));

  /** What a creature is called: its first creature's name, which is the trait in the Innate slot (GAME_RULES R2). */
  function creatureName(member: MemberIndex): string {
    const id = traitAt(party, { member, slot: 'innate' });
    if (id === null) return copy.noCreatureYet;
    const trait = lookup(id);
    return trait?.creature ?? trait?.name ?? id;
  }

  function undo(): void {
    if (undoable) onundo();
  }

  function redo(): void {
    if (redoable) onredo();
  }

  /** The party is empty and the button that cleared it is the one with the focus: the first slot takes it. */
  async function clearAll(): Promise<void> {
    if (filled === 0) return;
    onclearall();
    await tick();
    panel?.querySelector<HTMLButtonElement>('button.choose')?.focus();
  }
</script>

<div class="planner" bind:this={panel}>
  <div class="toolbar" role="group" aria-label={copy.partyToolbarLabel}>
    <span class="count">{copy.partyFilled(filled)}</span>
    <button type="button" aria-disabled={undoable ? undefined : 'true'} onclick={undo}>{copy.undo}</button>
    <button type="button" aria-disabled={redoable ? undefined : 'true'} onclick={redo}>{copy.redo}</button>
    <button type="button" aria-disabled={filled === 0 ? 'true' : undefined} onclick={clearAll}>{copy.clearParty}</button
    >
    <CopyButton
      text={address}
      label={copy.copyLink}
      copied={copy.linkCopied}
      failed={copy.copyLinkFailed}
      bind:feedback={linkFeedback}
    />
  </div>
  {#if linkFeedback === 'failed'}<code class="link">{address}</code>{/if}

  <ol class="members">
    {#each MEMBER_INDEXES as member (member)}
      <li class="member">
        <p class="head">
          <span class="label">{copy.creatureLabel(member)}</span>
          <span class="creature">{creatureName(member)}</span>
        </p>
        <ul class="slots">
          {#each SLOT_NAMES as slot (slot)}
            {@const at = { member, slot }}
            {@const id = traitAt(party, at)}
            <li>
              <PartySlot
                {at}
                {id}
                trait={id === null ? undefined : lookup(id)}
                isTarget={sameSlot(at, planner.target)}
                {datasetVersion}
                onchoose={() => {
                  onchoose(at);
                }}
                onclear={() => {
                  onclear(at);
                }}
                onfindlost={() => {
                  if (id !== null) onfindlost(id);
                }}
              />
            </li>
          {/each}
        </ul>
      </li>
    {/each}
  </ol>

  <PartyCoverage {coverage} {onfind} />
</div>

<style>
  .planner {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .count {
    margin-right: auto;
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 11.5px;
  }

  .link {
    color: var(--text);
    font-size: 11.5px;
    overflow-wrap: anywhere;
  }

  .toolbar button {
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

  .toolbar button:hover {
    background: var(--surface-2);
  }

  .toolbar button[aria-disabled='true'] {
    border-color: var(--border);
    color: var(--text-faint);
    cursor: default;
  }

  .toolbar button[aria-disabled='true']:hover {
    background: var(--surface-3);
  }

  ol,
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .members {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .member {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0;
  }

  .label {
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .creature {
    color: var(--text);
    font-size: 13px;
    font-weight: 500;
  }

  .slots {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  @media (pointer: coarse) {
    .toolbar button {
      min-height: var(--target-min);
    }
  }
</style>
