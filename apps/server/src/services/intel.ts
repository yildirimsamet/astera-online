import { and, desc, eq, gt, inArray, isNotNull, ne, or } from 'drizzle-orm';
import {
  PROBE,
  bearingBetween,
  detectChance,
  fuzzBand,
  probeAccuracy,
  distance,
  fleetCount,
  fleetValue,
  radarRevealsBearing,
  radarRevealsOrigin,
  telescopeCooldownHours,
  telescopeRange,
  telescopeReading,
  telescopeSeed,
  telescopeSlots,
  travelMinutes,
  withinTelescopeRange,
  type Bearing,
  type FleetStatus,
  type HullId,
  INSTRUMENT_IDS,
  type InstrumentId,
  type InstrumentLevels,
  type TelescopeReading,
} from '@blindspace/rules';
import { addMinutes, minutesSince, type Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import {
  missions,
  planets,
  players,
  probeReports,
  satellites,
  scanEvents,
  seasons,
  units,
  watches,
} from '../db/schema.js';
import { assertFreeBay } from './flight.js';
import { announceUnlocks } from './notifications.js';
import { GameError, buildingLevelsOf, loadLocked, saveResources } from './planet.js';
import { schedule } from '../worker/queue.js';
import { publishShard } from '../stream/bus.js';

/* ── satellite levels ───────────────────────────────────────── */

export async function instrumentLevels(
  tx: Queryable,
  planetIds: readonly string[],
): Promise<Map<string, InstrumentLevels>> {
  const out = new Map<string, InstrumentLevels>();
  if (planetIds.length === 0) return out;
  const rows = await tx
    .select()
    .from(satellites)
    .where(inArray(satellites.planetId, [...planetIds]));
  for (const r of rows) {
    // The table also holds orbit satellites (D25); those carry no level anyone
    // reads, and a row naming something retired belongs to neither list.
    if (!KNOWN_INSTRUMENTS.has(r.type)) continue;
    const entry = out.get(r.planetId) ?? {};
    entry[r.type as InstrumentId] = r.level;
    out.set(r.planetId, entry);
  }
  return out;
}

const KNOWN_INSTRUMENTS = new Set<string>(INSTRUMENT_IDS);

export const levelOf = (
  levels: Map<string, InstrumentLevels>,
  planetId: string,
  type: InstrumentId,
): number => levels.get(planetId)?.[type] ?? 0;

/* ── ground truth: is their fleet home? ─────────────────────── */

export interface FleetTruth {
  status: FleetStatus;
  /** Wall-clock time the fleet is expected back, if it is out. */
  expectedHomeAt: Date | null;
}

/**
 * The single most valuable fact in the game.
 *
 * "Away" means literally that: units belonging to this planet are not at home.
 * Anything cleverer — a percentage threshold, a value comparison — would make the
 * telescope lie in edge cases, and the whole design rests on this signal being
 * true-but-hard-to-obtain rather than approximate.
 */
export async function fleetTruthFor(
  tx: Queryable,
  planetIds: readonly string[],
  now: Date,
): Promise<Map<string, FleetTruth>> {
  const out = new Map<string, FleetTruth>();
  for (const id of planetIds) out.set(id, { status: 'HOME', expectedHomeAt: null });
  if (planetIds.length === 0) return out;

  const away = await tx
    .select({ planetId: units.planetId })
    .from(units)
    .where(
      and(
        inArray(units.planetId, [...planetIds]),
        ne(units.location, 'home'),
        gt(units.count, 0),
        /**
         * A Prospector is not a fleet. D19.
         *
         * The telescope sells exactly one fact — is the COMBAT fleet home — and a
         * mining craft leaving must not make a planet read `AWAY`. Without this
         * line, sending a Prospector at a passing rock would advertise a planet as
         * undefended while its whole garrison sat there, and the most valuable
         * signal in the game would quietly become approximate.
         */
        ne(units.hull, 'PROSPECTOR'),
      ),
    )
    .groupBy(units.planetId);

  if (away.length === 0) return out;
  const awayIds = away.map((r) => r.planetId);
  for (const id of awayIds) out.set(id, { status: 'AWAY', expectedHomeAt: null });

  // Expected return: a return leg already exists, or an outbound attack will
  // become one after it lands. Only shown at FULL clarity.
  const inFlight = await tx
    .select()
    .from(missions)
    .where(and(inArray(missions.originPlanetId, awayIds), eq(missions.status, 'in_flight')));
  const returning = await tx
    .select()
    .from(missions)
    .where(and(inArray(missions.targetPlanetId, awayIds), eq(missions.status, 'in_flight')));

  for (const m of returning) {
    if (m.kind !== 'return') continue;
    const cur = out.get(m.targetPlanetId);
    if (cur && (!cur.expectedHomeAt || m.arriveAt < cur.expectedHomeAt)) {
      out.set(m.targetPlanetId, { status: 'AWAY', expectedHomeAt: m.arriveAt });
    }
  }
  for (const m of inFlight) {
    if (m.kind !== 'attack') continue;
    const cur = out.get(m.originPlanetId);
    if (!cur || cur.expectedHomeAt) continue;
    // It has not turned around yet; the round trip is symmetric.
    const back = new Date(m.arriveAt.getTime() + (m.arriveAt.getTime() - m.departAt.getTime()));
    out.set(m.originPlanetId, { status: 'AWAY', expectedHomeAt: back });
  }

  void now;
  return out;
}

/* ── telescope ──────────────────────────────────────────────── */

export interface WatchView {
  slot: number;
  targetPlanetId: string;
  targetName: string;
  ownerName: string;
  reading: TelescopeReading;
  /** When this slot may be re-pointed. Null means now. D18. */
  cooldownUntil: Date | null;
}

/**
 * Assign a telescope slot.
 *
 * THREE GATES, not one (D18). Slots come from telescope level, and on top of that
 * the target has to be within range and the slot has to be off cooldown.
 *
 * All three are enforced HERE, server-side, for the same reason the clarity
 * gradient is: the shipped version had only the slot check, so a Telescope L1
 * could read the fleet status of every planet in the galaxy in thirty seconds by
 * moving its single slot down the list. That is not a fog, it is a button, and it
 * made the entire clarity gradient optional.
 */
export async function assignWatch(
  db: Db,
  observerPlanetId: string,
  targetPlanetId: string,
  slot: number,
  clock: Clock,
): Promise<{ slot: number; targetPlanetId: string; cooldownUntil: Date | null }> {
  if (observerPlanetId === targetPlanetId) {
    throw new GameError('SELF_WATCH', 'You already know what your own fleet is doing');
  }

  return db.transaction(async (tx) => {
    const observer = await loadLocked(tx, observerPlanetId, clock);
    const level = observer.instruments.TELESCOPE ?? 0;
    if (level < 1) throw new GameError('NO_TELESCOPE', 'Install a Telescope first', 403);

    const slots = telescopeSlots(level);
    if (!Number.isInteger(slot) || slot < 0 || slot >= slots) {
      throw new GameError('BAD_SLOT', `Telescope L${level} can watch ${slots} planet(s)`);
    }

    const [target] = await tx.select().from(planets).where(eq(planets.id, targetPlanetId));
    if (!target) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);
    if (target.seasonId !== observer.seasonId) {
      throw new GameError('CROSS_SEASON', 'That planet is in another galaxy');
    }

    const reach = distance(observer, target);
    if (!withinTelescopeRange(level, reach)) {
      throw new GameError(
        'OUT_OF_RANGE',
        `Telescope L${level} reaches ${Math.round(telescopeRange(level))} units; that world is ${Math.round(reach)} away`,
      );
    }

    const [existing] = await tx
      .select()
      .from(watches)
      .where(and(eq(watches.observerPlayerId, observer.playerId), eq(watches.slot, slot)));

    // Re-pointing at what the slot already watches is a no-op, not a purchase.
    // Charging a day's cooldown for a double-tap would be indefensible.
    if (existing?.targetPlanetId === targetPlanetId) {
      return { slot, targetPlanetId, cooldownUntil: existing.cooldownUntil };
    }

    const now = observer.now;
    if (existing?.cooldownUntil && existing.cooldownUntil > now) {
      const minutes = Math.ceil((existing.cooldownUntil.getTime() - now.getTime()) / 60_000);
      throw new GameError(
        'SLOT_COOLING',
        `That slot is still realigning — ${String(minutes)} minutes left`,
        409,
      );
    }

    /**
     * Filling an EMPTY slot is free; moving an occupied one costs the cooldown.
     *
     * The price is changing your mind, not looking — so a player who has just
     * installed their first telescope is never made to wait before using it, and a
     * player who wants to sweep the galaxy pays for every step of the sweep.
     */
    const cooldownUntil = existing
      ? addMinutes(now, telescopeCooldownHours(level) * 60)
      : null;

    await tx
      .insert(watches)
      .values({ observerPlayerId: observer.playerId, slot, targetPlanetId, cooldownUntil })
      // Re-pointing a slot discards its confirmation history — you are looking at
      // something new, so nothing is "last confirmed" about it.
      .onConflictDoUpdate({
        target: [watches.observerPlayerId, watches.slot],
        set: { targetPlanetId, lastStatus: null, lastConfirmedAt: null, cooldownUntil },
      });

    // "I can't tell if he's rich." Pointing a telescope at somebody is the moment
    // the Explorer becomes worth having, and it is where Design Law #2 says to
    // announce it. Guarded by `unlocksSeen`, so re-pointing announces nothing.
    await announceUnlocks(tx, observer.playerId, now);

    return { slot, targetPlanetId, cooldownUntil };
  });
}

