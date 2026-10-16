# Trait Atlas

Unofficial theorycrafting tool for **Siralim Ultimate**: search every trait by mechanic and role (what applies
Vulnerable, what relies on it), combine conditions with a boolean query language, and plan a party whose traits feed
each other. A static site on GitHub Pages; everything runs in the browser.

**Status:** Phase 1 in progress (see [`docs/ROADMAP.md`](docs/ROADMAP.md)).

## Development

Requires Node 24 (`nvm use`) and pnpm via corepack (`corepack enable pnpm`).

```sh
pnpm install
pnpm dev          # local dev server
pnpm check        # lint + typecheck + unit tests
pnpm test:e2e     # Playwright + axe
```

Architecture, conventions and the working agreement are in [`CLAUDE.md`](CLAUDE.md); the specification and decisions
are in [`docs/`](docs/).

## Credits

Trait data comes from the community
[Siralim Ultimate Compendium](https://docs.google.com/spreadsheets/d/1qvWwf1fNB5jN8bJ8dFGAVzC7scgDCoBO-hglwjTT4iY/).
All credit to its authors and contributors. Siralim Ultimate is a game by Thylacine Studios; this project is not
affiliated with it.
