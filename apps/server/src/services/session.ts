import { and, desc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  alloyRate,
  crystalRate,
  fleetCount,
  radarDetectsFleets,
  radarLead,
  radarRange,
  type Fleet,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Queryable } from '../db/client.js';
import {
  battleReports,
  buildings,
  missions,
  notifications,
  planets,
  players,
  satellites,
  scanEvents,
  seasons,
  watches,
} from '../db/schema.js';
import { announceUnlocks } from './notifications.js';
import { GameError } from './planet.js';

/* ── the unlock cascade ─────────────────────────────────────── */

export const UNLOCKABLE = ['TELESCOPE', 'RADAR', 'EXPLORER', 'VEIL'] as const;
export type Unlockable = (typeof UNLOCKABLE)[number];

export const UNLOCK_COPY: Record<Unlockable, { title: string; body: string }> = {
  /**
   * THE TWO GATED ONES NAME THEIR GATE, AND THEY HAVE TO.
   *
   * `build.ts` refuses a Telescope or a Radar without an Uplink in orbit —
   * `NEEDS_UPLINK`, and it is the one prerequisite in the whole system. This
   * cascade does not know about it and should not: it fires at the moment the
   * player FEELS the absence, which is the first battle, and that moment is right.
   *
   * What was wrong was the promise. "You may watch one planet. Choose one." was
   * told to 25 of 26 commanders on a live shard, not one of whom owned an Uplink,
   * so every one of them was invited to do something the server would refuse. The
   * news is still the news; the sentence now says what it costs.
   */
  TELESCOPE: {
    title: 'Telescope unlocked',
    body: 'Put an Uplink in orbit and you can watch one planet.',
  },
  RADAR: {
    title: 'Radar unlocked',
    body: 'Put an Uplink in orbit and you will catch anyone looking at you.',
  },
  EXPLORER: {
    title: 'Explorer unlocked',
    body: 'Send a probe to know for certain. Their radar may catch it.',
  },
  VEIL: {
    title: 'Veil unlocked',
    body: 'Your fleet status can read UNKNOWN to anyone watching.',
  },
};

/**
 * What this player has unlocked, DERIVED from what has happened to them.
 *
 * Design Law #2: every system unlocks at the moment the player feels its absence.
 * Deriving rather than storing means the cascade can never drift out of sync with
 * the history that justifies it — and a player who somehow skipped a step still
 * gets the right answer.
 */
