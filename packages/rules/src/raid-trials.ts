import type { RaidLedger } from './raid-ledger.js';

/**
 * THE DISTRIBUTION LAYER — because a single ledger cannot return a variance.
 *
 * `raidLedger` answers "what did THIS raid do". Every acceptance question the balance plan asks is
 * a question about a SET of raids: how bad is the bad tenth, how often does a commander lose the
 * fleet outright, is the median return an accident of one lucky seed. Averaging ledgers cannot
 * answer any of them, and a median answers none of the ones that decide whether a weaker player
 * can stay in the season.
 *
 * THIS IS A MEASUREMENT INSTRUMENT, NOT A GAME RULE. Nothing here decides an outcome; it sits in
 * this package for the same reason `economy-profile.ts` does — the simulator, the balance studies
 * and the server all need one definition of these figures, and a second copy would drift.
 *
 * IT DOES NOT SAMPLE. The caller supplies the trials — a season run, a scenario matrix, a replay of
 * settled battles — and this aggregates them. Putting an Rng here would make the instrument's own
 * randomness part of the reading.
 */

/** One settled raid, priced, with the commitment and the flight it occupied. */
export interface RaidTrial {
  ledger: RaidLedger;
  /**
   * AE of the fleet committed AT LAUNCH — collectors and transports included, because a hold that
   * flies is a hold that is not defending home and not building anything.
   */
  committedAE: number;
  /** The scheduled round trip in hours: out, fight, and home. */
  roundTripHours: number;
}

export interface Distribution {
  n: number;
  mean: number;
  /** Population standard deviation: these are the outcomes, not a sample drawn from more of them. */
  sd: number;
  p10: number;
  p50: number;
  p90: number;
  /**
   * The mean of the worst `share` of outcomes — not its edge. p10 says one raid in ten is at least
   * this bad; CVaR says how bad that tenth actually runs, which is the figure that decides whether
   * a commander survives a bad week.
   */
  cvar: number;
}

const finite = (values: readonly number[]): void => {
  if (values.length === 0) throw new Error('a distribution over no outcomes is not a reading');
  for (const v of values) {
    if (!Number.isFinite(v)) throw new Error('a distribution cannot summarise a non-finite outcome');
  }
};

/** Linear interpolation between order statistics, so a percentile moves as the sample moves. */
const quantile = (sorted: readonly number[], q: number): number => {
  const pos = q * (sorted.length - 1);
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  const lowValue = sorted[low] ?? 0;
  if (low === high) return lowValue;
  return lowValue + (pos - low) * ((sorted[high] ?? 0) - lowValue);
};

export function distribution(values: readonly number[], share = 0.1): Distribution {
  finite(values);
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((sum, v) => sum + v, 0) / n;
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  // At least one outcome stays in the tail however small the sample: a set of three raids still has
  // a worst raid, and reporting an empty tail as zero would read as "no bad case".
  const tail = Math.max(1, Math.ceil(share * n));
  return {
    n,
    mean,
    sd: Math.sqrt(variance),
    p10: quantile(sorted, 0.1),
    p50: quantile(sorted, 0.5),
    p90: quantile(sorted, 0.9),
    cvar: sorted.slice(0, tail).reduce((sum, v) => sum + v, 0) / tail,
  };
}

/**
 * THE DENOMINATOR, DEFINED ONCE. Codex, round 4: initial committed fleet AE × scheduled round trip.
 *
 * A raid that nets 30,000 with sixty Citadels tied up for eleven hours is not the trade a raid that
 * nets 30,000 with eight Darts out for two is, and an average P&L cannot tell them apart.
 */
export function fleetHours(committedAE: number, roundTripHours: number): number {
  if (!(committedAE > 0)) throw new Error('a raid with no committed fleet has no fleet-hours');
  if (!(roundTripHours > 0)) throw new Error('a raid with no scheduled flight has no fleet-hours');
  return committedAE * roundTripHours;
}

/** What this raid destroyed of the attacker's own fleet for good, in AE. */
const permanentLossAE = (ledger: RaidLedger): number => ledger.ae.liquid - ledger.ae.replacement;

/**
 * HOW OFTEN A RAID IS NOT A COST BUT A SETBACK.
 *
 * `share` of the committed fleet gone for good is the line. Half is the reading the plan's
 * "felaket kayıp oranı" means: below it a commander flies again tomorrow, above it they are
 * rebuilding, and the whole weak-player complaint in the chat logs is about the second case.
 */
export function catastrophicShare(trials: readonly RaidTrial[], share = 0.5): number {
  if (trials.length === 0) throw new Error('a catastrophe rate over no raids is not a reading');
  const hit = trials.filter(
    (trial) => permanentLossAE(trial.ledger) >= share * trial.committedAE,
  ).length;
  return hit / trials.length;
}

export interface RaidTrialSummary {
  liquid: Distribution;
  replacement: Distribution;
  wealth: Distribution;
  /**
   * Return per fleet-hour, on the REPLACEMENT view. Dividing the liquid view would rank a raid that
   * came home with loot and no fleet above a cheap one that came home with both.
   */
  perFleetHour: Distribution;
  /** The same return against one occupied mission slot's hours, which is what a player feels. */
  perSlotHour: Distribution;
  catastrophicShare: number;
}

export function raidTrials(trials: readonly RaidTrial[], share = 0.1): RaidTrialSummary {
  if (trials.length === 0) throw new Error('a raid summary over no raids is not a reading');
  return {
    liquid: distribution(trials.map((t) => t.ledger.ae.liquid), share),
    replacement: distribution(trials.map((t) => t.ledger.ae.replacement), share),
    wealth: distribution(trials.map((t) => t.ledger.ae.wealth), share),
    perFleetHour: distribution(
      trials.map((t) => t.ledger.ae.replacement / fleetHours(t.committedAE, t.roundTripHours)),
      share,
    ),
    perSlotHour: distribution(
      trials.map((t) => t.ledger.ae.replacement / t.roundTripHours),
      share,
    ),
    catastrophicShare: catastrophicShare(trials),
  };
}
