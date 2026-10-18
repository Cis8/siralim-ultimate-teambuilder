import { fieldRules } from './field-rules';
import { createLintRegistry } from './lint-registry';

/** The rules of the app (QUERY_LANGUAGE §5). To add one, write it and list it here; the registry and the page do not change. */
export const lintRegistry = createLintRegistry([...fieldRules]);
