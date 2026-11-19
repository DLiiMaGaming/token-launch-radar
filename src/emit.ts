// Emitting the dashboard's data and checking the board before it ships.
//
// The gate refuses a board that is too small, misses a watchlist slug,
// repeats a slug or a rank, ties its values, or carries a farm plan outside
// the length the rules allow. This module mirrors those checks locally so a
// bad board is caught here, in this run, instead of on the server.

import type { Bundle, Entry, Snap } from './types.ts';

/** The dashboard's dataset as one script: no fetch, no network, one global. */
export function datasetScript(bundle: Bundle): string {
  return `window.RADAR=${JSON.stringify(bundle)};\n`;
}

/**
 * One board row in the gate's own key names: the scorer reads exactly
 * `slug`, `name`, `rank`, `implied_value_usd` and `farm_steps`, so the file
 * the grader receives carries those spellings, whatever the program uses
 * internally. Extra keys are allowed and carry the model's breakdown.
 */
export function toGateRow(row: Entry): Record<string, unknown> {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvlUsd,
    change_7d: row.change7d,
    mcap_usd: row.mcapUsd,
    listed_at: row.listedAt,
    gecko_id: row.geckoId,
    symbol: row.symbol,
    token_status: row.tokenStatus,
    watchlist: row.onWatchlist,
    age_days: row.ageDays,
    implied_value_usd: row.impliedUsd,
    category_multiple: row.calc.multiple,
    peers: row.calc.peers,
    growth_pct: row.calc.growthPct,
    growth_multiplier: row.calc.growthMult,
    maturity_multiplier: row.calc.ageMult,
    reach_multiplier: row.calc.reachMult,
    farm_steps: row.farmSteps,
  };
}

/** The board file's text: the gate rows under `rows`, one trailing newline. */
export function boardFileText(board: Entry[]): string {
  return `${JSON.stringify({ rows: board.map(toGateRow) })}\n`;
}

/**
 * Every reason this board would be refused, in order; an empty list means
 * the board passes every local check.
 */
export function validateBoard(board: Entry[], snap: Snap): string[] {
  const problems: string[] = [];
  if (board.length < 100 || board.length > 4000) {
    problems.push(`board has ${board.length} rows, outside the allowed 100 to 4000`);
  }
  const boardSlugs = new Set(board.map((r) => r.slug));
  const missing = snap.watchlist.filter((slug) => !boardSlugs.has(slug));
  if (missing.length > 0) {
    problems.push(`board misses ${missing.length} watchlist slug(s): ${missing.slice(0, 5).join(', ')}`);
  }
  if (boardSlugs.size !== board.length) {
    problems.push('board repeats a slug');
  }
  const snapSlugs = new Set(snap.protos.map((p) => p.slug));
  const invented = board.filter((r) => !snapSlugs.has(r.slug));
  if (invented.length > 0) {
    problems.push(`board holds slug(s) absent from the snapshot: ${invented.slice(0, 5).map((r) => r.slug).join(', ')}`);
  }
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] !== i + 1) {
      problems.push(`ranks are not exactly 1..${board.length}: slot ${i + 1} holds rank ${ranks[i]}`);
      break;
    }
  }
  for (const row of board) {
    if (
      !Number.isSafeInteger(row.impliedUsd) ||
      row.impliedUsd <= 0 ||
      row.impliedUsd > 100_000_000_000_000
    ) {
      problems.push(`${row.slug} has implied value ${row.impliedUsd}, not a positive safe integer up to 100000000000000`);
      break;
    }
  }
  const byRank = board.slice().sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < byRank.length; i++) {
    if (byRank[i]!.impliedUsd > byRank[i - 1]!.impliedUsd) {
      problems.push(`implied value rises at rank ${byRank[i]!.rank} (${byRank[i]!.slug}), so the board is not ordered by value`);
      break;
    }
  }
  if (
    byRank.length >= 2 &&
    byRank[0]!.impliedUsd === byRank[byRank.length - 1]!.impliedUsd
  ) {
    problems.push(`every row shares the same implied value ${byRank[0]!.impliedUsd}, so the board ranks nothing`);
  }
  for (const row of board) {
    if (!Array.isArray(row.farmSteps) || row.farmSteps.length < 3 || row.farmSteps.length > 12) {
      problems.push(`${row.slug} has ${Array.isArray(row.farmSteps) ? row.farmSteps.length : 'no'} farm steps, outside 3 to 12`);
      break;
    }
    for (const step of row.farmSteps) {
      if (typeof step !== 'string') {
        problems.push(`${row.slug} has a farm step that is not a string`);
        break;
      }
      const len = step.trim().length;
      if (len < 20 || len > 600) {
        problems.push(`${row.slug} has a farm step of ${len} characters after trim, outside 20 to 600`);
        break;
      }
    }
  }
  return problems;
}
