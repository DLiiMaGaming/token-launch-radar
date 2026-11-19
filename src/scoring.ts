// Scoring: from snapshot to ranked board.
//
// Candidates are the whole watchlist plus every pre-token protocol that is
// not a derivative product. Each candidate is priced from its own category's
// multiple and its own growth, age and reach:
//
//   implied = TVL × category multiple × growth × maturity × reach
//
// then the board is sorted by that value and nudged into a strictly
// decreasing ladder, so the order by value always matches the order by rank.
// The same arithmetic scores every row; no protocol is special-cased by name.

import type {
  Bundle,
  Entry,
  FlatEntry,
  LiveEntry,
  Proto,
  Snap,
  Tuning,
} from './types.ts';
import { MODEL_LABEL, TUNING } from './types.ts';
import { isDerivative, recordsNoToken } from './snapshot.ts';
import { multipleFor, peerMultiples } from './peers.ts';
import { planFor } from './farm.ts';

const DAY_MS = 86_400_000;

function clamp(v: number, low: number, high: number): number {
  return v < low ? low : v > high ? high : v;
}

function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

/** Code-point string order: the only string ordering this file uses. */
function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function dayMs(value: string): number {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Date.parse(`${value}T00:00:00Z`)
    : Date.parse(value);
}

/**
 * Whole days from `listedAt` to `asOf`, never negative. Null when either date
 * is missing or unusable.
 */
export function ageInDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const end = dayMs(asOf);
  const start = dayMs(listedAt);
  if (!Number.isFinite(end) || !Number.isFinite(start)) return null;
  return Math.max(0, Math.floor((end - start) / DAY_MS));
}

/** The ranked board for a snapshot, under `tune` (the house tuning by default). */
export function rankBoard(snap: Snap, tune: Tuning = TUNING): Entry[] {
  const book = peerMultiples(snap, tune);
  const onList = new Set(snap.watchlist);
  const seen = new Set<string>();
  const candidates: Proto[] = [];
  for (const p of snap.protos) {
    if (seen.has(p.slug)) continue;
    if (!onList.has(p.slug) && !(recordsNoToken(p) && !isDerivative(p))) continue;
    seen.add(p.slug);
    candidates.push(p);
  }

  const scored = candidates.map((p) => {
    const priced = multipleFor(p, book);
    const growthPct = clamp(p.change7d ?? 0, tune.growthLow, tune.growthHigh);
    const growthMult = 1 + (growthPct / 100) * tune.growthWeight;
    const age = ageInDays(snap.asOf, p.listedAt);
    const ageMult =
      age === null
        ? tune.ageUnknown
        : tune.ageBase + tune.ageGain * (Math.min(age, tune.maturityDays) / tune.maturityDays);
    const extra = clamp(p.chains.length - 1, 0, tune.reachCap);
    const reachMult = 1 + tune.reachEach * extra;
    const implied = Math.max(
      1,
      Math.round(p.tvlUsd * priced.multiple * growthMult * ageMult * reachMult),
    );
    return { p, age, priced, growthPct, growthMult, ageMult, reachMult, implied };
  });
  scored.sort((a, b) => b.implied - a.implied || byText(a.p.slug, b.p.slug));

  // A strictly decreasing ladder: a row may not match or pass the row above
  // it, so it is set one dollar below that row, and never below one dollar.
  let ceiling = Number.POSITIVE_INFINITY;
  for (const row of scored) {
    if (row.implied >= ceiling) row.implied = Math.max(1, ceiling - 1);
    ceiling = row.implied;
  }

  return scored.map((row, index) => ({
    rank: index + 1,
    slug: row.p.slug,
    name: row.p.name,
    category: row.p.category,
    chains: row.p.chains,
    tvlUsd: row.p.tvlUsd,
    change7d: row.p.change7d,
    mcapUsd: row.p.mcapUsd,
    listedAt: row.p.listedAt,
    geckoId: row.p.geckoId,
    symbol: row.p.symbol,
    tokenStatus: 'pre-token' as const,
    onWatchlist: onList.has(row.p.slug),
    ageDays: row.age,
    impliedUsd: row.implied,
    calc: {
      multiple: round4(row.priced.multiple),
      peers: row.priced.peers,
      growthPct: round4(row.growthPct),
      growthMult: round4(row.growthMult),
      ageMult: round4(row.ageMult),
      reachMult: round4(row.reachMult),
    },
    farmSteps: planFor(row.p, row.age),
  }));
}

/** The tokenised set at market values, largest market cap first. */
function liveSet(snap: Snap, tune: Tuning): LiveEntry[] {
  return snap.protos
    .filter((p) => p.mcapUsd !== null && p.mcapUsd > 0)
    .sort((a, b) => (b.mcapUsd ?? 0) - (a.mcapUsd ?? 0) || byText(a.slug, b.slug))
    .slice(0, tune.liveCount)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvlUsd: p.tvlUsd,
      mcapUsd: p.mcapUsd!,
      change7d: p.change7d,
      ratio: p.tvlUsd === 0 ? null : round4(p.mcapUsd! / p.tvlUsd),
    }));
}

function flatten(row: Entry): FlatEntry {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvlUsd: row.tvlUsd,
    change7d: row.change7d,
    mcapUsd: row.mcapUsd,
    listedAt: row.listedAt,
    geckoId: row.geckoId,
    symbol: row.symbol,
    tokenStatus: row.tokenStatus,
    onWatchlist: row.onWatchlist,
    ageDays: row.ageDays,
    impliedUsd: row.impliedUsd,
    multiple: row.calc.multiple,
    peers: row.calc.peers,
    growthPct: row.calc.growthPct,
    growthMult: row.calc.growthMult,
    ageMult: row.calc.ageMult,
    reachMult: row.calc.reachMult,
    farmSteps: row.farmSteps,
  };
}

/** The board plus everything the dashboard needs, from one snapshot. */
export function assembleBundle(snap: Snap, tune: Tuning = TUNING): { board: Entry[]; bundle: Bundle } {
  const board = rankBoard(snap, tune);
  const live = liveSet(snap, tune);
  const book = peerMultiples(snap, tune);
  const bundle: Bundle = {
    asOf: snap.asOf,
    source: snap.source,
    floorUsd: snap.floorUsd,
    tuning: tune,
    modelVersion: MODEL_LABEL,
    stats: {
      protocols: snap.protos.length,
      tokenized: snap.protos.filter((p) => p.mcapUsd !== null && p.mcapUsd > 0).length,
      preToken: snap.protos.filter((p) => recordsNoToken(p)).length,
      derivativesExcluded: snap.protos.filter((p) => recordsNoToken(p) && isDerivative(p)).length,
      boardRows: board.length,
      watchlistSize: snap.watchlist.length,
      watchlistCovered: board.filter((r) => r.onWatchlist).length,
      liveRows: live.length,
    },
    multiples: book.listing,
    rows: board.map(flatten),
    live,
  };
  return { board, bundle };
}
