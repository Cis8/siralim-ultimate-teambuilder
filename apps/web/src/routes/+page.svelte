<script lang="ts">
  import { copy } from '../lib/copy';
</script>

<svelte:head>
  <title>{copy.pageTitle}</title>
</svelte:head>

<h1>{copy.homeHeading}</h1>
<p class="intro">{copy.homeIntro}</p>
<p class="status">{copy.homeStatus}</p>

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
</style>
