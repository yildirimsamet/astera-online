import { and, eq } from 'drizzle-orm';
import { pino } from 'pino';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { missions, notifications, planets, scheduledEvents, units } from '../src/db/schema.js';
import { launchTransfer, recallFlight } from '../src/services/movement.js';
import { launchAttack } from '../src/services/mission.js';
import { launchProbe } from '../src/services/intel.js';
import { pendingThreads } from '../src/services/session.js';
import { EventWorker } from '../src/worker/loop.js';
import { onMissionArrival } from '../src/worker/handlers.js';
import { complete } from '../src/worker/queue.js';
import {
  fuelUp,
  giveInstrument,
  giveSatellite,
  giveUnits,
  placeAt,
  grant,
  levelWorld,
  seedWorld,
  setLevel,
  testDb,
  type Fixture,
} from './helpers.js';

const silent = pino({ level: 'silent' });
const EMPTY = { alloy: 0, crystal: 0, deuterium: 0 };

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * CALLING YOUR OWN FLEET BACK. Owner decision, 2026-09-21; the chat logs' loudest loss.
 *
 * *"Ben sabah kalktım sıfırım. Hiç birşeyim kalmamış."* People leave when their FLEET dies, not
 * when their mines are emptied, and until now a launched fleet was gone from the commander's hands
 * the instant it left: they could watch a raid closing on the world their ships were flying to and
 * do nothing.
 *
 * THE RETURN TAKES AS LONG AS WAS ALREADY FLOWN, never instantly. An instant recall would delete
 * "catch the fleet while it is out" — the one counter-play a raider has against fleetsave — and
 * turn the whole package into a safety switch instead of a decision with a cost.
 *
 * A RAID TURNS TOO, SINCE K8 (owner, 2026-09-23), by the same rule — see `attack-recall.test.ts`.
 * The bet survives because the turn is not free: the fuel stays spent and the way home takes as long
 * as the way out did.
 */
