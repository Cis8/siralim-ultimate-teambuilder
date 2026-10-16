export interface FamilyMention {
  readonly family: string;
  /** Where the mention starts in the text. */
  readonly index: number;
}

export interface FamilyMatcher {
  /**
   * Every place the text names a family, singular or plural, in order of appearance. A form that two families share
   * yields both. Names are matched as whole words and case-sensitively: they are proper nouns.
   */
  mentionsIn(text: string): FamilyMention[];
}

/** Finds family names in free text, where the sheet writes them in the plural (`Apises`, `Mummies`, `Elves`). */
export function createFamilyMatcher(families: Iterable<string>): FamilyMatcher {
  const familiesByForm = new Map<string, string[]>();
  for (const family of new Set(families)) {
    for (const form of writtenForms(family)) {
      familiesByForm.set(form, [...(familiesByForm.get(form) ?? []), family]);
    }
  }
  if (familiesByForm.size === 0) return { mentionsIn: () => [] };

  // Longest first, so that `Pit Worms` is read as one family rather than as `Worms` after a stray `Pit`.
  const alternatives = [...familiesByForm.keys()].sort((a, b) => b.length - a.length).map(escapeForRegExp);
  const form = new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'gu');

  return {
    mentionsIn: (text) =>
      [...text.matchAll(form)].flatMap((match) =>
        (familiesByForm.get(match[0]) ?? []).map((family) => ({ family, index: match.index })),
      ),
  };
}

/** The ways the sheet writes a family: the singular and the regular plurals: `s`, `es`, `y` → `ies`, `f` / `fe` → `ves`. */
export function writtenForms(family: string): string[] {
  const forms = [family, `${family}s`, `${family}es`];
  if (family.endsWith('y')) forms.push(`${family.slice(0, -1)}ies`);
  if (family.endsWith('fe')) forms.push(`${family.slice(0, -2)}ves`);
  else if (family.endsWith('f')) forms.push(`${family.slice(0, -1)}ves`);
  return forms;
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
