/**
 * The colon of `a:vulnerable` and the comma between two items are legal in a query and are what SPEC §7 shows: left as
 * they are, a link pasted into a chat can be read. A comma that belongs to a name is `%2C` in the value, so it is `%252C`
 * here and keeps its escape.
 */
export const readableSearch = (search: string): string => search.replaceAll('%3A', ':').replaceAll('%2C', ',');
