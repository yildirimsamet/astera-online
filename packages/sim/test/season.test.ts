import { describe, expect, it } from 'vitest';
import { alloyRate, collectorCap, crystalRate, median, storageCap } from '@blindspace/rules';
import {
  BANDS, LEVERS, freshStats, informedArchetypeWins, ladderByArchetype, measure,
  runSeason, verdict, type InvariantKey, type SimPlayer,
} from '../src/index.js';

/**
 * THE REGRESSION GATE.
 *
 * A balance regression — someone nudges a constant and the vault silently starts
 * protecting 200% of storage again — is invisible to unit tests and catastrophic
 * in production. Running a full simulated season is the only thing that catches
 * it, and it costs a few seconds.
 *
 * FIFTY PLAYERS, NOT A HUNDRED AND TWENTY. `SERVERS.capacity` is 50 and galaxies
 * fill strictly in order (D21), so 120 was testing a galaxy size that never ships.
 * It mattered: at 50 the pre-S1 baseline failed `informedArchetypeWins` on seed 99,
 * and nothing at 120 showed it.
 *
 * FIVE SEEDS, NOT THREE. GRINDER is 12% of the field — six bots at this size — so a
 * median rank is taken over six samples and swings hard between seeds. Three runs
 * cannot tell a regression from a draw.
 */
const SEEDS = [42, 7, 99, 4242, 1337];
const CFG = { players: 50, days: 14 };

const RUNS = SEEDS.map((seed) => {
  const { world, days } = runSeason({ ...CFG, seed });
  // Days 1-2 are identical for everyone; measuring them says nothing.
  const settled = days.slice(2).map((d) => d.invariants);
  const medians = Object.fromEntries(
    (Object.keys(BANDS) as InvariantKey[]).map((key) => [
      key,
      median(settled.map((d) => d[key]).filter((v) => !Number.isNaN(v))),
    ]),
  ) as Record<InvariantKey, number>;
  return { seed, world, medians };
});

/**
 * WHICH INVARIANTS ARE ASSERTED PER SEED, AND WHICH ARE POOLED.
 *
 * Split by MEASURED spread across the five seeds, not by guesswork. A regression
 * gate that fires on seed noise teaches the reader to ignore it, which is the same
 * failure as a diagnostic that cannot fire at all.
 *
 *   ARR  0.308-0.326   6%   per seed
 *   SV   0.209-0.218   4%   per seed
 *   VFR  0.229-0.267  17%   per seed — wide band, every seed sits mid-range
 *   RR   1.362-1.742  28%   pooled
 *   TAX  0.079-0.120  52%   pooled
 *   TI   unstable at n=50 by construction — see BANDS.TI            pooled
 *
 * A genuine balance regression moves every seed together, so the pooled median
 * still catches it; what it stops catching is one unlucky galaxy.
 */
const PER_SEED: InvariantKey[] = ['ARR', 'VFR', 'SV'];
const POOLED: InvariantKey[] = ['TI', 'RR', 'TAX'];

describe.each(RUNS)('season on seed $seed', ({ world, medians }) => {
  it.each(PER_SEED)('%s holds its band', (key) => {
    const m = medians[key];
    const v = verdict(key, m);
    expect(v, `${key} = ${m.toFixed(3)} is ${v}. Lever: ${LEVERS[key]}`).toBe('OK');
  });

  it('the season actually progressed', () => {
    const topCore = Math.max(...world.players.map((p) => p.buildings.CORE));
    expect(topCore).toBeGreaterThanOrEqual(9);
    expect(topCore).toBeLessThanOrEqual(18);
  });

  it('dominion is zero-sum across the whole galaxy', () => {
    const total = world.players.reduce((s, p) => s + p.ledger.taken - p.ledger.lost, 0);
    expect(Math.abs(total)).toBeLessThan(1);
  });
});

