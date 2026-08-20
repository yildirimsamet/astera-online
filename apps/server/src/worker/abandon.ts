import { and, eq, inArray, sql } from 'drizzle-orm';
import { fleetCount, fleetEntries, type Fleet } from '@blindspace/rules';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { miningRuns, missions, planets, units } from '../db/schema.js';
import type { EventRow } from './queue.js';
import { clearMissionUnits, fleetOfMission } from '../services/mission.js';
import { notify } from '../services/notifications.js';
import { setUnits } from '../services/planet.js';
import { publishShard } from '../stream/bus.js';

/**
 * WHAT HAPPENS WHEN AN EVENT GIVES UP FOR GOOD. D28.
 *
 * `fail()` retries an event five times and then parks it as `failed`, and until
 * now **nothing in the codebase ever read a `failed` row again**. That was already
 * a leak: `claimMission` flips a mission to `resolved` inside the same transaction
 * that can throw, so a permanently failing handler rolls the mission back to
 * `in_flight` on every attempt and leaves it there — blocking that origin→target
 * pair forever, stranding its units under `location = <missionId>`, and sitting in
 * the pending strip at "0 minutes" for the rest of the season.
 *
 * Flight bays turn that from a slow bleed into a wall: a stranded mission also
 * holds a bay with no path back, so a player can be permanently unable to launch.
 * That is why this is being fixed here rather than left for later.
 *
 * The craft come HOME rather than being destroyed. A handler that cannot run is
 * the server's failure, not the player's, and the conservative reading of an
 * unresolvable flight is that it never happened. `mission_status.cancelled` has
 * existed in the enum since the first migration and has never been written; this
 * is what it was for.
 */

/** Which planet's bay a leg occupies — outbound belongs to its origin, a return to its target. */
const ownerOf = (m: typeof missions.$inferSelect): string =>
  m.kind === 'return' || m.parentMissionId !== null ? m.targetPlanetId : m.originPlanetId;

/**
 * A CRAFT THAT COMES HOME FOR NO REASON THE PLAYER CAN SEE IS A BUG REPORT. D45.
 *
 * Abandoning is the server admitting it could not resolve a flight, and it used to
 * happen in complete silence: units reappeared in the garrison, a bay freed up, the
 * pending strip lost a line, and nothing anywhere said why. From the player's seat
 * that is indistinguishable from a fleet being eaten.
 *
 * It is rare — `/health` reports `failedEvents` and anything above zero is a bug
 * that has already happened — which is exactly why the one person it happened to
 * deserves a sentence.
 */
/**
 * `craftKind` is what the sentence is ABOUT, and a probe is the reason it exists.
 *
 * A probe carries no unit rows — it is built on demand and nothing comes home — so
 * `fleetCount` was 0 and the player was told "0 craft returned · that flight could
 * not be completed": a recall notice reporting the loss of nothing, for a scout
 * that was genuinely lost. The count is the right number and the wrong subject.
 */
async function tellThemItCameBack(
  tx: Tx,
  planetId: string,
  craft: number,
  refId: string,
  at: Date,
  craftKind: 'fleet' | 'probe' = 'fleet',
): Promise<void> {
  const [planet] = await tx
    .select({ playerId: planets.playerId })
    .from(planets)
    .where(eq(planets.id, planetId));
  if (!planet) return;
  await notify(tx, {
    playerId: planet.playerId,
    kind: 'fleet_returned',
    payload: { trip: 'recalled', craft, craftKind },
    at,
    refId,
  });
}

