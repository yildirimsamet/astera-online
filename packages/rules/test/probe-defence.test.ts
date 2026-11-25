import { describe, expect, it } from 'vitest';
import {
  ANTI_STRATEGIC,
  PROBE_DEFENCE,
  detectChance,
  probeBatteryCharges,
  probeBatteryLevel,
  settleProbeBattery,
  probeBatteryOnline,
  probeCatchChance,
  probeCatchRoll,
  seededFrom,
  spendProbeCharge,
  orbitStandoff, probeShotMoment, surfaceStandoff, toWorld, visualLeg, worldRadius,
} from '../src/index.js';

/**
 * THE PROBE DEFENCE BATTERY. Owner decisions K1–K8, 2026-11-24
 * (`docs/sonda-bataryasi-plani-2026-11-24.md`).
 *
 * "A battery with a ready charge catches probes more easily and shoots down what it
 * catches; once its charges are gone the world is as if it had no battery."
 */
describe('probe defence figures (owner, 2026-11-24, levels after the first playtest)', () => {
  it('pins the four levels the owner chose', () => {
    expect(PROBE_DEFENCE.levels.map((level) => level.capacity)).toEqual([5, 10, 15, 20]);
    // A full refill takes about thirty minutes at every level.
    expect(PROBE_DEFENCE.levels.map((level) => level.refillMinutes)).toEqual([6, 3, 2, 1.5]);
    expect(PROBE_DEFENCE.levels.map((level) => level.capacity * level.refillMinutes)).toEqual([30, 30, 30, 30]);
    expect(PROBE_DEFENCE.levels.map((level) => level.requiredRadar)).toEqual([3, 4, 5, 6]);
    expect(PROBE_DEFENCE.levels.map((level) => level.cost)).toEqual([
      { alloy: 3_000, crystal: 1_800, deuterium: 150 },
      { alloy: 6_000, crystal: 3_600, deuterium: 300 },
      { alloy: 10_000, crystal: 6_000, deuterium: 500 },
      { alloy: 15_000, crystal: 9_000, deuterium: 800 },
    ]);
    expect(PROBE_DEFENCE.levels.map((level) => level.buildMinutes)).toEqual([20, 40, 60, 90]);
    expect(PROBE_DEFENCE.catchBase).toBe(0.5);
    expect(PROBE_DEFENCE.catchPerLevel).toBe(0.03);
    expect(PROBE_DEFENCE.catchMax).toBe(0.9);
    expect(PROBE_DEFENCE.noticeWindowMinutes).toBe(10);
  });

  it('opens at the same effective Radar rung as the strategic battery', () => {
    expect(PROBE_DEFENCE.requiredRadar).toBe(ANTI_STRATEGIC.requiredRadar);
    expect(PROBE_DEFENCE.levels[0].requiredRadar).toBe(PROBE_DEFENCE.requiredRadar);
  });

  it('reads a level past either end as the nearest one', () => {
    expect(probeBatteryLevel(0)).toBe(PROBE_DEFENCE.levels[0]);
    expect(probeBatteryLevel(9)).toBe(PROBE_DEFENCE.levels[3]);
  });
});

describe('probeCatchChance', () => {
  it('is exactly today\'s detection roll with no armed battery (level 0)', () => {
    for (const [radar, shipyard] of [[0, 0], [4, 4], [6, 3], [3, 6], [8, 1]] as const) {
      expect(probeCatchChance(radar, shipyard, 0)).toBe(detectChance(radar, shipyard));
    }
  });

  it('raises the base to 50% at level 1, three points more per level, same slope', () => {
    expect(probeCatchChance(4, 4, 1)).toBeCloseTo(0.5, 10);
    expect(probeCatchChance(4, 4, 2)).toBeCloseTo(0.53, 10);
    expect(probeCatchChance(4, 4, 4)).toBeCloseTo(0.59, 10);
    expect(probeCatchChance(6, 3, 1)).toBeCloseTo(0.89, 10);
    expect(probeCatchChance(3, 6, 1)).toBeCloseTo(0.11, 10);
  });

  it('keeps the floor and stops at 90% at every level, so a probe always has a way through', () => {
    expect(probeCatchChance(3, 12, 4)).toBe(0.05);
    expect(probeCatchChance(8, 0, 1)).toBe(0.9);
    expect(probeCatchChance(8, 0, 4)).toBe(0.9);
  });
});