/**
 * Read every telescope this player has pointed at something.
 *
 * The gradient is applied HERE, server-side. The response never contains the true
 * status when clarity does not permit it — a modified client has nothing to strip.
 */
export async function readTelescopes(
  db: Db,
  playerId: string,
  clock: Clock,
): Promise<WatchView[]> {
  const rows = await db
    .select({
      watch: watches,
      planet: planets,
      owner: players.name,
    })
    .from(watches)
    .innerJoin(planets, eq(watches.targetPlanetId, planets.id))
    .innerJoin(players, eq(planets.playerId, players.id))
    .where(eq(watches.observerPlayerId, playerId));

  if (rows.length === 0) return [];

  const [me] = await db.select().from(players).where(eq(players.id, playerId));
  if (!me) throw new GameError('PLAYER_NOT_FOUND', 'No such player', 404);
  const [myPlanet] = await db.select().from(planets).where(eq(planets.playerId, playerId));
  const [season] = await db.select().from(seasons).where(eq(seasons.id, me.seasonId));
  if (!myPlanet || !season) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);

  const now = clock.now();
  const nowMinutes = minutesSince(season.startsAt, now);
  const targetIds = rows.map((r) => r.planet.id);

  const [levels, truth] = await Promise.all([
    instrumentLevels(db, [myPlanet.id, ...targetIds]),
    fleetTruthFor(db, targetIds, now),
  ]);
  const myTelescope = levelOf(levels, myPlanet.id, 'TELESCOPE');

  const views: WatchView[] = [];
  for (const row of rows) {
    const target = row.planet;
    const veil = levelOf(levels, target.id, 'VEIL');
    const t = truth.get(target.id) ?? { status: 'HOME' as const, expectedHomeAt: null };

    const sinceConfirmed = row.watch.lastConfirmedAt
      ? Math.max(0, (now.getTime() - row.watch.lastConfirmedAt.getTime()) / 60_000)
      : 0;
    const eta = t.expectedHomeAt
      ? Math.max(0, Math.round((t.expectedHomeAt.getTime() - now.getTime()) / 60_000))
      : null;

    const reading = telescopeReading(
      myTelescope,
      veil,
      t.status,
      sinceConfirmed,
      eta,
      // Stable within its window: refreshing cannot improve the answer.
      telescopeSeed(`${row.watch.observerPlayerId}:${String(row.watch.slot)}`, nowMinutes),
    );

    if (reading.status !== 'UNKNOWN') {
      const confirmedAt = addMinutes(now, -reading.staleMinutes);
      /**
       * A READ THAT WRITES, THROTTLED TO WHAT THE READ ACTUALLY MEANS. D52.
       *
       * At CLEAR and FULL `staleMinutes` is always zero, so `confirmedAt` is always
       * `now` and this fired on EVERY call — which was tolerable while `/api/galaxy`
       * only refetched on window focus, and stopped being tolerable when it started
       * polling so that a reading labelled `live` is actually live. One row per
       * watched world per request, per player.
       *
       * The column exists so the INTERMITTENT and DEGRADED tiers can say how many
       * MINUTES old a reading is. A quarter of a minute of granularity is invisible
       * in every arithmetic that reads it — `staleness()` renders anything under a
       * minute as "live" — and it drops the write rate by whatever the poll interval
       * happens to be.
       */
      const advance = confirmedAt.getTime() - (row.watch.lastConfirmedAt?.getTime() ?? -Infinity);
      if (advance >= CONFIRM_GRANULARITY_MS) {
        await db
          .update(watches)
          .set({ lastStatus: reading.status, lastConfirmedAt: confirmedAt })
          .where(
            and(
              eq(watches.observerPlayerId, row.watch.observerPlayerId),
              eq(watches.slot, row.watch.slot),
            ),
          );
      }
    }

    views.push({
      slot: row.watch.slot,
      targetPlanetId: target.id,
      targetName: target.name,
      ownerName: row.owner,
      reading,
      cooldownUntil: row.watch.cooldownUntil,
    });
  }
  return views;
}

