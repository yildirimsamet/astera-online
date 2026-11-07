import { describe, expect, it } from 'vitest';
import {
  PROBE, REPAIR_LADDER, STARTER, STARTER_CRATES, advanceVesselEconomy, collectVessel, openingEconomy, openingProgress, readyCrates,
  type RepairStep, type VesselModule, type VesselProgress,
} from '../src/index.js';

const step = (module: VesselModule, stage: number) => REPAIR_LADDER.find(s => s.module === module && s.stage === stage)!;
const FIRST_FOUR = [step('REFINERY', 2), step('EXTRACTOR', 1), step('SURVEY', 1), step('EXTRACTOR', 2)];

/** The guided first session's road: the four seconds-long repairs, the probe, then the ramp to the Shipyard. */
const ROAD: readonly (RepairStep | 'PROBE')[] = [
  ...FIRST_FOUR.slice(0, 3), 'PROBE', FIRST_FOUR[3]!,
  step('REFINERY', 3), step('VAULT', 1), step('SHIPYARD', 1), step('EXTRACTOR', 3),
];
/** The rest of the first day, as the retention plan's timeline has it (§5.1). */
const DAY_ONE: readonly (RepairStep | 'PROBE')[] = [...ROAD, step('SURVEY', 2), step('HANGAR', 2), step('TELESCOPE', 1)];
/** What a Prospector brings back from a nearby asteroid: the pacing model's trip. */
const HAUL = { alloy: 150, crystal: 50 };
type Session = readonly [start: number, length: number];

/**
 * One player who does exactly what the NPC asks, as soon as it can be paid: orders in the road's order,
 * three repairs at a time, collects the works, opens every crate the moment it is ready.
 * Returns the minute each part of the road was ordered.
 */
function play(road: readonly (RepairStep | 'PROBE')[], sessions: readonly Session[], stalls?: Map<RepairStep | 'PROBE', number>): Map<RepairStep | 'PROBE', number> {
  let progress: VesselProgress = openingProgress();
  let economy = openingEconomy(0);
  let running: { step: RepairStep; endsAt: number }[] = [];
  const claimed: string[] = [];
  const ordered = new Map<RepairStep | 'PROBE', number>();
  let hauled = false;
  let lastSession = -1;
  const end = Math.max(...sessions.map(([start, length]) => start + length));
  for (let now = 0; now <= end; now += 1 / 6) {
    economy = advanceVesselEconomy(economy, progress.modules, now);
    for (const { step: done } of running.filter(r => r.endsAt <= now)) {
      progress = { ...progress, modules: { ...progress.modules, [done.module]: done.stage } };
    }
    running = running.filter(r => r.endsAt > now);
    const session = sessions.findIndex(([start, length]) => now >= start && now < start + length);
    if (session < 0) continue;
    economy = collectVessel(economy, progress.modules).state;
    // Each later session sends the Prospector out twice, as the pacing model does.
    if (session !== lastSession) {
      lastSession = session;
      if (session > 0 && (progress.modules.SHIPYARD ?? 0) >= 1) economy = { ...economy, alloy: economy.alloy + 2 * HAUL.alloy, crystal: economy.crystal + 2 * HAUL.crystal };
    }
    for (const crate of readyCrates(progress, claimed)) {
      claimed.push(crate.id);
      economy = { ...economy, alloy: economy.alloy + crate.reward.alloy, crystal: economy.crystal + crate.reward.crystal };
    }
    // The Shipyard hands over a Prospector; its first trip is a minute out and a minute back.
    const yard = ordered.get(step('SHIPYARD', 1));
    if (!hauled && session === 0 && (progress.modules.SHIPYARD ?? 0) >= 1 && yard !== undefined) {
      hauled = true;
      economy = { ...economy, alloy: economy.alloy + HAUL.alloy, crystal: economy.crystal + HAUL.crystal };
    }
    const next = road.find(part => !ordered.has(part));
    if (!next) break;
    const bill = next === 'PROBE' ? PROBE : next;
    if (next !== 'PROBE' && running.length >= STARTER.queues.construction) continue;
    if (economy.alloy < bill.alloy || economy.crystal < bill.crystal) {
      // Nothing building and short only of the price: the store, not a repair, is what the player waits on.
      if (running.length === 0) stalls?.set(next, (stalls.get(next) ?? 0) + 1 / 6);
      continue;
    }
    economy = { ...economy, alloy: economy.alloy - bill.alloy, crystal: economy.crystal - bill.crystal };
    ordered.set(next, now);
    if (next !== 'PROBE') running.push({ step: next, endsAt: now + next.minutes });
  }
  return ordered;
}

