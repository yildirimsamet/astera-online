import { describe, expect, it } from 'vitest';
import {
  STARTER,
  advanceVesselEconomy,
  afterQueue,
  collectVessel,
  jumpWindowOpen,
  nextSteps,
  openingEconomy,
  openingProgress,
  readyCrates,
  type RepairStep,
  type VesselFact,
  type VesselProgress,
} from '../src/index.js';

/**
 * A SHORT MODEL, NOT A SEASON SIMULATION. It plays the real ladder with the real works for one ship
 * and no neighbours: no combat and no loot beyond the salvage crates. What it answers is whether the
 * numbers hold the promise of plan 2026-11-13 §4.3–4.4, and the promise is only ever re-tuned by play.
 */
const QUEUE = STARTER.queues.construction;
const TICK_MINUTES = 0.25;
const SESSION_MINUTES = 20;
const DAY = 24 * 60;
/** Round trips of the first session's flights, as the guide plays them. */
const MINING_TRIP_MINUTES = 4;
const PROBE_TRIP_MINUTES = 2;
/** What a session's two mining runs bring home once the window is open. */
const TRIPS = { alloy: 300, crystal: 100 };
/** The works a player who stays may grow; the rest of the ship does not fill a hold. */
const WORKS = new Set(['REFINERY', 'EXTRACTOR', 'VAULT']);

interface Pace { windowMinutes: number; fullHours: number }

/** The first session starts at signup; `sessionHours` are the later ones, by hour of the day. */
function pace(sessionHours: readonly number[], growsWorks: boolean): Pace {
  let progress: VesselProgress = openingProgress();
  let economy = openingEconomy(0);
  let queue: { step: RepairStep; endsAt: number }[] = [];
  let tail = 0, lastSession = -1, windowMinutes = Infinity, sentAt = Infinity, surveyAt = Infinity;
  const opened: string[] = [];
  const happen = (fact: VesselFact) => {
    if (!progress.facts.includes(fact)) progress = { ...progress, facts: [...progress.facts, fact] };
  };

  for (let now = 0; now < 3 * DAY; now += TICK_MINUTES) {
    economy = advanceVesselEconomy(economy, progress.modules, now);
    for (const { step } of queue.filter(q => q.endsAt <= now)) progress = { ...progress, modules: { ...progress.modules, [step.module]: step.stage } };
    queue = queue.filter(q => q.endsAt > now);

    const minuteOfDay = now % DAY;
    const session = now < SESSION_MINUTES ? -2 : sessionHours.findIndex(h => minuteOfDay >= h * 60 && minuteOfDay < h * 60 + SESSION_MINUTES);
    if (session === -1) continue;

    economy = collectVessel(economy, progress.modules).state;
    for (const crate of readyCrates(progress, opened)) {
      opened.push(crate.id);
      economy = { ...economy, alloy: economy.alloy + crate.reward.alloy, crystal: economy.crystal + crate.reward.crystal };
    }
    if ((progress.modules.TELESCOPE ?? 0) >= 1 && sentAt === Infinity) { sentAt = now; happen('FIRST_MINING_SENT'); }
    if (now >= sentAt + MINING_TRIP_MINUTES) happen('FIRST_MINING_RETURN');
    if ((progress.modules.SURVEY ?? 0) >= 1 && surveyAt === Infinity) surveyAt = now;
    if (now >= surveyAt + PROBE_TRIP_MINUTES) happen('FIRST_PROBE_REPORT');
    const key = Math.floor(now / DAY) * 100 + session;
    if (windowMinutes < now && key !== lastSession) {
      lastSession = key;
      economy = { ...economy, alloy: economy.alloy + TRIPS.alloy, crystal: economy.crystal + TRIPS.crystal };
    }

    while (queue.length < QUEUE) {
      const step = nextSteps(afterQueue(progress, queue.map(q => q.step))).find(s => s.required || (growsWorks && WORKS.has(s.module)));
      if (!step || economy.alloy < step.alloy || economy.crystal < step.crystal) break;
      economy = { ...economy, alloy: economy.alloy - step.alloy, crystal: economy.crystal - step.crystal };
      tail = Math.max(tail, now) + step.minutes;
      queue.push({ step, endsAt: tail });
    }

    if (windowMinutes === Infinity && jumpWindowOpen(progress)) windowMinutes = now;
    // The hold counts what a queued repair would hand back (§5.2), so a running order does not hide it.
    const back = queue.reduce((sum, q) => ({ alloy: sum.alloy + q.step.alloy, crystal: sum.crystal + q.step.crystal }), { alloy: 0, crystal: 0 });
    if (windowMinutes < Infinity && economy.alloy + back.alloy >= STARTER.carry.alloy && economy.crystal + back.crystal >= STARTER.carry.crystal) {
      return { windowMinutes, fullHours: now / 60 };
    }
  }
  return { windowMinutes, fullHours: Infinity };
}

/**
 * THE PROMISE OF PLAN 2026-11-13. Measured on this model: the window opens 4.5 minutes in, which is
 * the timers and the two flights and nothing else; the hold is full at the second session of the
 * first day (9 h), whether the player saves or grows the works, and at the 20 h session for a
 * player who comes once a day. Staying is worth about a second first-season package (§4.4).
 */
describe('how long the ship takes', () => {
  it('opens the window inside the first session, waiting on no resource', () => {
    // The six timers (130 s) and the two flights: anything above that would be a wait for resources.
    expect(pace([9, 20], false).windowMinutes).toBeLessThanOrEqual(130 / 60 + MINING_TRIP_MINUTES + PROBE_TRIP_MINUTES);
  });

  it('fills the hold by the second session of the first day for a player who saves', () => {
    expect(pace([9, 20], false).fullHours).toBeLessThan(9.5);
  });

  it('fills it as soon for a player who grows the works', () => {
    expect(pace([9, 20], true).fullHours).toBeLessThan(9.5);
  });

  it('fills it inside the first day for a player who comes once a day', () => {
    expect(pace([20], false).fullHours).toBeLessThan(24);
  });

  it('never fills it inside the first session: leaving early is the lighter landing', () => {
    expect(pace([9, 20], false).fullHours).toBeGreaterThan(SESSION_MINUTES / 60);
  });
});
