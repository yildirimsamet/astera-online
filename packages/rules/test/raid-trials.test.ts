import { describe, expect, it } from 'vitest';
import {
  type RaidTrial,
  catastrophicShare,
  distribution,
  fleetHours,
  raidLedger,
  raidTrials,
} from '../src/index.js';

/**
 * A SINGLE LEDGER CANNOT RETURN A VARIANCE. That is the whole reason this layer is separate:
 * `raidLedger` answers "what did THIS raid do", and every acceptance question in the plan —
 * p10/p50/p90, CVaR, catastrophic-loss rate — is a question about a DISTRIBUTION of raids.
 */

/** A trial whose replacement-view AE is exactly `net`, with a stated commitment and flight. */
const trialWorth = (net: number, committedAE = 100_000, roundTripHours = 4): RaidTrial => ({
  ledger: raidLedger({
    attackerLosses: {},
    defenderLosses: {},
    loot: { alloy: net, crystal: 0, deuterium: 0 },
    salvage: { alloy: 0, crystal: 0, deuterium: 0 },
    fuelPaid: 0,
  }),
  committedAE,
  roundTripHours,
});

describe('the shape of a set of outcomes', () => {
  it('reports one outcome as its own every percentile', () => {
    const d = distribution([7]);
    expect(d).toEqual({ n: 1, mean: 7, sd: 0, p10: 7, p50: 7, p90: 7, cvar: 7 });
  });

  it('interpolates percentiles between order statistics', () => {
    const d = distribution([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(d.p50).toBe(50);
    expect(d.p10).toBe(10);
    expect(d.p90).toBe(90);
  });

  it('measures spread, not just the middle', () => {
    expect(distribution([5, 5, 5, 5]).sd).toBe(0);
    expect(distribution([0, 10]).sd).toBe(5);
  });

  /**
   * CVaR IS THE TAIL'S MEAN, NOT ITS EDGE. p10 says "one raid in ten is at least this bad"; CVaR
   * says how bad that tenth actually is on average — which is the number that decides whether a
   * commander can survive the bad run, and the one a median hides completely.
   */
  it('averages the bad tail rather than quoting its edge', () => {
    // Worst tenth of twenty values is the worst two: -100 and -50.
    const values = [-100, -50, ...Array.from({ length: 18 }, (_, i) => i * 10)];
    expect(distribution(values, 0.1).cvar).toBe(-75);
  });

  it('keeps at least one outcome in the tail however small the sample', () => {
    expect(distribution([-9, 1, 2], 0.01).cvar).toBe(-9);
  });

  it('refuses an empty set rather than reporting zeros', () => {
    expect(() => distribution([])).toThrow();
  });

  it('refuses a set that is not finite', () => {
    expect(() => distribution([1, Number.NaN])).toThrow();
  });
});

describe('what a fleet-hour is', () => {
  /** Codex, round 4: initial COMMITTED fleet AE × scheduled round trip — collectors and transports included. */
  it('prices the whole committed fleet for the whole scheduled round trip', () => {
    expect(fleetHours(100_000, 4)).toBe(400_000);
  });

  it('refuses a commitment or a flight that is not positive', () => {
    expect(() => fleetHours(0, 4)).toThrow();
    expect(() => fleetHours(100_000, 0)).toThrow();
  });
});

describe('a catastrophic raid', () => {
  const lost = (hullFleet: { DART: number }, committedAE: number): RaidTrial => ({
    ledger: raidLedger({
      attackerLosses: hullFleet,
      defenderLosses: {},
      loot: { alloy: 0, crystal: 0, deuterium: 0 },
      salvage: { alloy: 0, crystal: 0, deuterium: 0 },
      fuelPaid: 0,
    }),
    committedAE,
    roundTripHours: 4,
  });

  /** Half the committed fleet gone for good is the line: below it a raid is a cost, above it a setback. */
  it('counts the raids that burned at least half of what was committed', () => {
    const heavy = lost({ DART: 100 }, 1_000);
    const light = lost({ DART: 1 }, 1_000_000);
    expect(catastrophicShare([heavy, light, light, light], 0.5)).toBe(0.25);
  });

  it('is measured against what was committed, not against what came home', () => {
    const same = lost({ DART: 10 }, 100);
    expect(catastrophicShare([same], 0.5)).toBe(1);
    expect(catastrophicShare([same], 1_000_000)).toBe(0);
  });
});

describe('the aggregate a balance gate reads', () => {
  const trials = [trialWorth(-40_000), trialWorth(10_000), trialWorth(30_000), trialWorth(80_000)];

  it('reports each of the three views as its own distribution', () => {
    const agg = raidTrials(trials);
    expect(agg.liquid.n).toBe(4);
    expect(agg.replacement.p50).toBe(agg.liquid.p50);
    expect(agg.wealth.mean).toBe(20_000);
  });

  /**
   * THE DENOMINATOR IS THE POINT. A raid that nets 30,000 with 61 Citadels tied up for eleven hours
   * is not the same trade as one that nets 30,000 with eight Darts out for two, and an average P&L
   * cannot tell them apart.
   */
  it('divides the return by the fleet-hours it occupied', () => {
    const agg = raidTrials([trialWorth(80_000, 100_000, 4)]);
    expect(agg.perFleetHour.p50).toBeCloseTo(80_000 / 400_000, 12);
  });

  it('also reports the plain hourly return of one occupied mission slot', () => {
    const agg = raidTrials([trialWorth(80_000, 100_000, 4)]);
    expect(agg.perSlotHour.p50).toBe(20_000);
  });

  it('carries the catastrophic share alongside the middle', () => {
    expect(raidTrials(trials).catastrophicShare).toBe(0);
  });

  it('refuses to summarise no raids at all', () => {
    expect(() => raidTrials([])).toThrow();
  });
});
