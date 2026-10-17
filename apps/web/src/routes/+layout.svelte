<script lang="ts">
  import '../lib/styles/fonts.css';
  import '../lib/styles/tokens.css';
  import '../lib/styles/base.css';
  import type { Snippet } from 'svelte';
  import ExternalLink from '../lib/components/external-link.svelte';
  import { copy } from '../lib/copy';

  const { children }: { children: Snippet } = $props();
</script>

<a class="skip-link" href="#main">{copy.skipToContent}</a>

<header class="app-header">
  <span class="brand">{copy.appName}</span>
  <span class="tagline">{copy.appTagline}</span>
</header>

<main id="main" tabindex="-1">
  {@render children()}
</main>

<footer class="app-footer">
  <p>
    {copy.dataCreditBefore}<ExternalLink href={copy.compendiumUrl}>{copy.compendiumName}</ExternalLink
    >{copy.dataCreditAfter}
  </p>
  <p>{copy.unofficial}</p>
</footer>

<style>
  .skip-link {
    position: absolute;
    left: 8px;
    top: -100px;
    padding: 8px 12px;
    background: var(--surface-3);
    color: var(--text-strong);
    border-radius: var(--radius);
    z-index: 10;
  }

  .skip-link:focus {
    top: 8px;
  }

  .app-header {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 4px 12px;
    padding: 12px 16px;
    background: var(--bg-bar);
    border-bottom: 1px solid var(--border);
  }

  .brand {
    color: var(--text-strong);
    font-weight: 600;
    font-size: 16px;
  }

  .tagline {
    color: var(--text-muted);
  }

  /* Pages lay themselves out edge to edge: Explore is three columns separated by rules. */
  main {
    display: flex;
    flex: 1;
    flex-direction: column;
    width: 100%;
  }

  main:focus {
    outline: none;
  }

  .app-footer {
    padding: 16px;
    border-top: 1px solid var(--border);
    background: var(--bg-bar);
    color: var(--text-muted);
    font-size: 13px;
  }

  .app-footer p {
    margin: 0 0 4px;
  }
</style>
