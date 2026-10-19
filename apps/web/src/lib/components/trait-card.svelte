<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import type { Trait } from '@atlas/core';
  import { classColour } from '../class-colour';
  import { copy } from '../copy';
  import type { PartyActions } from '../party-actions';
  import AddButton from './add-button.svelte';
  import PartyNotes from './party-notes.svelte';

  /**
   * A trait beside the one in focus, small enough for a long list (DESIGN § Synergy pages): its name, which is a link that moves
   * the focus to it, where it comes from, what ties it to the focus, and the "add" button with what the party says. `badge` is
   * "×2 links", `tier` how it gives the key when that is not by name, `detail` a line of its own (the keys, the reason for an
   * alternative). The link is named "Re-centre on X" unless `linkName` says what else it does: a keyword has no trait at its centre.
   */
  const {
    trait,
    party,
    href,
    badge,
    tier,
    detail,
    linkName,
  }: {
    trait: Trait;
    party: PartyActions;
    href: ResolvedPathname;
    badge?: string | undefined;
    tier?: 'conditional' | 'random' | undefined;
    detail?: string | undefined;
    linkName?: string | undefined;
  } = $props();

  // A trait can be in two lists of the page, so the id of the note that gives a refusal is the card's, not the trait's.
  const uid = $props.id();
  const reasonId = $derived(`${uid}-reason`);
</script>

<li class="card">
  <span class="dot" style:background={classColour(trait.class)} aria-hidden="true"></span>
  <div class="body">
    <a class="name" {href} aria-label={linkName ?? copy.recentre(trait.name)}>{trait.name}</a>
    <p class="origin">
      {trait.creature === null
        ? `${copy.traitKind[trait.kind]} · ${trait.family}`
        : `${trait.creature} · ${trait.class}`}
    </p>
    {#if detail !== undefined}<p class="detail">{detail}</p>{/if}
    {#if badge !== undefined || tier !== undefined || trait.material === null}
      <p class="tags">
        {#if badge !== undefined}<span class="tag badge">{badge}</span>{/if}
        {#if tier !== undefined}<span class="tag">{copy.tiers[tier]}</span>{/if}
        {#if trait.material === null}
          <span class="tag missing">
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false">
              <path d="M12 3 4 7.5v9L12 21l8-4.5v-9z" fill="none" stroke="currentColor" stroke-width="2" />
              <path d="M4 7.5 12 12l8-4.5M12 12v9" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
            {copy.noMaterialTag}
          </span>
        {/if}
      </p>
    {/if}
  </div>
  <AddButton {trait} {party} variant="compact" {reasonId} />
  <div class="notes-cell"><PartyNotes {trait} {party} {reasonId} /></div>
</li>

<style>
  .card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      'dot body add'
      '. notes notes';
    align-items: start;
    gap: 4px 10px;
    padding: 8px 8px 8px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-1);
  }

  .dot {
    grid-area: dot;
    width: 8px;
    height: 8px;
    margin-top: 7px;
    border-radius: 2px;
  }

  .body {
    display: flex;
    grid-area: body;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .card > :global(.add) {
    grid-area: add;
  }

  .notes-cell {
    --notes-align: flex-start;
    --notes-text-align: left;

    grid-area: notes;
  }

  .notes-cell:empty {
    display: none;
  }

  p {
    margin: 0;
  }

  .name {
    align-self: flex-start;
    color: var(--text-strong);
    font-size: 13.5px;
    font-weight: 600;
    text-decoration: none;
  }

  .name:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .origin,
  .detail {
    color: var(--text-muted);
    font-size: 12px;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 6px;
    margin-top: 3px;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 7px;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .badge {
    border-color: var(--accent-border);
    background: var(--accent-surface);
    color: var(--text-strong);
  }

  .missing {
    color: var(--status-crit);
  }

  @media (pointer: coarse) {
    /* A link is a target for a finger: the whole name, at least 44 px each way. */
    .name {
      display: inline-flex;
      align-items: center;
      min-width: var(--target-min);
      min-height: var(--target-min);
    }
  }
</style>
