/** The colour token of each class that has an identity colour (DESIGN § Tokens), by lower-case class name. */
const CLASS_TOKENS: ReadonlyMap<string, string> = new Map([
  ['chaos', '--class-chaos'],
  ['death', '--class-death'],
  ['life', '--class-life'],
  ['nature', '--class-nature'],
  ['sorcery', '--class-sorcery'],
  ['rodian master', '--class-rodian-master'],
  ['nether boss', '--class-nether-boss'],
]);

/**
 * The CSS colour of a class's dot. Backer, Boss, Pandemonium, Nether Room and any class the dataset gains later use the
 * fallback. The dot only ever sits next to the class or trait name: the colour alone says nothing (DESIGN § Colour rules).
 */
export function classColour(className: string): string {
  return `var(${CLASS_TOKENS.get(className.toLowerCase()) ?? '--class-fallback'})`;
}