async function abandonMission(db: Db, missionId: string, at: Date): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [mission] = await tx
      .update(missions)
      .set({ status: 'cancelled' })
      .where(and(eq(missions.id, missionId), eq(missions.status, 'in_flight')))
      .returning();
    // Already resolved by a retry that won, or already abandoned. Nothing to undo.
    if (!mission) return false;

    const home = ownerOf(mission);
    const stranded = await fleetOfMission(tx, home, mission.id);
    if (fleetEntries(stranded).length > 0) {
      const current = await tx
        .select()
        .from(units)
        .where(and(eq(units.planetId, home), eq(units.location, 'home')));
      const merged: Fleet = {};
      for (const u of current) merged[u.hull] = u.count;
      for (const [hull, n] of fleetEntries(stranded)) merged[hull] = (merged[hull] ?? 0) + n;
      await clearMissionUnits(tx, home, mission.id);
      await setUnits(tx, home, merged, 'home');
    }
    await tellThemItCameBack(
      tx,
      home,
      fleetCount(stranded),
      mission.id,
      at,
      mission.kind === 'probe' ? 'probe' : 'fleet',
    );
    /**
     * AND THE GALAXY IS TOLD THE CRAFT IS GONE. D53.
     *
     * A cancelled mission leaves `in_flight`, so it drops out of `galaxyTraffic` —
     * which means every other client is drawing a contact that no longer exists.
     * That used to correct itself on a twenty-second poll; the poll is now a
     * sixty-second net under the broadcast, so leaving this out would have made the
     * rarest failure in the game three times more visible than it was before.
     *
     * `arrival` rather than a kind of its own: from every screen but the owner's,
     * a flight ending because it was abandoned and a flight ending because it
     * landed are the same event — a contact that is no longer there.
     */
    await publishShard(tx, mission.seasonId, 'arrival');
    return true;
  });
}

async function abandonMiningRun(db: Db, runId: string, at: Date): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [run] = await tx
      .update(miningRuns)
      .set({ status: 'done' })
      .where(and(eq(miningRuns.id, runId), inArray(miningRuns.status, ['outbound', 'returning'])))
      .returning();
    if (!run) return false;

    const current = await tx
      .select()
      .from(units)
      .where(and(eq(units.planetId, run.planetId), eq(units.location, 'home')));
    const merged: Fleet = {};
    for (const u of current) merged[u.hull] = u.count;
    merged.PROSPECTOR = (merged.PROSPECTOR ?? 0) + run.craft;
    await setUnits(tx, run.planetId, merged, 'home');
    await tx
      .delete(units)
      .where(and(eq(units.planetId, run.planetId), eq(units.location, `mine:${runId}`)));
    await tellThemItCameBack(tx, run.planetId, run.craft, runId, at);
    /** Same reason: the drill is out of the sky, and the disc has to stop drawing it. */
    await publishShard(tx, run.seasonId, 'mining');
    return true;
  });
}

/**
 * Undo whatever a permanently failed event was going to resolve.
 *
 * Returns true if something was actually released, so the caller can say so in the
 * log — a silent abandonment is how this went unnoticed in the first place.
 */
export async function abandon(db: Db, event: EventRow, clock: Clock): Promise<boolean> {
  if (!event.refId) return false;
  switch (event.kind) {
    case 'mission_arrival':
      return abandonMission(db, event.refId, clock.now());
    case 'mining_arrival':
    case 'mining_return':
      return abandonMiningRun(db, event.refId, clock.now());
    default:
      // A radar warning or a season end strands nothing; letting it die is correct.
      return false;
  }
}

/* ── flights with no event at all ───────────────────────────── */

/**
 * How far past its own arrival a flight must be before it counts as stranded.
 *
 * Generous on purpose. A flight is only ever swept when it has NO live event, and
 * the window has to clear every legitimate reason a resolution can be a little
 * late: the worker's poll interval, a five-attempt retry budget, a reaped claim
 * from a killed worker, and a server that was simply down for a moment. Five
 * minutes is far past all of them and far short of a season.
 */
const STRANDED_GRACE_MINUTES = 5;

