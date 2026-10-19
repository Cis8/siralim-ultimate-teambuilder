// The query assist layer (ADR-0010): what the search field gains once the page is idle, the focus or a pointer arrives. This
// is the one entrance to it, fetched by `query-assist-loader.ts` with `import()` and by nothing else (the dependency rule
// `assist-stays-lazy`): a static import would put the lint, the suggestions and their list into the first script.
import { analyseQuery, countNext as countNextSuggestions } from './analyse-query';
import { timeAssist } from './search-timing';

export { acceptSuggestion } from '@atlas/core';
export { hasUncounted, optionsOf } from './analyse-query';
export { default as Combobox } from './components/combobox.svelte';
export { default as IssueBadge } from './components/issue-badge.svelte';
export { default as QueryIssues } from './components/query-issues.svelte';

// The work of a keystroke and each step of the counts that follow it are timed as `atlas:assist`: the e2e holds each to the
// budget beside the search.
export const analyse = timeAssist(analyseQuery);
export const countNext = timeAssist(countNextSuggestions);
