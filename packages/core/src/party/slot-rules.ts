import type { Trait } from '../model/trait';
import type { SlotRule } from './slot-rule';
import { createSlotRuleRegistry } from './slot-rule-registry';

/**
 * Mastery, backer and other special traits (Nether Boss, Boss, Pandemonium, Nether Room) are artifacts only
 * (GAME_RULES R6). A class never seen before is `other` (R7), so it is artifact-only too until the owner says otherwise.
 */
const specialTraitsArtifactOnly: SlotRule = {
  id: 'special-traits-artifact-only',
  refusal: (trait, slot) =>
    slot !== 'artifact' && (trait.kind === 'mastery' || trait.kind === 'backer' || trait.kind === 'other')
      ? `${specialKindName(trait)} traits can only go in the Artifact slot.`
      : null,
};

/** An Avatar is the first creature of a fusion, never the second, and no artifact (GAME_RULES R6). */
const avatarInnateOnly: SlotRule = {
  id: 'avatar-innate-only',
  refusal: (trait, slot) =>
    trait.kind === 'avatar' && slot !== 'innate' ? 'Avatar traits can only go in the Innate slot.' : null,
};

/** A trait with no material cannot be granted by an artifact (GAME_RULES R1). */
const artifactNeedsMaterial: SlotRule = {
  id: 'artifact-needs-material',
  refusal: (trait, slot) =>
    slot === 'artifact' && trait.material === null
      ? 'This trait has no material, so it cannot go in the Artifact slot.'
      : null,
};

/** How the sheet and the game call the kind: "Mastery", "Backer", or the class of an `other` trait ("Nether Boss"). */
function specialKindName({ kind, class: className }: Trait): string {
  if (kind === 'mastery') return 'Mastery';
  if (kind === 'backer') return 'Backer';
  return className;
}

/**
 * Where a trait may sit in a party (GAME_RULES R1, R6): the rules about what the trait is come before the one about its
 * material, so a refusal says the most basic thing first. Together they give the table of R1: Innate takes creature and
 * Avatar traits, Fused creature traits only, Artifact anything with a material but an Avatar.
 */
export const slotRules = createSlotRuleRegistry([specialTraitsArtifactOnly, avatarInnateOnly, artifactNeedsMaterial]);
