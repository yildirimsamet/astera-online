import { randomUUID } from 'node:crypto';
import { and, eq, isNotNull } from 'drizzle-orm';
import { pino } from 'pino';
import { z } from 'zod';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { PROBE, PROBE_DEFENCE, detectChance, probeCatchChance, probeCatchRoll, probeShotMoment } from '@astera/rules';
import {
  missions,
  notifications,
  paidAlerts,
  planets,
  probeBatteries,
  probeReports,
  probeShots,
  satellites,
  scanEvents,
  scheduledEvents,
  seasons,
} from '../src/db/schema.js';
import { launchProbe, readRadarLog } from '../src/services/intel.js';
import { installProbeBattery } from '../src/services/probeDefence.js';
import { loadTrafficSnapshot, projectProbeShots, type SensorPost } from '../src/services/traffic.js';
import { planetView } from '../src/services/planetView.js';
import { EventWorker } from '../src/worker/loop.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { grant, levelWorld, seedWorld, setLevel, testDb, testEnv, type Fixture } from './helpers.js';

/**
 * THE PROBE DEFENCE BATTERY. `docs/sonda-bataryasi-plani-2026-11-24.md` §8.
 *
 * "A battery with a ready charge catches probes more easily and shoots down what it
 * catches; once its charges are gone the world is as if it had no battery."
 *
 * The detection roll is a fixed number per mission (`probeCatchRoll`), so every test
 * here pins the mission to an id whose roll lands where the case needs it.
 */

const silent = pino({ level: 'silent' });
const worker = (f: Fixture) => new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

async function instrument(f: Fixture, planetId: string, type: 'RADAR' | 'VEIL' | 'TELESCOPE', level: number): Promise<void> {
  await f.db.insert(satellites).values({ planetId, slot: { RADAR: 1, VEIL: 2, TELESCOPE: 3 }[type], type, level })
    .onConflictDoUpdate({ target: [satellites.planetId, satellites.slot], set: { type, level } });
}

/** Re-key a just-launched probe to an id whose detection roll satisfies `wanted`. */
async function pinRoll(f: Fixture, missionId: string, wanted: (roll: number) => boolean): Promise<string> {
  let id = randomUUID();
  while (!wanted(probeCatchRoll(id))) id = randomUUID();
  await f.db.update(missions).set({ id }).where(eq(missions.id, missionId));
  await f.db.update(scheduledEvents).set({ refId: id }).where(eq(scheduledEvents.refId, missionId));
  return id;
}

