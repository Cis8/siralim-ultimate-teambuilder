<script lang="ts">
  import { copy } from '../copy';

  /** How long the count must stay the same before a screen reader is told: typing changes it with every key. */
  const ANNOUNCE_AFTER_MS = 400;

  const { shown, total }: { shown: number; total: number } = $props();

  const sentence = $derived(copy.resultCount(shown, total));
  let announced = $state('');

  $effect(() => {
    const next = sentence;
    const timer = setTimeout(() => {
      announced = next;
    }, ANNOUNCE_AFTER_MS);
    return () => {
      clearTimeout(timer);
    };
  });
</script>

<!-- Sighted users see the count change at once; the live region follows once typing pauses, so it is said once. -->
<span class="count" aria-hidden="true">{sentence}</span>
<span class="visually-hidden" role="status">{announced}</span>

<style>
  .count {
    color: var(--text-strong);
    font-weight: 600;
  }
</style>
