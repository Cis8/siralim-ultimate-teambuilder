<script lang="ts">
  import type { SlotPosition } from '@atlas/core';
  import { partySession } from '../composition-root';
  import SlotChooser from './slot-chooser.svelte';

  /**
   * The choice of slot for a trait the target refuses, wired to the party of the session. A page that has an "add" button puts it
   * on the page and not in a card: the cards are drawn and dropped as the person moves, and a card can be gone while the sheet is open.
   */
</script>

<SlotChooser
  trait={partySession.choosing}
  member={partySession.planner.target.member}
  reason={partySession.choosing === undefined ? '' : (partySession.actions.refusal(partySession.choosing) ?? '')}
  choices={partySession.choices}
  onchoose={(position: SlotPosition) => partySession.addToChosenSlot(position)}
  onclose={() => {
    partySession.closeChooser();
  }}
/>