describe('pooled across all five seeds', () => {
  it.each(POOLED)('%s holds its band', (key) => {
    const m = median(RUNS.map((r) => r.medians[key]));
    const v = verdict(key, m);
    const spread = RUNS.map((r) => `${String(r.seed)}:${r.medians[key].toFixed(3)}`).join(' ');
    expect(v, `${key} = ${m.toFixed(4)} is ${v}. Per seed: ${spread}. Lever: ${LEVERS[key]}`).toBe('OK');
  });

  /**
   * THE DESIGN'S CENTRAL CLAIM, and the reason the whole simulator exists.
   *
   * Pooled rather than per-seed because a median rank over six GRINDERs is noisy,
   * but demanded on EVERY seed rather than on a majority: if the informed player
   * fails to top the ladder in a fifty-world galaxy, that is a finding about the
   * design and not about the sample.
   */
  it('the informed archetype tops the ladder on every seed', () => {
    const failures = RUNS.filter((r) => !informedArchetypeWins(r.world.players)).map((r) => ({
      seed: r.seed,
      board: ladderByArchetype(r.world.players),
    }));
    expect(failures, JSON.stringify(failures, null, 1)).toHaveLength(0);
  });

  /**
   * RESTATED to what D2 actually claims.
   *
   * The old assertion was `turtle.medianDominion <= 0`, which contradicts the
   * decision it was meant to protect. D2 says in as many words: "A fortress that is
   * never attacked scores exactly zero; a fortress that is attacked and holds,
   * climbs." A turtle in this simulation is attacked constantly and repels a
   * quarter of it, so a positive score is the design working, not failing.
   *
   * What the design does forbid is turtling being the WINNING strategy, and that is
   * what is asserted here: sitting still may pay, but it must never out-earn the
   * player who scouts.
   */
  it('turtling may pay, but never beats the informed player', () => {
    for (const { seed, world } of RUNS) {
      const board = ladderByArchetype(world.players);
      const turtle = board.find((r) => r.type === 'TURTLE');
      const grinder = board.find((r) => r.type === 'GRINDER');
      expect(turtle!.medianDominion, `seed ${String(seed)}`).toBeLessThanOrEqual(
        grinder!.medianDominion,
      );
    }
  });
});

/**
 * THE GATE'S OWN GATE.
 *
 * `BANDS.VFR` was re-derived downward for the two-pile economy (D16), and a floor
 * that has been lowered is a floor that has to prove it still stops something. The
 * bug it exists for is D13's: a vault whose protection compounds faster than the
 * stock it protects eventually covers everything, nothing in the galaxy is
 * raidable, and there is no other symptom.
 *
 * This drives that state directly rather than waiting for a season to produce it,
 * so the assertion holds even if the bots' behaviour changes underneath it.
 */
describe('VFR still catches a vault that covers everything', () => {
  const planet = (over: Partial<SimPlayer>): SimPlayer => ({
      id: 0, name: 'T', type: 'TURTLE', x: 0, y: 0, z: 0,
      buildings: { CORE: 8, REFINERY: 8, EXTRACTOR: 8, VAULT: 8, SHIPYARD: 4 },
      instruments: {}, orbit: [], fleet: {}, ground: {},
      alloy: 0, crystal: 0, bufferAlloy: 0, bufferCrystal: 0,
      shield: 0, lastTick: 0, joinedAt: 0, disruptedUntil: 0, nextLogin: 0,
      ledger: { taken: 0, lost: 0 },
      attacks: [], scoutsSent: 0, lootToday: 0, lossToday: 0, disruptedToday: 0,
      wealthNow: 1, wealthHistory: [1],
      recentHits: new Map(), intel: new Map(), neighbours: [],
      ...over,
  });

  const vfrOf = (ps: SimPlayer[]): number => measure(5, ps, freshStats()).VFR;

  it('reads inside the band when stores are genuinely full', () => {
    const rich = Array.from({ length: 20 }, () =>
      planet({
        alloy: storageCap(alloyRate(8)),
        crystal: storageCap(crystalRate(8)),
        bufferAlloy: collectorCap(alloyRate(8)),
        bufferCrystal: collectorCap(crystalRate(8)),
      }),
    );
    expect(vfrOf(rich)).toBeGreaterThan(BANDS.VFR[0]);
  });

  /**
   * The vault swallowing the whole store is exactly the shipped-once bug. Whatever
   * the floor is set to, this has to fall below it.
   */
  it('falls under the floor when the vault swallows the store', () => {
    const covered = Array.from({ length: 20 }, () =>
      planet({
        // Everything a player holds sits under a vault floor that outgrew it.
        buildings: { CORE: 8, REFINERY: 8, EXTRACTOR: 8, VAULT: 40, SHIPYARD: 4 },
        alloy: storageCap(alloyRate(8)),
        crystal: storageCap(crystalRate(8)),
      }),
    );
    expect(vfrOf(covered)).toBeLessThan(BANDS.VFR[0]);
  });
});
