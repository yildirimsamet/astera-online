import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { INTEL, PROBE } from '@astera/rules';
import {
  accounts,
  missions,
  planets,
  players,
  probeReports,
  satellites,
  scanEvents,
  strategicAssets,
  watches,
} from '../src/db/schema.js';
import {
  assignWatch,
  launchProbe,
  readProbeCooldowns,
  readRadarLog,
  readTelescopes,
} from '../src/services/intel.js';
import { launchAttack } from '../src/services/mission.js';
import { EventWorker } from '../src/worker/loop.js';
import {
  giveUnits,
  grant,
  makeAccount,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

/**
 * A world that has been running a while.
 *
 * These used to advance past the newcomer grace period, which no longer exists
 * (D14). The advance stays because the assertions below are about a settled
 * world — accrued resources, telescope windows that have turned over — and
 * removing it would quietly change what they test.
 */
const SETTLED_MINUTES = 250;


const silent = pino({ level: 'silent' });

/** Set a satellite directly, for arranging preconditions. */
async function giveInstrument(
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
    // Telescope and Radar are stored independently, but their effects only turn
    // on while an Uplink occupies an active orbit slot.
    await f.db.insert(satellites).values([
      { planetId: mine, slot: 15, type: 'UPLINK', level: 1 },
      { planetId: theirs, slot: 15, type: 'UPLINK', level: 1 },
    ]);
  });


  /* ── telescope assignment ─────────────────────────────────── */

  describe('pointing a telescope', () => {
    it('refuses without a telescope installed', async () => {
      await expect(assignWatch(f.db, mine, theirs, 0, f.clock)).rejects.toMatchObject({
        code: 'NO_TELESCOPE',
      });
    });

    /**
     * D18 slowed the slot curve: L1 and L2 watch one planet, L3 and L4 watch two.
     * It used to be one slot per level, which handed a mid-season player five
     * simultaneous windows and made "who do I watch" a question nobody had to
     * answer.
     */
    it('gives a second slot at L3, not at L2', async () => {
      await giveInstrument(f, mine, 'TELESCOPE', 1);
      await expect(assignWatch(f.db, mine, theirs, 0, f.clock)).resolves.toBeTruthy();
      await expect(assignWatch(f.db, mine, theirs, 1, f.clock)).rejects.toMatchObject({
        code: 'BAD_SLOT',
      });

      await giveInstrument(f, mine, 'TELESCOPE', 2);
      await expect(assignWatch(f.db, mine, theirs, 1, f.clock)).rejects.toMatchObject({
        code: 'BAD_SLOT',
      });

      await giveInstrument(f, mine, 'TELESCOPE', 3);
      await expect(assignWatch(f.db, mine, theirs, 1, f.clock)).resolves.toBeTruthy();
    });

    it('refuses negative and fractional slots', async () => {
      await giveInstrument(f, mine, 'TELESCOPE', 3);
      for (const slot of [-1, 1.5]) {
        await expect(assignWatch(f.db, mine, theirs, slot, f.clock)).rejects.toMatchObject({
          code: 'BAD_SLOT',
        });
      }
    });

    it('refuses to watch your own planet', async () => {
      await giveInstrument(f, mine, 'TELESCOPE', 1);
      await expect(assignWatch(f.db, mine, mine, 0, f.clock)).rejects.toMatchObject({
        code: 'SELF_WATCH',
      });
    });

    it('404s on a planet that does not exist', async () => {
      await giveInstrument(f, mine, 'TELESCOPE', 1);
      await expect(
        assignWatch(f.db, mine, '00000000-0000-0000-0000-000000000000', 0, f.clock),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('re-pointing a slot discards its confirmation history', async () => {
      // seedWorld() truncates, so a third planet has to exist from the start.
      const w = await seedWorld(3);
      const [a, b, c] = w.planetIds as [string, string, string];
      await setLevel(w.db, a, 'CORE', 8);
      await w.db.insert(satellites).values({ planetId: a, slot: 15, type: 'UPLINK', level: 1 });
      await giveInstrument(w, a, 'TELESCOPE', 2);

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
      await f.db.update(accounts).set({ displayName: 'İzci' }).where(eq(accounts.id, f.accountIds[1]!));
      await f.db.update(players).set({ name: 'STALE-SEASON-NAME' }).where(eq(players.id, f.playerIds[1]!));
      await giveInstrument(f, mine, 'TELESCOPE', 2);
      await assignWatch(f.db, mine, theirs, 0, f.clock);

      const [view] = await readTelescopes(f.db, myPlayer, f.clock);
      expect(view!.ownerName).toBe('İzci');
      expect(view!.reading.status).toBe('HOME');
      expect(view!.reading.state).toBe('FULL');
    });

    it('reports AWAY the moment a fleet leaves orbit', async () => {
      await giveInstrument(f, mine, 'TELESCOPE', 2);
      await assignWatch(f.db, mine, theirs, 0, f.clock);
      await giveUnits(f.db, theirs, { WASP: 30 });
      f.clock.advance(SETTLED_MINUTES);
      await launchAttack(f.db, theirs, mine, { WASP: 30 }, f.clock);

      const [view] = await readTelescopes(f.db, myPlayer, f.clock);
      expect(view!.reading.status).toBe('AWAY');
    });

    it('gives a return ETA only at FULL clarity', async () => {
      await giveUnits(f.db, theirs, { WASP: 30 });
      f.clock.advance(SETTLED_MINUTES);
      await launchAttack(f.db, theirs, mine, { WASP: 30 }, f.clock);

      await giveInstrument(f, mine, 'TELESCOPE', 2); // clarity +2 → FULL
      await assignWatch(f.db, mine, theirs, 0, f.clock);
      const [full] = await readTelescopes(f.db, myPlayer, f.clock);
      expect(full!.reading.state).toBe('FULL');
      expect(full!.reading.etaMinutes).toBeGreaterThan(0);

      await giveInstrument(f, mine, 'TELESCOPE', 1); // clarity +1 → CLEAR
      const [clear] = await readTelescopes(f.db, myPlayer, f.clock);
      expect(clear!.reading.state).toBe('CLEAR');
      expect(clear!.reading.etaMinutes).toBeNull();
    });

    it('a Veil that outmatches the telescope blinds it completely', async () => {
      await giveInstrument(f, mine, 'TELESCOPE', 1);
      await giveInstrument(f, theirs, 'VEIL', 3); // clarity −2 → BLIND
      await assignWatch(f.db, mine, theirs, 0, f.clock);
      await giveUnits(f.db, theirs, { WASP: 30 });
      f.clock.advance(SETTLED_MINUTES);
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
      await giveInstrument(f, mine, 'TELESCOPE', 2);
      await giveInstrument(f, theirs, 'VEIL', 2); // clarity 0 → INTERMITTENT
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
      await giveInstrument(f, mine, 'TELESCOPE', 2);
      await giveInstrument(f, theirs, 'VEIL', 2); // the fuzzy state
      await assignWatch(f.db, mine, theirs, 0, f.clock);

      const first = (await readTelescopes(f.db, myPlayer, f.clock))[0]!.reading;
      for (let i = 0; i < 20; i++) {
        const again = (await readTelescopes(f.db, myPlayer, f.clock))[0]!.reading;
        expect(again.status).toBe(first.status);
        expect(again.state).toBe(first.state);
      }
    });

    it('but the answer can change once the window rolls over', async () => {
      await giveInstrument(f, mine, 'TELESCOPE', 1);
      await giveInstrument(f, theirs, 'VEIL', 2); // DEGRADED — flips between known and unknown
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
      await giveInstrument(f, theirs, 'VEIL', 2); // force accuracy below 1.0

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
      await giveInstrument(f, theirs, 'VEIL', 3);

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
        // Fly it home before the next one goes out. Only one probe may work a
        // planet at a time, and a craft on its return leg is still working it —
        // the answer is in the air. Skipping this made the second call fail with
        // PROBE_ALREADY_OUT rather than measuring anything.
        f.clock.advance(launch.flightMinutes);
        await worker(f).tick();
        return (r.stock.high - r.stock.low) / Math.max(1, r.stock.high);
      };

      const wide = await widthAfterProbe(0);
      f.clock.advance(60);
      const narrow = await widthAfterProbe(8);
      expect(narrow).toBeLessThan(wide);
    });

    it('reports the target as AWAY when their ships are out', async () => {
      await giveUnits(f.db, theirs, { WASP: 30 });
      f.clock.advance(SETTLED_MINUTES);
      await launchAttack(f.db, theirs, mine, { WASP: 30 }, f.clock);

      const launch = await launchProbe(f.db, mine, theirs, f.clock);
      f.clock.set(launch.arriveAt);
      await worker(f).tick();

      const [report] = await f.db.select().from(probeReports);
      expect(report!.fleetHome).toBe(false);
    });
  });

  /* ── one look per world per hour ──────────────────────────── */

  /**
   * D121 MADE A PROBE FOUR TIMES FASTER, AND THAT TOOK SOMETHING AWAY.
   *
   * The old flight time was doing rationing work nobody had written down: a
   * twenty-four-minute round trip to the far rim was the reason a commander could
   * not read the same world over and over. Speed removed it, so the rule is stated
   * — and these are the edges that decide whether it is a rule or a nuisance.
   */
  describe('the probe cooldown', () => {
    /**
     * ITS OWN FOUR-WORLD GALAXY. The cooldown is a rule about a COMMANDER, so the
     * cases that matter need a second world under one commander, a spare target,
     * and a neighbour who is not bound by anybody else's hour.
     */
    let w: Fixture;
    let home: string;
    let target: string;
    let spare: string;
    let colony: string;
    let commander: string;

    beforeEach(async () => {
      w = await seedWorld(4);
      [home, target, spare, colony] = w.planetIds as [string, string, string, string];
      commander = w.playerIds[0]!;
      for (const id of w.planetIds) await setLevel(w.db, id, 'CORE', 8);
      await grant(w.db, home, 50_000, 5_000);
      await setLevel(w.db, home, 'SHIPYARD', 3);
    });

    /** Make `colony` a second world under the SAME commander, which D97 permits. */
    const giveColony = async (): Promise<string> => {
      await w.db.update(planets)
        .set({ kind: 'COLONY', controllerPlayerId: commander })
        .where(eq(planets.id, colony));
      await grant(w.db, colony, 50_000, 5_000);
      await setLevel(w.db, colony, 'SHIPYARD', 3);
      return colony;
    };

    /** Land the probe and its return leg, so only the cooldown is under test. */
    const landAndReturn = async (launch: { arriveAt: Date }): Promise<void> => {
      w.clock.set(launch.arriveAt);
      await worker(w).tick();
      // The return leg is one more flight, and the widest is minutes rather than
      // an hour — see the rules test that binds those two constants together.
      w.clock.advance(10);
      await worker(w).tick();
    };

    it('refuses a second look at the same world inside the hour', async () => {
      const first = await launchProbe(w.db, home, target, w.clock);
      await landAndReturn(first);

      await expect(launchProbe(w.db, home, target, w.clock)).rejects.toMatchObject({
        code: 'PROBE_COOLDOWN',
        status: 409,
      });
    });

    /**
     * A refusal travels as a code plus its figures (D55), so the interface can say
     * it in Turkish with the server's own numbers. A code with no `minutes` is a
     * toast that cannot answer the only question the player has.
     */
    it('says how long is left, in figures the client can translate', async () => {
      const departedAt = w.clock.now();
      const first = await launchProbe(w.db, home, target, w.clock);
      // Land it first: while a probe is still in the air the player gets
      // PROBE_ALREADY_OUT, which is a different sentence about a different fact.
      await landAndReturn(first);
      w.clock.set(new Date(departedAt.getTime() + 20 * 60_000));

      const refused: unknown = await launchProbe(w.db, home, target, w.clock)
        .then(() => null)
        .catch((error: unknown) => error);
      const params = (refused as { params?: Record<string, unknown> }).params;
      expect(params).toEqual({
        minutes: PROBE.retargetCooldownMinutes - 20,
        until: new Date(
          departedAt.getTime() + PROBE.retargetCooldownMinutes * 60_000,
        ).toISOString(),
      });
    });

    it('opens again the moment the hour is up, and not before', async () => {
      const departedAt = w.clock.now();
      const first = await launchProbe(w.db, home, target, w.clock);
      await landAndReturn(first);

      const readyAt = new Date(departedAt.getTime() + PROBE.retargetCooldownMinutes * 60_000);
      // A millisecond short is short.
      w.clock.set(new Date(readyAt.getTime() - 1));
      await expect(launchProbe(w.db, home, target, w.clock)).rejects.toMatchObject({
        code: 'PROBE_COOLDOWN',
      });

      w.clock.set(readyAt);
      await expect(launchProbe(w.db, home, target, w.clock)).resolves.toBeDefined();
    });

    /** The hour closes ONE world. It is a cooldown on a target, not on scouting. */
    it('closes one world, not the neighbourhood', async () => {
      const first = await launchProbe(w.db, home, target, w.clock);
      await landAndReturn(first);

      await expect(launchProbe(w.db, home, spare, w.clock)).resolves.toBeDefined();
    });

    /**
     * THE RULE IS THE COMMANDER'S, NOT THE LAUNCH PAD'S.
     *
     * A commander may hold four worlds (D97). Scoped to the origin planet, the
     * same hour would be sold four times over to whoever had colonised most —
     * a wealth ladder wearing an intel rule's clothes.
     */
    it('holds across every world one commander controls', async () => {
      const second = await giveColony();
      const first = await launchProbe(w.db, home, target, w.clock);
      await landAndReturn(first);

      await expect(launchProbe(w.db, second, target, w.clock)).rejects.toMatchObject({
        code: 'PROBE_COOLDOWN',
      });
    });

    /** And it is one commander's hour, never the galaxy's. */
    it('does not close the world to anybody else', async () => {
      const first = await launchProbe(w.db, home, target, w.clock);
      await landAndReturn(first);

      await grant(w.db, spare, 50_000, 5_000);
      await setLevel(w.db, spare, 'SHIPYARD', 3);
      await expect(launchProbe(w.db, spare, target, w.clock)).resolves.toBeDefined();
    });

    /**
     * A LOOK THE GAME ITSELF FAILED TO DELIVER COSTS NOTHING.
     *
     * `sweepStranded` and `abandon()` mark a probe whose event row was lost as
     * `cancelled`. Charging the hour for it would make a server fault take the
     * player's turn away, which is exactly what those two paths exist to prevent.
     */
    it('does not charge the hour for a flight the server gave up on', async () => {
      const first = await launchProbe(w.db, home, target, w.clock);
      await w.db.update(missions)
        .set({ status: 'cancelled' })
        .where(eq(missions.id, first.missionId));

      await expect(launchProbe(w.db, home, target, w.clock)).resolves.toBeDefined();
    });

    /**
     * While the probe is literally in the air the player gets the sentence that
     * describes THAT, not the one about an hour — and it now covers every world
     * the commander holds, for the same reason the cooldown does.
     */
    it('says "already out" while it is still flying, from any of your worlds', async () => {
      const second = await giveColony();
      await launchProbe(w.db, home, target, w.clock);

      await expect(launchProbe(w.db, second, target, w.clock)).rejects.toMatchObject({
        code: 'PROBE_ALREADY_OUT',
      });
    });

    /**
     * The interface reads the same instant the guard reads, so a control can be
     * closed before the tap rather than after it. If these two ever disagree, the
     * player is offered a launch the server will refuse.
     */
    it('publishes the same instant the guard enforces', async () => {
      const first = await launchProbe(w.db, home, target, w.clock);
      await landAndReturn(first);
      const [row] = (await readProbeCooldowns(w.db, commander, w.clock.now()))
        .filter((entry) => entry.targetPlanetId === target);
      expect(row).toBeDefined();

      w.clock.set(new Date(row!.readyAt.getTime() - 1));
      await expect(launchProbe(w.db, home, target, w.clock)).rejects.toMatchObject({
        code: 'PROBE_COOLDOWN',
      });
      w.clock.set(row!.readyAt);
      await expect(launchProbe(w.db, home, target, w.clock)).resolves.toBeDefined();
    });

    it('lists nothing once every window has closed', async () => {
      await launchProbe(w.db, home, target, w.clock);
      expect(await readProbeCooldowns(w.db, commander, w.clock.now())).toHaveLength(1);

      w.clock.advance(PROBE.retargetCooldownMinutes + 1);
      expect(await readProbeCooldowns(w.db, commander, w.clock.now())).toEqual([]);
    });

    /** One row per world, even where a cancelled flight left two launches in the hour. */
    it('reports one window per world, dated from the newest launch', async () => {
      const first = await launchProbe(w.db, home, target, w.clock);
      await w.db.update(missions)
        .set({ status: 'cancelled' })
        .where(eq(missions.id, first.missionId));
      w.clock.advance(5);
      const second = w.clock.now();
      await launchProbe(w.db, home, target, w.clock);

      const rows = await readProbeCooldowns(w.db, commander, w.clock.now());
      expect(rows).toHaveLength(1);
      expect(rows[0]!.readyAt.getTime()).toBe(
        second.getTime() + PROBE.retargetCooldownMinutes * 60_000,
      );
    });
  });

  /* ── the asymmetry: watching is silent, probing is loud ───── */

  describe('detection', () => {
    beforeEach(async () => {
      await grant(f.db, mine, 50_000, 5_000);
      await setLevel(f.db, mine, 'SHIPYARD', 1);
    });

    it('watching leaves no trace the target can ever see', async () => {
      await giveInstrument(f, mine, 'TELESCOPE', 3);
      await giveInstrument(f, theirs, 'RADAR', 5); // maximum radar
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
      await giveInstrument(f, theirs, 'RADAR', 5); // detect chance clamps to 0.95
      await setLevel(f.db, mine, 'SHIPYARD', 0);

      const PROBES = 8;
      for (let i = 0; i < PROBES; i++) {
        await grant(f.db, mine, 50_000, 5_000);
        const launch = await launchProbe(f.db, mine, theirs, f.clock);
        f.clock.set(launch.arriveAt);
        await worker(f).tick();
        // Each craft has to get home before the next can go: one probe per target
        // at a time, both legs. And since D121 the same commander may not look at
        // the same world again for an hour, so the clock clears that too — this
        // measures a DETECTION RATE, and the rationing rule is not its subject.
        f.clock.advance(launch.flightMinutes);
        await worker(f).tick();
        f.clock.advance(PROBE.retargetCooldownMinutes + 1);
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
      await giveInstrument(f, theirs, 'RADAR', 1);
      const [entry] = await readRadarLog(f.db, theirs);
      expect(entry).toBeDefined();
      expect(entry!.bearing).toBeNull();
      expect(entry!.originPlanetName).toBeNull();
    });

    it('L2 adds a direction but still never names anyone', async () => {
      await giveInstrument(f, theirs, 'RADAR', 2);
      const [entry] = await readRadarLog(f.db, theirs);
      expect(entry!.bearing).toBeTruthy();
      expect(entry!.originPlanetName).toBeNull();
    });

    it.each([3, 4])('L%i still withholds the origin', async (level) => {
      await giveInstrument(f, theirs, 'RADAR', level);
      const [entry] = await readRadarLog(f.db, theirs);
      expect(entry!.originPlanetName).toBeNull();
    });

    it('only L5 names the scanner', async () => {
      await giveInstrument(f, theirs, 'RADAR', 5);
      const [entry] = await readRadarLog(f.db, theirs);
      expect(entry!.originPlanetName).toBeTruthy();
    });
  });

  /* ── cross-cutting ────────────────────────────────────────── */

  describe('intel across a season boundary', () => {
    it('cannot watch a planet that belongs to another galaxy', async () => {
      await giveInstrument(f, mine, 'TELESCOPE', 2);

      // A second live season in the same database — no truncation.
      const { createSeason } = await import('../src/services/season.js');
      const { joinSeason } = await import('../src/services/player.js');
      const other = await createSeason(f.db, {
        shardCode: 'EU-OTHER',
        seed: 31337,
        startsAt: f.clock.now(),
        playerCap: 20,
      });
      const stranger = await makeAccount(f.db, 'Stranger');
      const elsewhere = await joinSeason(f.db, stranger.id, other.season.id, f.clock);

      await expect(
        assignWatch(f.db, mine, elsewhere.planetId, 0, f.clock),
      ).rejects.toMatchObject({ code: 'CROSS_SEASON' });
    });

    it('cannot probe across a galaxy boundary either', async () => {
      await grant(f.db, mine, 50_000, 5_000);
      const { createSeason } = await import('../src/services/season.js');
      const { joinSeason } = await import('../src/services/player.js');
      const other = await createSeason(f.db, {
        shardCode: 'EU-OTHER-2',
        seed: 4711,
        startsAt: f.clock.now(),
        playerCap: 20,
      });
      const stranger = await makeAccount(f.db, 'Stranger2');
      const elsewhere = await joinSeason(f.db, stranger.id, other.season.id, f.clock);

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

    it('reveals strategic inventory only at the 75% accuracy threshold', async () => {
      await grant(f.db, mine, 100_000, 10_000);
      await f.db.insert(strategicAssets).values({
        planetId: theirs,
        status: 'READY',
        startedAt: f.clock.now(),
        remainingSeconds: 0,
      });

      // Shipyard L1 produces 67% accuracy against no Veil: the existence of the
      // asset itself must remain hidden.
      await setLevel(f.db, mine, 'SHIPYARD', 1);
      const low = await launchProbe(f.db, mine, theirs, f.clock);
      f.clock.set(low.arriveAt);
      await worker(f).tick();
      const [lowReport] = await f.db.select().from(probeReports)
        .where(eq(probeReports.missionId, low.missionId));
      expect(lowReport).toMatchObject({ accuracy: 0.67, strategicStatus: 'UNKNOWN' });

      // Let the first probe return, and let D121's hour on this world close, before
      // sending another. The accuracy gate is what is under test, not the cooldown.
      f.clock.advance(low.flightMinutes);
      await worker(f).tick();
      f.clock.advance(PROBE.retargetCooldownMinutes);
      await setLevel(f.db, mine, 'SHIPYARD', 2); // 79%, first level above the gate.
      const high = await launchProbe(f.db, mine, theirs, f.clock);
      f.clock.set(high.arriveAt);
      await worker(f).tick();
      const [highReport] = await f.db.select().from(probeReports)
        .where(eq(probeReports.missionId, high.missionId));
      expect(highReport).toMatchObject({ accuracy: 0.79, strategicStatus: 'READY' });
    });
  });

/**
 * THE PROBE IS A ROUND TRIP.
 *
 * The snapshot is taken on arrival — that is the instant being measured, and it is
 * when the target's radar has its chance — but the observer reads none of it until
 * the craft is home. It makes scouting a commitment rather than a purchase, and it
 * means a probe in the air is a pending thread, which Design Law #1 wants anyway.
 */
describe('a probe flies out and comes back', () => {
  let f: Fixture;
  let mine: string;
  let theirs: string;
  let myPlayer: string;

  const worker = () =>
    new EventWorker(f.db, f.clock, { pollMs: 1000, batch: 100, staleMinutes: 5 }, pino({ level: 'silent' }));

  beforeEach(async () => {
    f = await seedWorld(2);
    [mine, theirs] = f.planetIds as [string, string];
    myPlayer = f.playerIds[0]!;
    await grant(f.db, mine, 5_000, 500);
  });

  it('tells you nothing until it is home', async () => {
    await f.db.update(accounts).set({ displayName: 'İzci' }).where(eq(accounts.id, f.accountIds[1]!));
    await f.db.update(players).set({ name: 'STALE-SEASON-NAME' }).where(eq(players.id, f.playerIds[1]!));
    const { launchProbe, readProbeReports } = await import('../src/services/intel.js');
    const out = await launchProbe(f.db, mine, theirs, f.clock);

    // It lands: the snapshot exists, and the target's radar has had its chance.
    f.clock.set(out.arriveAt);
    await worker().tick();
    expect(await readProbeReports(f.db, myPlayer)).toHaveLength(0);

    const [home] = await f.db
      .select()
      .from(missions)
      .where(and(eq(missions.kind, 'probe'), eq(missions.status, 'in_flight')));
    expect(home).toBeDefined();
    expect(home!.originPlanetId).toBe(theirs);
    expect(home!.targetPlanetId).toBe(mine);

    // And only when it gets back does the answer appear.
    f.clock.set(home!.arriveAt);
    await worker().tick();
    const reports = await readProbeReports(f.db, myPlayer);
    expect(reports).toHaveLength(1);
    expect(reports[0]!.report.deliveredAt).not.toBeNull();
    expect(reports[0]!.targetUsername).toBe('İzci');
    expect(reports[0]!.targetName).not.toBe('STALE-SEASON-NAME');
  });

  /** The scan is written when the probe arrives, not when it gets home. */
  it('is caught by radar on arrival, not on the way back', async () => {
    const { launchProbe } = await import('../src/services/intel.js');
    const { scanEvents } = await import('../src/db/schema.js');
    const { eq } = await import('drizzle-orm');

    const out = await launchProbe(f.db, mine, theirs, f.clock);
    f.clock.set(out.arriveAt);
    await worker().tick();

    const scans = await f.db.select().from(scanEvents).where(eq(scanEvents.targetPlanetId, theirs));
    expect(scans).toHaveLength(1);
  });

  /** A crashed worker replaying the arrival must not send a second craft home. */
  it('does not schedule a second trip home when the arrival is delivered twice', async () => {
    const { launchProbe } = await import('../src/services/intel.js');
    const { missions } = await import('../src/db/schema.js');
    const { and, eq } = await import('drizzle-orm');

    const out = await launchProbe(f.db, mine, theirs, f.clock);
    f.clock.set(out.arriveAt);
    await worker().tick();
    await worker().tick();

    const homeward = await f.db
      .select()
      .from(missions)
      .where(and(eq(missions.kind, 'probe'), eq(missions.originPlanetId, theirs)));
    expect(homeward).toHaveLength(1);
  });
});
});
