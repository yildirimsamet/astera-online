import { describe, expect, it } from 'vitest';
import {
  PROBE, REPAIR_LADDER, STARTER, STARTER_CRATES, advanceVesselEconomy, collectVessel, openingEconomy, openingProgress, readyCrates,
  type RepairStep, type VesselModule, type VesselProgress,
} from '../src/index.js';

const step = (module: VesselModule, stage: number) => REPAIR_LADDER.find(s => s.module === module && s.stage === stage)!;
/** The road every ship takes, one repair at a time (owner 2026-11-08, N10). */
const FIRST_SIX = [step('REFINERY', 2), step('EXTRACTOR', 1), step('TELESCOPE', 1), step('RADAR', 1), step('SURVEY', 1), step('SHIPYARD', 1)];

/** The guided first session: the road with its probe, then the works the Shipyard opens. */
const ROAD: readonly (RepairStep | 'PROBE')[] = [
  ...FIRST_SIX.slice(0, 5), 'PROBE', FIRST_SIX[5]!,
  step('EXTRACTOR', 2), step('REFINERY', 3),
];
/** The rest of the first day, as the retention plan's timeline has it (§5.1). */
const DAY_ONE: readonly (RepairStep | 'PROBE')[] = [...ROAD, step('VAULT', 1), step('EXTRACTOR', 3), step('SURVEY', 2), step('HANGAR', 2)];
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
      if (session > 0 && (progress.modules.TELESCOPE ?? 0) >= 1) economy = { ...economy, alloy: economy.alloy + 2 * HAUL.alloy, crystal: economy.crystal + 2 * HAUL.crystal };
    }
    for (const crate of readyCrates(progress, claimed)) {
      claimed.push(crate.id);
      economy = { ...economy, alloy: economy.alloy + crate.reward.alloy, crystal: economy.crystal + crate.reward.crystal };
    }
    // The telescope hands over a Prospector; its first trip is a minute out and a minute back.
    const yard = ordered.get(step('TELESCOPE', 1));
    if (!hauled && session === 0 && (progress.modules.TELESCOPE ?? 0) >= 1 && yard !== undefined) {
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
  it('runs the road in seconds and minutes: 10 s, 10 s, 90 s, 90 s, 30 s, 3 min', () => {
    expect(FIRST_SIX.map(s => s.minutes * 60)).toEqual([10, 10, 90, 90, 30, 180]);
  });

  /** Retention plan §6.1: a ramp, not a cliff. What the Shipyard opens runs up to the first day's hour. */
  it('ramps the repairs after it: 1, 1.5, 2, 5, then 20, 30 and 60 minutes', () => {
    const ramp = [step('EXTRACTOR', 2), step('REFINERY', 3), step('VAULT', 1), step('EXTRACTOR', 3), step('SURVEY', 2), step('HANGAR', 2), step('REFINERY', 4)];
    expect(ramp.map(s => s.minutes)).toEqual([1, 1.5, 2, 5, 20, 30, 60]);
    ramp.slice(1).forEach((s, i) => { expect(s.minutes / ramp[i]!.minutes).toBeLessThanOrEqual(4); });
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

  // Owner 2026-11-08 (N4): four hours a part. The ship still takes days, now through its works and fuel.
  it('keeps the engine at four hours a part, so the ship still takes days', () => {
    expect(step('DRIVE_HULL', 1).minutes).toBe(240);
    expect(step('DRIVE_THRUST', 1).minutes).toBe(240);
  });

  /**
   * The guided session reaches the yard and the third refinery in well under twenty minutes, and
   * nothing in it waits on the store for more than a minute (owner 2026-11-08, N10). The Vault is the
   * first thing past it that makes a player wait, about a quarter of an hour, with flights to fly meanwhile.
   */
  it('orders everything up to the third refinery in the first twenty minutes', () => {
    const ordered = play(ROAD, [[0, 25]]);
    const times = ROAD.map(part => ordered.get(part));
    expect(times.every(time => time !== undefined)).toBe(true);
    expect(Math.max(...times.map(time => time ?? Infinity))).toBeLessThanOrEqual(20);
  });

  /**
   * The sensors are bought in the first minutes now, so the chat moves from the second session to the
   * third and the hangar to the fourth (measured 2026-11-08): the price of showing the game first.
   */
  it('lets a player who comes back reach the chat and the hangar on the first day', () => {
    const ordered = play(DAY_ONE, [[0, 25], [60, 15], [180, 15], [480, 20]]);
    const at = (s: RepairStep) => ordered.get(s) ?? Infinity;
    expect(at(step('SURVEY', 2))).toBeLessThan(195);
    expect(at(step('HANGAR', 2))).toBeLessThan(500);
  });

  it('opens its crates only from the first session and the first day', () => {
    expect(STARTER_CRATES.length).toBeGreaterThan(0);
    const late = STARTER_CRATES.filter(crate => REPAIR_LADDER.findIndex(s => s.module === crate.module && s.stage === crate.stage) > REPAIR_LADDER.indexOf(step('SURVEY', 2)));
    expect(late).toEqual([]);
  });
});