describe('probeBatteryCharges — lazy refill', () => {
  const t0 = Date.UTC(2026, 10, 24, 12);
  const min = 60_000;

  it('a full battery stays full and has no next charge', () => {
    expect(probeBatteryCharges({ charges: 5, chargedAt: t0 }, t0 + 999 * min, 1)).toEqual({ charges: 5, nextAt: null });
  });

  it('refills one charge per the level\'s step up to its cap', () => {
    const empty = { charges: 0, chargedAt: t0 };
    expect(probeBatteryCharges(empty, t0 + 5 * min, 1)).toEqual({ charges: 0, nextAt: t0 + 6 * min });
    expect(probeBatteryCharges(empty, t0 + 6 * min, 1)).toEqual({ charges: 1, nextAt: t0 + 12 * min });
    expect(probeBatteryCharges(empty, t0 + 30 * min, 1)).toEqual({ charges: 5, nextAt: null });
    expect(probeBatteryCharges(empty, t0 + 15 * min, 4)).toEqual({ charges: 10, nextAt: t0 + 16.5 * min });
    expect(probeBatteryCharges(empty, t0 + 30 * min, 4)).toEqual({ charges: 20, nextAt: null });
  });

  it('never gains a charge from an instant before the stored one', () => {
    expect(probeBatteryCharges({ charges: 1, chargedAt: t0 }, t0 - 30 * min, 1)).toEqual({ charges: 1, nextAt: t0 + 6 * min });
  });
});

describe('spendProbeCharge', () => {
  const t0 = Date.UTC(2026, 10, 24, 12);
  const min = 60_000;

  it('spending from full starts the refill clock at the shot', () => {
    const after = spendProbeCharge({ charges: 5, chargedAt: t0 - 500 * min }, t0, 1);
    expect(after).toEqual({ charges: 4, chargedAt: t0 });
    expect(after && probeBatteryCharges(after, t0 + 6 * min, 1).charges).toBe(5);
  });

  it('spending while refilling keeps the progress already made', () => {
    // 0 at t0, one gained at +6, shot at +8: the next charge is still due at +12.
    const after = spendProbeCharge({ charges: 0, chargedAt: t0 }, t0 + 8 * min, 1);
    expect(after).toEqual({ charges: 0, chargedAt: t0 + 6 * min });
    expect(after && probeBatteryCharges(after, t0 + 12 * min, 1)).toEqual({ charges: 1, nextAt: t0 + 18 * min });
  });

  it('refuses to spend a charge that is not there', () => {
    expect(spendProbeCharge({ charges: 0, chargedAt: t0 }, t0 + 5 * min, 1)).toBeNull();
  });
});

describe('settleProbeBattery — an upgrade lands on its own', () => {
  const t0 = Date.UTC(2026, 10, 24, 12);
  const min = 60_000;
  const row = { level: 1, charges: 2, chargedAt: t0, upgradeLevel: 2, upgradeReadyAt: t0 + 40 * min };

  it('works at the old level while the upgrade runs', () => {
    expect(settleProbeBattery(row, t0 + 10 * min)).toEqual({ level: 1, stock: { charges: 2, chargedAt: t0 }, upgrading: true });
  });

  it('at the finish adds the new capacity as ready charges, and refills at the new pace', () => {
    // Level 1 was full (5) long before the finish; level 2 holds 10.
    const settled = settleProbeBattery(row, t0 + 40 * min);
    expect(settled).toEqual({ level: 2, stock: { charges: 10, chargedAt: t0 + 40 * min }, upgrading: false });
  });

  it('carries a part-empty battery\'s gap across the upgrade', () => {
    const busy = { level: 1, charges: 0, chargedAt: t0 + 37 * min, upgradeLevel: 2, upgradeReadyAt: t0 + 40 * min };
    const settled = settleProbeBattery(busy, t0 + 40 * min);
    expect(settled.level).toBe(2);
    expect(settled.stock.charges).toBe(5);
    expect(probeBatteryCharges(settled.stock, t0 + 43 * min, 2).charges).toBe(6);
  });

  it('leaves a battery with no upgrade as it is', () => {
    const plain = { level: 3, charges: 7, chargedAt: t0, upgradeLevel: null, upgradeReadyAt: null };
    expect(settleProbeBattery(plain, t0 + 999 * min)).toEqual({ level: 3, stock: { charges: 7, chargedAt: t0 }, upgrading: false });
  });
});

describe('probeCatchRoll', () => {
  it('is a fixed number in [0, 1) per mission, on a stream of its own', () => {
    const id = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
    const roll = probeCatchRoll(id);
    expect(roll).toBe(probeCatchRoll(id));
    expect(roll).toBeGreaterThanOrEqual(0);
    expect(roll).toBeLessThan(1);
    // Not the report's own stream, so moving the roll off it leaves every band where it was.
    expect(roll).not.toBe(seededFrom(id)());
  });
});

