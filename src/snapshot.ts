// Reading the sealed snapshot.
//
// The parser is strict about the fields the valuation actually reads and
// lenient about nothing else: a snapshot that cannot be scored is refused
// with one message naming the first problem, before any number is trusted.

import type { Proto, Snap } from './types.ts';

/** Raised when the input text is not a snapshot this radar can score. */
export class BadSnapshot extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadSnapshot';
  }
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') out.push(item);
  }
  return out;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** One protocol entry, checked field by field. */
function readProto(raw: unknown, index: number): Proto {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new BadSnapshot(`protocol #${index} is not an object`);
  }
  const rec = raw as Record<string, unknown>;
  const slug = asText(rec.slug);
  if (slug === null || slug.length === 0) {
    throw new BadSnapshot(`protocol #${index} has no slug`);
  }
  const name = asText(rec.name);
  if (name === null || name.length === 0) {
    throw new BadSnapshot(`protocol ${slug} has no name`);
  }
  const tvl = asNumber(rec.tvl_usd);
  if (tvl === null) {
    throw new BadSnapshot(`protocol ${slug} has no finite tvl_usd`);
  }
  return {
    slug,
    name,
    category: asText(rec.category),
    chains: asTextList(rec.chains),
    tvlUsd: tvl,
    change7d: asNumber(rec.change_7d),
    mcapUsd: asNumber(rec.mcap_usd),
    listedAt: asText(rec.listed_at),
    geckoId: asText(rec.gecko_id),
    symbol: asText(rec.symbol),
  };
}

/** The snapshot inside `text`, or a BadSnapshot naming what is wrong. */
export function loadSnapshot(text: string): Snap {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new BadSnapshot('input is not valid JSON');
  }
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    throw new BadSnapshot('input is not a JSON object');
  }
  const root = doc as Record<string, unknown>;
  const asOf = asText(root.as_of);
  if (asOf === null || !DAY_RE.test(asOf)) {
    throw new BadSnapshot('snapshot has no as_of date in YYYY-MM-DD form');
  }
  const source = asText(root.source);
  if (source === null || source.length === 0) {
    throw new BadSnapshot('snapshot has no source string');
  }
  const floor = asNumber(root.floor_usd);
  if (floor === null || floor <= 0) {
    throw new BadSnapshot('snapshot has no positive floor_usd');
  }
  if (!Array.isArray(root.protocols)) {
    throw new BadSnapshot('snapshot has no protocols array');
  }
  if (!Array.isArray(root.watchlist) || root.watchlist.some((s) => typeof s !== 'string')) {
    throw new BadSnapshot('snapshot has no watchlist of slug strings');
  }
  return {
    asOf,
    source,
    floorUsd: floor,
    protos: root.protocols.map((entry, i) => readProto(entry, i)),
    watchlist: root.watchlist as string[],
  };
}

// ---------------------------------------------------------------------------
// Classification. These two predicates decide what the board ranks and what
// it leaves out; they read only the snapshot's own ten fields.
// ---------------------------------------------------------------------------

/** True when the snapshot records no token at all for the protocol. */
export function recordsNoToken(p: Proto): boolean {
  return p.geckoId === null && p.symbol === null && p.mcapUsd === null;
}

const DERIVATIVE_CATS = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

const RECEIPT_WORD = /\b(wrapped|staked|staking)\b/i;
const VERSION_TAIL = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const EXCHANGE_NAMES = [
  'Binance',
  'Coinbase',
  'Bybit',
  'Kraken',
  'Bitget',
  'OKX',
  'Bitfinex',
  'Gemini',
];

/**
 * True when the entry is a product of another protocol's token rather than a
 * launch candidate in its own right: a bridge or staking wrapper by category,
 * a wrapped or staked receipt by name, a versioned deployment, or an
 * exchange's own entry by its leading name.
 */
export function isDerivative(p: Proto): boolean {
  if (p.category !== null && DERIVATIVE_CATS.has(p.category)) return true;
  if (RECEIPT_WORD.test(p.name)) return true;
  if (VERSION_TAIL.test(p.name)) return true;
  for (const exchange of EXCHANGE_NAMES) {
    if (p.name === exchange || p.name.startsWith(`${exchange} `)) return true;
  }
  return false;
}
