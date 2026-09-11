import { describe, expect, it } from 'vitest';
import {
  ALL_HULLS, HULLS, PLANET_START, hullFuelMass, hullRoundTrip, missionFuel,
  type HullId,
} from '../src/index.js';

const combat = ALL_HULLS.filter((id) => {
  const h = HULLS[id];
  return !h.ground && h.cls !== 'SUPPORT' && id !== 'PROSPECTOR';
});
const price = (id: HullId) => HULLS[id].alloy + HULLS[id].crystal + HULLS[id].deuterium;
const tierOf = (id: HullId) => HULLS[id].tier ?? 1;
const trip = (id: HullId) => hullRoundTrip(id) ?? 20;
const byTier = (t: number) => combat.filter((id) => tierOf(id) === t);

/**
 * A FAST HULL CARRIES LESS AND DRINKS MORE. D195, owner instruction.
 *
 * Two sentences from the owner — *"hızlı olan biraz daha az kargosu olsun yavaş olan
 * biraz daha çok"* and *"hızlı olanlar biraz daha çok yaksın, yavaş olanlar biraz
 * daha az"* — are one design statement, so they are derived from ONE number: the
 * hull's own reference round trip. A separate table for each would be two things to
 * keep in step, and they would not stay in step.
 */
describe('what a hull carries and drinks', () => {
  it('gives every combat hull a hold, and grows it with the tier', () => {
    for (const id of combat) expect(HULLS[id].cargo, id).toBeGreaterThan(0);
    for (let t = 2; t <= 4; t++) {
      const smallest = Math.min(...byTier(t).map((id) => HULLS[id].cargo));
      const largest = Math.max(...byTier(t - 1).map((id) => HULLS[id].cargo));
      expect(smallest, `tier ${String(t)} vs ${String(t - 1)}`).toBeGreaterThan(largest);
    }
  });

  /** The hold is small on purpose: a raid still wants a transport. */
  it("keeps a warship hold well under a transport hold", () => {
    for (const id of combat) {
      expect(HULLS[id].cargo, id).toBeLessThan(HULLS.COURIER.cargo);
    }
  });

  it('carries less the faster it flies, within a tier', () => {
    for (let t = 1; t <= 4; t++) {
      const group = byTier(t);
      if (group.length < 2) continue;
      const fastest = group.reduce((a, b) => (trip(a) <= trip(b) ? a : b));
      const slowest = group.reduce((a, b) => (trip(a) >= trip(b) ? a : b));
      if (trip(fastest) === trip(slowest)) continue;
      expect(HULLS[fastest].cargo, `tier ${String(t)}`).toBeLessThan(HULLS[slowest].cargo);
      expect(HULLS[fastest].speed).toBeGreaterThan(HULLS[slowest].speed);
    }
  });

  it('drinks in proportion to what it costs', () => {
    for (const id of combat) {
      const perValue = hullFuelMass(id) / price(id);
      expect(perValue, id).toBeGreaterThan(0.004);
      expect(perValue, id).toBeLessThan(0.03);
    }
  });

  it('drinks more the faster it flies, from the second tier up', () => {
    for (let t = 2; t <= 4; t++) {
      const group = byTier(t);
      if (group.length < 2) continue;
      const fastest = group.reduce((a, b) => (trip(a) <= trip(b) ? a : b));
      const slowest = group.reduce((a, b) => (trip(a) >= trip(b) ? a : b));
      if (trip(fastest) === trip(slowest)) continue;
      const per = (id: HullId) => hullFuelMass(id) / price(id);
      expect(per(fastest), `tier ${String(t)}`).toBeGreaterThan(per(slowest));
    }
  });

  /**
   * THERE IS NO EXEMPTED TIER, AND THE OPENING SURVIVES ANYWAY. Owner instruction,
   * retiring D153's tier-1 carve-out: *"Tier 1 is excluded diye bisey yok ... cunku
   * bu sefer tier 1 karli diye full ondan uretiyorlar"*. An exempted rung is a
   * discount, and a discount on the entry hull is an instruction to build nothing
   * else.
   *
   * What protects the opening instead is that the granted TANK is measured against
   * the granted FLEET. Two Darts at a neighbour is what a fresh commander actually
   * flies, and `PLANET_START.deuterium` still covers a long run of it — the lesson
   * arrives when the fleet grows, which is when it was always meant to arrive.
   */
  it('protects the opening without exempting anything', () => {
    const opening = missionFuel({ DART: 2 }, 600, 2);
    expect(PLANET_START.deuterium / opening).toBeGreaterThanOrEqual(8);
    expect(PLANET_START.deuterium / opening).toBeLessThan(40);
    // ...and the entry hull is on the same rule as everything above it.
    for (const id of byTier(1)) {
      const perValue = hullFuelMass(id) / price(id);
      expect(perValue, id).toBeGreaterThan(0.004);
    }
  });

  /** Fuel must stop punishing the tier it is supposed to reward. */
  it('never gets less fuel-efficient as the tier rises, within a class', () => {
    for (const cls of ['SKIRMISHER', 'LANCE', 'BULWARK'] as const) {
      const line = combat.filter((id) => HULLS[id].cls === cls)
        .sort((a, b) => tierOf(a) - tierOf(b));
      for (let i = 1; i < line.length; i++) {
        const before = Math.sqrt(HULLS[line[i - 1]!].atk * HULLS[line[i - 1]!].hp) / hullFuelMass(line[i - 1]!);
        const after = Math.sqrt(HULLS[line[i]!].atk * HULLS[line[i]!].hp) / hullFuelMass(line[i]!);
        expect(after, `${cls} ${line[i - 1]!} -> ${line[i]!}`).toBeGreaterThan(before * 0.9);
      }
    }
  });
});

