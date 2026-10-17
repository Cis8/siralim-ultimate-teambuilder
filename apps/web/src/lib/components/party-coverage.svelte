<script lang="ts">
  import { taxonomy, type ClickedKeyword, type PartyCoverage, type SlotPosition } from '@atlas/core';
  import { copy } from '../copy';

  /**
   * What the party gives and what it needs (SPEC §8.2): the buffs, debuffs and effects it applies, those it relies on with
   * the status of each (covered, or missing: a button that shows the traits that could apply it), and the non-stacking
   * traits it holds more than once. A status is an icon and a word, never a colour alone (DESIGN § Colour rules).
   */
  const { coverage, onfind }: { coverage: PartyCoverage; onfind: (keyword: ClickedKeyword) => void } = $props();

  const entryOf = (key: string) => taxonomy.get(key);
  const labelOf = (key: string): string => entryOf(key)?.label ?? key;
  const kindClass = (key: string): string => `kind-${entryOf(key)?.kind ?? 'unknown'}`;
  const placesLabel = (places: readonly SlotPosition[]): string[] => places.map(copy.slotLabel);
</script>

<section class="coverage" aria-labelledby="coverage-heading">
  <h3 id="coverage-heading">{copy.coverageHeading}</h3>

  <div class="line">
    <h4>{copy.coverageApplies}</h4>
    <ul>
      {#each coverage.applies as key (key)}
        <li><span class="chip {kindClass(key)}">{labelOf(key)}</span></li>
      {:else}
        <li class="none">{copy.coverageNothing}</li>
      {/each}
    </ul>
  </div>

  <div class="line">
    <h4>{copy.coverageRelies}</h4>
    <ul>
      {#each coverage.relies as dependency (dependency.key)}
        {@const label = labelOf(dependency.key)}
        <li>
          <button
            type="button"
            class="chip {kindClass(dependency.key)} {dependency.status}"
            aria-label={copy.dependency(label, dependency.status)}
            title={copy.dependency(label, dependency.status)}
            onclick={() => {
              const kind = entryOf(dependency.key)?.kind ?? 'debuff';
              onfind({ key: dependency.key, kind, role: 'uses' });
            }}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
              {#if dependency.status === 'covered'}
                <path
                  d="M3 8.5 6.5 12 13 4.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              {:else}
                <path
                  d="M8 1.5 15 14H1z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linejoin="round"
                />
                <path d="M8 6v4M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              {/if}
            </svg>
            <span class="label">{label}</span>
            <span class="status">{copy[dependency.status]}</span>
          </button>
        </li>
      {:else}
        <li class="none">{copy.coverageNothing}</li>
      {/each}
    </ul>
  </div>

  {#if coverage.duplicates.length > 0}
    <div class="duplicates">
      <h4>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false">
          <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
          <path d="M8 6v4M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        {copy.duplicatesHeading}
      </h4>
      <ul>
        {#each coverage.duplicates as duplicate (duplicate.trait.id)}
          <li>{copy.duplicate(duplicate.trait.name, placesLabel(duplicate.positions))}</li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

<style>
  .coverage {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  h3,
  h4 {
    margin: 0;
  }

  h3 {
    color: var(--text-faint);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .line {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  h4 {
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 400;
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .none {
    color: var(--text-faint);
    font-size: 12px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 24px;
    padding: 0 8px;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface-3);
    font: inherit;
    font-size: 12px;
  }

  button.chip {
    cursor: pointer;
  }

  button.chip:hover {
    background: var(--surface-2);
  }

  .kind-debuff {
    color: var(--kw-debuff);
  }

  .kind-buff {
    color: var(--kw-buff);
  }

  .kind-effect {
    color: var(--kw-mechanic);
  }

  .kind-unknown {
    color: var(--text);
  }

  .status {
    font-size: 11px;
  }

  .covered .status,
  .covered svg {
    color: var(--status-good);
  }

  .missing {
    border-color: var(--status-crit);
  }

  .missing .status,
  .missing svg {
    color: var(--status-crit);
  }

  .duplicates {
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: var(--status-warn);
    font-size: 12px;
  }

  .duplicates h4 {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--status-warn);
    font-weight: 600;
  }

  .duplicates ul {
    flex-direction: column;
    gap: 2px;
    color: var(--text);
  }

  @media (pointer: coarse) {
    button.chip {
      min-height: var(--target-min);
    }
  }
</style>
