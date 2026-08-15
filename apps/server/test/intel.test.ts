import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ABUSE, INTEL, PROBE } from '@blindspace/rules';
import { missions, planets, probeReports, satellites, scanEvents, watches } from '../src/db/schema.js';
import { assignWatch, launchProbe, readRadarLog, readTelescopes } from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { EventWorker } from '../src/worker/loop.js';
import { giveUnits, grant, seedWorld, setLevel, testDb, type Fixture } from './helpers.js';

const silent = pino({ level: 'silent' });

/** Set a satellite directly, for arranging preconditions. */
async function giveSatellite(
  f: Fixture,
  planetId: string,
  type: 'TELESCOPE' | 'RADAR' | 'VEIL' | 'AEGIS' | 'DRILL',
  level: number,
  slot = 0,
): Promise<void> {
  await f.db
    .insert(satellites)
    .values({ planetId, slot, type, level })
    .onConflictDoUpdate({
      target: [satellites.planetId, satellites.slot],
      set: { type, level },
    });
}

const worker = (f: Fixture) =>
  new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, silent);

// The database pool is shared across this whole file, so it is torn down at FILE
// scope. An afterAll inside a describe would close it out from under any describe
// that follows.
afterAll(async () => {
  const { close } = await testDb();
  await close();
});

