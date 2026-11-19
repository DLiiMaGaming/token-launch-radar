// Comparables: what the market already pays per dollar of TVL.
//
// A protocol with no token has no price, so the radar borrows prices from
// the protocols in the same snapshot that do have one. For each category,
// the median market-cap-to-TVL ratio of its tokenised protocols — winsorised
// so one absurd ratio cannot price a whole category, then shrunk toward the
// global median so a category with one or two peers cannot claim an extreme
// multiple on thin evidence — becomes the multiple applied to that
// category's pre-token protocols. Categories with no peers use the global
// figure. Nothing here is stored or hand-written: the table is recomputed
// from the snapshot on every run.

import type { MultipleRow, Proto, Snap, Tuning } from './types.ts';

/** The multiple a category is priced with, and how many peers back it. */
export interface PricedCategory {
  multiple: number;
  peers: number;
}

/** The whole comparables book: one global multiple, one per category. */
export interface Comparables {
  global: number;
  table: Record<string, PricedCategory>;
  listing: MultipleRow[];
}

function clamp(v: number, low: number, high: number): number {
  return v < low ? low : v > high ? high : v;
}

function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

/** Median of a non-empty list; an even count averages the two middle values. */
function median(values: number[]): number {
  const ordered = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[mid]!
    : (ordered[mid - 1]! + ordered[mid]!) / 2;
}

/** Build the comparables book for a snapshot under the given tuning. */
export function peerMultiples(snap: Snap, tune: Tuning): Comparables {
  const all: number[] = [];
  const perCat = new Map<string, number[]>();
  for (const p of snap.protos) {
    if (p.mcapUsd === null || p.mcapUsd <= 0 || p.tvlUsd <= 0) continue;
    const ratio = clamp(p.mcapUsd / p.tvlUsd, tune.winsorLow, tune.winsorHigh);
    all.push(ratio);
    if (p.category === null) continue;
    const bucket = perCat.get(p.category);
    if (bucket === undefined) perCat.set(p.category, [ratio]);
    else bucket.push(ratio);
  }
  // No peers at all leaves no market evidence; a neutral 1x keeps the board
  // a pure TVL ranking instead of dividing by an absent median. The sealed
  // snapshot has plenty of peers, so this branch is only a guard.
  const globalMedian = all.length > 0 ? median(all) : 1;
  const global = clamp(globalMedian, tune.multLow, tune.multHigh);

  const table: Record<string, PricedCategory> = {};
  const listing: MultipleRow[] = [];
  for (const [category, ratios] of perCat) {
    const n = ratios.length;
    const blended =
      (n * median(ratios) + tune.shrinkK * globalMedian) / (n + tune.shrinkK);
    const multiple = clamp(blended, tune.multLow, tune.multHigh);
    table[category] = { multiple, peers: n };
    listing.push({ category, peers: n, multiple: round4(multiple) });
  }
  listing.sort((a, b) => (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  return { global, table, listing };
}

/** The multiple and peer count a candidate is priced with, global fallback included. */
export function multipleFor(p: Proto, book: Comparables): PricedCategory {
  if (p.category !== null) {
    const own = book.table[p.category];
    if (own !== undefined) return own;
  }
  return { multiple: book.global, peers: 0 };
}
