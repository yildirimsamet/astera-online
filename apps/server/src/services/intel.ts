import { and, desc, eq, gt, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  COMBAT_RESEARCH_PROJECTS,
  PROBE,
  DEATH_STAR,
  bearingBetween,
  detectChance,
  fuzzBand,
  computeLoot,
  raidableStock,
  vaultProtects,
  probeAccuracy,
  distance,
  fleetCount,
  fleetValue,
  radarRevealsBearing,
  radarRevealsOrigin,
  telescopeCooldownHours,
  telescopeReading,
  telescopeSeed,
  telescopeSlots,
  telescopeWatchRange,
  satelliteSlots,
  travelExact,
  withinTelescopeRange,
  seededFrom,
  type Bearing,
  type FleetStatus,
  type HullId,
  INSTRUMENT_IDS,
  type InstrumentId,
  type InstrumentLevels,
  type TelescopeReading,
} from '@astera/rules';
import { addMinutes, minutesSince, type Clock } from '../clock.js';
import type { Db, Queryable, Tx } from '../db/client.js';
import {
  accounts,
  buildings,
  missions,
  planets,
  players,
  probeReports,
  probeWorldMemories,
  satellites,
  scanEvents,
  seasons,
  strategicAssets,
  units,
  watches,
} from '../db/schema.js';
import { assertFreeBay } from './flight.js';
import { announceUnlocks } from './notifications.js';
import {
  assertSeasonOpenThrough,
  assertWorldOperational,
  GameError,
  buildingLevelsOf,
  loadLocked,
  saveResources,
} from './planet.js';
import { schedule } from '../worker/queue.js';
import { publishShard, publishWorldMemory } from '../stream/bus.js';
import { researchLevels } from './researchState.js';
import { publicWorlds, silhouetteOf } from './publicGalaxy.js';
import { lockWorlds } from './ownership.js';
import { assertClanHostilityAllowed, lockClanPlayers } from './clanCombat.js';

/* ── satellite levels ───────────────────────────────────────── */