/**
 * A flight that is past its arrival and has NO live event pointing at it.
 *
 * THE HOLE D28 DID NOT COVER, found in a live galaxy. D46.
 *
 * D28 fixed what happens when an event fails permanently: `abandon()` releases
 * what it held. Every safety net in the system is built on the same assumption —
 * that a flight in the air has an event somewhere. `reap` requeues a claim whose
 * worker died; `fail` retries and then abandons; `/health` counts `failed` rows.
 * All three read the EVENT.
 *
 * So a mission whose event row is simply GONE is invisible to all of them. It sits
 * `in_flight` for the rest of the season, holding a flight bay that can never be
 * freed, its units parked off-planet, blocking its origin-target pair — and
 * `/health` says `ok`, because there is no failed event to count. One was found on
 * a development galaxy thirteen hours past its arrival, and nothing in the running
 * system could have noticed or repaired it.
 *
 * Rows can go missing for boring reasons — a harness that rewrote the queue, a
 * partial restore, a migration run against a live database — and the product
 * answer is the same in every case: the server could not resolve this flight, so
 * the conservative reading is that it never happened. That is exactly what
 * `abandon` already means, so this reuses it rather than inventing a second way
 * for a craft to come home.
 *
 * MATCHED ON THE EVENT'S OWN KIND, not just on `ref_id`. A mission has a
 * `radar_warning` pointing at it as well as its arrival, and a run that has turned
 * for home has a spent `mining_arrival` behind it — either would look like a live
 * event and keep a genuinely stranded flight invisible.
 */
export async function sweepStranded(db: Db, clock: Clock): Promise<number> {
  const now = clock.now();
  const { missions: strandedMissions, runs: strandedRuns } = await strandedFlights(db, now);

  let released = 0;
  for (const id of strandedMissions) if (await abandonMission(db, id, now)) released += 1;
  for (const id of strandedRuns) if (await abandonMiningRun(db, id, now)) released += 1;
  return released;
}

/**
 * The two queries, in one place, so the sweep and the health check can never
 * disagree about what "stranded" means.
 *
 * RAW SQL WITH AN ISO STRING AND AN EXPLICIT CAST, and that is not a style choice:
 * `architecture.md` records that **Drizzle's `sql` template cannot bind a JS
 * `Date` through postgres.js**. The driver is handed the object and throws
 * `The "string" argument must be of type string`. Writing the instant out and
 * casting it is the shape that works.
 *
 * MATCHED ON THE EVENT'S OWN KIND, not just on `ref_id`. A mission has a
 * `radar_warning` pointing at it as well as its arrival, and a run that has turned
 * for home has a spent `mining_arrival` behind it — either would look like a live
 * event and keep a genuinely stranded flight invisible.
 */
async function strandedFlights(
  db: Db,
  now: Date,
): Promise<{ missions: string[]; runs: string[] }> {
  const cutoff = new Date(now.getTime() - STRANDED_GRACE_MINUTES * 60_000).toISOString();

  const missionRows = await db.execute<{ id: string }>(sql`
    select m.id from missions m
    where m.status = 'in_flight'
      and m.arrive_at < ${cutoff}::timestamptz
      and not exists (
        select 1 from scheduled_events e
        where e.ref_id = m.id and e.kind = 'mission_arrival'
          and e.status in ('pending', 'processing'))
  `);

  /**
   * A run is due at `arrive_at` on the way out and at `home_at` on the way back,
   * and `home_at` is NULL until it turns — so `coalesce` picks whichever leg it is
   * actually on rather than measuring an outbound run against a time it has not
   * been given yet.
   */
  const runRows = await db.execute<{ id: string }>(sql`
    select r.id from mining_runs r
    where r.status in ('outbound', 'returning')
      and coalesce(r.home_at, r.arrive_at) < ${cutoff}::timestamptz
      and not exists (
        select 1 from scheduled_events e
        where e.ref_id = r.id and e.kind in ('mining_arrival', 'mining_return')
          and e.status in ('pending', 'processing'))
  `);

  return { missions: missionRows.map((r) => r.id), runs: runRows.map((r) => r.id) };
}

/**
 * How many flights are stranded right now, for `/health` to shout about.
 *
 * A separate read rather than a by-product of the sweep, because health must be
 * able to report the number on an API-only process that runs no worker at all.
 */
export async function strandedFlightCount(db: Db, now: Date): Promise<number> {
  const { missions: m, runs: r } = await strandedFlights(db, now);
  return m.length + r.length;
}
