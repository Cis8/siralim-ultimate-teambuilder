<script lang="ts">
  import { onMount } from 'svelte';
  import { loadSearchService } from '../lib/composition-root';
  import { copy } from '../lib/copy';

  type Loading =
    | { readonly state: 'loading' }
    | { readonly state: 'ready'; readonly traitCount: number; readonly datasetVersion: string }
    | { readonly state: 'failed' };

  let loading = $state<Loading>({ state: 'loading' });

  onMount(() => {
    loadSearchService().then(
      ({ traitCount, datasetVersion }) => {
        loading = { state: 'ready', traitCount, datasetVersion };
      },
      () => {
        loading = { state: 'failed' };
      },
    );
  });
</script>

<svelte:head>
  <title>{copy.pageTitle}</title>
</svelte:head>

<h1>{copy.homeHeading}</h1>
<p class="intro">{copy.homeIntro}</p>

{#if loading.state === 'failed'}
  <p class="status failed" role="alert">
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
      <path d="M8 6v4M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
    {copy.traitsFailed}
  </p>
{:else}
  <p class="status" role="status">
    {loading.state === 'ready' ? copy.traitsLoaded(loading.traitCount, loading.datasetVersion) : copy.loadingTraits}
  </p>
{/if}

<style>
  h1 {
    margin: 0 0 8px;
    color: var(--text-strong);
    font-size: 22px;
    font-weight: 600;
  }

  .intro {
    max-width: 70ch;
    margin: 0 0 8px;
  }

  .status {
    margin: 0;
    color: var(--text-faint);
  }

  .failed {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--status-crit);
  }
</style>
