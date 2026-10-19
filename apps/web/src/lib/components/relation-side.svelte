<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import { taxonomy, type KeywordKey, type RelationSide, type Trait, type TraitId } from '@atlas/core';
  import { copy } from '../copy';
  import { keyLabel } from '../key-label';
  import type { PartyActions } from '../party-actions';
  import KeyPill from './key-pill.svelte';
  import TraitLane from './trait-lane.svelte';

  /**
   * One side of the page of a trait: what enables the focus, or what it enables (SPEC §8.4). The traits tied through two keys of
   * the focus or more come first, in a lane of their own, then a lane for each key that has traits of its own; a key that
   * nobody gives (or relies on) is said last, so that a gap is not mistaken for a lane that has not loaded.
   */
  const {
    side,
    direction,
    focus,
    artifactOnly,
    party,
    hrefOf,
  }: {
    side: RelationSide;
    direction: 'enabledBy' | 'enables';
    focus: Trait;
    artifactOnly: boolean;
    party: PartyActions;
    hrefOf: (id: TraitId) => ResolvedPathname;
  } = $props();

  const uid = $props.id();
  const enabledBy = $derived(direction === 'enabledBy');
  /** Only a buff, a debuff or an effect can be a lane's key; anything else would be a fault of the dataset, drawn as an effect. */
  const kindOf = (key: KeywordKey): 'debuff' | 'buff' | 'effect' => {
    const kind = taxonomy.get(key)?.kind;
    return kind === 'debuff' || kind === 'buff' ? kind : 'effect';
  };
  /** The focus has no key of this role at all: every key it has is a lane or an unmet key. */
  const noKeys = $derived(side.count === 0 && side.unmet.length === 0);
</script>

<section class="side" aria-labelledby="{uid}-title">
  <header>
    <h2 id="{uid}-title">
      {enabledBy ? copy.enabledBy : copy.enables}
      <span class="count">{side.count}<span class="visually-hidden">{copy.countUnit(side.count)}</span></span>
    </h2>
    <p class="hint">{enabledBy ? copy.enabledByHint(focus.name) : copy.enablesHint(focus.name)}</p>
  </header>

  {#if noKeys}
    <p class="note">{enabledBy ? copy.selfSufficient(focus.name) : copy.appliesNothingByName(focus.name)}</p>
  {/if}

  {#if side.several.length > 0}
    <TraitLane entries={side.several} {party} {hrefOf} {keyLabel} namesKeys hint={copy.severalKeysHint(direction)}>
      {#snippet heading()}
        <span>{copy.severalKeys}</span>
      {/snippet}
    </TraitLane>
  {/if}

  {#each side.single as lane (lane.key)}
    <TraitLane entries={lane.entries} {party} {hrefOf} {keyLabel} namesKeys={false}>
      {#snippet heading()}
        <KeyPill kind={kindOf(lane.key)}>
          {enabledBy ? copy.laneApplies(keyLabel(lane.key)) : copy.laneRelies(keyLabel(lane.key))}
        </KeyPill>
      {/snippet}
    </TraitLane>
  {/each}

  {#each side.unmet as key (key)}
    <p class="note unmet" class:missing={enabledBy}>
      {enabledBy ? copy.noApplier(keyLabel(key), artifactOnly) : copy.noUser(keyLabel(key), artifactOnly)}
    </p>
  {/each}
</section>

<style>
  .side {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }

  header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  h2 {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .count {
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 400;
  }

  .hint {
    margin: 0;
    color: var(--text-faint);
    font-size: 12.5px;
  }

  .note {
    margin: 0;
    padding: 12px 14px;
    border: 1px dashed var(--border-strong);
    border-radius: 8px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .note.missing {
    border-color: var(--issue-error-border);
    color: var(--status-crit);
  }
</style>