/**
 * SPECIALISATION SHARPENS WITH THE TIER, AND COSTS THE SAME. D195, option A.
 *
 * The owner asked for the trade between attack and armour to improve as hulls go
 * up. Measured first: `atk x hp` IS the power a duel resolves on, so paying a
 * PRODUCT bonus for specialising would make the extremes strictly better than the
 * middle — the Skirmisher line sits at role 1.000 and would earn nothing at all,
 * and Escort hulls would be dominated by Fortresses of their own counter class.
 * Two dead branches, one of them a third of the counter cycle.
 *
 * So the SPREAD widens and the product does not move: a tier-4 Fortress is further
 * from a tier-4 Lance than their tier-1 counterparts are, and every hull still buys
 * the same power per unit of ore.
 */
describe('the specialisation spread', () => {
  const ratio = (id: HullId) => HULLS[id].atk / HULLS[id].hp;
  const spreadAt = (t: number) => {
    const r = byTier(t).map(ratio);
    return Math.max(...r) / Math.min(...r);
  };

  it('widens with every tier', () => {
    for (let t = 2; t <= 4; t++) {
      expect(spreadAt(t), `tier ${String(t)}`).toBeGreaterThan(spreadAt(t - 1));
    }
  });

  it('never pays for it — equal budget still buys equal power', () => {
    for (let t = 1; t <= 4; t++) {
      const eff = byTier(t).map((id) => (HULLS[id].atk * HULLS[id].hp) / price(id) ** 2);
      expect(Math.max(...eff) / Math.min(...eff), `tier ${String(t)}`).toBeLessThan(1.06);
    }
  });

  it('keeps the tier worth reaching, on its own terms', () => {
    const meanEff = (t: number) => {
      const e = byTier(t).map((id) => (HULLS[id].atk * HULLS[id].hp) / price(id) ** 2);
      return e.reduce((a, b) => a + b, 0) / e.length;
    };
    for (let t = 2; t <= 4; t++) expect(meanEff(t)).toBeGreaterThan(meanEff(t - 1));
  });
});