describe('recalling a fleet', () => {
  let f: Fixture;
  let mine: string;
  let colony: string;
  let other: string;

  const worker = (): EventWorker =>
    new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

  const unitsAt = async (planetId: string): Promise<number> => {
    const rows = await f.db.select().from(units).where(eq(units.planetId, planetId));
    return rows.filter((r) => r.location === 'home').reduce((n, r) => n + r.count, 0);
  };

  /** Far enough that the flight lasts long enough to be turned around mid-way. */
  const sendTransfer = async (cargo = EMPTY, fleet: Record<string, number> = { DART: 10 }) =>
    launchTransfer(f.db, f.playerIds[0]!, mine, colony, fleet, cargo, f.clock);

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, colony, other] = f.planetIds as [string, string, string];
    await setLevel(f.db, mine, 'CORE', 8);
    await setLevel(f.db, colony, 'HANGAR', 3);
    await grant(f.db, mine, 200_000, 60_000);
    await levelWorld(f.db, f.planetIds);
    await f.db
      .update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, colony));
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, colony, { x: 4_000 });
    await giveUnits(f.db, mine, { DART: 10, COURIER: 4 });
    await fuelUp(f.db, mine, 200_000);
    f.clock.advance(250);
  });

  it('turns a transfer around and brings the ships home', async () => {
    const launched = await sendTransfer();
    expect(await unitsAt(mine)).toBe(4);

    f.clock.advance(1);
    const recall = await recallFlight(f.db, launched.missionId, f.clock, f.playerIds[0]!);

    f.clock.set(new Date(recall.arriveAt.getTime() + 1_000));
    await worker().tick();
    expect(await unitsAt(mine)).toBe(14);
    expect(await unitsAt(colony)).toBe(0);
  });

  it('does not let a pre-claimed outbound arrival teleport a recalled fleet home', async () => {
    const launched = await sendTransfer();
    const [claimed] = await f.db
      .update(scheduledEvents)
      .set({
        status: 'processing',
        claimedAt: launched.arriveAt,
        attempts: 1,
      })
      .where(and(
        eq(scheduledEvents.kind, 'mission_arrival'),
        eq(scheduledEvents.refId, launched.missionId),
      ))
      .returning();
    expect(claimed?.status).toBe('processing');

    const oldArrival = launched.arriveAt;
    f.clock.set(new Date(oldArrival.getTime() - 100));
    const recalled = await recallFlight(f.db, launched.missionId, f.clock, f.playerIds[0]!);
    expect(recalled.arriveAt.getTime()).toBeGreaterThan(oldArrival.getTime());

    // The worker already owns the old row in memory and resumes after recall commits.
    f.clock.set(new Date(oldArrival.getTime() + 1));
    await onMissionArrival({ db: f.db, clock: f.clock }, claimed!);
    await complete(f.db, claimed!.id);

    const [mission] = await f.db.select().from(missions)
      .where(eq(missions.id, launched.missionId));
    expect(mission).toMatchObject({ status: 'in_flight', recalledAt: expect.any(Date) as Date });
    expect(await unitsAt(mine)).toBe(4);
    const live = await f.db.select().from(scheduledEvents).where(and(
      eq(scheduledEvents.kind, 'mission_arrival'),
      eq(scheduledEvents.refId, launched.missionId),
      eq(scheduledEvents.status, 'pending'),
    ));
    expect(live).toHaveLength(1);
    expect(live[0]!.resolveAt).toEqual(recalled.arriveAt);
  });

  it('takes exactly as long to come back as it had already flown', async () => {
    const departedAt = f.clock.now();
    const launched = await sendTransfer();
    f.clock.advance(7);
    const turnedAt = f.clock.now();
    const recall = await recallFlight(f.db, launched.missionId, f.clock, f.playerIds[0]!);

    const flown = (turnedAt.getTime() - departedAt.getTime()) / 60_000;
    const back = (recall.arriveAt.getTime() - turnedAt.getTime()) / 60_000;
    expect(back).toBeCloseTo(flown, 6);
  });

  /** Chat: `hangar dolu diye geri donuyordu`. A fleet coming home is not an arrival to be refused. */
  it('always fits at home, however full the hangar is', async () => {
    const launched = await sendTransfer();
    await setLevel(f.db, mine, 'HANGAR', 0);
    await giveUnits(f.db, mine, { DART: 400 });
    f.clock.advance(1);
    const recall = await recallFlight(f.db, launched.missionId, f.clock, f.playerIds[0]!);

    f.clock.set(new Date(recall.arriveAt.getTime() + 1_000));
    await worker().tick();
    expect(await unitsAt(mine)).toBe(414);
  });

  it('brings the cargo back with the ships', async () => {
    const [before] = await f.db.select().from(planets).where(eq(planets.id, mine));
    const launched = await sendTransfer(
      { alloy: 600, crystal: 200, deuterium: 0 }, { DART: 10, COURIER: 4 },
    );
    f.clock.advance(1);
    const recall = await recallFlight(f.db, launched.missionId, f.clock, f.playerIds[0]!);

    f.clock.set(new Date(recall.arriveAt.getTime() + 1_000));
    await worker().tick();
    const [after] = await f.db.select().from(planets).where(eq(planets.id, mine));
    // The ore left and came back: the store is no lower than the fuel it burned.
    expect(after!.alloy).toBeCloseTo(before!.alloy, 0);
  });

  /** A probe goes, looks and comes home; K8 turns raids around, not scouts. `attack-recall.test.ts` has the raids. */
  it('refuses to recall a probe', async () => {
    await giveSatellite(f.db, mine, 'UPLINK');
    await giveInstrument(f.db, mine, 'TELESCOPE', 1);
    const probe = await launchProbe(f.db, mine, other, f.clock);
    await expect(
      recallFlight(f.db, probe.missionId, f.clock, f.playerIds[0]!),
    ).rejects.toMatchObject({ code: 'NOT_RECALLABLE' });
  });

  it('refuses to recall a flight that has already landed', async () => {
    const launched = await sendTransfer();
    f.clock.set(new Date(launched.arriveAt.getTime() + 1_000));
    await worker().tick();
    await expect(
      recallFlight(f.db, launched.missionId, f.clock, f.playerIds[0]!),
    ).rejects.toMatchObject({ code: 'NOT_RECALLABLE' });
  });

  it('refuses to recall somebody else’s flight', async () => {
    const launched = await sendTransfer();
    f.clock.advance(1);
    await expect(
      recallFlight(f.db, launched.missionId, f.clock, f.playerIds[1]!),
    ).rejects.toMatchObject({ code: 'PLANET_NOT_OWNED' });
  });

  /** A recall is one decision. Turning a return around again would make the flight unbounded. */
  it('refuses to recall a flight that is already coming home', async () => {
    const launched = await sendTransfer();
    f.clock.advance(2);
    await recallFlight(f.db, launched.missionId, f.clock, f.playerIds[0]!);
    await expect(
      recallFlight(f.db, launched.missionId, f.clock, f.playerIds[0]!),
    ).rejects.toMatchObject({ code: 'NOT_RECALLABLE' });
  });

  it('records where it turned around, so the disc can draw the way back', async () => {
    const launched = await sendTransfer();
    f.clock.advance(3);
    await recallFlight(f.db, launched.missionId, f.clock, f.playerIds[0]!);
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    expect(row?.recalledAt).toBeTruthy();
    expect(row?.recallFrom).toBeTruthy();
    const [origin] = await f.db.select().from(planets).where(eq(planets.id, mine));
    // Somewhere along the leg, not still sitting on the world it left.
    expect(row!.recallFrom!.x).not.toBe(origin!.x);
  });

  /**
   * THE STRIP SAYS WHERE IT IS GOING NOW. Self-review 2026-09-23, R1.
   *
   * The disc already drew the way home, but the pending strip still read "→ Haven, outbound" and
   * focused the old destination — a commander who has just pulled their fleet back to save it is
   * told it is still flying into the raid.
   */
  it('lists a recalled transfer as coming home to the world it left', async () => {
    const launched = await sendTransfer();
    f.clock.advance(3);
    await recallFlight(f.db, launched.missionId, f.clock, f.playerIds[0]!);
    const threads = await pendingThreads(f.db, mine, f.clock.now());
    const thread = threads.find((t) => t.id === launched.missionId);
    expect(thread).toBeDefined();
    expect(thread).toMatchObject({ leg: 'return', targetPlanetId: mine });
    expect(thread?.recallable).toBeUndefined();
  });

  /**
   * A TRANSFER IS ALWAYS NAMED AFTER WHERE IT IS GOING. Same root as R1: the strip reads a transfer
   * as "Transfer → X", and the return-leg flip named a REROUTED leg after the world that turned it
   * away rather than the safe world it is flying to.
   */
  it('names a rerouted transfer after the safe world it is flying to', async () => {
    const launched = await sendTransfer();
    await f.db.update(planets)
      .set({ controllerPlayerId: f.playerIds[1]! })
      .where(eq(planets.id, colony));
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    f.clock.set(new Date(row!.arriveAt.getTime() + 20_000));
    await worker().tick();

    const [leg] = await f.db.select().from(missions)
      .where(eq(missions.parentMissionId, launched.missionId));
    expect(leg).toBeDefined();
    const threads = await pendingThreads(f.db, mine, f.clock.now());
    expect(threads.find((t) => t.id === leg!.id)).toMatchObject({ leg: 'return', targetPlanetId: mine });
  });

  /**
   * THE REROUTE NAMES THE WORLD IT WAS LANDING AT. Self-review 2026-09-23, R8.
   *
   * A recalled flight lands where it left from; if that world was lost while it was in the air it
   * is sent on to a safe world, and the notice has to say which world closed its doors — not the
   * one the fleet turned away from hours ago.
   */
  it('names the world it was landing at when a recalled flight has to go elsewhere', async () => {
    await giveUnits(f.db, colony, { DART: 6 });
    await fuelUp(f.db, colony, 100_000);
    const launched = await launchTransfer(
      f.db, f.playerIds[0]!, colony, mine, { DART: 6 }, EMPTY, f.clock,
    );
    f.clock.advance(3);
    await recallFlight(f.db, launched.missionId, f.clock, f.playerIds[0]!);
    await f.db.update(planets)
      .set({ controllerPlayerId: f.playerIds[1]! })
      .where(eq(planets.id, colony));
    const [row] = await f.db.select().from(missions).where(eq(missions.id, launched.missionId));
    f.clock.set(new Date(row!.arriveAt.getTime() + 20_000));
    await worker().tick();

    const notes = await f.db.select().from(notifications)
      .where(eq(notifications.refId, launched.missionId));
    const rerouted = notes.find((n) => n.payload.trip === 'transfer_rerouted');
    expect(rerouted?.payload).toMatchObject({ reason: 'OWNERSHIP', targetPlanetId: colony });
  });
});

