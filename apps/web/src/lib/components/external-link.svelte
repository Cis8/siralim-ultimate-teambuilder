<script lang="ts">
  import type { Snippet } from 'svelte';

  /** A link that leaves the app. Internal links must go through `resolve()` from `$app/paths` instead. */
  const { href, children }: { href: `https://${string}`; children: Snippet } = $props();
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external URL, not an app route -->
<a {href} rel="noopener noreferrer">{@render children()}</a>
