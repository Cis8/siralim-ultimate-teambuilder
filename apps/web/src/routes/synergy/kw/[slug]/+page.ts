import type { PageLoad } from './$types';

// As the trait pages: built by the client from the fallback page (ADR-0011).
export const prerender = false;
export const ssr = false;

export const load: PageLoad = ({ params }) => ({ slug: params.slug });