/**
 * THE FIVE MINUTES AFTER A SQUADRON LANDS. Owner plan, Faz 2A.3.
 *
 * Recall and pace together make a fleet very hard to catch, and without a floor they make it
 * IMPOSSIBLE: bounce a wing between two of your own worlds for ever and it is never on the ground
 * when a raid arrives. The counter-play a raider has is the moment of landing, so the landing has
 * to last long enough to be a moment.
 *
 * FIVE MINUTES, AND ON ARRIVAL RATHER THAN ON LAUNCH. Raid waves land fifteen to twenty minutes
 * apart, so five minutes does not break a chase; it closes the bounce, which needs the turnaround
 * to be instant to work at all.
 *
 * A RECALL IS NOT CAUGHT BY IT. Turning a flight around is not launching one, and a commander who
 * could not pull their fleet back because it had just landed somewhere would have the package's
 * whole promise taken away at the worst moment.
 */
describe('the pause after a transfer lands', () => {
  let f: Fixture;
  let mine: string;
  let colony: string;

  const worker = (): EventWorker =>
    new EventWorker(f.db, f.clock, { pollMs: 1, batch: 100, staleMinutes: 5 }, silent);

  beforeEach(async () => {
    f = await seedWorld(3);
    [mine, colony] = f.planetIds as [string, string, string];
    await setLevel(f.db, mine, 'CORE', 8);
    await setLevel(f.db, colony, 'CORE', 8);
    await setLevel(f.db, colony, 'HANGAR', 4);
    await setLevel(f.db, mine, 'HANGAR', 4);
    await grant(f.db, mine, 200_000, 60_000);
    await levelWorld(f.db, f.planetIds);
    await f.db
      .update(planets)
      .set({ controllerPlayerId: f.playerIds[0]!, kind: 'COLONY' })
      .where(eq(planets.id, colony));
    await placeAt(f.db, mine, { x: 0 });
    await placeAt(f.db, colony, { x: 600 });
    await giveUnits(f.db, mine, { DART: 10 });
    await fuelUp(f.db, mine, 200_000);
    await fuelUp(f.db, colony, 200_000);
    f.clock.advance(250);
  });

  const landOne = async (): Promise<void> => {
    const launched = await launchTransfer(
      f.db, f.playerIds[0]!, mine, colony, { DART: 10 }, EMPTY, f.clock,
    );
    f.clock.set(new Date(launched.arriveAt.getTime() + 1_000));
    await worker().tick();
  };

  it('will not launch a second transfer straight back out', async () => {
    await landOne();
    await expect(
      launchTransfer(f.db, f.playerIds[0]!, colony, mine, { DART: 10 }, EMPTY, f.clock),
    ).rejects.toMatchObject({ code: 'TRANSFER_COOLDOWN' });
  });

  it('lets it go again once the pause is over', async () => {
    await landOne();
    f.clock.advance(6);
    await expect(
      launchTransfer(f.db, f.playerIds[0]!, colony, mine, { DART: 10 }, EMPTY, f.clock),
    ).resolves.toBeTruthy();
  });

  /** Reinforcing a world is not a reason it may not fight from there. */
  it('does not stop the world attacking', async () => {
    const other = f.planetIds[2]!;
    await grant(f.db, other, 20_000, 2_000);
    await landOne();
    await expect(
      launchAttack(f.db, colony, other, { DART: 5 }, f.clock, f.playerIds[0]),
    ).resolves.toBeTruthy();
  });

  it('never catches a recall', async () => {
    await landOne();
    await giveUnits(f.db, mine, { DART: 10 });
    const out = await launchTransfer(
      f.db, f.playerIds[0]!, mine, colony, { DART: 10 }, EMPTY, f.clock,
    );
    f.clock.advance(1);
    await expect(
      recallFlight(f.db, out.missionId, f.clock, f.playerIds[0]!),
    ).resolves.toBeTruthy();
  });
});