/** How much a confirmation has to move before it is worth a write. See above. */
const CONFIRM_GRANULARITY_MS = 15_000;

/* ── explorer ───────────────────────────────────────────────── */

export interface ProbeLaunch {
  missionId: string;
  arriveAt: Date;
  flightMinutes: number;
}

/**
 * Send a probe. Costs alloy and time, and MAY be detected.
 *
 * This is the decision the whole information layer exists to create: strike blind
 * now, or spend seven minutes to know — and accept that knowing may announce you.
 */
export async function launchProbe(
  db: Db,
  originPlanetId: string,
  targetPlanetId: string,
  clock: Clock,
): Promise<ProbeLaunch> {
  if (originPlanetId === targetPlanetId) {
    throw new GameError('SELF_PROBE', 'You already know what is on your own planet');
  }

  return db.transaction(async (tx) => {
    const origin = await loadLocked(tx, originPlanetId, clock);
    if (origin.alloy < PROBE.alloy || origin.crystal < PROBE.crystal) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources for a probe');
    }

    const [target] = await tx.select().from(planets).where(eq(planets.id, targetPlanetId));
    if (!target) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);
    if (target.seasonId !== origin.seasonId) {
      throw new GameError('CROSS_SEASON', 'That planet is in another galaxy');
    }

    /**
     * TWO LIMITS ON SCOUTING, both owner decisions.
     *
     * Counted under the origin planet's lock, so two probes launched at the same
     * instant cannot both see a clear board and both pass — the second blocks here
     * and re-reads a row the first has already written.
     *
     * Return legs count. A probe on its way home is still a craft you have not got
     * back, and letting the cap reset at the halfway point would make it a cap on
     * outbound distance rather than on how much you may have in the air.
     */
    const inFlight = await tx
      .select({ targetPlanetId: missions.targetPlanetId, originPlanetId: missions.originPlanetId })
      .from(missions)
      .where(
        and(
          eq(missions.kind, 'probe'),
          eq(missions.status, 'in_flight'),
          or(
            eq(missions.originPlanetId, originPlanetId),
            eq(missions.targetPlanetId, originPlanetId),
          ),
        ),
      );

    /**
     * The probe cap is now the general flight-slot rule. D28.
     *
     * `PROBE.maxInFlight` was a special case that rationed one craft type and left
     * mining and raiding unrationed; a bay is the same scarcity applied to
     * everything that leaves the ground. The `inFlight` rows above are still
     * needed — the one-probe-per-target rule below reads them.
     */
    await assertFreeBay(tx, originPlanetId, origin.buildings.CORE);

    // One probe per target at a time. A second one launched before the first
    // reports would buy nothing — the answer is already on its way — and it is the
    // cheapest way to turn a banded reading into a precise one by averaging.
    const already = inFlight.some(
      (m) => m.targetPlanetId === targetPlanetId || m.originPlanetId === targetPlanetId,
    );
    if (already) {
      throw new GameError(
        'PROBE_ALREADY_OUT',
        'You already have a probe working that planet',
        409,
      );
    }

    const dist = distance(origin, target);
    const flightMinutes = travelMinutes(dist, PROBE.speed);
    const arriveAt = addMinutes(origin.now, flightMinutes);

    await saveResources(tx, originPlanetId, {
      alloy: origin.alloy - PROBE.alloy,
      crystal: origin.crystal - PROBE.crystal,
    });

    const [mission] = await tx
      .insert(missions)
      .values({
        seasonId: origin.seasonId,
        kind: 'probe',
        originPlanetId,
        targetPlanetId,
        fleet: {},
        distance: dist,
        departAt: origin.now,
        arriveAt,
      })
      .returning();

    await schedule(tx, {
      seasonId: origin.seasonId,
      kind: 'mission_arrival',
      refId: mission!.id,
      resolveAt: arriveAt,
    });

    /**
     * A PROBE IS A CRAFT IN THE AIR, AND THE DISC SHOWS IT. D53.
     *
     * `galaxyTraffic` publishes it as a `probe` contact to everyone but its owner,
     * so the galaxy is told the same way a raid is. What it is NOT told is who
     * launched it or where it is going — a contact carries a bearing window and
     * nothing else, and "probing is loud" stays a fact the TARGET is told by their
     * own instruments, never one the disc gives away.
     */
    await publishShard(tx, origin.seasonId, 'launch');

    return { missionId: mission!.id, arriveAt, flightMinutes };
  });
}