describe('the probe defence battery', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let attacker: string;
  let defender: string;

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, theirs] = f.planetIds as [string, string];
    [attacker, defender] = f.playerIds as [string, string];
    for (const id of f.planetIds) await setLevel(f.db, id, 'CORE', 8);
    await f.db.insert(satellites).values(f.planetIds.map((planetId) => ({ planetId, slot: 15, type: 'UPLINK', level: 1 })));
    await levelWorld(f.db, f.planetIds);
    for (const id of f.planetIds) {
      await grant(f.db, id, 60_000, 20_000);
      await f.db.update(planets).set({ deuterium: 5_000 }).where(eq(planets.id, id));
    }
  });

  const L1 = PROBE_DEFENCE.levels[0];

  /** A finished battery on `theirs` at `level`, with `charges` standing at the current instant. */
  async function armed(charges: number = L1.capacity, level = 1): Promise<void> {
    await instrument(f, theirs, 'RADAR', Math.max(PROBE_DEFENCE.requiredRadar, 3));
    await installProbeBattery(f.db, theirs, f.clock);
    f.clock.advance(L1.buildMinutes);
    await f.db.update(probeBatteries).set({ charges, level, chargedAt: f.clock.now() }).where(eq(probeBatteries.planetId, theirs));
  }

  /** When and where the battery fires at this probe: the moment its own event carries. */
  async function shotMomentOf(missionId: string): Promise<Date> {
    const [event] = await f.db.select().from(scheduledEvents)
      .where(and(eq(scheduledEvents.refId, missionId), eq(scheduledEvents.kind, 'probe_defence')));
    if (!event) throw new Error('no probe_defence event');
    return event.resolveAt;
  }

  async function probe(wanted: (roll: number) => boolean, from = mine): Promise<{ id: string; arriveAt: Date }> {
    const launch = await launchProbe(f.db, from, theirs, f.clock);
    return { id: await pinRoll(f, launch.missionId, wanted), arriveAt: launch.arriveAt };
  }

  async function land(arriveAt: Date): Promise<void> {
    f.clock.set(arriveAt);
    await worker(f).tick();
  }

  const stock = async () => (await f.db.select().from(probeBatteries).where(eq(probeBatteries.planetId, theirs)))[0];

  /* ── installing one ─────────────────────────────────────── */

  describe('installing', () => {
    it('refuses a world whose effective Radar cannot reach the rung', async () => {
      await instrument(f, theirs, 'RADAR', PROBE_DEFENCE.requiredRadar - 1);
      await expect(installProbeBattery(f.db, theirs, f.clock)).rejects.toMatchObject({
        code: 'PROBE_BATTERY_LOCKED', params: { requiredRadar: PROBE_DEFENCE.requiredRadar },
      });
    });

    it('reads the effective rung: a Radar 5 with no Uplink is no Radar', async () => {
      await instrument(f, theirs, 'RADAR', 5);
      await f.db.delete(satellites).where(and(eq(satellites.planetId, theirs), eq(satellites.type, 'UPLINK')));
      await expect(installProbeBattery(f.db, theirs, f.clock)).rejects.toMatchObject({ code: 'PROBE_BATTERY_LOCKED' });
    });

    it('refuses when the purse is short', async () => {
      await instrument(f, theirs, 'RADAR', 3);
      await f.db.update(planets).set({ deuterium: PROBE_DEFENCE.levels[0].cost.deuterium - 1 }).where(eq(planets.id, theirs));
      await expect(installProbeBattery(f.db, theirs, f.clock)).rejects.toMatchObject({ code: 'INSUFFICIENT_RESOURCES' });
    });

    it('refuses an order the season cannot finish', async () => {
      await instrument(f, theirs, 'RADAR', 3);
      await f.db.update(seasons).set({ endsAt: new Date(f.clock.now().getTime() + 10 * 60_000) }).where(eq(seasons.id, f.seasonId));
      await expect(installProbeBattery(f.db, theirs, f.clock)).rejects.toMatchObject({ code: 'SEASON_ENDS_BEFORE_BUILD' });
    });

    it('charges level 1\'s price, finishes in its minutes and starts full', async () => {
      await instrument(f, theirs, 'RADAR', 3);
      const [before] = await f.db.select().from(planets).where(eq(planets.id, theirs));
      const result = await installProbeBattery(f.db, theirs, f.clock);
      const [after] = await f.db.select().from(planets).where(eq(planets.id, theirs));
      expect(before!.alloy - after!.alloy).toBeCloseTo(L1.cost.alloy, 0);
      expect(before!.crystal - after!.crystal).toBeCloseTo(L1.cost.crystal, 0);
      expect(before!.deuterium - after!.deuterium).toBeCloseTo(L1.cost.deuterium, 0);

      const row = await stock();
      expect(row!.level).toBe(1);
      expect(row!.readyAt.getTime() - f.clock.now().getTime()).toBe(L1.buildMinutes * 60_000);
      expect(row!.charges).toBe(L1.capacity);
      expect(row!.chargedAt.getTime()).toBe(row!.readyAt.getTime());
      expect(result.planet.probeBattery).toMatchObject({ level: 1, charges: L1.capacity });
    });

    it('refuses another order while the first build runs', async () => {
      await instrument(f, theirs, 'RADAR', 4);
      await installProbeBattery(f.db, theirs, f.clock);
      await expect(installProbeBattery(f.db, theirs, f.clock)).rejects.toMatchObject({ code: 'PROBE_BATTERY_BUSY' });
    });
  });

  /* ── levels (owner, 2026-11-24) ─────────────────────────── */

  describe('raising the level', () => {
    const L2 = PROBE_DEFENCE.levels[1];

    it('the same order raises a finished battery one level, for that level\'s price and minutes', async () => {
      await armed();
      await instrument(f, theirs, 'RADAR', L2.requiredRadar);
      const [before] = await f.db.select().from(planets).where(eq(planets.id, theirs));
      const result = await installProbeBattery(f.db, theirs, f.clock);
      const [after] = await f.db.select().from(planets).where(eq(planets.id, theirs));
      expect(before!.alloy - after!.alloy).toBeCloseTo(L2.cost.alloy, 0);
      expect(before!.deuterium - after!.deuterium).toBeCloseTo(L2.cost.deuterium, 0);
      const row = await stock();
      expect(row).toMatchObject({ level: 1, upgradeLevel: 2 });
      expect(row!.upgradeReadyAt!.getTime() - f.clock.now().getTime()).toBe(L2.buildMinutes * 60_000);
      expect(result.readyAt.getTime()).toBe(row!.upgradeReadyAt!.getTime());
    });

    it('needs the next level\'s Radar rung', async () => {
      await armed();
      await expect(installProbeBattery(f.db, theirs, f.clock)).rejects.toMatchObject({
        code: 'PROBE_BATTERY_LOCKED', params: { requiredRadar: L2.requiredRadar },
      });
    });

    it('refuses a second upgrade while one runs, and anything past the top level', async () => {
      await armed();
      await instrument(f, theirs, 'RADAR', 8);
      await installProbeBattery(f.db, theirs, f.clock);
      await expect(installProbeBattery(f.db, theirs, f.clock)).rejects.toMatchObject({ code: 'PROBE_BATTERY_BUSY' });
      await f.db.update(probeBatteries).set({ level: PROBE_DEFENCE.levels.length, upgradeLevel: null, upgradeReadyAt: null, upgradeStartedAt: null })
        .where(eq(probeBatteries.planetId, theirs));
      await expect(installProbeBattery(f.db, theirs, f.clock)).rejects.toMatchObject({ code: 'PROBE_BATTERY_MAX' });
    });

    it('keeps firing at the old level while it runs, and lands with the new charges ready', async () => {
      await armed(L1.capacity);
      await instrument(f, theirs, 'RADAR', L2.requiredRadar);
      await installProbeBattery(f.db, theirs, f.clock);
      const view = async () => (await f.db.transaction((tx) => planetView(tx, theirs, f.clock))).probeBattery;
      expect(await view()).toMatchObject({ level: 1, upgradeLevel: 2, charges: L1.capacity });
      f.clock.advance(L2.buildMinutes);
      expect(await view()).toMatchObject({ level: 2, upgradeLevel: null, charges: L2.capacity });
    });

    it('a higher level catches a roll level 1 misses', async () => {
      await armed(L1.capacity, 4);
      await instrument(f, theirs, 'RADAR', 3);
      await setLevel(f.db, mine, 'SHIPYARD', 3);
      const sent = await probe((roll) => roll >= probeCatchChance(3, 3, 1) && roll < probeCatchChance(3, 3, 4));
      await land(sent.arriveAt);
      expect(await f.db.select().from(probeShots)).toHaveLength(1);
    });
  });

  /* ── where and when it fires (owner playtest, 2026-11-24) ── */

  describe('the shot, out on the approach', () => {
    it('opens fire before the hit, so every screen sees the rounds reach the craft (2026-11-25)', async () => {
      await armed();
      await instrument(f, theirs, 'RADAR', 8);
      await setLevel(f.db, mine, 'SHIPYARD', 0);
      const sent = await probe((roll) => roll < probeCatchChance(8, 0, 1));
      const [mission] = await f.db.select().from(missions).where(eq(missions.id, sent.id));
      const [origin] = await f.db.select().from(planets).where(eq(planets.id, mine));
      const [target] = await f.db.select().from(planets).where(eq(planets.id, theirs));
      const expected = probeShotMoment(origin!, target!, 8, 8, mission!.departAt.getTime(), mission!.arriveAt.getTime());
      const at = await shotMomentOf(sent.id);
      expect(at.getTime()).toBeLessThan(sent.arriveAt.getTime());
      // The decision is the battery opening fire, a lead before the hit.
      expect(at.getTime()).toBeCloseTo(expected.fireAt, -1);
      expect(expected.fireAt).toBe(Math.max(mission!.departAt.getTime(), expected.at - PROBE_DEFENCE.fireLeadSeconds * 1000));

      await land(at);
      const [shot] = await f.db.select().from(probeShots);
      // The shot keeps both instants: when it opened fire and when the last round hit.
      expect(shot!.firedAt.getTime()).toBe(at.getTime());
      expect(shot!.shotAt.getTime()).toBeCloseTo(expected.at, -1);
      expect(shot!.x).toBeCloseTo(expected.point.x, 1);
      expect(shot!.y).toBeCloseTo(expected.point.y, 1);
      expect(shot!.z).toBeCloseTo(expected.point.z, 1);
      expect(shot!.fromX).toBeCloseTo(expected.firePoint.x, 1);
      expect(shot!.fromY).toBeCloseTo(expected.firePoint.y, 1);
      expect(shot!.fromZ).toBeCloseTo(expected.firePoint.z, 1);
      // Shot there, the craft never reaches the world.
      const [after] = await f.db.select().from(missions).where(eq(missions.id, sent.id));
      expect(after!.status).toBe('resolved');
      await land(sent.arriveAt);
      expect(await f.db.select().from(probeReports)).toHaveLength(0);
    });

    it('a world with no battery at the launch is given no shot to take', async () => {
      await instrument(f, theirs, 'RADAR', 8);
      const sent = await probe(() => true);
      await expect(shotMomentOf(sent.id)).rejects.toThrow('no probe_defence event');
    });
  });

  /* ── the arrival ────────────────────────────────────────── */

  describe('a probe reaching a world with a ready charge', () => {
    it('is shot down when caught: no report, no way home, one charge spent', async () => {
      await armed();
      await instrument(f, theirs, 'RADAR', 8);
      await setLevel(f.db, mine, 'SHIPYARD', 0);
      const sent = await probe((roll) => roll < probeCatchChance(8, 0, 1));
      await land(sent.arriveAt);

      expect(await f.db.select().from(probeReports)).toHaveLength(0);
      expect(await f.db.select().from(missions).where(eq(missions.parentMissionId, sent.id))).toHaveLength(0);
      const [mission] = await f.db.select().from(missions).where(eq(missions.id, sent.id));
      // Still a probe that left: daily quests and the reward chain keep counting it.
      expect(mission!.status).toBe('resolved');
      expect((await stock())!.charges).toBe(L1.capacity - 1);

      const [shot] = await f.db.select().from(probeShots);
      expect(shot).toMatchObject({ missionId: sent.id, attackerPlayerId: attacker, defenderPlayerId: defender, targetPlanetId: theirs });
      const [scan] = await f.db.select().from(scanEvents);
      expect(scan).toMatchObject({ detected: true, shotDown: true });
    });

    it('tells both sides once, and the defender under the shot, not as a plain scan', async () => {
      await armed();
      await instrument(f, theirs, 'RADAR', 8);
      await setLevel(f.db, mine, 'SHIPYARD', 0);
      const sent = await probe((roll) => roll < probeCatchChance(8, 0, 1));
      await land(sent.arriveAt);

      const lost = await f.db.select().from(notifications).where(and(eq(notifications.playerId, attacker), eq(notifications.kind, 'probe_report')));
      expect(lost).toHaveLength(1);
      expect(lost[0]!.payload).toMatchObject({ shotDown: true, targetPlanetId: theirs });

      const heard = await f.db.select().from(notifications).where(and(eq(notifications.playerId, defender), eq(notifications.kind, 'scan_detected')));
      expect(heard).toHaveLength(1);
      expect(heard[0]!.payload).toMatchObject({ shotDown: true, count: 1, planetId: theirs });
    });

    it('slips through silently when not caught, and the charge stays', async () => {
      await armed();
      await instrument(f, theirs, 'RADAR', 3);
      await setLevel(f.db, mine, 'SHIPYARD', 8);
      const sent = await probe((roll) => roll >= probeCatchChance(3, 8, 1));
      await land(sent.arriveAt);

      const [report] = await f.db.select().from(probeReports);
      expect(report!.detected).toBe(false);
      expect((await stock())!.charges).toBe(L1.capacity);
      expect(await f.db.select().from(probeShots)).toHaveLength(0);
    });

    it('raises the base: a roll today\'s Radar would miss is caught', async () => {
      await armed();
      await instrument(f, theirs, 'RADAR', 3);
      await setLevel(f.db, mine, 'SHIPYARD', 3);
      const sent = await probe((roll) => roll >= detectChance(3, 3) && roll < probeCatchChance(3, 3, 1));
      await land(sent.arriveAt);
      expect(await f.db.select().from(probeShots)).toHaveLength(1);
    });

    it('reads what the battery holds on the report that does get home', async () => {
      await armed(2);
      await instrument(f, theirs, 'RADAR', 3);
      await setLevel(f.db, mine, 'SHIPYARD', 8);
      const sent = await probe((roll) => roll >= probeCatchChance(3, 8, 1));
      await land(sent.arriveAt);
      const [report] = await f.db.select().from(probeReports);
      expect(report!.silhouette?.probeBattery).toEqual({ ready: 2, capacity: L1.capacity });
    });
  });

  describe('a world with no armed battery is the world it was', () => {
    it('an empty battery rolls today\'s detection and shoots nothing', async () => {
      await armed(0);
      await instrument(f, theirs, 'RADAR', 3);
      await setLevel(f.db, mine, 'SHIPYARD', 3);
      // Caught by an armed battery, missed by today's roll.
      const sent = await probe((roll) => roll >= detectChance(3, 3) && roll < probeCatchChance(3, 3, 1));
      await land(sent.arriveAt);
      const [report] = await f.db.select().from(probeReports);
      expect(report!.detected).toBe(false);
      expect(await f.db.select().from(probeShots)).toHaveLength(0);
    });

    it('counts the charges at the shot, not when a late worker gets there', async () => {
      await armed(0);
      await instrument(f, theirs, 'RADAR', 3);
      await setLevel(f.db, mine, 'SHIPYARD', 3);
      const sent = await probe((roll) => roll >= detectChance(3, 3) && roll < probeCatchChance(3, 3, 1));
      // The first charge lands one minute after the battery's moment.
      const refillAt = new Date((await shotMomentOf(sent.id)).getTime() + 60_000 - L1.refillMinutes * 60_000);
      await f.db.update(probeBatteries).set({ chargedAt: refillAt }).where(eq(probeBatteries.planetId, theirs));
      f.clock.set(new Date(sent.arriveAt.getTime() + 5 * 60_000));
      await worker(f).tick();
      expect(await f.db.select().from(probeShots)).toHaveLength(0);
    });

    it.each([
      ['an EMP', { empUntil: 'later' }],
      ['recovery', { recoveryUntil: 'later' }],
    ] as const)('is offline under %s', async (_label, cut) => {
      await armed();
      await instrument(f, theirs, 'RADAR', 3);
      await setLevel(f.db, mine, 'SHIPYARD', 3);
      const later = new Date(f.clock.now().getTime() + 24 * 60 * 60_000);
      await f.db.update(planets).set('empUntil' in cut ? { empUntil: later } : { recoveryUntil: later }).where(eq(planets.id, theirs));
      const sent = await probe((roll) => roll >= detectChance(3, 3) && roll < probeCatchChance(3, 3, 1));
      await land(sent.arriveAt);
      expect(await f.db.select().from(probeShots)).toHaveLength(0);
      expect((await stock())!.charges).toBe(L1.capacity);
    });

    it('is offline once its Radar falls below the rung', async () => {
      await armed();
      await instrument(f, theirs, 'RADAR', 3);
      await setLevel(f.db, mine, 'SHIPYARD', 0);
      await f.db.delete(satellites).where(and(eq(satellites.planetId, theirs), eq(satellites.type, 'UPLINK')));
      const sent = await probe((roll) => roll >= detectChance(0, 0) && roll < probeCatchChance(0, 0, 1));
      await land(sent.arriveAt);
      expect(await f.db.select().from(probeShots)).toHaveLength(0);
    });

    it('a battery still being built shoots nothing', async () => {
      await instrument(f, theirs, 'RADAR', 3);
      await installProbeBattery(f.db, theirs, f.clock);
      await setLevel(f.db, mine, 'SHIPYARD', 3);
      const sent = await probe((roll) => roll >= detectChance(3, 3) && roll < probeCatchChance(3, 3, 1));
      expect(sent.arriveAt.getTime()).toBeLessThan((await stock())!.readyAt.getTime());
      await land(sent.arriveAt);
      expect(await f.db.select().from(probeShots)).toHaveLength(0);
      const [report] = await f.db.select().from(probeReports);
      expect(report!.silhouette?.probeBattery).toBeNull();
    });
  });

  describe('several probes', () => {
    it('one charge shoots down exactly one of two probes landing together', async () => {
      await armed(1);
      await instrument(f, theirs, 'RADAR', 8);
      const third = f.planetIds[2]!;
      await setLevel(f.db, mine, 'SHIPYARD', 0);
      await setLevel(f.db, third, 'SHIPYARD', 0);
      const a = await probe((roll) => roll < detectChance(8, 0), mine);
      const b = await probe((roll) => roll < detectChance(8, 0), third);
      const at = new Date(Math.max(a.arriveAt.getTime(), b.arriveAt.getTime()));
      for (const id of [a.id, b.id]) {
        await f.db.update(missions).set({ arriveAt: at }).where(eq(missions.id, id));
        await f.db.update(scheduledEvents).set({ resolveAt: at }).where(eq(scheduledEvents.refId, id));
      }
      await land(at);
      expect(await f.db.select().from(probeShots)).toHaveLength(1);
      expect(await f.db.select().from(probeReports)).toHaveLength(1);
      expect((await stock())!.charges).toBe(0);
    });

    it('gathers the shots of one window into one notification, and one push', async () => {
      await armed();
      await instrument(f, theirs, 'RADAR', 8);
      await setLevel(f.db, mine, 'SHIPYARD', 0);
      for (let i = 0; i < 3; i++) {
        const sent = await probe((roll) => roll < probeCatchChance(8, 0, 1));
        await land(sent.arriveAt);
        f.clock.advance(PROBE.retargetCooldownMinutes + 1);
      }
      expect(await f.db.select().from(probeShots)).toHaveLength(3);
      const heard = await f.db.select().from(notifications).where(and(eq(notifications.playerId, defender), eq(notifications.kind, 'scan_detected')));
      expect(heard).toHaveLength(1);
      expect(heard[0]!.payload).toMatchObject({ shotDown: true, count: 3 });
      expect(heard[0]!.seen).toBe(false);
      expect((await f.db.select().from(paidAlerts).where(eq(paidAlerts.playerId, defender))).length).toBeLessThanOrEqual(1);

      // A new window opens a new line.
      f.clock.advance(PROBE_DEFENCE.noticeWindowMinutes + 1);
      await f.db.update(probeBatteries).set({ charges: L1.capacity, chargedAt: f.clock.now() }).where(eq(probeBatteries.planetId, theirs));
      const late = await probe((roll) => roll < probeCatchChance(8, 0, 1));
      await land(late.arriveAt);
      expect(await f.db.select().from(notifications).where(and(eq(notifications.playerId, defender), eq(notifications.kind, 'scan_detected')))).toHaveLength(2);
    });
  });

  it('the holder\'s world counts the probes it shot down in the notice window', async () => {
    await armed();
    await instrument(f, theirs, 'RADAR', 8);
    await setLevel(f.db, mine, 'SHIPYARD', 0);
    const sent = await probe((roll) => roll < probeCatchChance(8, 0, 1));
    await land(sent.arriveAt);
    const view = async () => (await f.db.transaction((tx) => planetView(tx, theirs, f.clock))).probeBattery;
    expect((await view())?.recentShots).toBe(1);
    f.clock.advance(PROBE_DEFENCE.noticeWindowMinutes + 1);
    expect((await view())?.recentShots).toBe(0);
  });

  it('the radar log names a shot-down probe as one', async () => {
    await armed();
    await instrument(f, theirs, 'RADAR', 8);
    await setLevel(f.db, mine, 'SHIPYARD', 0);
    const sent = await probe((roll) => roll < probeCatchChance(8, 0, 1));
    await land(sent.arriveAt);
    const [row] = await readRadarLog(f.db, [theirs]);
    expect(row).toMatchObject({ shotDown: true });
    expect(await f.db.select().from(scanEvents).where(isNotNull(scanEvents.bearing))).toHaveLength(1);
  });

  /* ── over the wire ──────────────────────────────────────── */

  describe('over the wire', () => {
    async function as<T>(schema: z.ZodType<T>, account: string, method: 'GET' | 'POST', url: string): Promise<{ status: number; body: T }> {
      const env = testEnv();
      const built = buildApp({ db: f.db, clock: f.clock, env, logger: silent });
      await built.app.ready();
      try {
        const token = await new TokenService(env.JWT_SECRET, 15, 30).issueAccess(account);
        const res = await built.app.inject({ method, url, headers: { authorization: `Bearer ${token}` } });
        return { status: res.statusCode, body: schema.parse(res.json()) };
      } finally {
        await built.close();
      }
    }

    it('installs from the route', async () => {
      await instrument(f, theirs, 'RADAR', PROBE_DEFENCE.requiredRadar);
      const res = await as(z.object({ readyAt: z.string() }), f.accountIds[1]!, 'POST', `/api/planets/${theirs}/probe-battery/build`);
      expect(res.status).toBe(200);
      expect(new Date(res.body.readyAt).getTime()).toBe(f.clock.now().getTime() + PROBE_DEFENCE.levels[0].buildMinutes * 60_000);
    });

    it('carries the battery a probe read home to the report', async () => {
      await armed(2);
      await instrument(f, theirs, 'RADAR', 3);
      await setLevel(f.db, mine, 'SHIPYARD', 8);
      const launched = f.clock.now().getTime();
      const sent = await probe((roll) => roll >= probeCatchChance(3, 8, 1));
      await land(sent.arriveAt);
      // The report is read once the craft is home: the same flight back.
      await land(new Date(2 * sent.arriveAt.getTime() - launched + 60_000));
      const res = await as(z.object({ probeReports: z.array(z.object({ targetPlanetId: z.string(), probeBattery: z.unknown() })) }),
        f.accountIds[0]!, 'GET', '/api/intel');
      const report = res.body.probeReports.find((r) => r.targetPlanetId === theirs);
      expect(report?.probeBattery).toEqual({ ready: 2, capacity: L1.capacity });
    });

    it('lists a shot-down probe as a loss, in place of a report', async () => {
      await armed();
      await instrument(f, theirs, 'RADAR', 8);
      await setLevel(f.db, mine, 'SHIPYARD', 0);
      const sent = await probe((roll) => roll < probeCatchChance(8, 0, 1));
      await land(sent.arriveAt);
      const res = await as(z.object({ probeReports: z.array(z.unknown()), probeLosses: z.array(z.object({
        missionId: z.string(), targetPlanetId: z.string(), targetName: z.string(), at: z.string(), firedAt: z.string(),
        from: z.object({ x: z.number(), y: z.number(), z: z.number() }) })) }), f.accountIds[0]!, 'GET', '/api/intel');
      expect(res.body.probeReports).toHaveLength(0);
      expect(res.body.probeLosses).toHaveLength(1);
      expect(res.body.probeLosses[0]).toMatchObject({ missionId: sent.id, targetPlanetId: theirs });
      const [row] = await f.db.select().from(probeShots);
      expect(new Date(res.body.probeLosses[0]!.at).getTime()).toBe(row!.shotAt.getTime());
      // Where the craft was when the battery opened fire: the sender's screen plays the rounds from there.
      expect(new Date(res.body.probeLosses[0]!.firedAt).getTime()).toBe(row!.firedAt.getTime());
      expect(res.body.probeLosses[0]!.from.x).toBeCloseTo(row!.fromX, 3);
      const fired = await as(z.object({ probeShotsFired: z.array(z.object({ firedAt: z.string(), from: z.object({ x: z.number() }) })) }),
        f.accountIds[1]!, 'GET', '/api/intel');
      expect(new Date(fired.body.probeShotsFired[0]!.firedAt).getTime()).toBe(row!.firedAt.getTime());
      expect(fired.body.probeShotsFired[0]!.from.x).toBeCloseTo(row!.fromX, 3);
      // The defender's own intel lists no loss.
      const theirsRes = await as(z.object({ probeLosses: z.array(z.unknown()) }), f.accountIds[1]!, 'GET', '/api/intel');
      expect(theirsRes.body.probeLosses).toHaveLength(0);
    });

    it('drops a loss older than a day', async () => {
      await armed();
      await instrument(f, theirs, 'RADAR', 8);
      await setLevel(f.db, mine, 'SHIPYARD', 0);
      const sent = await probe((roll) => roll < probeCatchChance(8, 0, 1));
      await land(sent.arriveAt);
      f.clock.advance(24 * 60 + 1);
      const res = await as(z.object({ probeLosses: z.array(z.unknown()) }), f.accountIds[0]!, 'GET', '/api/intel');
      expect(res.body.probeLosses).toHaveLength(0);
    });
  });
  /* ── seen from afar ─────────────────────────────────────── */

  describe('seen from afar (plan §3.5)', () => {
    async function shotDown(): Promise<{ id: string; arriveAt: Date }> {
      await armed();
      await instrument(f, theirs, 'RADAR', 8);
      await setLevel(f.db, mine, 'SHIPYARD', 0);
      const sent = await probe((roll) => roll < probeCatchChance(8, 0, 1));
      await land(sent.arriveAt);
      return sent;
    }
    const target = async () => {
      const [world] = await f.db.select().from(planets).where(eq(planets.id, theirs));
      return { x: world!.x, y: world!.y, z: world!.z };
    };
    const eyes = (telescope: boolean, at: { x: number; y: number; z: number }): SensorPost[] => [{
      planetId: f.planetIds[2]!, at, telescope, identify: 500, detect: 500, warn: 500, revealsSize: false, revealsKind: false,
    }];

    it('shows the shot to a Telescope that identifies the world, and to nobody who was part of it', async () => {
      const sent = await shotDown();
      const at = await target();
      const snapshot = await loadTrafficSnapshot(f.db, f.seasonId, f.clock.now());
      const witness = f.playerIds[2]!;
      const [shot] = await f.db.select({ id: probeShots.id }).from(probeShots).where(eq(probeShots.missionId, sent.id));
      const [row] = await f.db.select().from(probeShots).where(eq(probeShots.missionId, sent.id));
      expect(projectProbeShots(snapshot, witness, eyes(true, at))).toEqual([{ id: shot!.id, planetId: theirs, at: row!.shotAt }]);
      // Naked eye, or a Telescope that does not reach: nothing.
      expect(projectProbeShots(snapshot, witness, eyes(false, at))).toEqual([]);
      expect(projectProbeShots(snapshot, witness, eyes(true, { ...at, x: at.x + 5_000 }))).toEqual([]);
      // The two sides already have it from their own intel.
      expect(projectProbeShots(snapshot, attacker, eyes(true, at))).toEqual([]);
      expect(projectProbeShots(snapshot, defender, eyes(true, at))).toEqual([]);
    });

    it('names neither side to the witness, nor where on the approach it was hit (review, 2026-11-24)', async () => {
      // The point would give the bearing the probe came from, which a bystander's probe contact
      // never carries (D53): the witness sees the shot over the world, not where it came from.
      await shotDown();
      const snapshot = await loadTrafficSnapshot(f.db, f.seasonId, f.clock.now());
      const [shot] = projectProbeShots(snapshot, f.playerIds[2]!, eyes(true, await target()));
      expect(Object.keys(shot ?? {}).sort()).toEqual(['at', 'id', 'planetId']);
    });

    it('drops the shot once its moment is over', async () => {
      await shotDown();
      f.clock.advance(PROBE_DEFENCE.witnessMinutes + 1);
      const snapshot = await loadTrafficSnapshot(f.db, f.seasonId, f.clock.now());
      expect(projectProbeShots(snapshot, f.playerIds[2]!, eyes(true, await target()))).toEqual([]);
    });

    it('carries it on the witness\'s traffic read', async () => {
      await instrument(f, f.planetIds[2]!, 'TELESCOPE', 8);
      await shotDown();
      const env = testEnv();
      const built = buildApp({ db: f.db, clock: f.clock, env, logger: silent });
      await built.app.ready();
      try {
        const read = async (account: string) => {
          const token = await new TokenService(env.JWT_SECRET, 15, 30).issueAccess(account);
          const res = await built.app.inject({ method: 'GET', url: '/api/galaxy/traffic', headers: { authorization: `Bearer ${token}` } });
          expect(res.statusCode, res.body).toBe(200);
          return z.object({ probeShots: z.array(z.object({ planetId: z.string() })) }).parse(res.json()).probeShots;
        };
        expect(await read(f.accountIds[2]!)).toEqual([expect.objectContaining({ planetId: theirs })]);
        expect(await read(f.accountIds[0]!)).toEqual([]);
      } finally {
        await built.close();
      }
    });
  });
});
