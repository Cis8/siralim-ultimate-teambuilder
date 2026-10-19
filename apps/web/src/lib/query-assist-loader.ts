import { memoisedLoader } from './lazy-load';
import type * as QueryAssistModule from './query-assist';

/** The assist layer as the search field uses it: the analysis of a text and the components that show it. */
export type QueryAssist = typeof QueryAssistModule;

/** Fetches the assist layer the first time it is asked for. The only place that names `query-assist.ts` at run time. */
export const loadQueryAssist = memoisedLoader<QueryAssist>(() => import('./query-assist'));
