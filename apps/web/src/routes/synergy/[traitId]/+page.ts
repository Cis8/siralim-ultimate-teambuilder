import type { PageLoad } from './$types';

// A trait page is built by the client from the fallback page the host serves for an address it does not know (ADR-0011): the
// ids are the dataset's, and one shell copied for each of 1,780 traits would be the same page.
export const prerender = false;
export const ssr = false;

export const load: PageLoad = ({ params }) => ({ traitId: params.traitId });
