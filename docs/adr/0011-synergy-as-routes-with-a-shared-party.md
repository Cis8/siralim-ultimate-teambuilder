# ADR-0011 — Synergy is a set of routes, and the party is shared across them

- Status: Accepted
- Date: 2026-10-18
- Builds on: ADR-0001 (static site, `404.html` fallback), ADR-0005 (the URL is the source of truth), ADR-0008 (party in the address)
- Supersedes: the idea, in DESIGN and SPEC §7, that Synergies is a third tab of the Explore page

## Context
Phase 2 adds the Synergy explorer (M13). The documents disagree on its shape: DESIGN and SPEC speak of a third tab beside Explore and
Party, while ROADMAP and the owner's decision (PLAN D14) say a new page with deep links, `/synergy/<traitId>` and
`/synergy/kw/<slug>`. A tab swaps one view of a page for another; a deep link must open a view directly, and ADR-0005 requires the
focus to be in the address.

Today `+page.svelte` (776 lines) holds all state: the search, the planner with its undo history, the live announcements, the slot
chooser and the writer that keeps the address in step. Moving to another route would drop the planner and the history. The site is
static (adapter-static, GitHub Pages, base path `/siralim-ultimate-teambuilder`) and Pages has no rewrites: it serves `404.html` for
an unknown path.

## Decision
- **Real routes**: `/synergy` (the picker, and "start from your party"), `/synergy/<traitId>` and `/synergy/kw/<slug>`. The two
  dynamic routes set `prerender = false` and `ssr = false`: `404.html` (the SPA fallback `adapter({ fallback: '404.html' })` already
  writes) boots the app and the client router reads the path. One shell copied 1,780 times would be pointless. Slice 13.2 proves a
  direct visit of both URL shapes in the e2e, and the built-output smoke test covers what Pages itself does.
- **A shared party session** at module level (`party-session.ts`, made once in `composition-root.ts`): the planner (undo history
  included), the announcements, the chooser state, the last-party persistence and the `party` / `target` address sync. Pages read
  and write it; navigation does not drop it. It is plain TypeScript, so Vitest tests it as it is; Svelte's `createSubscriber` makes
  every field it hands out reactive, so no runes (and no `.svelte.ts`) are needed. A generic writer,
  `createAddressWriter(bar, addressOf)`, replaces the page-bound one: each page says how its state becomes an address, and the
  session tells the page in front what a change of the party asks of the address (`syncAddress`). The party travels in the address
  of every page (ADR-0008), so a Synergy link can be shared with the party.
- **The state of a Synergy view is in the address**: the focus (path), `mat=yes` for the artifact-eligible filter, `section=` for the
  open tab on a phone. A re-centre is a history entry, so Back and Forward walk the trail.
- **Navigation**: the header on wide screens (Explore · Synergies · Party n/18). On a phone the bottom bar **keeps its ARIA tablist**
  (Explore, Party), which still swaps views of one page, and gets a **Synergies link beside it**, not a third tab (PLAN D23); on the
  Synergy routes the bar is a `nav` of three links with `aria-current`.
- **Keyword slugs** are explicit: `keywordSlug(key)` and `keywordFromSlug(slug, keys)` (the keys that have a page). Uniqueness is
  a rule of `createTaxonomy`, as is the rule that no key starts another: a taxonomy with two keys of one slug does not load.
- **Unknown input is a state**: an unknown trait id is "not found in vX" with a name search (as the party already does); an unknown
  slug opens the keyword picker.

## Alternatives considered
- **A third tab with the focus in the query string** (`/?tab=synergy&focus=…`). It keeps one page and one state, but contradicts the
  owner's decision of a page with path deep links, loads the relations with the Explore page, and mixes three views in one 776-line file.
- **Hash routing.** ADR-0001 allows it, but readable paths work with the base path and the SPA fallback and share better.
- **Prerendering every trait page.** Identical shells, a much larger deploy, no gain without server-rendered content.

## Consequences
- Slice 13.1 is a refactor with no behaviour change; **the whole Phase 1 e2e suite must pass untouched**, and it is the safety net.
- GitHub Pages answers a deep link with status 404 and the fallback body: it works in a browser, but link previews and search-engine
  indexing of `/synergy/…` do not (accepted; ADR-0001 has no backend to do better). A built-output smoke test checks that the assets in
  `404.html` carry the base path.
- The lint rule `no-navigation-without-resolve` accepts few forms (`resolve('/')` and a few template strings): a small helper builds
  the Synergy links.
- A Lighthouse URL for `/synergy/<id>` is added only if the static server used by CI can fall back to `404.html`.
- SPEC §7 (the `tab=` parameter), SPEC §8.4 and DESIGN (the `TabBar` line, `TraitCard`, lanes, trail, verdict) change in the slices
  that ship them (13.2, 13.8).