/** Snapshot the target and write both sides of the event. Called by the worker. */
export async function resolveProbe(
  tx: Tx,
  mission: typeof missions.$inferSelect,
  now: Date,
  rng: () => number,
): Promise<{ detected: boolean; bearing: Bearing }> {
  const [origin] = await tx.select().from(planets).where(eq(planets.id, mission.originPlanetId));
  const [target] = await tx.select().from(planets).where(eq(planets.id, mission.targetPlanetId));
  if (!origin || !target) throw new Error('probe references a missing planet');

  const levels = await instrumentLevels(tx, [target.id]);
  const veil = levelOf(levels, target.id, 'VEIL');
  const radar = levelOf(levels, target.id, 'RADAR');

  // Shipyard level supplies both probe accuracy and probe stealth.
  const originBuildings = await buildingLevelsOf(tx, mission.originPlanetId);
  const shipyard = originBuildings.SHIPYARD;

  const unitRows = await tx.select().from(units).where(eq(units.planetId, target.id));
  const home: Record<string, number> = {};
  let anyAway = false;
  for (const u of unitRows) {
    if (u.count <= 0) continue;
    if (u.location === 'home') home[u.hull] = (home[u.hull] ?? 0) + u.count;
    else anyAway = true;
  }
  const homeFleet = home as Partial<Record<HullId, number>>;

  const accuracy = probeAccuracy(shipyard, veil);
  const stock = fuzzBand(target.alloy + target.crystal, accuracy, rng);
  const defence = fuzzBand(fleetValue(homeFleet), accuracy, rng);
  const size = fuzzBand(fleetCount(homeFleet), accuracy, rng);

  const detected = rng() < detectChance(radar, shipyard);
  const bearing = bearingBetween(target, origin);

  await tx.insert(probeReports).values({
    observerPlayerId: origin.playerId,
    targetPlanetId: target.id,
    missionId: mission.id,
    accuracy,
    stock: { low: stock.low, high: stock.high },
    defence: { low: defence.low, high: defence.high },
    fleetSize: { low: size.low, high: size.high },
    fleetHome: !anyAway,
    detected,
    createdAt: now,
    // Written, but not readable until the craft is home. The snapshot is of this
    // instant — that is what was measured, and it is what the target's radar had
    // its chance against — but the observer learns none of it yet.
    deliveredAt: null,
  });

  // The target's radar log always gets a row; what the target may READ from it is
  // decided at read time by their radar level, never here.
  await tx.insert(scanEvents).values({
    targetPlanetId: target.id,
    originPlanetId: origin.id,
    detected,
    bearing,
    createdAt: now,
  });

  return { detected, bearing };
}

