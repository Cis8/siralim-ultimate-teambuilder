import { parse as parseYaml, YAMLParseError } from 'yaml';
import { z } from 'zod';
import { OverridesError } from './overrides-error';

const reason = z.string().trim().min(1, 'a reason is needed, so that the correction can be reviewed');
const nonEmpty = z.string().trim().min(1);
const section = <T extends z.ZodType>(entry: T) =>
  z
    .array(entry)
    .nullish()
    .transform((entries) => entries ?? []);

const roleOverride = z.strictObject({
  trait: nonEmpty,
  keyword: nonEmpty,
  /** Which mention of the keyword in the trait, counting from 1. Absent: all of them. */
  occurrence: z.number().int().positive().optional(),
  role: z.enum(['applies', 'uses']),
  reason,
});

const randomDebuffOverride = z.strictObject({
  trait: nonEmpty,
  target: z.enum(['enemy', 'self_or_allies', 'both']),
  activation: z.enum(['unconditional', 'conditional']),
  /** What a conditional source waits for. */
  note: z.string().trim().min(1).optional(),
  reason,
});

const overridesSchema = z.strictObject({
  roles: section(roleOverride),
  randomDebuff: section(randomDebuffOverride),
});

/** Corrections to what the extractor guessed, by hand, each with the reason for it. */
export type Overrides = z.infer<typeof overridesSchema>;
export type RoleOverride = Overrides['roles'][number];
export type RandomDebuffOverride = Overrides['randomDebuff'][number];

/**
 * Reads `overrides.yaml` (SPEC §4). Every entry names a trait by id and says why it is there.
 *
 * @throws OverridesError listing every problem.
 */
export function parseOverrides(yaml: string): Overrides {
  const value = readYaml(yaml);
  if (value === null || value === undefined) return { roles: [], randomDebuff: [] };
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new OverridesError('overrides.yaml must have the sections "roles" and "randomDebuff"');
  }

  const result = overridesSchema.safeParse(value);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => `${formatPath(issue.path)}${issue.message}`);
  throw new OverridesError(`overrides.yaml has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
}

function readYaml(yaml: string): unknown {
  try {
    return parseYaml(yaml);
  } catch (error) {
    if (error instanceof YAMLParseError) {
      throw new OverridesError(`overrides.yaml is not valid YAML: ${error.message}`, { cause: error });
    }
    throw error;
  }
}

/** `roles[0].reason: ` */
function formatPath(path: readonly PropertyKey[]): string {
  let text = '';
  for (const part of path) {
    if (typeof part === 'number') text += `[${part}]`;
    else text += text === '' ? String(part) : `.${String(part)}`;
  }
  return text === '' ? '' : `${text}: `;
}
