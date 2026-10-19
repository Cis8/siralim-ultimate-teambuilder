import type { Trait } from '../model/trait';

export interface RelationOptions {
  /** Leave out the traits without material: they can never sit in the Artifact slot (GAME_RULES R1). Never the focus. */
  readonly artifactOnly?: boolean;
}

const hasMaterial = (trait: Trait) => trait.material !== null;
const anyTrait = () => true;

/** Which traits may be listed beside a focus. The focus is no candidate: whoever lists leaves it out before asking. */
export function eligibleTraits(options: RelationOptions): (trait: Trait) => boolean {
  return options.artifactOnly === true ? hasMaterial : anyTrait;
}