export async function instrumentLevels(
  tx: Queryable,
  planetIds: readonly string[],
): Promise<Map<string, InstrumentLevels>> {
  const out = new Map<string, InstrumentLevels>();
  if (planetIds.length === 0) return out;
  const [rows, coreRows] = await Promise.all([
    tx.select().from(satellites).where(inArray(satellites.planetId, [...planetIds])),
    tx.select({ planetId: buildings.planetId, level: buildings.level })
      .from(buildings)
      .where(and(inArray(buildings.planetId, [...planetIds]), eq(buildings.type, 'CORE'))),
  ]);
  const coreByPlanet = new Map(coreRows.map((row) => [row.planetId, row.level]));
  const activeUplink = new Set<string>();
  for (const planetId of planetIds) {
    const core = coreByPlanet.get(planetId) ?? 0;
    const active = rows
      .filter((row) => row.planetId === planetId && !KNOWN_INSTRUMENTS.has(row.type))
      .toSorted((a, b) => a.slot - b.slot)
      .slice(0, satelliteSlots(core));
    if (active.some((row) => row.type === 'UPLINK')) activeUplink.add(planetId);
  }
  for (const r of rows) {
    // The table also holds orbit satellites (D25); those carry no level anyone
    // reads, and a row naming something retired belongs to neither list.
    if (!KNOWN_INSTRUMENTS.has(r.type)) continue;
    const entry = out.get(r.planetId) ?? {};
    const core = coreByPlanet.get(r.planetId) ?? 0;
    const gated = (r.type === 'TELESCOPE' || r.type === 'RADAR') && !activeUplink.has(r.planetId);
    entry[r.type as InstrumentId] = gated ? 0 : Math.min(r.level, core);
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
  observerPlanetId: string;
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
  expectedPlayerId?: string,
): Promise<{ slot: number; targetPlanetId: string; cooldownUntil: Date | null }> {
  if (observerPlanetId === targetPlanetId) {
    throw new GameError('SELF_WATCH', 'You already know what your own fleet is doing');
  }

  return db.transaction(async (tx) => {
    await lockWorlds(tx, [observerPlanetId, targetPlanetId]);
    const observer = await loadLocked(tx, observerPlanetId, clock, { expectedPlayerId });
    const level = observer.effectiveInstruments.TELESCOPE ?? 0;
    if (level < 1) throw new GameError('NO_TELESCOPE', 'Install a Telescope first', 403);

    const slots = telescopeSlots(level);
    if (!Number.isInteger(slot) || slot < 0 || slot >= slots) {
      throw new GameError('BAD_SLOT', `Telescope L${level} can watch ${slots} planet(s)`, 400, {
        level,
        slots,
      });
    }

    const [target] = await tx.select().from(planets).where(eq(planets.id, targetPlanetId));
    if (!target) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);
    if (target.seasonId !== observer.seasonId) {
      throw new GameError('CROSS_SEASON', 'That planet is in another galaxy');
    }

    const reach = distance(observer, target);
    if (!withinTelescopeRange(level, reach)) {
      const effectiveReach = telescopeWatchRange(level);
      throw new GameError(
        'OUT_OF_RANGE',
        `Telescope L${level} reaches ${Math.round(effectiveReach)} units; that world is ${Math.round(reach)} away`,
        400,
        { level, reach: Math.round(effectiveReach), distance: Math.round(reach) },
      );
    }

    const [existing] = await tx
      .select()
      .from(watches)
      .where(and(eq(watches.observerPlanetId, observer.planetId), eq(watches.slot, slot)));

    // Re-pointing at what the slot already watches is a no-op, not a purchase.
    // Charging a day's cooldown for a double-tap would be indefensible.
    if (existing?.targetPlanetId === targetPlanetId) {
      return { slot, targetPlanetId, cooldownUntil: existing.cooldownUntil };
    }

    /**
     * One target, one answer per commander.
     *
     * INTERMITTENT is a deterministic uncertainty roll per assignment window. A
     * second slot aimed at the same target created a second independent roll, so
     * three slots turned a 75% confirmation chance into 98% without improving an
     * instrument. The target world is already row-locked above; assignments from
     * two controlled worlds therefore serialize on the same lock and cannot race
     * this check.
     */
    const [duplicate] = await tx
      .select({ observerPlanetId: watches.observerPlanetId, slot: watches.slot })
      .from(watches)
      .innerJoin(planets, and(
        eq(planets.id, watches.observerPlanetId),
        eq(planets.controllerPlayerId, observer.playerId),
      ))
      .where(and(
        eq(watches.observerPlayerId, observer.playerId),
        eq(watches.targetPlanetId, targetPlanetId),
      ))
      .limit(1);
    if (duplicate) {
      throw new GameError(
        'TARGET_ALREADY_WATCHED',
        'Another Telescope slot is already watching that world',
        409,
      );
    }

    const now = observer.now;
    if (existing?.cooldownUntil && existing.cooldownUntil > now) {
      const minutes = Math.ceil((existing.cooldownUntil.getTime() - now.getTime()) / 60_000);
      throw new GameError(
        'SLOT_COOLING',
        `That slot is still realigning — ${String(minutes)} minutes left`,
        409,
        { minutes },
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
      .values({
        observerPlayerId: observer.playerId,
        observerPlanetId: observer.planetId,
        slot,
        targetPlanetId,
        cooldownUntil,
      })
      // Re-pointing a slot discards its confirmation history — you are looking at
      // something new, so nothing is "last confirmed" about it.
      .onConflictDoUpdate({
        target: [watches.observerPlanetId, watches.slot],
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
  const observerPlanet = alias(planets, 'watch_observer');
  const rows = await db
    .select({
      watch: watches,
      observer: observerPlanet,
      planet: planets,
      owner: accounts.displayName,
    })
    .from(watches)
    .innerJoin(observerPlanet, eq(watches.observerPlanetId, observerPlanet.id))
    .innerJoin(planets, eq(watches.targetPlanetId, planets.id))
    .leftJoin(players, eq(planets.controllerPlayerId, players.id))
    .leftJoin(accounts, eq(players.accountId, accounts.id))
    .where(and(
      eq(watches.observerPlayerId, playerId),
      // A watch belongs to the commander, not to a world forever. If that world
      // changes hands, its former controller must stop receiving live readings.
      eq(observerPlanet.controllerPlayerId, playerId),
    ));

  if (rows.length === 0) return [];

  const [me] = await db.select().from(players).where(eq(players.id, playerId));
  if (!me) throw new GameError('PLAYER_NOT_FOUND', 'No such player', 404);
  const [season] = await db.select().from(seasons).where(eq(seasons.id, me.seasonId));
  if (!season) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);

  const now = clock.now();
  const nowMinutes = minutesSince(season.startsAt, now);
  const observerIds = [...new Set(rows.map((r) => r.watch.observerPlanetId))];
  const targetIds = rows.map((r) => r.planet.id);
  const levels = await instrumentLevels(db, [...observerIds, ...targetIds]);

  /**
   * STORED AIM IS NOT CURRENT AUTHORISATION.
   *
   * Watches deliberately survive temporary hardware loss so restoring an Uplink
   * restores the commander's chosen targets. The stored rows therefore cannot be
   * returned blindly: current effective level, current slot count, current season
   * and current distance are all rechecked on every read. Otherwise lowering a
   * Core, losing an Uplink, shrinking a Telescope or losing the observer world
   * would leave an old row leaking live fleet truth indefinitely.
   */
  const eligibleRows = rows.filter((row) => {
    const level = levelOf(levels, row.watch.observerPlanetId, 'TELESCOPE');
    return row.observer.seasonId === me.seasonId
      && row.planet.seasonId === me.seasonId
      && level >= 1
      && row.watch.slot >= 0
      && row.watch.slot < telescopeSlots(level)
      && withinTelescopeRange(level, distance(row.observer, row.planet));
  });
  if (eligibleRows.length === 0) return [];

  /**
   * Repair the read boundary for rows created before target uniqueness existed.
   * Keep the strongest eligible instrument; stable world/slot tiebreakers make
   * repeated reads choose the same assignment. The hidden legacy slot can then be
   * re-pointed normally, while it can never buy a second uncertainty roll.
   */
  eligibleRows.sort((a, b) => {
    const byLevel = levelOf(levels, b.watch.observerPlanetId, 'TELESCOPE')
      - levelOf(levels, a.watch.observerPlanetId, 'TELESCOPE');
    if (byLevel !== 0) return byLevel;
    const byWorld = a.watch.observerPlanetId.localeCompare(b.watch.observerPlanetId);
    return byWorld !== 0 ? byWorld : a.watch.slot - b.watch.slot;
  });
  const seenTargets = new Set<string>();
  const eligible = eligibleRows.filter((row) => {
    if (seenTargets.has(row.planet.id)) return false;
    seenTargets.add(row.planet.id);
    return true;
  });

  const truth = await fleetTruthFor(db, eligible.map((r) => r.planet.id), now);
  const views: WatchView[] = [];
  for (const row of eligible) {
    const myTelescope = levelOf(levels, row.watch.observerPlanetId, 'TELESCOPE');
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
      // Slots are world-local. Two colonies can both own slot zero, so the world
      // id is part of the watch identity; seeding from player+slot correlated
      // otherwise independent watches and made their fog change in lockstep.
      telescopeSeed(`${row.watch.observerPlanetId}:${String(row.watch.slot)}`, nowMinutes),
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
              eq(watches.observerPlanetId, row.watch.observerPlanetId),
              eq(watches.slot, row.watch.slot),
            ),
          );
      }
    }

    views.push({
      observerPlanetId: row.watch.observerPlanetId,
      slot: row.watch.slot,
      targetPlanetId: target.id,
      targetName: target.name,
      ownerName: row.owner ?? `Neutral ${target.name}`,
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
  expectedPlayerId?: string,
): Promise<ProbeLaunch> {
  if (originPlanetId === targetPlanetId) {
    throw new GameError('SELF_PROBE', 'You already know what is on your own planet');
  }

  return db.transaction(async (tx) => {
    await lockWorlds(tx, [originPlanetId, targetPlanetId]);
    const origin = await loadLocked(tx, originPlanetId, clock, { expectedPlayerId });
    assertWorldOperational(origin);
    if (origin.alloy < PROBE.alloy || origin.crystal < PROBE.crystal) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources for a probe', 400, {
        context: 'probe',
      });
    }

    const [target] = await tx.select().from(planets).where(eq(planets.id, targetPlanetId));
    if (!target) throw new GameError('PLANET_NOT_FOUND', 'No such planet', 404);
    if (target.seasonId !== origin.seasonId) {
      throw new GameError('CROSS_SEASON', 'That planet is in another galaxy');
    }
    if (target.controllerPlayerId) {
      await lockClanPlayers(tx, [origin.playerId, target.controllerPlayerId]);
      await assertClanHostilityAllowed(
        tx,
        origin.playerId,
        target.controllerPlayerId,
        origin.now,
      );
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
     *
     * SCOPED TO THE COMMANDER SINCE D121, not to the world the probe leaves from.
     * It used to read every probe touching THIS origin, which was the whole of the
     * rule when a commander held one world. With up to three colonies under them
     * (D97) that sold the same target four looks at once, and it would now
     * contradict the cooldown below — which is per commander — line for line: the
     * colony's probe would be told the target is clear and then refused for an
     * hour by the next check. Return legs are stored with their two ends swapped
     * (D28), so a probe coming HOME from the target still matches on `originPlanetId`.
     */
    const inFlight = await tx
      .select({ targetPlanetId: missions.targetPlanetId, originPlanetId: missions.originPlanetId })
      .from(missions)
      .where(
        and(
          eq(missions.kind, 'probe'),
          eq(missions.status, 'in_flight'),
          eq(missions.ownerPlayerId, origin.playerId),
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

    /**
     * AND AN HOUR BEFORE THE SAME WORLD MAY BE READ AGAIN. D121, owner instruction.
     *
     * D121 made a probe four times faster, which took the wait out of scouting —
     * and the wait was doing rationing work nobody had ever written down. This is
     * that work, stated: one look per world per hour, per commander.
     *
     * MEASURED FROM THE LAUNCH. `departAt` is the instant of the decision, so the
     * hour is the same hour for a neighbour and for a world on the far rim; dating
     * it from the report would charge distance twice, once in the flight and again
     * in the cooldown.
     *
     * CANCELLED FLIGHTS ARE EXCLUDED. `sweepStranded` and `abandon()` mark a probe
     * whose event row was lost as `cancelled` and refund nothing — charging an hour
     * for a look the game itself failed to deliver would make a server fault cost
     * the player their turn.
     */
    const cooldownFrom = addMinutes(origin.now, -PROBE.retargetCooldownMinutes);
    const [recent] = await tx
      .select({ departAt: missions.departAt })
      .from(missions)
      .where(
        and(
          eq(missions.kind, 'probe'),
          eq(missions.ownerPlayerId, origin.playerId),
          eq(missions.targetPlanetId, targetPlanetId),
          inArray(missions.status, ['in_flight', 'resolved']),
          gt(missions.departAt, cooldownFrom),
        ),
      )
      .orderBy(desc(missions.departAt))
      .limit(1);
    if (recent) {
      const readyAt = addMinutes(recent.departAt, PROBE.retargetCooldownMinutes);
      throw new GameError(
        'PROBE_COOLDOWN',
        'That world was probed too recently',
        409,
        {
          // A CODE PLUS ITS FIGURES, never a finished sentence (D55). The client
          // counts down against the instant; the minutes are the fallback for a
          // surface that only has room for a number.
          until: readyAt.toISOString(),
          minutes: Math.max(1, Math.ceil((readyAt.getTime() - origin.now.getTime()) / 60_000)),
        },
      );
    }

    const dist = distance(origin, target);
    const flightMinutes = travelExact(dist, PROBE.speed);
    const arriveAt = addMinutes(origin.now, flightMinutes);
    assertSeasonOpenThrough(origin, addMinutes(arriveAt, flightMinutes));

    await saveResources(tx, originPlanetId, {
      alloy: origin.alloy - PROBE.alloy,
      crystal: origin.crystal - PROBE.crystal,
      deuterium: origin.deuterium,
    });

    const [mission] = await tx
      .insert(missions)
      .values({
        seasonId: origin.seasonId,
        kind: 'probe',
        ownerPlayerId: origin.playerId,
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

/**
 * THE NEWEST LOOK PER TARGET, FOR ONE COMMANDER. D127 · D151.
 *
 * The complete Intel-centre history stays in `probe_reports`; this follows one
 * materialized row per target, so its work is bounded by remembered worlds rather
 * than by every probe the commander has ever sent.
 *
 * THE SILHOUETTE IS READ FROM THE MEMORY ROW, NOT JOINED FROM A REPORT. It used
 * to be an `innerJoin` on `probe_reports`, which made the record structurally
 * unable to come from anything but a probe — and a fleet that had just fought in
 * a world's orbit is a look by any definition the rest of this file uses.
 */
export interface WorldMemory {
  silhouette: NonNullable<typeof probeWorldMemories.$inferSelect['silhouette']>;
  seenAt: Date;
}
export type RememberedWorlds = ReadonlyMap<string, WorldMemory>;

export async function rememberedWorlds(
  db: Queryable,
  observerPlayerId: string,
): Promise<RememberedWorlds> {
  const rows = await db
    .select({
      targetPlanetId: probeWorldMemories.targetPlanetId,
      silhouette: probeWorldMemories.silhouette,
      seenAt: probeWorldMemories.seenAt,
    })
    .from(probeWorldMemories)
    .where(eq(probeWorldMemories.observerPlayerId, observerPlayerId));

  const out = new Map<string, WorldMemory>();
  for (const row of rows) {
    out.set(row.targetPlanetId, { silhouette: row.silhouette, seenAt: row.seenAt });
  }
  return out;
}

/**
 * ONE COMMANDER'S RECORD OF ONE WORLD, WRITTEN OR REPLACED. D127 · D151.
 *
 * THE ONLY WRITER, and that is the point of it existing. The probe path and every
 * arrival path go through here, so "the newest look wins" is decided once instead
 * of by whichever caller was written last — and a new craft that reaches a world
 * cannot record a memory that behaves differently from the two that already do.
 *
 * NEWEST WINS, AND THE TIE-BREAK MAY NOT BE NULL. The predicate used to compare
 * `(seen_at, report_id)` as a row, which is deterministic only while every row has
 * a report: a battle record carries none, SQL row comparison against NULL is NULL,
 * and a fresh battle would silently have failed to replace an ancient probe.
 * `coalesce` to a sortable text makes the second term total.
 */
export async function rememberWorld(
  tx: Tx,
  input: {
    observerPlayerId: string;
    targetPlanetId: string;
    seasonId: string;
    seenAt: Date;
    source: 'PROBE' | 'BATTLE';
    reportId?: string;
    /** Provided by the probe, which reads more than a silhouette. */
    silhouette?: NonNullable<typeof probeWorldMemories.$inferSelect['silhouette']>;
  },
): Promise<void> {
  /*
    BUILT FROM THE SAME PROJECTION THE GALAXY IS, narrowed to one world, so a
    record and a live reading can never disagree about what a world looks like.
    A caller that already holds a richer silhouette — the probe, which also brings
    home doctrines and the interceptor pad — passes its own.
  */
  let silhouette = input.silhouette;
  if (!silhouette) {
    const [outside] = await publicWorlds(tx, input.seasonId, input.seenAt, [input.targetPlanetId]);
    if (!outside) return;
    silhouette = silhouetteOf(outside);
  }

  await tx
    .insert(probeWorldMemories)
    .values({
      observerPlayerId: input.observerPlayerId,
      targetPlanetId: input.targetPlanetId,
      reportId: input.reportId ?? null,
      source: input.source,
      silhouette,
      seenAt: input.seenAt,
    })
    .onConflictDoUpdate({
      target: [probeWorldMemories.observerPlayerId, probeWorldMemories.targetPlanetId],
      set: {
        reportId: sql`excluded.report_id`,
        source: sql`excluded.source`,
        silhouette: sql`excluded.silhouette`,
        seenAt: sql`excluded.seen_at`,
      },
      // Two arrivals may land at the same instant. The tuple makes the winner
      // newest-first and deterministic on ties, with no NULL in either term.
      setWhere: sql`(excluded.seen_at, coalesce(excluded.report_id::text, ''))
        > (${probeWorldMemories.seenAt}, coalesce(${probeWorldMemories.reportId}::text, ''))`,
    });

  // The map this commander reads is a player-keyed projection. A record written
  // into a warm cache is a record the player does not have until a TTL expires.
  await publishWorldMemory(tx, input.observerPlayerId);
}

/**
 * A CRAFT OF THIS COMMANDER'S REACHED THAT WORLD, SO THEY HAVE SEEN IT. D151.
 *
 * Called from every arrival that puts an owned craft at another world — a raid, a
 * raid that bounces off protection, a battle with a rock, a strategic strike. The
 * fleet is eyes: it crossed the distance, it was in that orbit, and what the map
 * draws afterwards has to be what it found rather than what a probe saw before it.
 *
 * WHAT IT DOES NOT CARRY is as deliberate as what it does. `silhouetteOf` is the
 * OUTSIDE of a world — flag, development, orbital hardware, dome. The two readings
 * only a probe takes (combat doctrine and the interceptor pad) are not here and
 * must not be inferred: a raid is not a scan, and a record that quietly grew a
 * doctrine list nobody flew for would be the fog leaking through its own door.
 */
export const rememberVisitedWorld = async (
  tx: Tx,
  input: { observerPlayerId: string; targetPlanetId: string; seasonId: string; seenAt: Date },
): Promise<void> => rememberWorld(tx, { ...input, source: 'BATTLE' });

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
  /**
   * WHAT A RAID COULD TAKE, NOT WHAT THE WORLD IS HOLDING. Owner report:
   * *"gezegende 50k kaynak gözüküyor ama dalıyom 300 alloy alıyorum. Böyle
   * saçmalık olmaz. Yağmalanabilir kaynak aralığını vermeli."*
   *
   * This fuzzed `alloy + crystal` — the whole pile — and three rules stand between
   * that figure and what a fleet flies home with: the vault floor is untouchable,
   * the grade takes a SHARE rather than the remainder, and uncollected ore is
   * exposed at only half that again while the vault does not cover it at all. On a
   * developed world the floor alone is most of the store, so the reported number
   * and the delivered number were never the same quantity — and a reading that
   * cannot be compared to the outcome it predicts is not intelligence.
   *
   * `raidableStock` is `computeLoot` with the raider's hold taken out of the
   * question, so this figure and the haul are computed by ONE piece of arithmetic
   * and cannot drift. The hold stays out on purpose: it is a fact about the
   * attacker, and a probe that folded it in would report a different world to two
   * commanders.
   *
   * DECISIVE is the grade quoted, because it is the ceiling — the most this world
   * can be made to give up. A PARTIAL takes proportionally less and the player
   * already knows which of the two they are flying for.
   */
  const targetBuildings = await buildingLevelsOf(tx, target.id);
  const raidable = raidableStock(
    { alloy: target.alloy, crystal: target.crystal, deuterium: target.deuterium },
    {
      alloy: target.bufferAlloy,
      crystal: target.bufferCrystal,
      deuterium: target.bufferDeuterium,
    },
    vaultProtects(
      targetBuildings.VAULT,
      targetBuildings.REFINERY,
      targetBuildings.EXTRACTOR,
      targetBuildings.DEUTERIUM_PLANT,
    ),
    'DECISIVE',
  );
  const stock = fuzzBand(raidable, accuracy, rng);
  /**
   * THE DEUTERIUM SHARE OF THE SAME FIGURE, FOR EVERY COMMANDER. D166.
   *
   * Owner instruction, and the gate it removes could not have been kept honestly:
   * `raidableStock` above sums ALL THREE resources, so the deuterium was already
   * inside the headline band. A commander without `ISOTOPE_SPECTROMETRY` was
   * reading it through the total, and one who had bought the project saw the same
   * ore twice — once in the band, once on its own line, and was sizing a hold
   * against a number that counted it twice.
   *
   * IT IS THE RAIDABLE SHARE, NOT THE TANK, and that is the other half of the fix.
   * This used to publish `target.deuterium` — the whole store — beside a band that
   * means "what a fleet could carry away", so the one line a commander read for
   * deuterium was measuring a different quantity from every other figure on the
   * screen. `computeLoot` is the single definition of exposure and both now read
   * it.
   *
   * A separate deterministic roll keeps this field from perturbing the other bands
   * or the detection roll, exactly as it did while it was gated.
   */
  const raidableDeuterium = computeLoot(
    { alloy: target.alloy, crystal: target.crystal, deuterium: target.deuterium },
    {
      alloy: target.bufferAlloy,
      crystal: target.bufferCrystal,
      deuterium: target.bufferDeuterium,
    },
    vaultProtects(
      targetBuildings.VAULT,
      targetBuildings.REFINERY,
      targetBuildings.EXTRACTOR,
      targetBuildings.DEUTERIUM_PLANT,
    ),
    'DECISIVE',
    Number.MAX_SAFE_INTEGER,
  ).deuterium;
  const deuteriumStock = fuzzBand(
    raidableDeuterium,
    accuracy,
    seededFrom(mission.id, 0x1d50_70e),
  );
  const defence = fuzzBand(fleetValue(homeFleet), accuracy, rng);
  const size = fuzzBand(fleetCount(homeFleet), accuracy, rng);
  /*
    THE WEAPON, AND ONLY THE WEAPON. T12.

    This read predates the interception charge sharing the table, and untyped it
    reported the exact opposite of the truth: a defender loading the charge that
    would shoot a Death Star down came home on the report as BUILDING one. The
    interceptor flag a few queries below has always been typed; this one had no
    reason to be until D139 put a second kind of asset in the table.
  */
  const [strategic] = await tx
    .select({ status: strategicAssets.status })
    .from(strategicAssets)
    .where(and(
      eq(strategicAssets.planetId, target.id),
      eq(strategicAssets.type, 'DEATH_STAR'),
      inArray(strategicAssets.status, ['BUILDING', 'PAUSED', 'READY']),
    ))
    .limit(1);
  const strategicStatus = accuracy < DEATH_STAR.probeVisibilityAccuracy
    ? 'UNKNOWN' as const
    : strategic?.status === 'READY'
      ? 'READY' as const
      : strategic
        ? 'BUILDING' as const
        : 'NONE' as const;

  const detected = rng() < detectChance(radar, shipyard);
  const bearing = bearingBetween(target, origin);

  const [outside] = await publicWorlds(tx, target.seasonId, now, [target.id]);
  /*
    THE DOCTRINES RIDE HOME WITH THE SILHOUETTE. T9 · D124.

    They are not part of `silhouetteOf`, which derives from what is PUBLIC about a
    world — nothing about a commander's research is. This is the probe's own
    product: earned by flying there, frozen at the look, and stale from then on
    exactly like the rest of the record. Without it a 25% multiplier would sit
    invisibly on every battle and quietly devalue the scouting flight that the
    whole information layer is built to sell.
  */
  const owner = target.controllerPlayerId;
  const held = owner === null ? new Map<string, number>() : await researchLevels(tx, owner);
  const doctrines = owner === null
    ? undefined
    : Object.fromEntries(
      COMBAT_RESEARCH_PROJECTS
        .map((id) => [id, held.get(id) ?? 0] as const)
        .filter(([, level]) => level > 0),
    );
  /*
    AND WHETHER IT CAN SHOOT ONE DOWN. T10.

    Read at the look and frozen with the rest of the record, like everything else
    D127 put here. It is the reading that turns a strategic strike into an
    intelligence decision rather than a purchase — and it is never public, so the
    only way to hold it is to have flown there.
  */
  const [charge] = owner === null ? [] : await tx
    .select({ id: strategicAssets.id })
    .from(strategicAssets)
    .where(and(
      eq(strategicAssets.planetId, target.id),
      eq(strategicAssets.type, 'INTERCEPTOR'),
      eq(strategicAssets.status, 'READY'),
    ))
    .limit(1);
  const silhouette = outside
    ? {
      ...silhouetteOf(outside),
      ...(doctrines === undefined ? {} : { doctrines }),
      ...(owner === null ? {} : { interceptor: charge !== undefined }),
    }
    : null;

  await tx.insert(probeReports).values({
    observerPlayerId: mission.ownerPlayerId,
    targetPlanetId: target.id,
    missionId: mission.id,
    accuracy,
    stock: { low: stock.low, high: stock.high },
    // Always present since D166 — the column stays nullable for the reports written
    // while it was gated behind research.
    deuteriumStock: { low: deuteriumStock.low, high: deuteriumStock.high },
    defence: { low: defence.low, high: defence.high },
    fleetSize: { low: size.low, high: size.high },
    fleetHome: !anyAway,
    strategicStatus,
    /**
     * WHAT THE CRAFT COULD SIMPLY SEE. D127.
     *
     * Everything above is a fuzzed band. This is exact, because it is the outside
     * of the world rather than its contents — whose flag is on it, how developed
     * it is, what is in orbit, whether a dome is up. All of it used to be on
     * `/api/galaxy` for the whole disc; D127 made it private, so this is now the
     * only way a commander learns it about a world their Telescope cannot reach.
     *
     * Built from the SAME projection the galaxy is, narrowed to one world, so a
     * probe's record and a live reading can never disagree about what a world
     * looks like.
     */
    silhouette,
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
  /** Which of the caller's worlds was scanned. Multi-world needs to know. */
  planetId: string;
  planetName: string;
  /** Only from Radar L2, and from THAT world's radar. */
  bearing: Bearing | null;
  /** Only from Radar L5. */
  originPlanetName: string | null;
}

/**
 * What a defender may read from their own radar logs.
 *
 * The filtering happens in this function, not in the client. Below L5 the origin
 * is never placed in the response at all — there is nothing for a modified client
 * to reveal.
 *
 * IT TAKES EVERY WORLD THE COMMANDER HOLDS, AND IT USED TO TAKE ONE.
 *
 * `/api/intel` passed the CAPITAL and nothing else, so a probe against a colony
 * wrote its `scan_events` row and no surface in the game ever read it: a commander
 * could be scouted on three of their four worlds and be told nothing at all. The
 * screen made it worse by labelling the capital's log with the ACTIVE world's
 * radar level, so a Radar 5 capital's history could sit behind a "you have no
 * Radar" card belonging to a different world.
 *
 * EACH ROW IS GATED BY THE RADAR OF THE WORLD IT HAPPENED TO. That is the honest
 * reading — the instrument that caught the probe is the one on the world it flew
 * at — which is why the level is looked up per row rather than once for the call.
 */
export async function readRadarLog(
  db: Db,
  planetIds: readonly string[],
  limit = 20,
): Promise<ScanView[]> {
  if (planetIds.length === 0) return [];
  const originPlanet = alias(planets, 'scan_origin');
  const [levels, rows] = await Promise.all([
    instrumentLevels(db, planetIds),
    db
      .select({
        scan: scanEvents,
        originName: originPlanet.name,
        targetName: planets.name,
      })
      .from(scanEvents)
      .innerJoin(originPlanet, eq(scanEvents.originPlanetId, originPlanet.id))
      .innerJoin(planets, eq(scanEvents.targetPlanetId, planets.id))
      .where(and(
        inArray(scanEvents.targetPlanetId, [...planetIds]),
        eq(scanEvents.detected, true),
      ))
      .orderBy(desc(scanEvents.createdAt))
      .limit(limit),
  ]);

  return rows.map((r) => {
    const radar = levelOf(levels, r.scan.targetPlanetId, 'RADAR');
    return {
      at: r.scan.createdAt,
      planetId: r.scan.targetPlanetId,
      planetName: r.targetName,
      bearing: radarRevealsBearing(radar) ? (r.scan.bearing as Bearing | null) : null,
      originPlanetName: radarRevealsOrigin(radar) ? r.originName : null,
    };
  });
}

/**
 * Only what has actually come home. A probe in flight tells you nothing yet.
 *
 * THE LIMIT HAS TO COVER WHAT THE MAP REMEMBERS. It was ten, while
 * `probe_world_memories` is unbounded — one row per world ever probed — so from
 * the eleventh world onward the galaxy drew a REMEMBERED silhouette with a
 * "seen 3h ago" stamp while the dossier beside it offered the "nobody has ever
 * looked here" gap. One surface saying two things about one world.
 *
 * Keep the recent history AND the newest delivered report for every remembered
 * target. A fixed history cap alone cannot cover a season: the one-hour per-target
 * cooldown still allows more than forty distinct reports, leaving a REMEMBERED
 * world on the map whose dossier had fallen out of the only readable endpoint.
 */
export async function readProbeReports(db: Db, playerId: string, limit = 40) {
  const delivered = and(
    eq(probeReports.observerPlayerId, playerId),
    isNotNull(probeReports.deliveredAt),
  );
  const recent = await db
    .select({
      report: probeReports,
      targetName: planets.name,
    })
    .from(probeReports)
    .innerJoin(planets, eq(probeReports.targetPlanetId, planets.id))
    .where(delivered)
    .orderBy(desc(probeReports.createdAt))
    .limit(limit);

  const latestByTarget = await db
    .selectDistinctOn([probeReports.targetPlanetId], {
      report: probeReports,
      targetName: planets.name,
    })
    .from(probeReports)
    .innerJoin(planets, eq(probeReports.targetPlanetId, planets.id))
    .where(delivered)
    .orderBy(probeReports.targetPlanetId, desc(probeReports.createdAt));

  const rows = [...new Map(
    [...recent, ...latestByTarget].map((row) => [row.report.id, row]),
  ).values()].toSorted(
    (a, b) => b.report.createdAt.getTime() - a.report.createdAt.getTime(),
  );
  return rows.map((row) => ({
    ...row,
    // Identity is part of the arrival snapshot. Joining the target's current
    // controller rewrote old intelligence after a capture and leaked ownership
    // the observer had not seen.
    targetUsername: row.report.silhouette?.owner ?? 'Neutral',
  }));
}

/**
 * WHICH WORLDS THIS COMMANDER MAY NOT LOOK AT YET, AND UNTIL WHEN. D121.
 *
 * The cooldown is enforced in `launchProbe` under the planet lock, which is the
 * only place it can be. This exists so the interface does not have to find out by
 * being refused: a control that offers a launch it knows will fail is a spinner
 * where a decision should be (principle 10), and the instant is the same instant
 * the guard reads, so the two can never disagree by a rounding.
 *
 * Only rows still inside the window are returned, so the list is bounded by how
 * many probes one commander can have launched in an hour rather than by history.
 */
export async function readProbeCooldowns(
  db: Db,
  playerId: string,
  now: Date,
): Promise<{ targetPlanetId: string; readyAt: Date }[]> {
  const rows = await db
    .select({ targetPlanetId: missions.targetPlanetId, departAt: missions.departAt })
    .from(missions)
    .where(
      and(
        eq(missions.kind, 'probe'),
        eq(missions.ownerPlayerId, playerId),
        inArray(missions.status, ['in_flight', 'resolved']),
        gt(missions.departAt, addMinutes(now, -PROBE.retargetCooldownMinutes)),
      ),
    );

  // A commander may have probed the same world twice inside an hour only if the
  // first was cancelled, so keep the latest and let the newest launch decide.
  const latest = new Map<string, Date>();
  for (const row of rows) {
    const readyAt = addMinutes(row.departAt, PROBE.retargetCooldownMinutes);
    const held = latest.get(row.targetPlanetId);
    if (!held || readyAt > held) latest.set(row.targetPlanetId, readyAt);
  }
  return [...latest].map(([targetPlanetId, readyAt]) => ({ targetPlanetId, readyAt }));
}
