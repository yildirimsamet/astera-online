import { describe, expect, it } from 'vitest';
import {
  REPAIR_LADDER,
  STARTER,
  advanceVesselEconomy,
  afterQueue,
  canLoadFuel,
  collectVessel,
  isFeatureOpen,
  nextSteps,
  openingEconomy,
  openingProgress,
  readyCrates,
  type RepairStep,
  type VesselProgress,
} from '../src/index.js';

/**
 * A SHORT MODEL, NOT A SEASON SIMULATION. It plays the real ladder with the real works for one
 * ship and no neighbours: no combat, no loot, one purchase of fleet. What it answers is whether
 * the numbers can hold the 3–5 day promise, and the promise is only ever re-tuned by play.
 */
const QUEUE = STARTER.queues.construction;
const SESSION_MINUTES = 20;
const TICK_MINUTES = 5;
const DAY = 24 * 60;
const FLEET = { alloy: 1800, crystal: 700, minutes: 12 };
const TRIP = { alloy: 150, crystal: 50 };
const TRIPS_PER_SESSION = 2;
const PART_HAUL = { alloy: 200, crystal: 100 };

function daysToJump(sessionHours: readonly number[]): number {
  let progress: VesselProgress = openingProgress();
  let economy = openingEconomy(0);
  let queue: { step: RepairStep; endsAt: number }[] = [];
  let tail = 0, fleetBought = false, lastSession = -1;
  const opened: string[] = [];

  for (let now = 0; now < 30 * DAY; now += TICK_MINUTES) {
    economy = advanceVesselEconomy(economy, progress.modules, now);
    for (const { step } of queue.filter(q => q.endsAt <= now)) {
      progress = { ...progress, modules: { ...progress.modules, [step.module]: step.stage } };
      if (step.grants?.deuterium) economy = { ...economy, deuterium: economy.deuterium + step.grants.deuterium };
    }
    queue = queue.filter(q => q.endsAt > now);

    const minuteOfDay = now % DAY;
    const session = sessionHours.findIndex(h => minuteOfDay >= h * 60 && minuteOfDay < h * 60 + SESSION_MINUTES);
    if (session < 0) continue;

    economy = collectVessel(economy, progress.modules).state;
    // The salvage crates (retention plan §6.2) are opened the moment they are ready.
    for (const crate of readyCrates(progress, opened)) {
      opened.push(crate.id);
      economy = { ...economy, alloy: economy.alloy + crate.reward.alloy, crystal: economy.crystal + crate.reward.crystal };
    }
    const key = Math.floor(now / DAY) * 100 + session;
    if (key !== lastSession) {
      lastSession = key;
      if (isFeatureOpen(progress, 'intel') && !progress.facts.includes('FIRST_PROBE_REPORT')) progress = { ...progress, facts: [...progress.facts, 'FIRST_PROBE_REPORT'] };
      if (isFeatureOpen(progress, 'fleet')) {
        economy = { ...economy, alloy: economy.alloy + TRIPS_PER_SESSION * TRIP.alloy, crystal: economy.crystal + TRIPS_PER_SESSION * TRIP.crystal };
        if (!progress.facts.includes('FIRST_MINING_RETURN')) progress = { ...progress, facts: [...progress.facts, 'FIRST_MINING_RETURN'] };
      }
      if (isFeatureOpen(progress, 'defence') && !progress.facts.includes('FIRST_BATTLE_REPORT')) progress = { ...progress, facts: [...progress.facts, 'FIRST_BATTLE_REPORT'] };
      if (isFeatureOpen(progress, 'drive') && progress.parts < STARTER.parts.needed) {
        progress = { ...progress, parts: progress.parts + 1 };
        economy = { ...economy, alloy: economy.alloy + PART_HAUL.alloy, crystal: economy.crystal + PART_HAUL.crystal };
      }
    }

    if (!fleetBought && isFeatureOpen(progress, 'fleet') && economy.alloy >= FLEET.alloy && economy.crystal >= FLEET.crystal) {
      economy = { ...economy, alloy: economy.alloy - FLEET.alloy, crystal: economy.crystal - FLEET.crystal };
      fleetBought = true;
    }

    while (queue.length < QUEUE) {
      const planned = afterQueue(progress, queue.map(q => q.step));
      const step = nextSteps(planned).find(s => s.required);
      if (!step || economy.alloy < step.alloy || economy.crystal < step.crystal) break;
      economy = { ...economy, alloy: economy.alloy - step.alloy, crystal: economy.crystal - step.crystal };
      tail = Math.max(tail, now) + step.minutes;
      queue.push({ step, endsAt: tail });
    }

    if (queue.length === 0 && canLoadFuel(progress) && economy.deuterium >= STARTER.fuelForJump) return now / DAY;
  }
  return Infinity;
}

/**
 * THE PROMISE AFTER THE OWNER'S 2026-11-08 TEMPO (N3, N4): no battle on the way, four hours a part
 * for the engine, the radar in the gate. Measured on this model: 6.8 days at one session a day, 3.4
 * at two, 2.5 at three or four, 1.7 at fifteen. Two to three days is the normal pace, and no schedule
 * of sessions reaches the main galaxy inside its first day: the works, not the engine or the fuel,
 * are what a ship waits on (a deuterium plant ordered early slows it, since the store pays for it).
 */
describe('how long the ship takes', () => {
  it('has a required ladder a player can finish', () => {
    expect(REPAIR_LADDER.some(s => s.required)).toBe(true);
    expect(Number.isFinite(daysToJump([9, 20]))).toBe(true);
  });

  it('takes under four days at two sessions a day', () => {
    expect(daysToJump([9, 20])).toBeLessThan(4);
  });

  it('takes two to three days at three sessions a day', () => {
    const days = daysToJump([9, 13, 20]);
    expect(days).toBeGreaterThanOrEqual(2);
    expect(days).toBeLessThanOrEqual(3);
  });

  it('takes at least two days at four sessions a day', () => {
    expect(daysToJump([9, 13, 18, 22])).toBeGreaterThanOrEqual(2);
  });

  it('never lands the most active player inside the first day', () => {
    const days = daysToJump([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
    expect(days).toBeGreaterThan(1);
    expect(days).toBeLessThan(2);
  });

  it('still lands a player who comes once a day', () => {
    const days = daysToJump([20]);
    expect(days).toBeGreaterThan(5);
    expect(days).toBeLessThan(12);
  });
});
