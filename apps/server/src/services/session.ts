import { and, desc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  alloyRate,
  crystalRate,
  fleetCount,
  radarDetectsFleets,
  radarLeadMinutes,
} from '@blindspace/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
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
import { GameError } from './planet.js';

/* ── the unlock cascade ─────────────────────────────────────── */

export const UNLOCKABLE = ['TELESCOPE', 'RADAR', 'EXPLORER', 'VEIL'] as const;
export type Unlockable = (typeof UNLOCKABLE)[number];

export const UNLOCK_COPY: Record<Unlockable, { title: string; body: string }> = {
  TELESCOPE: {
    title: 'Telescope unlocked',
    body: 'You may watch one planet. Choose one.',
  },
  RADAR: {
    title: 'Radar unlocked',
    body: 'You can now detect when someone is looking at you.',
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
export async function currentUnlocks(db: Db, playerId: string): Promise<Unlockable[]> {
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
  kind: 'fleet' | 'probe' | 'incoming';
  targetName: string;
  minutesRemaining: number;
  /** Which way a fleet of yours is flying. Absent for `incoming`. */
  leg?: 'outbound' | 'return';
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

  /* what is new */
  const unlocked = await currentUnlocks(db, playerId);
  const seen = new Set(player.unlocksSeen);
  const newUnlocks = unlocked.filter((u) => !seen.has(u));
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

  // Advance the window and record what has now been announced.
  await db
    .update(players)
    .set({
      lastSeenAt: now,
      ...(newUnlocks.length > 0 ? { unlocksSeen: [...seen, ...newUnlocks] } : {}),
    })
    .where(eq(players.id, playerId));

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
 * is, `minutesRemaining <= lead(radarLevel)`. Without the gate this payload told
 * every player, at any radar level including none, that a fleet was inbound and
 * exactly how long they had. That is the whole radar ladder given away for free,
 * and it silently reversed D9: a forty-minute flight gave forty minutes of
 * notice. It shipped that way in Phase 3 and was found by building the strip that
 * displays it.
 */
export async function pendingThreads(
  db: Db,
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
  const lead = radarLeadMinutes(radar);
  const pending: PendingThread[] = [];

  for (const row of inFlight) {
    const m = row.mission;
    const minutes = Math.max(0, Math.round((m.arriveAt.getTime() - now.getTime()) / 60_000));

    if (m.targetPlanetId === planetId && m.kind === 'attack') {
      if (!radarDetectsFleets(radar) || minutes > lead) continue;
      pending.push({ kind: 'incoming', targetName: 'inbound fleet', minutesRemaining: minutes });
      continue;
    }

    // A return leg flies backwards: its target is home and its origin is the
    // planet that was raided, so the name worth showing is at the other end.
    const returning = m.targetPlanetId === planetId;
    pending.push({
      kind: m.kind === 'probe' ? 'probe' : 'fleet',
      targetName: returning ? row.originName : row.targetName,
      minutesRemaining: minutes,
      ...(m.kind === 'probe' ? {} : { leg: returning ? 'return' : 'outbound' }),
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
