<script lang="ts">
  import { copy } from '../copy';

  /**
   * "Artifact-eligible only" (`mat=yes`): leaves out the traits that have no material, which can never sit in the Artifact slot
   * (GAME_RULES R1). The focus is never left out.
   */
  const { checked, onchange }: { checked: boolean; onchange: (checked: boolean) => void } = $props();
</script>

<label>
  <input
    type="checkbox"
    {checked}
    onchange={(event) => {
      onchange(event.currentTarget.checked);
    }}
  />
  {copy.artifactOnly}
</label>

<style>
  label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
  }

  input {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--accent);
  }

  @media (pointer: coarse) {
    label {
      min-height: var(--target-min);
    }
  }
</style>
