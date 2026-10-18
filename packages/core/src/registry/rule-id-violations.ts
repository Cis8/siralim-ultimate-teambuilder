/**
 * What is wrong with the ids of a list of rules: a registry of rules (the slot rules, the lint rules) names what a rule
 * finds by its id, so the ids must be written alike and tell the rules apart. One message for each violation.
 */
export function ruleIdViolations(rules: readonly { readonly id: string }[]): string[] {
  const counts = new Map<string, number>();
  for (const { id } of rules) counts.set(id, (counts.get(id) ?? 0) + 1);

  return [
    ...rules
      .filter(({ id }) => !/^[a-z]+(-[a-z]+)*$/.test(id))
      .map(({ id }) => `id ${JSON.stringify(id)} must be lower case words joined by hyphens`),
    ...[...counts]
      .filter(([, count]) => count > 1)
      .map(([id, count]) => `id ${JSON.stringify(id)} is used by ${count} rules`),
  ];
}
