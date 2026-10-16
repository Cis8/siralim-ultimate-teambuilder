import type { KeywordHit, KeywordRole, RandomDebuffSource, Trait } from '@atlas/core';
import { OverridesError } from './overrides-error';
import type { Overrides, RandomDebuffOverride, RoleOverride } from './parse-overrides';

export interface AppliedOverrides {
  readonly traits: readonly Trait[];
  /** Overrides that change nothing: probably left over from a fix the extractor now makes by itself. */
  readonly warnings: readonly string[];
}

/**
 * Puts the hand-made corrections over what the extractor guessed. An override that names a trait or a mention that
 * does not exist is an error, not skipped: the data it was written for has changed and it needs a look.
 *
 * @throws OverridesError listing every override that does not fit.
 */
export function applyOverrides(traits: readonly Trait[], overrides: Overrides): AppliedOverrides {
  const byId = new Map(traits.map((trait) => [trait.id, trait]));
  const problems: string[] = [];
  const warnings: string[] = [];

  const newRoles = new Map<string, Map<number, KeywordRole>>(); // trait id → keyword index → role
  const claimed = new Map<string, number>(); // "trait id|keyword index" → the override that set it
  overrides.roles.forEach((override, index) => {
    const label = `roles[${index}]`;
    const trait = byId.get(override.trait);
    if (trait === undefined) return void problems.push(`${label}: there is no trait "${override.trait}"`);

    const targets = mentionsToChange(trait, override, label, problems);
    if (targets.length === 0) return;

    const clash = targets
      .map(({ position }) => claimed.get(`${trait.id}|${position}`))
      .find((other) => other !== undefined);
    if (clash !== undefined) {
      return void problems.push(
        `${label}: sets the same mention of "${override.keyword}" in "${trait.id}" as roles[${clash}]`,
      );
    }

    for (const { position } of targets) claimed.set(`${trait.id}|${position}`, index);
    if (targets.every(({ hit }) => hit.role === override.role)) {
      warnings.push(
        `${label}: in "${trait.id}", "${override.keyword}" is already "${override.role}"; this changes nothing`,
      );
    }
    const changes = newRoles.get(trait.id) ?? new Map<number, KeywordRole>();
    for (const { position } of targets) changes.set(position, override.role);
    newRoles.set(trait.id, changes);
  });

  const newSources = new Map<string, RandomDebuffSource>();
  const sourceSetBy = new Map<string, number>();
  overrides.randomDebuff.forEach((override, index) => {
    const label = `randomDebuff[${index}]`;
    const trait = byId.get(override.trait);
    if (trait === undefined) return void problems.push(`${label}: there is no trait "${override.trait}"`);
    const earlier = sourceSetBy.get(trait.id);
    if (earlier !== undefined)
      return void problems.push(`${label}: "${trait.id}" is already set by randomDebuff[${earlier}]`);

    sourceSetBy.set(trait.id, index);
    const source = toSource(override);
    if (sameSource(trait.randomDebuff, source)) {
      warnings.push(`${label}: "${trait.id}" is already detected as this; this changes nothing`);
    }
    newSources.set(trait.id, source);
  });

  if (problems.length > 0) {
    throw new OverridesError(
      `overrides.yaml does not fit the data (${problems.length} problem(s)):\n- ${problems.join('\n- ')}`,
    );
  }

  return {
    traits: traits.map((trait) => {
      const changes = newRoles.get(trait.id);
      const source = newSources.get(trait.id);
      if (changes === undefined && source === undefined) return trait;
      return {
        ...trait,
        keywords:
          changes === undefined ? trait.keywords : trait.keywords.map((hit, i) => withRole(hit, changes.get(i))),
        randomDebuff: source ?? trait.randomDebuff,
      };
    }),
    warnings,
  };
}

/** The mentions of the override's keyword in the trait that it is about, or nothing (with the reason in `problems`). */
function mentionsToChange(trait: Trait, override: RoleOverride, label: string, problems: string[]) {
  const mentions = trait.keywords
    .map((hit, position) => ({ hit, position }))
    .filter(({ hit }) => hit.key === override.keyword);

  const first = mentions[0];
  if (first === undefined) {
    problems.push(`${label}: "${trait.id}" does not mention "${override.keyword}"`);
    return [];
  }
  if (first.hit.kind !== 'buff' && first.hit.kind !== 'debuff') {
    problems.push(`${label}: "${override.keyword}" is a ${first.hit.kind} and has no role`);
    return [];
  }
  if (override.occurrence === undefined) return mentions;

  const chosen = mentions[override.occurrence - 1];
  if (chosen === undefined) {
    problems.push(
      `${label}: "${trait.id}" mentions "${override.keyword}" ${mentions.length} times, there is no occurrence ${override.occurrence}`,
    );
    return [];
  }
  return [chosen];
}

function withRole(hit: KeywordHit, role: KeywordRole | undefined): KeywordHit {
  return role === undefined ? hit : { ...hit, role };
}

function toSource(override: RandomDebuffOverride): RandomDebuffSource {
  const { target, activation, note } = override;
  return note === undefined ? { target, activation } : { target, activation, note };
}

function sameSource(detected: RandomDebuffSource | null, source: RandomDebuffSource): boolean {
  return (
    detected !== null &&
    detected.target === source.target &&
    detected.activation === source.activation &&
    detected.note === source.note
  );
}