/* ── radar log ──────────────────────────────────────────────── */

export interface ScanView {
  at: Date;
  /** Only from Radar L2. */
  bearing: Bearing | null;
  /** Only from Radar L5. */
  originPlanetName: string | null;
}

/**
 * What a defender may read from their own radar log.
 *
 * The filtering happens in this function, not in the client. Below L5 the origin
 * is never placed in the response at all — there is nothing for a modified client
 * to reveal.
 */
export async function readRadarLog(
  db: Db,
  planetId: string,
  limit = 20,
): Promise<ScanView[]> {
  const levels = await instrumentLevels(db, [planetId]);
  const radar = levelOf(levels, planetId, 'RADAR');

  const rows = await db
    .select({ scan: scanEvents, originName: planets.name })
    .from(scanEvents)
    .innerJoin(planets, eq(scanEvents.originPlanetId, planets.id))
    .where(and(eq(scanEvents.targetPlanetId, planetId), eq(scanEvents.detected, true)))
    .orderBy(desc(scanEvents.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    at: r.scan.createdAt,
    bearing: radarRevealsBearing(radar) ? (r.scan.bearing as Bearing | null) : null,
    originPlanetName: radarRevealsOrigin(radar) ? r.originName : null,
  }));
}

/** Only what has actually come home. A probe in flight tells you nothing yet. */
export async function readProbeReports(db: Db, playerId: string, limit = 10) {
  return db
    .select({ report: probeReports, targetName: planets.name })
    .from(probeReports)
    .innerJoin(planets, eq(probeReports.targetPlanetId, planets.id))
    .where(
      and(eq(probeReports.observerPlayerId, playerId), isNotNull(probeReports.deliveredAt)),
    )
    .orderBy(desc(probeReports.createdAt))
    .limit(limit);
}