describe('the first session', () => {
  /**
   * OWNER 2026-11-06: "aralarda 2-3 dk üretim süresini birçok kişi beklemeden kapatır gider". The
   * tutorial's four repairs run in seconds, in whole seconds, so the guided first session is played
   * through, not waited through.
   */
  it('runs its four guided repairs in seconds: 10, 10, 30 and 60', () => {
    expect(FIRST_FOUR.map(s => s.minutes * 60)).toEqual([10, 10, 30, 60]);
  });

  /**
   * Retention plan §6.1: a ramp, not a cliff from one minute to forty-five. Owner 2026-11-07 ("30 sn'den
   * 3 dk'ya geçiyoruz?"): the guided session's last four run 90 s, 2, 3 and 5 minutes; the first day's
   * steps after the farewell keep 20, 30, 40 and 60, so the one step past three times is the second session's.
   */
  it('ramps the repairs after them: 90 seconds, 2, 3, 5, then 20, 30, 40 and 60 minutes', () => {
    const ramp = [step('REFINERY', 3), step('VAULT', 1), step('SHIPYARD', 1), step('EXTRACTOR', 3),
      step('SURVEY', 2), step('HANGAR', 2), step('TELESCOPE', 1), step('REFINERY', 4)];
    expect(ramp.map(s => s.minutes)).toEqual([1.5, 2, 3, 5, 20, 30, 40, 60]);
    const road = [FIRST_FOUR[3]!, ...ramp];
    road.slice(1).forEach((s, i) => { expect(s.minutes / road[i]!.minutes).toBeLessThanOrEqual(4); });
  });

  /**
   * Owner 2026-11-07: shorter waits must not turn into waiting on the store instead. A repair still running
   * is a wait the NPC tells (its crate pays the next step); a session with nothing running and nothing
   * payable is the stall this forbids beyond a minute.
   */
  it('never leaves the guided session idle on the store for more than a minute', () => {
    const stalls = new Map<RepairStep | 'PROBE', number>();
    play(ROAD, [[0, 25]], stalls);
    const long = [...stalls].filter(([, minutes]) => minutes > 1)
      .map(([part, minutes]) => `${part === 'PROBE' ? part : `${part.module}:${String(part.stage)}`} ${minutes.toFixed(2)}`);
    expect(long).toEqual([]);
  });

  it('keeps the engine at eight hours, so the ship still takes days', () => {
    expect(step('DRIVE_HULL', 1).minutes).toBe(480);
    expect(step('DRIVE_THRUST', 1).minutes).toBe(480);
  });

  /**
   * Retention plan §5.1 and §6.2: the guided session reaches the fleet and the third extractor in
   * about twenty minutes, and nothing in it waits on the store for more than a minute.
   */
  it('orders everything up to the third extractor in the first twenty minutes', () => {
    const ordered = play(ROAD, [[0, 25]]);
    const times = ROAD.map(part => ordered.get(part));
    expect(times.every(time => time !== undefined)).toBe(true);
    expect(Math.max(...times.map(time => time ?? Infinity))).toBeLessThanOrEqual(20);
  });

  /** Retention plan §5.1: chat at the second session, research at the third, the telescope by evening. */
  it('lets a player who comes back three times reach the telescope on the first day', () => {
    const ordered = play(DAY_ONE, [[0, 25], [60, 15], [180, 15], [480, 20]]);
    const at = (s: RepairStep) => ordered.get(s) ?? Infinity;
    expect(at(step('SURVEY', 2))).toBeLessThan(75);
    expect(at(step('HANGAR', 2))).toBeLessThan(195);
    expect(at(step('TELESCOPE', 1))).toBeLessThan(500);
  });

  it('opens its crates only from the first session and the first day', () => {
    expect(STARTER_CRATES.length).toBeGreaterThan(0);
    const late = STARTER_CRATES.filter(crate => REPAIR_LADDER.findIndex(s => s.module === crate.module && s.stage === crate.stage) > REPAIR_LADDER.indexOf(step('SURVEY', 2)));
    expect(late).toEqual([]);
  });
});