describe('probeBatteryOnline', () => {
  it('needs the effective Radar rung, and no EMP or recovery', () => {
    expect(probeBatteryOnline({ radar: 3, emp: false, recovering: false })).toBe(true);
    expect(probeBatteryOnline({ radar: 2, emp: false, recovering: false })).toBe(false);
    expect(probeBatteryOnline({ radar: 5, emp: true, recovering: false })).toBe(false);
    expect(probeBatteryOnline({ radar: 5, emp: false, recovering: true })).toBe(false);
  });
});

/*
  WHERE AND WHEN THE BATTERY SHOOTS (owner playtest, 2026-11-24): "biraz geriden vurmalı" — out on
  the probe's own approach, like an interception, not at its hold over the surface.
*/
describe('probeShotMoment', () => {
  const world = (p: { x: number; y: number; z: number }) => toWorld(p);
  const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
  const from = { x: 0, y: 0, z: 0 };
  const to = { x: 600, y: 0, z: 0 };
  const departAt = 1_000_000;
  const arriveAt = departAt + 20_000;

  it('fires out on the approach, reachRadii target radii from the world', () => {
    const shot = probeShotMoment(from, to, 5, 8, departAt, arriveAt);
    expect(dist(world(shot.point), world(to))).toBeCloseTo(PROBE_DEFENCE.reachRadii * worldRadius(8), 6);
    // On the straight line between the two worlds, between them.
    expect(shot.point.y).toBeCloseTo(0, 9);
    expect(shot.point.z).toBeCloseTo(0, 9);
    expect(shot.point.x).toBeGreaterThan(from.x);
    expect(shot.point.x).toBeLessThan(to.x);
  });

  it('is the moment the craft is drawn there: before the arrival, in proportion along the drawn leg', () => {
    const shot = probeShotMoment(from, to, 5, 8, departAt, arriveAt);
    const leg = visualLeg(from, to, surfaceStandoff(worldRadius(5)), orbitStandoff(worldRadius(8)));
    const share = dist(world(leg.from), world(shot.point)) / dist(world(leg.from), world(leg.to));
    expect(shot.at).toBeLessThan(arriveAt);
    expect(shot.at).toBeCloseTo(departAt + share * (arriveAt - departAt), 3);
  });

  it('holds a hop too short for the reach at the middle of its leg', () => {
    const near = { x: 20, y: 0, z: 0 };
    const shot = probeShotMoment(from, near, 5, 8, departAt, arriveAt);
    expect(shot.at).toBe(departAt + (arriveAt - departAt) / 2);
  });

  /*
    THE BATTERY OPENS FIRE BEFORE THE ROUNDS ARRIVE (owner playtest 2, 2026-11-25: "ateş başlar
    başlamaz sonda yok oluyor"). The decision is made `fireLeadSeconds` before the craft reaches
    the point, so every screen hears of it while the craft still flies and can play the rounds
    climbing to it (handbook GF-02 travel phase, MP-07 latency hidden inside the startup).
  */
  it('opens fire fireLeadSeconds before the hit, where the craft is drawn then', () => {
    const longArrive = departAt + 60_000;
    const shot = probeShotMoment(from, to, 5, 8, departAt, longArrive);
    expect(PROBE_DEFENCE.fireLeadSeconds).toBeGreaterThanOrEqual(2);
    expect(shot.fireAt).toBe(shot.at - PROBE_DEFENCE.fireLeadSeconds * 1000);
    const leg = visualLeg(from, to, surfaceStandoff(worldRadius(5)), orbitStandoff(worldRadius(8)));
    const a = world(leg.from); const b = world(leg.to);
    const share = (shot.fireAt - departAt) / (longArrive - departAt);
    const expected = [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * share);
    expect(dist(world(shot.firePoint), expected)).toBeCloseTo(0, 6);
    // Farther out than the hit, on the same line.
    expect(dist(world(shot.firePoint), world(to))).toBeGreaterThan(dist(world(shot.point), world(to)));
  });

  it('never opens fire before the craft has left', () => {
    const shot = probeShotMoment(from, to, 5, 8, departAt, departAt + 1_000);
    expect(shot.fireAt).toBe(departAt);
    expect(dist(world(shot.firePoint), world(visualLeg(from, to, surfaceStandoff(worldRadius(5)), orbitStandoff(worldRadius(8))).from))).toBeCloseTo(0, 6);
  });
});
