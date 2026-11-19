// Farm plans: seven concrete steps per protocol.
//
// Every plan is assembled from the protocol's own record — its TVL sets the
// working-capital band, its first chain sets the gas figure, its category
// sets the qualifying action, its age sets the holding window, and its
// seven-day change decides the sixth step. A small hash of the slug picks
// the phrasing variant and the weekly cadence, so two protocols' plans do
// not read as one pasted template, while staying reproducible: the same slug
// always yields the same plan. No step promises any reward, airdrop or
// token; the plan is about showing up and using the product.

import type { Proto } from './types.ts';

/** A cheap stable hash of a slug, used only to pick plan variants. */
function slugSeed(slug: string): number {
  let h = 7;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Working capital for one farm position, banded by the protocol's own TVL. */
function capitalBand(tvlUsd: number): number {
  if (tvlUsd >= 2_000_000_000) return 400;
  if (tvlUsd >= 500_000_000) return 200;
  if (tvlUsd >= 100_000_000) return 120;
  if (tvlUsd >= 50_000_000) return 80;
  return 50;
}

const GAS_BY_CHAIN: Readonly<Record<string, number>> = {
  Ethereum: 8,
  Binance: 0.5,
  Arbitrum: 0.4,
  Base: 0.3,
  Optimism: 0.4,
  Polygon: 0.1,
  Solana: 0.05,
  Avalanche: 0.3,
};

/** A rough per-transaction gas figure for a chain; unlisted chains get $1. */
function gasUsd(chain: string): number {
  return GAS_BY_CHAIN[chain] ?? 1;
}

function firstChain(p: Proto): string {
  return p.chains.length > 0 ? p.chains[0]! : 'Ethereum';
}

/** The qualifying action for a category, as one imperative clause. */
const CORE: Readonly<Record<string, string>> = {
  Dexs: 'trade a small amount on a main pair, then add liquidity to that pair and leave the position in place',
  Lending: 'deposit a major stablecoin into the main lending market and leave the supply position open',
  CDP: 'lock collateral and mint a modest amount of the stablecoin, keeping the collateral ratio far above liquidation',
  'CDP Manager': 'open a managed vault, deposit collateral and mint only a small amount against it',
  Derivatives: 'post margin and open a single small hedged position, sized well below the margin deposited',
  'Interest Rate Derivatives': 'open one small interest-rate position that you could explain to a friend in one sentence',
  'Options Vault': 'deposit into an options vault and hold the vault shares through a full strategy cycle',
  Yield: 'deposit into a live yield vault and keep the receipt shares in the wallet',
  'Yield Aggregator': 'deposit into an aggregator vault and keep the receipt shares it issues',
  Farm: 'supply the liquidity the farm requires, stake that position in the farm and leave it staked',
  'Leveraged Farming': 'open a farm position at the lowest leverage on offer, with the liquidation price far away',
  'Risk Curators': 'deposit into a curator vault whose current holdings you have inspected on chain first',
  'Onchain Capital Allocator': 'allocate into one allocator vault and keep the allocation shares',
  'Collateral Markets': 'supply collateral to one listed market and keep the supply open',
  RWA: 'take the tokenised real-world-asset exposure open to eligible wallets and hold it',
  Launchpad: 'sign up for an open launch pool, finish the tasks it lists and make the minimum deposit it asks for',
  'Prediction Market': 'take a single small position in a liquid market with a clear settlement date',
  'Basis Trading': 'open the basis trade correctly, holding the spot leg and the offsetting short leg together',
  Indexes: 'buy the index basket and hold it instead of trading in and out of it',
  Restaking: 'restake a liquid staking asset through the protocol and keep the receipt it issues',
  'Liquid Restaking': 'deposit a liquid staking asset and keep the liquid restaking receipt',
  'Liquid Staking': 'stake the native asset through the protocol and keep the liquid staking receipt',
  'Staking Pool': 'stake the native asset through the pool and keep the staking receipt',
  'Restaked BTC': 'deposit the bitcoin staking asset and keep the restaked receipt',
  Privacy: 'make one small deposit or private transfer through the privacy pool, following its own guide exactly',
  Payments: 'send a real payment through the rail to a second wallet you control, then one payment back',
  Chain: 'bridge a small amount onto the chain, hold its native gas token and use one native application',
  'Cross Chain Bridge': 'bridge funds to a supported destination chain and use a small part of them in an application there',
  Bridge: 'bridge funds to a supported destination chain and use a small part of them in an application there',
  'Canonical Bridge': 'bridge funds through the canonical route onto the destination chain and use them in an application there',
  Synthetics: 'mint a small synthetic position against posted collateral and keep the collateral ratio healthy',
  'Dual-Token Stablecoin': 'mint or deposit into the stablecoin position and hold the stable asset it issues',
  'Stablecoin Wrapper': 'wrap a small amount of the underlying stablecoin and hold the wrapped balance',
  'Stablecoin Issuer': 'mint a small amount of the issued stablecoin against eligible collateral and hold it',
  Insurance: 'buy a small cover policy on a position you actually hold and keep the policy until it expires',
  'Uncollateralized Lending': 'supply a small amount to one lending pool whose borrowers and terms are disclosed',
  'Token Locker': 'lock a small token amount you already hold for a short fixed term and keep the lock receipt',
  'Liquidity Manager': 'deposit into a managed liquidity position and keep the position shares',
  'Governance Incentives': 'stake or vote with a small eligible balance in the current incentives round',
  'AI Agents': 'fund one agent task or agent wallet with a small amount and let it finish a real job',
  'Decentralized AI': 'pay for one small inference or compute job and keep the job receipt in the wallet',
  'Crypto Card Issuer': 'activate the card if it is available in your region and make one ordinary purchase with it',
  'NFT Marketplace': 'list one item you own at a fair price, or buy one small item you actually want',
  'OTC Marketplace': 'post one small firm quote on the marketplace and honour it if it is taken',
  'Reserve Currency': 'bond or stake a small amount through the treasury mechanism and keep the position',
  DOR: 'submit or consume one data request through the oracle and keep the request receipt',
  CeDeFi: 'deposit into one disclosed yield product and keep the deposit receipt',
  CEX: 'make one ordinary spot trade on the exchange and withdraw the proceeds to your own wallet',
  'Anchor BTC': 'deposit a small amount of bitcoin exposure into the anchored position and keep the receipt',
  'Decentralized BTC': 'bridge a small amount of bitcoin exposure in and keep the wrapped position in your wallet',
  'Collateral Management': 'deposit collateral into the managed position and keep the position open',
  'Algo-Stables': 'mint or deposit a small amount into the algorithmic stablecoin position and hold it',
};

/** A second, deeper action in the same app, used when there is no second chain. */
const DEEPER: Readonly<Record<string, string>> = {
  Dexs: 'trade on a second pair in the same app, so the wallet shows both trading and liquidity activity',
  Lending: 'borrow a small amount against the supplied collateral once and repay it in full, keeping the health factor high throughout',
  CDP: 'add a little more collateral and adjust the minted amount once, showing active management without nearing liquidation',
  'CDP Manager': 'top up the managed position with a small amount of extra collateral',
  Derivatives: 'open the offsetting hedge leg the app describes and close both legs together at the end of the week',
  'Interest Rate Derivatives': 'take the opposite side of the rate position with a smaller amount as a hedge',
  'Options Vault': 'deposit a smaller amount into a second vault strategy and compare the two receipts',
  Yield: 'deposit a smaller amount into a second vault in the same app and keep both sets of shares',
  'Yield Aggregator': 'move a small part of the deposit to a second strategy the aggregator offers and keep both receipts',
  Farm: 'stake a second, smaller pool position in the same farm and keep both positions staked',
  'Leveraged Farming': 'open a second position at the same lowest leverage in a different pool instead of raising leverage on the first',
  'Risk Curators': 'split a smaller deposit into a second curator vault and read its holdings report before funding it',
  'Onchain Capital Allocator': 'allocate a smaller amount through a second allocator strategy and keep both sets of shares',
  'Collateral Markets': 'supply a smaller amount to a second collateral market listed in the app',
  RWA: 'hold a second, smaller asset from the same issuer if one is open to eligible wallets',
  Launchpad: 'finish the tasks of a second open pool without depositing more than its stated minimum',
  'Prediction Market': 'take one smaller position in a second market with a different settlement date',
  'Basis Trading': 'repeat the basis trade at a smaller size in a second market, keeping both legs matched',
  Indexes: 'buy a smaller amount of a second index basket the protocol offers',
  Restaking: 'restake a second, smaller amount through a different operator or strategy the app lists',
  'Liquid Restaking': 'deposit a smaller amount of a second supported staking asset if one is listed',
  'Liquid Staking': 'stake a second, smaller amount on a different day and keep both receipts together',
  'Staking Pool': 'stake a second, smaller amount on a different day and keep both receipts together',
  Privacy: 'make a second small private transfer on a different day, following the same guide',
  Payments: 'set up one repeat payment to the same second wallet and let it run twice',
  Chain: 'use a second native application on the chain, such as its main exchange or lending market',
  'Cross Chain Bridge': 'bridge a small amount back on a different day so the wallet shows a completed round trip',
  Bridge: 'bridge a small amount back on a different day so the wallet shows a completed round trip',
  'Canonical Bridge': 'withdraw a small amount back through the canonical route once the waiting period allows',
};

/** One step as a single string: what to do, what it costs, how long it takes. */
function step(action: string, cost: string, time: string): string {
  return `${action}. Cost: ${cost}. Time: ${time}.`;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** How long a position should stay open, from the protocol's age. */
function holdWindow(age: number | null): number {
  if (age === null) return 40;
  if (age < 180) return 56;
  if (age < 365) return 42;
  if (age < 730) return 35;
  return 28;
}

/**
 * A protocol's farm plan: seven steps in a fixed order — wallet, the
 * category's core action, a weekly cadence, a second chain or a deeper step,
 * a holding window, a step that answers current momentum, and a closing step
 * on claiming safely and keeping a log.
 */
export function planFor(p: Proto, age: number | null): string[] {
  const seed = slugSeed(p.slug);
  const chain = firstChain(p);
  const gas = gasUsd(chain);
  const capital = capitalBand(p.tvlUsd);
  const topUp = Math.max(20, Math.floor(capital / 2));
  const category = p.category ?? '';
  const core = CORE[category] ?? 'deposit into the main product the app offers and keep the position open';
  const deeper = DEEPER[category] ?? 'use a second feature of the same app, such as a second vault, market or pool, with a smaller amount';

  const setups = [
    `Open a fresh wallet used only for ${p.name}, write its seed phrase on paper, keep that paper offline and never type the phrase into any website`,
    `Make a separate wallet just for ${p.name}, back its seed phrase up on paper kept offline, and double-check the address before sending anything to it`,
    `Use a new wallet for ${p.name} so this activity stays apart from savings, save its seed phrase offline on paper, and fund it with a small test amount first`,
  ];
  const setup = setups[seed % setups.length]!;

  const weeks = 5 + (seed % 4);
  const weeklyMinutes = 10 + 5 * ((seed >>> 3) % 3);
  const hold = holdWindow(age);
  const change = p.change7d;

  const steps: string[] = [];
  steps.push(step(
    setup,
    `about $${gas} of gas to fund the wallet and send a first test transaction`,
    '15 minutes, once, before any deposit',
  ));
  steps.push(step(
    `Begin in ${p.name} on ${chain}: ${core}, with $${capital} of working capital, then confirm the position shows correctly in the app before walking away`,
    `$${capital} of capital plus about $${gas} of gas for the transaction`,
    '15 minutes to set up',
  ));
  steps.push(step(
    `Come back once a week for ${weeks} weeks and do one qualifying action in ${p.name} each time, such as repeating the core action with a small amount, compounding any yield the app shows, or voting while a vote is open`,
    `about $${gas} of gas per week`,
    `${weeklyMinutes} minutes per week for ${weeks} weeks`,
  ));
  if (p.chains.length >= 3) {
    const other = p.chains[1]!;
    steps.push(step(
      `Open a smaller position on ${other}, another chain ${p.name} runs on: move about $${topUp} across, do the core action once there, and keep that position open next to the first`,
      `about $${topUp} of extra capital plus $${gasUsd(other)} of gas on ${other}`,
      '20 minutes, once',
    ));
  } else {
    steps.push(step(
      `Go one step deeper in ${p.name} on ${chain}: ${deeper}`,
      `about $${topUp} of extra capital plus $${gas} of gas`,
      '15 minutes, once, in the second week',
    ));
  }
  steps.push(step(
    `Keep the ${p.name} position open for at least ${hold} days, through the weekly snapshots inside that window, checking it on the weekly visit instead of closing it after the first action`,
    `the $${capital} stays deployed for the whole period`,
    `${hold} days`,
  ));
  if (change !== null && change >= 10) {
    steps.push(step(
      `${p.name} is growing, with TVL up ${round1(change)}% over seven days, so add a second smaller tranche through the same core action after the first weekly check instead of enlarging the first position all at once`,
      `$${topUp} of added capital plus about $${gas} of gas`,
      '15 minutes, in the second week',
    ));
  } else if (change !== null && change <= -15) {
    steps.push(step(
      `${p.name} is shrinking, with TVL down ${round1(-change)}% over seven days, so start at half size, $${topUp}, wait two weeks, and re-check TVL and the official announcements before adding anything more`,
      `$${topUp} of capital to start instead of $${capital}, and no added capital until the re-check`,
      '10 minutes to re-check, two weeks in',
    ));
  } else {
    steps.push(step(
      `Read the official announcements page for ${p.name}, join one governance vote, quest or community call when one is offered, and note what was decided in the farm log`,
      'about $0 to $2, only if a vote transaction needs gas',
      '20 minutes, once',
    ));
  }
  steps.push(step(
    `Claim only from a link ${p.name} itself publishes in its app or official announcements, never pay a separate fee to claim anything, and never connect this wallet to a claim link sent by a stranger. Write the wallet address, dates, amounts and transaction hashes in a farm log as you go`,
    '$0 to check the official page, plus ordinary gas only for a claim the protocol itself shows',
    '10 minutes to check, plus 5 minutes of logging each week',
  ));
  return steps;
}