export async function currentUnlocks(db: Queryable, playerId: string): Promise<Unlockable[]> {
  const [battles, scans, watching] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int`, asDefender: sql<number>`
        count(*) filter (where ${battleReports.defenderPlayerId} = ${playerId})::int` })
      .from(battleReports)
      .where(
        or(
          eq(battleReports.attackerPlayerId, playerId),
          eq(battleReports.defenderPlayerId, playerId),
        ),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(scanEvents)
      .innerJoin(planets, eq(scanEvents.targetPlanetId, planets.id))
      .where(and(eq(planets.playerId, playerId), eq(scanEvents.detected, true))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(watches)
      .where(eq(watches.observerPlayerId, playerId)),
  ]);

  const anyBattle = (battles[0]?.n ?? 0) > 0;
  const wasAttacked = (battles[0]?.asDefender ?? 0) > 0;
  const wasScanned = (scans[0]?.n ?? 0) > 0;
  const hasWatched = (watching[0]?.n ?? 0) > 0;

  const out: Unlockable[] = [];
  // Fires whether the first fleet won or died. Losing it and only THEN being handed
  // a telescope is the better lesson.
  if (anyBattle) out.push('TELESCOPE');
  if (wasAttacked || wasScanned) out.push('RADAR');
  // You have looked at someone; now you want detail the telescope cannot give.
  if (hasWatched) out.push('EXPLORER');
  if (wasScanned) out.push('VEIL');
  return out;
}

/* ── the return payload ─────────────────────────────────────── */

export type ReturnEntryKind =
  | 'fleet_returned'
  | 'raided'
  | 'raid_result'
  | 'scan_detected'
  | 'accrued'
  | 'unlock';

export interface ReturnEntry {
  kind: ReturnEntryKind;
  title: string;
  detail: string;
  at: Date;
}

export interface PendingThread {
  /** The mission's own id — YOUR OWN CRAFT ONLY. Absent on `incoming`. See below. */
  id?: string;
  kind: 'fleet' | 'probe' | 'incoming';
  targetName: string;
  minutesRemaining: number;
  /**
   * WHEN IT LANDS, EXACTLY — and it is on every thread, including an inbound one.
   *
   * `minutesRemaining` is rounded, and the client used to rebuild the arrival
   * instant from it. On your OWN craft that did not matter, because the strip could
   * read the exact `arriveAt` off `path`; on an INBOUND attack there is no path, so
   * the defender's countdown was reconstructed from a whole-minute figure and ran
   * up to thirty seconds away from the attacker's. Two players watching the same
   * fleet saw two different clocks.
   *
   * Publishing the instant to an inbound thread costs the fog nothing. The radar
   * ladder sells WHETHER you are warned and HOW EARLY (D9); it has never sold the
   * precision of the clock, and the defender already knows the arrival minute. What
   * stays withheld is unchanged: no origin, no heading, no composition.
   */
  arriveAt: Date;
  /** Which way a fleet of yours is flying. Absent for `incoming`. */
  leg?: 'outbound' | 'return';
  /**
   * What is in it. PRESENT ONLY FOR YOUR OWN MISSIONS.
   *
   * THIS IS NOT THE FOG RULE IT USED TO BE, and the comment said otherwise for two
   * phases. It read "composition is what Radar L5 sells, and an inbound attack must
   * never carry it" — which stopped being true at D24, when the owner made every
   * craft in the galaxy readable down to the hull. A defender can already count the
   * ships in a contact on `/api/galaxy/traffic`, exactly as any stranger can.
   *
   * WHAT THE RADAR STILL SELLS IS ATTRIBUTION, and that is the whole ladder: a
   * contact is a craft moving out there, and knowing that it is coming for YOU, and
   * how long you have, is what you pay for. A defender watching traffic may work it
   * out from a short hop and cannot from a long one — that asymmetry is the game,
   * not a leak. Owner's call, on review.
   *
   * So this stays absent from an inbound thread for a narrower and still real
   * reason: this payload is the ATTRIBUTED one. Everything on it is already known to
   * be aimed at you, so a composition here would be the radar's answer given away
   * with the radar's question. Omitted rather than nulled — there is no field for a
   * modified client to read.
   */
  fleet?: Fleet;
  /**
   * Where it is flying, so the client can draw it moving.
   *
   * PRESENT ONLY FOR YOUR OWN MISSIONS. An inbound attack never carries a path —
   * its origin is exactly what Radar L5 is sold for, and a heading would give away
   * most of what L2's bearing costs. The fog is enforced by omission here, as
   * everywhere else: there is no field for a modified client to read.
   */
  path?: {
    from: { x: number; y: number; z: number };
    to: { x: number; y: number; z: number };
    departAt: Date;
    arriveAt: Date;
  };
}

export interface ReturnPayload {
  awayMinutes: number;
  entries: ReturnEntry[];
  /** Design Law #1 — what is still in flight. Never allowed to be empty by accident. */
  pending: PendingThread[];
  newUnlocks: Unlockable[];
}

const MAX_ENTRIES = 5;
const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

/**
 * "While you were gone" — the single most important screen in the game.
 *
 * It must answer *what happened?* before the player asks. Three kinds of line:
 * what I did, what accrued, what is new. Never more than five, never a wall of logs.
 *
 * Reading it advances `lastSeenAt`, so the window is genuinely "since you last
 * looked" rather than a rolling guess.
 */
export async function buildReturnPayload(
  db: Db,
  playerId: string,
  clock: Clock,
): Promise<ReturnPayload> {
  const [player] = await db.select().from(players).where(eq(players.id, playerId));
  if (!player) throw new GameError('PLAYER_NOT_FOUND', 'No such player', 404);
  const [planet] = await db.select().from(planets).where(eq(planets.playerId, playerId));
  if (!planet) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);

  const now = clock.now();
  const since = player.lastSeenAt;
  const awayMinutes = Math.max(0, Math.round((now.getTime() - since.getTime()) / 60_000));

  const entries: ReturnEntry[] = [];

  /* what I did, and what was done to me */
  const reports = await db
    .select()
    .from(battleReports)
    .where(
      and(
        gt(battleReports.createdAt, since),
        or(
          eq(battleReports.attackerPlayerId, playerId),
          eq(battleReports.defenderPlayerId, playerId),
        ),
      ),
    )
    .orderBy(desc(battleReports.createdAt))
    .limit(MAX_ENTRIES);

  for (const r of reports) {
    const mine = r.attackerPlayerId === playerId;
    const loot = r.loot.alloy + r.loot.crystal;
    const lost = fleetCount(mine ? r.attackerLosses : r.defenderLosses);
    entries.push(
      mine
        ? {
            kind: 'raid_result',
            title: r.grade,
            detail: `+${fmt(loot)} looted · ${String(lost)} ships lost`,
            at: r.createdAt,
          }
        : {
            kind: 'raided',
            title: r.grade === 'REPELLED' ? 'You repelled a raid' : 'You were raided',
            detail:
              r.grade === 'REPELLED'
                ? `${String(lost)} units lost holding the line`
                : `−${fmt(loot)} taken · ${String(lost)} units lost`,
            at: r.createdAt,
          },
    );
  }

  /* someone was looking at you */
  const scans = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(scanEvents)
    .where(
      and(
        eq(scanEvents.targetPlanetId, planet.id),
        eq(scanEvents.detected, true),
        gt(scanEvents.createdAt, since),
      ),
    );
  const scanCount = scans[0]?.n ?? 0;
  if (scanCount > 0) {
    entries.push({
      kind: 'scan_detected',
      title: scanCount === 1 ? 'Scan detected' : `${String(scanCount)} scans detected`,
      detail: 'Someone is building a picture of you.',
      at: now,
    });
  }

  /* what accrued while you were away */
  if (awayMinutes >= 1) {
    const levels = await db
      .select()
      .from(buildings)
      .where(eq(buildings.planetId, planet.id));
    const refinery = levels.find((b) => b.type === 'REFINERY')?.level ?? 0;
    const extractor = levels.find((b) => b.type === 'EXTRACTOR')?.level ?? 0;
    const hours = awayMinutes / 60;
    // An estimate by design: the exact figure is on the planet screen, and this
    // line exists to say "time passed and it mattered", not to be audited.
    const alloy = alloyRate(refinery) * hours;
    const crystal = crystalRate(extractor) * hours;
    if (alloy >= 1) {
      entries.push({
        kind: 'accrued',
        title: `+${fmt(alloy)} alloy`,
        detail: crystal >= 1 ? `+${fmt(crystal)} crystal` : 'accumulated while you were away',
        at: now,
      });
    }
  }

  /**
   * What is new — announced through the ONE path that records it. D45.
   *
   * This used to run its own copy of the diff against `unlocksSeen` and write the
   * field itself. That was safe while this was the only surface that announced
   * anything; it is not now that a battle, a caught probe and a telescope being
   * pointed all announce unlocks as notifications. Two writers of one field means
   * whichever ran first silently ate the other's news — and this one is an
   * endpoint no client calls (D23), so the unlock would have been consumed by a
   * route nobody reads and never shown to anybody.
   */
  const newUnlocks = await db.transaction((tx) => announceUnlocks(tx, playerId, now));
  for (const u of newUnlocks) {
    entries.push({
      kind: 'unlock',
      title: UNLOCK_COPY[u].title,
      detail: UNLOCK_COPY[u].body,
      at: now,
    });
  }

  /* Design Law #1 — what is still in flight */
  const pending = await pendingThreads(db, planet.id, now);

  // Advance the window. What has been announced is recorded by `announceUnlocks`.
  await db.update(players).set({ lastSeenAt: now }).where(eq(players.id, playerId));

  return {
    awayMinutes,
    entries: entries.slice(0, MAX_ENTRIES),
    pending,
    newUnlocks,
  };
}

/* ── what is still in flight ────────────────────────────────── */

/**
 * Every unresolved thread this planet has, at the tier of detail it has earned.
 *
 * THE RADAR GATE IS LOAD-BEARING. An inbound attack is listed only if this
 * planet's radar detects fleets AND the warning would already have fired — that
 * is, the fleet is already inside the radar's own reach. Without the gate this
 * payload told every player, at any radar level including none, that a fleet was
 * inbound and exactly how long they had. That is the whole radar ladder given
 * away for free, and it silently reversed D9: a forty-minute flight gave forty
 * minutes of notice. It shipped that way in Phase 3 and was found by building the
 * strip that displays it.
 *
 * THE GATE AND THE WARNING MUST AGREE, and since D49 that means both read a
 * DISTANCE. This surface is a live query and the warning is a scheduled event, so
 * they can never share a computation — only a rule. `radarLead` is that rule, and
 * both sides call it with the same three figures off the same mission row.
 */
export async function pendingThreads(
  /**
   * A `Tx` as well as a `Db`, so a launch can answer with the list it just joined.
   * D53. Read inside the launching transaction the fleet is created in, this sees
   * the new mission before it commits — which is the whole point: the craft is
   * drawn on the frame the response lands, instead of one round trip later.
   */
  db: Queryable,
  planetId: string,
  now: Date,
): Promise<PendingThread[]> {
  // Both ends are needed: a fleet's thread is named after the planet that is NOT
  // yours, and which end that is flips between the outbound and return legs.
  const originPlanet = alias(planets, 'pending_origin');
  const targetPlanet = alias(planets, 'pending_target');

  const [inFlight, radarRow] = await Promise.all([
    db
      .select({
        mission: missions,
        originName: originPlanet.name,
        targetName: targetPlanet.name,
        originX: originPlanet.x,
        originY: originPlanet.y,
        originZ: originPlanet.z,
        targetX: targetPlanet.x,
        targetY: targetPlanet.y,
        targetZ: targetPlanet.z,
      })
      .from(missions)
      .innerJoin(originPlanet, eq(missions.originPlanetId, originPlanet.id))
      .innerJoin(targetPlanet, eq(missions.targetPlanetId, targetPlanet.id))
      .where(
        and(
          eq(missions.status, 'in_flight'),
          or(eq(missions.originPlanetId, planetId), eq(missions.targetPlanetId, planetId)),
        ),
      ),
    db
      .select({ level: satellites.level })
      .from(satellites)
      .where(and(eq(satellites.planetId, planetId), eq(satellites.type, 'RADAR')))
      .limit(1),
  ]);

  const radar = radarRow[0]?.level ?? 0;
  const reach = radarRange(radar);
  const pending: PendingThread[] = [];

  for (const row of inFlight) {
    const m = row.mission;
    const minutes = Math.max(0, Math.round((m.arriveAt.getTime() - now.getTime()) / 60_000));

    if (m.targetPlanetId === planetId && m.kind === 'attack') {
      const oneWay = (m.arriveAt.getTime() - m.departAt.getTime()) / 60_000;
      const lead = radarLead(reach, m.distance, oneWay);
      // Measured unrounded: `minutes` is rounded for display and comparing a
      // rounded figure against an exact one puts the strip and the warning up to
      // thirty seconds out of step with each other.
      const remaining = (m.arriveAt.getTime() - now.getTime()) / 60_000;
      if (!radarDetectsFleets(radar) || remaining > lead) continue;
      pending.push({
        kind: 'incoming',
        targetName: 'inbound fleet',
        minutesRemaining: minutes,
        arriveAt: m.arriveAt,
      });
      continue;
    }

    // A return leg flies backwards: its target is home and its origin is the
    // planet that was raided, so the name worth showing is at the other end.
    const returning = m.targetPlanetId === planetId;
    pending.push({
      /**
       * THE MISSION'S OWN ID, ON YOUR OWN CRAFT ONLY. D52.
       *
       * It discloses nothing — `/api/galaxy/traffic` already publishes the same
       * uuid to the whole galaxy as a contact's key, and it maps to no world, no
       * player and no name anywhere else. What it buys is that both sides of a raid
       * seed the SAME volley: the bombardment is generated from this string, so the
       * attacker and every bystander watch the identical rounds leave the identical
       * ships. A key rebuilt from the target's name and a list position could not
       * agree with anything.
       *
       * Never on an `incoming` thread, which returns above and carries nothing.
       */
      id: m.id,
      kind: m.kind === 'probe' ? 'probe' : 'fleet',
      targetName: returning ? row.originName : row.targetName,
      minutesRemaining: minutes,
      arriveAt: m.arriveAt,
      // Probes have legs too now that they fly home — "returning from" and
      // "heading for" are different states of the same craft and the strip should
      // not have to guess which.
      leg: returning ? 'return' : 'outbound',
      /**
       * What is actually in it.
       *
       * ONLY EVER ON YOUR OWN CRAFT. An inbound attack never reaches this line —
       * it returns above — because a fleet's composition is precisely what Radar
       * L5 sells, and D9 was already broken once by this payload handing out
       * something the radar ladder was supposed to charge for.
       *
       * On your own missions it is free: you packed it. The galaxy needs it to
       * draw a squadron as the hulls it contains rather than as one anonymous
       * marker.
       */
      fleet: m.fleet,
      // Yours, so you may watch it fly.
      path: {
        from: { x: row.originX, y: row.originY, z: row.originZ },
        to: { x: row.targetX, y: row.targetY, z: row.targetZ },
        departAt: m.departAt,
        arriveAt: m.arriveAt,
      },
    });
  }

  return pending;
}

/* ── notifications ──────────────────────────────────────────── */

export async function listNotifications(
  db: Db,
  playerId: string,
  opts: { unseenOnly?: boolean; limit?: number } = {},
) {
  const where = opts.unseenOnly
    ? and(eq(notifications.playerId, playerId), eq(notifications.seen, false))
    : eq(notifications.playerId, playerId);

  return db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(Math.min(opts.limit ?? 30, 100));
}

export async function markNotificationsSeen(
  db: Db,
  playerId: string,
  ids?: string[],
): Promise<number> {
  const where =
    ids && ids.length > 0
      ? and(eq(notifications.playerId, playerId), inArray(notifications.id, ids))
      : eq(notifications.playerId, playerId);

  const rows = await db
    .update(notifications)
    .set({ seen: true })
    .where(where)
    .returning({ id: notifications.id });
  return rows.length;
}

/** Used by the health check and by tests: is this season still live? */
export async function seasonOf(db: Db, playerId: string) {
  const [row] = await db
    .select({ season: seasons })
    .from(players)
    .innerJoin(seasons, eq(players.seasonId, seasons.id))
    .where(eq(players.id, playerId))
    .limit(1);
  return row?.season ?? null;
}
