<script lang="ts">
  import { copy } from '../copy';
  import { keepFieldFocus } from '../keep-field-focus';
  import IssueIcon from './issue-icon.svelte';

  /**
   * How many issues the query has, inside the search field: it is drawn there so that a query that arrives with the address
   * moves nothing on the page. It opens and shuts the list of the issues under the field. The colour and the icon are those of
   * the worst one, and the count says it in words.
   */
  const {
    count,
    hasErrors,
    open,
    controls,
    onpress,
  }: { count: number; hasErrors: boolean; open: boolean; controls: string; onpress: () => void } = $props();
</script>

<button type="button" aria-expanded={open} aria-controls={controls} onclick={onpress} {@attach keepFieldFocus}>
  <span class="pill" class:error={hasErrors}>
    <IssueIcon severity={hasErrors ? 'error' : 'warning'} />
    {copy.issueCount(count)}
  </span>
</button>

<style>
  /* The button is the target and the pill is what is drawn: a finger is given the whole height of the field, over its border, where the pill is 24 px. */
  button {
    flex: none;
    display: flex;
    align-items: center;
    align-self: stretch;
    margin-block: -1px;
    padding: 0 12px 0 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 9px;
    border: 1px solid currentColor;
    border-radius: 12px;
    color: var(--status-warn);
    font-family: var(--font-mono);
    font-size: 12px;
    white-space: nowrap;
  }

  .pill.error {
    color: var(--status-crit);
  }

  /* The ring is drawn around the pill; the frame of the field draws one too, around the whole of it. */
  button:focus-visible {
    outline: none;
  }

  button:focus-visible .pill {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
</style>
