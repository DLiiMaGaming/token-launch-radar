# Launch Radar

[![make.fun bounty](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/DLiiMaGaming/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/DLiiMaGaming/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01)

An entry to make.fun's [Build the best token launch radar](https://make.fun/bounty/token-radar-01) bounty.

The radar reads one sealed DefiLlama snapshot (758 protocols, fetched 2026-11-14), sets the
tokenised protocols aside as a comparables book, excludes wrapped, staked and bridged products of
tokens that already trade, and ranks the remaining 198 pre-token protocols by an implied launch
value. Every row carries a concrete seven-step farm plan, and the whole board is rendered as a
static, no-network dashboard: a sortable, filterable board, a detail view per protocol with the
model's arithmetic shown as a waterfall, a live-tokens view of the comparables, and a method view
that states the formula and every constant.

## The model

Implied value follows only from the snapshot's own figures — no protocol name is ever special-cased:

```
implied = TVL × category multiple × growth × maturity × reach
```

- **Category multiple** — the median market-cap/TVL ratio of the category's tokenised protocols in
  the same snapshot, winsorised and shrunk toward the global median (shrinkage weight 4) so thin
  categories stay honest, clamped to [0.05, 4].
- **Growth** — the 7-day TVL change, clamped to [-60%, +150%], weighted 0.45.
- **Maturity** — how long the protocol has run with no token, from 0.75 at listing to 1.20 at four
  years; an unreported listing date scores a neutral 0.95.
- **Reach** — +3% per additional chain beyond the first, capped at seven.

The board covers the snapshot's 40-protocol watchlist in full and extends to every non-derivative
pre-token protocol above the snapshot's $5M floor — the watchlist is the floor, never the ceiling.

## Run it

Node 22.18 or later, standard library only:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

This writes `out/board.json` (the ranked board), `out/data.js` (the dashboard's dataset),
`out/dashboard/` and `out/screenshots/` (the hand-in), and `out/dossier.json` (the judge's summary,
built with the vendored `vendor/makefun-board.ts`, which is byte-identical to the competition kit's).

Run it twice and the outputs are byte-identical: the program reads no clock, no randomness and no
locale-sensitive formatting.

## Layout

- `main.ts` — the program: snapshot in, board + dashboard + dossier out.
- `src/snapshot.ts` — parsing, validation, and the pre-token / derivative classification.
- `src/peers.ts` — the comparables book: winsorised peer ratios, shrunk category multiples.
- `src/scoring.ts` — the valuation, the ranking, the live set and the dashboard bundle.
- `src/farm.ts` — the seven-step farm-plan generator, built from each protocol's own record.
- `src/emit.ts` — the dashboard's data script and the board's local gate check.
- `dashboard/` — the static page (`index.html`, `theme.css`, `radar.js`); it renders `../data.js`.
- `screenshots/` — the board, a detail view and a filtered view, as handed in.

Implied values are this model's claims from a frozen snapshot — not a prediction that any protocol
will issue a token, and not financial advice.

## License

MIT — see `LICENSE`.
