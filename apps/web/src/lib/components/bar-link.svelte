<script lang="ts">
  import type { ResolvedPathname } from '$app/types';
  import type { Snippet } from 'svelte';
  import BarIcon from './bar-icon.svelte';

  /** A link in the bar at the foot of a narrow screen: the icon over the name, `current` for the page the person is on. */
  const {
    href,
    icon,
    current = false,
    children,
  }: {
    href: ResolvedPathname;
    icon: 'explore' | 'party' | 'synergies';
    current?: boolean;
    children: Snippet;
  } = $props();
</script>

<a class="bar-item" {href} aria-current={current ? 'page' : undefined}>
  <BarIcon name={icon} />
  <span>{@render children()}</span>
</a>