describe('the information layer', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let myPlayer: string;

  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, theirs] = f.planetIds as [string, string];
    myPlayer = f.playerIds[0]!;
    await setLevel(f.db, mine, 'CORE', 8);
    await setLevel(f.db, theirs, 'CORE', 8);
  });


  /* ── telescope assignment ─────────────────────────────────── */

  describe('pointing a telescope', () => {
    it('refuses without a telescope installed', async () => {
      await expect(assignWatch(f.db, mine, theirs, 0, f.clock)).rejects.toMatchObject({
        code: 'NO_TELESCOPE',
      });
    });

    it('allows exactly as many slots as the telescope level', async () => {
      await giveSatellite(f, mine, 'TELESCOPE', 1);
      await expect(assignWatch(f.db, mine, theirs, 0, f.clock)).resolves.toBeTruthy();
      await expect(assignWatch(f.db, mine, theirs, 1, f.clock)).rejects.toMatchObject({
        code: 'BAD_SLOT',
      });

      await giveSatellite(f, mine, 'TELESCOPE', 2);
      await expect(assignWatch(f.db, mine, theirs, 1, f.clock)).resolves.toBeTruthy();
    });

    it('refuses negative and fractional slots', async () => {
      await giveSatellite(f, mine, 'TELESCOPE', 3);
      for (const slot of [-1, 1.5]) {
        await expect(assignWatch(f.db, mine, theirs, slot, f.clock)).rejects.toMatchObject({
          code: 'BAD_SLOT',
        });
      }
    });

    it('refuses to watch your own planet', async () => {
      await giveSatellite(f, mine, 'TELESCOPE', 1);
      await expect(assignWatch(f.db, mine, mine, 0, f.clock)).rejects.toMatchObject({
        code: 'SELF_WATCH',
      });
    });

    it('404s on a planet that does not exist', async () => {
      await giveSatellite(f, mine, 'TELESCOPE', 1);
      await expect(
        assignWatch(f.db, mine, '00000000-0000-0000-0000-000000000000', 0, f.clock),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('re-pointing a slot discards its confirmation history', async () => {
      // seedWorld() truncates, so a third planet has to exist from the start.
      const w = await seedWorld(3);
      const [a, b, c] = w.planetIds as [string, string, string];
      await setLevel(w.db, a, 'CORE', 8);
      await giveSatellite(w, a, 'TELESCOPE', 2);

      await assignWatch(w.db, a, b, 0, w.clock);
      await readTelescopes(w.db, w.playerIds[0]!, w.clock);

      const before = await w.db.select().from(watches).where(eq(watches.slot, 0));
      expect(before[0]!.lastConfirmedAt).not.toBeNull();
      expect(before[0]!.targetPlanetId).toBe(b);

      await assignWatch(w.db, a, c, 0, w.clock);

      const after = await w.db.select().from(watches).where(eq(watches.slot, 0));
      expect(after[0]!.targetPlanetId).toBe(c);
      // You are looking at something new — nothing about it is "last confirmed".
      expect(after[0]!.lastConfirmedAt).toBeNull();
      expect(after[0]!.lastStatus).toBeNull();
    });
  });

  /* ── the clarity gradient ─────────────────────────────────── */

  describe('what the telescope shows', () => {
    it('reports HOME when their ships are home', async () => {
      await giveSatellite(f, mine, 'TELESCOPE', 2);
      await assignWatch(f.db, mine, theirs, 0, f.clock);

      const [view] = await readTelescopes(f.db, myPlayer, f.clock);
      expect(view!.reading.status).toBe('HOME');
      expect(view!.reading.state).toBe('FULL');
    });

    it('reports AWAY the moment a fleet leaves orbit', async () => {
      await giveSatellite(f, mine, 'TELESCOPE', 2);
      await assignWatch(f.db, mine, theirs, 0, f.clock);
      await giveUnits(f.db, theirs, { WASP: 30 });
      f.clock.advance(ABUSE.graceMinutes + 10);
      await launchAttack(f.db, theirs, mine, { WASP: 30 }, f.clock);

      const [view] = await readTelescopes(f.db, myPlayer, f.clock);
      expect(view!.reading.status).toBe('AWAY');
    });

    it('gives a return ETA only at FULL clarity', async () => {
      await giveUnits(f.db, theirs, { WASP: 30 });
      f.clock.advance(ABUSE.graceMinutes + 10);
      await launchAttack(f.db, theirs, mine, { WASP: 30 }, f.clock);

      await giveSatellite(f, mine, 'TELESCOPE', 2); // clarity +2 → FULL
      await assignWatch(f.db, mine, theirs, 0, f.clock);
      const [full] = await readTelescopes(f.db, myPlayer, f.clock);
      expect(full!.reading.state).toBe('FULL');
      expect(full!.reading.etaMinutes).toBeGreaterThan(0);

      await giveSatellite(f, mine, 'TELESCOPE', 1); // clarity +1 → CLEAR
      const [clear] = await readTelescopes(f.db, myPlayer, f.clock);
      expect(clear!.reading.state).toBe('CLEAR');
      expect(clear!.reading.etaMinutes).toBeNull();
    });

    it('a Veil that outmatches the telescope blinds it completely', async () => {
      await giveSatellite(f, mine, 'TELESCOPE', 1);
      await giveSatellite(f, theirs, 'VEIL', 3); // clarity −2 → BLIND
      await assignWatch(f.db, mine, theirs, 0, f.clock);
      await giveUnits(f.db, theirs, { WASP: 30 });
      f.clock.advance(ABUSE.graceMinutes + 10);
      await launchAttack(f.db, theirs, mine, { WASP: 30 }, f.clock);

      // The true status is AWAY. It must never appear.
      for (let i = 0; i < 12; i++) {
        f.clock.advance(INTEL.intermittentRefreshMin + 1);
        const [view] = await readTelescopes(f.db, myPlayer, f.clock);
        expect(view!.reading.status).toBe('UNKNOWN');
        expect(view!.reading.etaMinutes).toBeNull();
      }
    });

    it('a matched Veil produces fog, not a wall', async () => {
      await giveSatellite(f, mine, 'TELESCOPE', 2);
      await giveSatellite(f, theirs, 'VEIL', 2); // clarity 0 → INTERMITTENT
      await assignWatch(f.db, mine, theirs, 0, f.clock);

      const states = new Set<string>();
      const stales = new Set<number>();
      for (let i = 0; i < 20; i++) {
        f.clock.advance(INTEL.intermittentRefreshMin + 1);
        const [view] = await readTelescopes(f.db, myPlayer, f.clock);
        states.add(view!.reading.state);
        stales.add(Math.round(view!.reading.staleMinutes));
      }
      expect([...states]).toEqual(['INTERMITTENT']);
      // Sometimes fresh, sometimes stale — that variation IS the mechanic.
      expect(stales.size).toBeGreaterThan(1);
    });
  });

  /* ── the rule that keeps the fog honest ───────────────────── */

  describe('refresh-spam resistance', () => {
    /**
     * THE EASIEST WAY TO SHIP A BROKEN INFORMATION GAME.
     *
     * If the roll were fresh per request, a player defeats the entire fog layer by
     * pulling to refresh until INTERMITTENT happens to yield a confirmation.
     */
    it('reading twenty times inside one window gives twenty identical answers', async () => {
      await giveSatellite(f, mine, 'TELESCOPE', 2);
      await giveSatellite(f, theirs, 'VEIL', 2); // the fuzzy state
      await assignWatch(f.db, mine, theirs, 0, f.clock);

      const first = (await readTelescopes(f.db, myPlayer, f.clock))[0]!.reading;
      for (let i = 0; i < 20; i++) {
        const again = (await readTelescopes(f.db, myPlayer, f.clock))[0]!.reading;
        expect(again.status).toBe(first.status);
        expect(again.state).toBe(first.state);
      }
    });

    it('but the answer can change once the window rolls over', async () => {
      await giveSatellite(f, mine, 'TELESCOPE', 1);
      await giveSatellite(f, theirs, 'VEIL', 2); // DEGRADED — flips between known and unknown
      await assignWatch(f.db, mine, theirs, 0, f.clock);

      const seen = new Set<string>();
      for (let i = 0; i < 25; i++) {
        seen.add((await readTelescopes(f.db, myPlayer, f.clock))[0]!.reading.status);
        f.clock.advance(INTEL.intermittentRefreshMin + 1);
      }
      expect(seen.size).toBeGreaterThan(1);
    });
  });

  /* ── probes ───────────────────────────────────────────────── */

  describe('sending a probe', () => {
    beforeEach(async () => {
      await grant(f.db, mine, 50_000, 5_000);
      await setLevel(f.db, mine, 'SHIPYARD', 3);
    });

    it('costs alloy and schedules an arrival', async () => {
      const before = await f.db.select().from(planets).where(eq(planets.id, mine));
      const launch = await launchProbe(f.db, mine, theirs, f.clock);

      const after = await f.db.select().from(planets).where(eq(planets.id, mine));
      expect(before[0]!.alloy - after[0]!.alloy).toBeCloseTo(PROBE.alloy, 0);
      expect(launch.flightMinutes).toBeGreaterThan(0);

      const [m] = await f.db.select().from(missions).where(eq(missions.id, launch.missionId));
      expect(m!.kind).toBe('probe');
    });

    it('refuses when you cannot afford it', async () => {
      await grant(f.db, mine, 10, 0);
      await expect(launchProbe(f.db, mine, theirs, f.clock)).rejects.toMatchObject({
        code: 'INSUFFICIENT_RESOURCES',
      });
    });

    it('refuses to probe your own planet', async () => {
      await expect(launchProbe(f.db, mine, mine, f.clock)).rejects.toMatchObject({
        code: 'SELF_PROBE',
      });
    });

    it('files a banded report on arrival — never an exact number', async () => {
      await grant(f.db, theirs, 60_000, 6_000);
      await giveUnits(f.db, theirs, { WASP: 40, BASTION: 3 });
      await giveSatellite(f, theirs, 'VEIL', 2); // force accuracy below 1.0

      const launch = await launchProbe(f.db, mine, theirs, f.clock);
      f.clock.set(launch.arriveAt);
      await worker(f).tick();

      const [report] = await f.db.select().from(probeReports);
      expect(report).toBeDefined();
      expect(report!.accuracy).toBeLessThan(1);
      expect(report!.stock.high).toBeGreaterThan(report!.stock.low);
      expect(report!.defence.high).toBeGreaterThan(report!.defence.low);
      expect(report!.fleetHome).toBe(true);
    });

    it('a better shipyard buys a narrower band', async () => {
      await grant(f.db, theirs, 60_000, 6_000);
      await giveSatellite(f, theirs, 'VEIL', 3);

      const widthAfterProbe = async (shipyard: number): Promise<number> => {
        await setLevel(f.db, mine, 'SHIPYARD', shipyard);
        await grant(f.db, mine, 50_000, 5_000);
        const launch = await launchProbe(f.db, mine, theirs, f.clock);
        f.clock.set(launch.arriveAt);
        await worker(f).tick();
        const rows = await f.db
          .select()
          .from(probeReports)
          .where(eq(probeReports.missionId, launch.missionId));
        const r = rows[0]!;
        return (r.stock.high - r.stock.low) / Math.max(1, r.stock.high);
      };

      const wide = await widthAfterProbe(0);
      f.clock.advance(60);
      const narrow = await widthAfterProbe(8);
      expect(narrow).toBeLessThan(wide);
    });

    it('reports the target as AWAY when their ships are out', async () => {
      await giveUnits(f.db, theirs, { WASP: 30 });
      f.clock.advance(ABUSE.graceMinutes + 10);
      await launchAttack(f.db, theirs, mine, { WASP: 30 }, f.clock);

      const launch = await launchProbe(f.db, mine, theirs, f.clock);
      f.clock.set(launch.arriveAt);
      await worker(f).tick();

      const [report] = await f.db.select().from(probeReports);
      expect(report!.fleetHome).toBe(false);
    });
  });

  /* ── the asymmetry: watching is silent, probing is loud ───── */

  describe('detection', () => {
    beforeEach(async () => {
      await grant(f.db, mine, 50_000, 5_000);
      await setLevel(f.db, mine, 'SHIPYARD', 1);
    });

    it('watching leaves no trace the target can ever see', async () => {
      await giveSatellite(f, mine, 'TELESCOPE', 3);
      await giveSatellite(f, theirs, 'RADAR', 5); // maximum radar
      await assignWatch(f.db, mine, theirs, 0, f.clock);

      for (let i = 0; i < 10; i++) {
        f.clock.advance(30);
        await readTelescopes(f.db, myPlayer, f.clock);
      }

      expect(await f.db.select().from(scanEvents)).toHaveLength(0);
      expect(await readRadarLog(f.db, theirs)).toHaveLength(0);
    });

    it('every probe writes exactly one scan row, detected or not', async () => {
      const launch = await launchProbe(f.db, mine, theirs, f.clock);
      f.clock.set(launch.arriveAt);
      await worker(f).tick();

      const scans = await f.db.select().from(scanEvents);
      expect(scans).toHaveLength(1);
      // And the log shows it if and only if it was caught — whichever way the
      // seeded roll went.
      const visible = await readRadarLog(f.db, theirs);
      expect(visible.length).toBe(scans[0]!.detected ? 1 : 0);
    });

    it('high radar catches almost everything — measured over many probes', async () => {
      await giveSatellite(f, theirs, 'RADAR', 5); // detect chance clamps to 0.95
      await setLevel(f.db, mine, 'SHIPYARD', 0);

      const PROBES = 8;
      for (let i = 0; i < PROBES; i++) {
        await grant(f.db, mine, 50_000, 5_000);
        const launch = await launchProbe(f.db, mine, theirs, f.clock);
        f.clock.set(launch.arriveAt);
        await worker(f).tick();
        f.clock.advance(1);
      }

      const scans = await f.db.select().from(scanEvents);
      expect(scans).toHaveLength(PROBES);
      const caught = scans.filter((s) => s.detected).length;
      // At p=0.95, seeing fewer than 5 of 8 has probability ~1e-6.
      expect(caught).toBeGreaterThanOrEqual(5);
    });

    it('an undetected probe never appears in the radar log', async () => {
      // No radar at all: detection clamps to the 5% floor.
      const log = await readRadarLog(f.db, theirs);
      expect(log).toHaveLength(0);

      await setLevel(f.db, mine, 'SHIPYARD', 8);
      const launch = await launchProbe(f.db, mine, theirs, f.clock);
      f.clock.set(launch.arriveAt);
      await worker(f).tick();

      const scans = await f.db
        .select()
        .from(scanEvents)
        .where(eq(scanEvents.detected, false));
      // Whether this particular roll was caught is seeded, but an undetected row
      // must never surface in the log.
      const visible = await readRadarLog(f.db, theirs);
      expect(visible.length + scans.length).toBe(1);
    });
  });

  /* ── fog enforcement in the radar log ─────────────────────── */

  describe('what a defender may read from their own radar', () => {
    beforeEach(async () => {
      // Arranged directly rather than by probing: detection is a 95% roll seeded
      // from a random mission id, so driving these through a real probe would make
      // them fail roughly one run in twenty. What is under test here is the READ
      // filter, not the roll — the roll is covered in 'detection' below.
      await f.db.insert(scanEvents).values({
        targetPlanetId: theirs,
        originPlanetId: mine,
        detected: true,
        bearing: 'north-west',
      });
    });

    it('L1 gives the fact only — no bearing, no origin', async () => {
      await giveSatellite(f, theirs, 'RADAR', 1);
      const [entry] = await readRadarLog(f.db, theirs);
      expect(entry).toBeDefined();
      expect(entry!.bearing).toBeNull();
      expect(entry!.originPlanetName).toBeNull();
    });

    it('L2 adds a direction but still never names anyone', async () => {
      await giveSatellite(f, theirs, 'RADAR', 2);
      const [entry] = await readRadarLog(f.db, theirs);
      expect(entry!.bearing).toBeTruthy();
      expect(entry!.originPlanetName).toBeNull();
    });

    it.each([3, 4])('L%i still withholds the origin', async (level) => {
      await giveSatellite(f, theirs, 'RADAR', level);
      const [entry] = await readRadarLog(f.db, theirs);
      expect(entry!.originPlanetName).toBeNull();
    });

    it('only L5 names the scanner', async () => {
      await giveSatellite(f, theirs, 'RADAR', 5);
      const [entry] = await readRadarLog(f.db, theirs);
      expect(entry!.originPlanetName).toBeTruthy();
    });
  });

  /* ── cross-cutting ────────────────────────────────────────── */

  describe('intel across a season boundary', () => {
    it('cannot watch a planet that belongs to another galaxy', async () => {
      await giveSatellite(f, mine, 'TELESCOPE', 2);

      // A second live season in the same database — no truncation.
      const { createSeason } = await import('../src/services/season.js');
      const { joinSeason } = await import('../src/services/player.js');
      const { accounts } = await import('../src/db/schema.js');
      const other = await createSeason(f.db, {
        shardCode: 'EU-OTHER',
        seed: 31337,
        startsAt: f.clock.now(),
        playerCap: 20,
      });
      const [stranger] = await f.db
        .insert(accounts)
        .values({ displayName: 'Stranger' })
        .returning();
      const elsewhere = await joinSeason(f.db, stranger!.id, other.season.id, f.clock);

      await expect(
        assignWatch(f.db, mine, elsewhere.planetId, 0, f.clock),
      ).rejects.toMatchObject({ code: 'CROSS_SEASON' });
    });

    it('cannot probe across a galaxy boundary either', async () => {
      await grant(f.db, mine, 50_000, 5_000);
      const { createSeason } = await import('../src/services/season.js');
      const { joinSeason } = await import('../src/services/player.js');
      const { accounts } = await import('../src/db/schema.js');
      const other = await createSeason(f.db, {
        shardCode: 'EU-OTHER-2',
        seed: 4711,
        startsAt: f.clock.now(),
        playerCap: 20,
      });
      const [stranger] = await f.db
        .insert(accounts)
        .values({ displayName: 'Stranger 2' })
        .returning();
      const elsewhere = await joinSeason(f.db, stranger!.id, other.season.id, f.clock);

      await expect(
        launchProbe(f.db, mine, elsewhere.planetId, f.clock),
      ).rejects.toMatchObject({ code: 'CROSS_SEASON' });
    });
  });

  describe('probe report ownership', () => {
    it('a report belongs to the observer, and names the target', async () => {
      await grant(f.db, mine, 50_000, 5_000);
      await setLevel(f.db, mine, 'SHIPYARD', 2);
      const launch = await launchProbe(f.db, mine, theirs, f.clock);
      f.clock.set(launch.arriveAt);
      await worker(f).tick();

      const [report] = await f.db.select().from(probeReports);
      expect(report!.observerPlayerId).toBe(myPlayer);
      expect(report!.targetPlanetId).toBe(theirs);

      // And the mirror row names the origin — but only the radar log may read it.
      const [scan] = await f.db
        .select()
        .from(scanEvents)
        .where(and(eq(scanEvents.targetPlanetId, theirs)));
      expect(scan!.originPlanetId).toBe(mine);
    });
  });
});
