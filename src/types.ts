// Shared shapes for the launch radar.
//
// The snapshot is the sealed input: one object per protocol, ten fields each.
// The board is the output: ranked entries, each with its valuation breakdown
// and a seven-step farm plan. The bundle is everything the dashboard needs.

/** One protocol as the sealed snapshot records it. */
export interface Proto {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvlUsd: number;
  change7d: number | null;
  mcapUsd: number | null;
  listedAt: string | null;
  geckoId: string | null;
  symbol: string | null;
}

/** The sealed snapshot document. */
export interface Snap {
  asOf: string;
  source: string;
  floorUsd: number;
  protos: Proto[];
  watchlist: string[];
}

/** Every dial the valuation turns on, in one record. */
export interface Tuning {
  /** Peer ratios are clipped to this band before any median is taken. */
  winsorLow: number;
  winsorHigh: number;
  /** A category multiple after shrinkage is clipped to this band. */
  multLow: number;
  multHigh: number;
  /** Pseudo-peers of global median mixed into every category multiple. */
  shrinkK: number;
  /** Seven-day change is clipped to this band, in percent. */
  growthLow: number;
  growthHigh: number;
  /** Share of the (clipped) growth percent that feeds the multiplier. */
  growthWeight: number;
  /** Maturity multiplier at age zero, plus this much by `maturityDays`. */
  ageBase: number;
  ageGain: number;
  maturityDays: number;
  /** Maturity multiplier when no listing date is recorded. */
  ageUnknown: number;
  /** Reach gained per chain beyond the first, up to `reachCap` extra chains. */
  reachEach: number;
  reachCap: number;
  /** How many already-tokenised protocols the dashboard's live view shows. */
  liveCount: number;
}

/** The house tuning for model `launch-radar-2`. */
export const TUNING: Tuning = {
  winsorLow: 0.02,
  winsorHigh: 20,
  multLow: 0.05,
  multHigh: 4,
  shrinkK: 4,
  growthLow: -60,
  growthHigh: 150,
  growthWeight: 0.45,
  ageBase: 0.75,
  ageGain: 0.45,
  maturityDays: 1460,
  ageUnknown: 0.95,
  reachEach: 0.03,
  reachCap: 7,
  liveCount: 40,
};

/** The model label quoted by the dashboard and the run summary. */
export const MODEL_LABEL = 'launch-radar-2';

/** The valuation breakdown kept beside every ranked entry. */
export interface Breakdown {
  multiple: number;
  peers: number;
  growthPct: number;
  growthMult: number;
  ageMult: number;
  reachMult: number;
}

/** One ranked board entry. */
export interface Entry {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvlUsd: number;
  change7d: number | null;
  mcapUsd: number | null;
  listedAt: string | null;
  geckoId: string | null;
  symbol: string | null;
  tokenStatus: 'pre-token';
  onWatchlist: boolean;
  ageDays: number | null;
  impliedUsd: number;
  calc: Breakdown;
  farmSteps: string[];
}

/** A board entry flattened for the dashboard's data script. */
export interface FlatEntry {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvlUsd: number;
  change7d: number | null;
  mcapUsd: number | null;
  listedAt: string | null;
  geckoId: string | null;
  symbol: string | null;
  tokenStatus: 'pre-token';
  onWatchlist: boolean;
  ageDays: number | null;
  impliedUsd: number;
  multiple: number;
  peers: number;
  growthPct: number;
  growthMult: number;
  ageMult: number;
  reachMult: number;
  farmSteps: string[];
}

/** An already-tokenised protocol, shown at its market value, never modelled. */
export interface LiveEntry {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvlUsd: number;
  mcapUsd: number;
  change7d: number | null;
  ratio: number | null;
}

/** One row of the category-multiples table the dashboard shows. */
export interface MultipleRow {
  category: string;
  peers: number;
  multiple: number;
}

/** Everything the dashboard renders, in one object. */
export interface Bundle {
  asOf: string;
  source: string;
  floorUsd: number;
  tuning: Tuning;
  modelVersion: string;
  stats: {
    protocols: number;
    tokenized: number;
    preToken: number;
    derivativesExcluded: number;
    boardRows: number;
    watchlistSize: number;
    watchlistCovered: number;
    liveRows: number;
  };
  multiples: MultipleRow[];
  rows: FlatEntry[];
  live: LiveEntry[];
}
