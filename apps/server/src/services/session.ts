import { and, desc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  alloyRate,
  crystalRate,
  deuteriumOf,
  fleetCount,
  massClass,
  radarDetectsFleets,
  radarRange,
  radarRevealsComposition,
  radarRevealsOrigin,
  radarRevealsSize,
  type Fleet,
  type MassClass,
  type PirateLevel,
} from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db, Queryable } from '../db/client.js';
import {
  battleReports,
  buildings,
  missions,
  notifications,
  pirateRaids,
  planets,
  players,
  scanEvents,
  seasons,
  tradeRuns,
  units,
  watches,
} from '../db/schema.js';
import { pirateCallsign, privatePirateField } from './pirateField.js';
import { announceUnlocks } from './notifications.js';
import { GameError } from './planet.js';
import { instrumentLevels, levelOf } from './intel.js';
import { inboundRadarLead, LEAD_TOLERANCE } from './radar.js';
import { dockEndsAt } from './trade.js';

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
      .where(and(eq(planets.controllerPlayerId, playerId), eq(scanEvents.detected, true))),
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
  /**
   * `trade` IS A CONVOY OUT AT THE MERCHANT. D156.
   *
   * It is on this payload for the same reason `pirate` is, and the gap is the one
   * that hurt that lane: this list INNER JOINs `missions`, a convoy is not a
   * `missions` row, and without a second query the commander who launched one
   * cannot see it on any screen at all — `traffic.ts` deliberately excludes the
   * caller's own craft. D153's outbound-only camera follow reads `leg`/`status`
   * off this thread too, so it dies with it.
   */
  kind: 'fleet' | 'probe' | 'incoming' | 'transfer' | 'settlement' | 'death_star' | 'pirate' | 'trade';
  targetName: string;
  /**
   * THE WORLD THIS THREAD IS HEADING TOWARD.
   *
   * Not a radar product: it is the defender's own world, and the radar ladder
   * sells the ATTACKER's side — that something is coming (L3), how big (L4), from
   * where and with what (L5). This was simply absent, so a commander with four
   * worlds read "incoming, six minutes" and had no way to know where to move the
   * fleet. On your own craft it lets action surfaces match an in-flight mission
   * to a selected world without comparing a translated or hidden name.
   */
  targetPlanetId?: string;
  /**
   * THE CONTACT ON THE DISC THIS WARNING IS ABOUT. `incoming` ONLY. D162.
   *
   * Owner report: *"alttaki radar'da gelen uyarıya tıklayınca focus olmalı. Çünkü
   * bana neyin geldiği söyleniyor zaten."* The strip's only handle on a craft was
   * `path`, and a defender is deliberately never given one (D123) — so the one row
   * a commander most wants to look at was the one row that did nothing when
   * pressed, even while the fleet was drawn on their own disc.
   *
   * IT DISCLOSES NOTHING NEW, and that is the whole argument for it. This is the
   * mission uuid, which `/api/galaxy/traffic` already publishes as that craft's
   * contact key to everybody who can see it — and that payload already says which
   * contact is coming for the caller (`Contact.inbound`). What was missing was the
   * JOIN between two rows the client was handed separately.
   *
   * THE FOG STAYS IN THE CONTACT QUERY. Where no circle of the caller's covers the
   * craft, there is no contact carrying this id, so the client finds nothing to
   * focus and the row falls back to what it always was. A uuid on its own is not a
   * position, a heading or an origin.
   */
  contactId?: string;
  /**
   * WHICH PIRATE THIS RAID IS AT. `pirate` THREADS ONLY. D150.
   *
   * There is no world on the other end, so `targetPlanetId` is absent and
   * `targetName` carries the callsign. The level and callsign are handed over
   * structured rather than as a sentence, because the sentence belongs in the
   * client's locale files — the server has never written user-facing copy and this
   * is not the place to start.
   */
  pirate?: { level: PirateLevel; callsign: string };
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
   * What is in it. YOUR OWN MISSIONS, OR AN INBOUND ATTACK AT RADAR L5. D123.
   *
   * THE COMMENT THAT USED TO BE HERE WAS RIGHT AND THEN WAS OVERTAKEN TWICE.
   * It began as "composition is what Radar L5 sells, and an inbound attack must
   * never carry it", which stopped being true at D24 when every craft in the
   * galaxy became readable down to the hull — a defender could count the ships in
   * a contact on `/api/galaxy/traffic` exactly as any stranger could, so withholding
   * them here protected nothing. D123 removed that: a public contact now carries a
   * `mass` silhouette and no roster at all.
   *
   * So the roster comes back HERE, where the ladder always said it lived. Radar L4
   * estimates the size and Radar L5 names the hulls and the world they left, and
   * this is the one payload on which either is worth anything — a composition is a
   * decision when you know it is coming for you and a curiosity when it is one
   * more mote crossing the disc. Below L4 an inbound thread carries neither, and
   * it is omitted rather than nulled: there is no field for a modified client to
   * read.
   */
  fleet?: Fleet;
  /**
   * How big the inbound force looks. RADAR L4. D123.
   *
   * The rung between "something is coming" and "seventy-four Wasps and twenty
   * Lances": enough to decide whether to spend the stock, fly the fleet out or
   * stand, which are the three real options D9 exists to create. Absent on your
   * own craft, which carry the exact `fleet` instead.
   */
  mass?: MassClass;
  /**
   * Which world it left. RADAR L5, and the top of the ladder.
   *
   * `radarRevealsOrigin` has gated this figure since D45; until D123 there was no
   * field on this payload to put it in, so the top rung of the radar sold the same
   * thing the rung below it did. Naming the world is what turns a warning into a
   * grudge, and a grudge is what brings somebody back tomorrow.
   */
  originName?: string;
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
  const ownedWorlds = await db
    .select()
    .from(planets)
    .where(eq(planets.controllerPlayerId, playerId));
  const planet = ownedWorlds.find((world) => world.kind === 'CAPITAL');
  if (!planet) throw new GameError('NO_PLANET', 'Join a galaxy first', 404);
  const ownedIds = ownedWorlds.map((world) => world.id);

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
    const loot = r.loot.alloy + r.loot.crystal + deuteriumOf(r.loot);
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
        inArray(scanEvents.targetPlanetId, ownedIds),
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
      .where(inArray(buildings.planetId, ownedIds));
    const hours = awayMinutes / 60;
    // An estimate by design: the exact figure is on the planet screen, and this
    // line exists to say "time passed and it mattered", not to be audited.
    const alloy = levels
      .filter((building) => building.type === 'REFINERY')
      .reduce((total, building) => total + alloyRate(building.level) * hours, 0);
    const crystal = levels
      .filter((building) => building.type === 'EXTRACTOR')
      .reduce((total, building) => total + crystalRate(building.level) * hours, 0);
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
 * THE GATE AND THE WARNING MUST AGREE. Both use the shortened visual leg: surface
 * at departure, orbit at arrival, and the current public Core silhouettes. The
 * live strip and the scheduled warning call the same `inboundRadarLead` helper.
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
  const originCore = alias(buildings, 'pending_origin_core');
  const targetCore = alias(buildings, 'pending_target_core');

  const [observer] = await db
    .select({ playerId: planets.controllerPlayerId })
    .from(planets)
    .where(eq(planets.id, planetId));
  const playerId = observer?.playerId;
  const ownedIds = playerId
    ? (await db.select({ id: planets.id }).from(planets)
        .where(eq(planets.controllerPlayerId, playerId))).map((world) => world.id)
    : [planetId];

  const [inFlight, levels] = await Promise.all([
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
        originCoreLevel: originCore.level,
        targetCoreLevel: targetCore.level,
      })
      .from(missions)
      .innerJoin(originPlanet, eq(missions.originPlanetId, originPlanet.id))
      .innerJoin(targetPlanet, eq(missions.targetPlanetId, targetPlanet.id))
      .leftJoin(
        originCore,
        and(eq(originCore.planetId, originPlanet.id), eq(originCore.type, 'CORE')),
      )
      .leftJoin(
        targetCore,
        and(eq(targetCore.planetId, targetPlanet.id), eq(targetCore.type, 'CORE')),
      )
      .where(
        and(
          eq(missions.status, 'in_flight'),
          or(
            ...(playerId ? [eq(missions.ownerPlayerId, playerId)] : []),
            inArray(missions.targetPlanetId, ownedIds),
          ),
        ),
      ),
    instrumentLevels(db, ownedIds),
  ]);

  const radarByPlanet = new Map(ownedIds.map((id) => [id, levelOf(levels, id, 'RADAR')]));
  const pending: PendingThread[] = [];

  for (const row of inFlight) {
    const m = row.mission;
    const minutes = Math.max(0, Math.round((m.arriveAt.getTime() - now.getTime()) / 60_000));

    /**
     * WHOSE CRAFT IS THIS? THE SAME QUESTION `flight.ts` AND `traffic.ts` ASK.
     *
     * This used to be answered here for one case only — an inbound attack — and
     * everything else that touched this planet at either end fell through to the
     * branch below and was described as the caller's OWN craft. The query matches
     * `origin OR target`, and four different legs match it without being yours:
     *
     *   · a probe flying AT you        origin them, target you
     *   · that probe flying home       origin you,  target them   (parent set)
     *   · a raider's survivors leaving origin you,  target them   (kind 'return')
     *   · your own raid's return leg — which IS yours, at the other end
     *
     * Only the last is the caller's. The other three were handed out with a full
     * `path` (both endpoints, so the disc drew the route), the `fleet` inside them,
     * and `targetName` set to the OTHER WORLD'S NAME — so a player who had just
     * been probed could read who had probed them straight off their own pending
     * strip, and a player who had just been raided watched twenty of the attacker's
     * Wasps leave their orbit labelled as their own outbound squadron, complete
     * with a bombardment fired at the raider's homeworld when the phantom "landed".
     *
     * And every one of them is ALSO published to this caller by `/api/galaxy/traffic`
     * as an anonymous contact, because `galaxyTraffic` excludes only the legs the
     * caller genuinely owns. So the same mission was drawn twice on one disc, in two
     * different places, from two payloads that disagreed about what it was.
     */
    if (!playerId || m.ownerPlayerId !== playerId) {
      /**
       * SOMEBODY ELSE'S LEG. The only thing this payload may ever say about one is
       * that a raid is coming, and only once the radar has actually caught it.
       * Everything else about a foreign craft belongs to the public contact list,
       * where it arrives with no owner, no route and no name.
       */
      if ((m.kind !== 'attack' && m.kind !== 'death_star') || !ownedIds.includes(m.targetPlanetId)) continue;
      const radar = radarByPlanet.get(m.targetPlanetId) ?? 0;
      const reach = radarRange(radar);
      const oneWay = (m.arriveAt.getTime() - m.departAt.getTime()) / 60_000;
      const lead = inboundRadarLead(reach, {
        from: { x: row.originX, y: row.originY, z: row.originZ },
        to: { x: row.targetX, y: row.targetY, z: row.targetZ },
        originCoreLevel: row.originCoreLevel ?? 1,
        targetCoreLevel: row.targetCoreLevel ?? 1,
        oneWayMinutes: oneWay,
      });
      // Measured unrounded: `minutes` is rounded for display and comparing a
      // rounded figure against an exact one puts the strip and the warning up to
      // thirty seconds out of step with each other.
      const remaining = (m.arriveAt.getTime() - now.getTime()) / 60_000;
      if (!radarDetectsFleets(radar) || remaining > lead + LEAD_TOLERANCE) continue;
      /**
       * THE LADDER, SOLD WHERE IT MEANS SOMETHING. D123.
       *
       * Every purchased rung warns inside its own circle. L4 adds the size, L5 the
       * roster and the world it came from. All
       * three are derived from the DEFENDER'S CURRENT RADAR, read here at request
       * time — never from a level snapshotted when the fleet launched, because a
       * defender who buys a radar while a fleet is in the air has bought exactly
       * this.
       */
      /**
       * AND IT SAYS WHICH OF YOUR WORLDS IT IS COMING FOR.
       *
       * `targetName` was the literal string `'inbound fleet'` — a user-facing
       * sentence written on the server, which the client had to work around by
       * ignoring the field and printing its own. What a defender actually needs is
       * the one thing that was missing: with four worlds, "incoming, six minutes"
       * does not tell you where to move the fleet, and it is not a fact the fog
       * has any reason to hide. It is the defender's OWN world.
       *
       * The radar ladder is untouched by this. What it sells is the ATTACKER's
       * side — that something is coming at all, how big (L4), from where and
       * with what (L5). Which of your own worlds is under the crosshair was never
       * part of that, and withholding it only made the warning unusable.
       */
      pending.push({
        kind: 'incoming',
        targetName: row.targetName,
        targetPlanetId: m.targetPlanetId,
        // The key the same craft carries on the public contact list, so the strip
        // can focus what the disc is already drawing. See `contactId`. D162.
        contactId: m.id,
        minutesRemaining: minutes,
        arriveAt: m.arriveAt,
        ...(radarRevealsSize(radar) ? { mass: massClass(m.fleet) } : {}),
        ...(radarRevealsComposition(radar) ? { fleet: m.fleet } : {}),
        ...(radarRevealsOrigin(radar) ? { originName: row.originName } : {}),
      });
      continue;
    }

    // A return leg flies backwards: its target is home and its origin is the
    // planet that was raided, so the name worth showing is at the other end. Read
    // off the same rule that decided the leg was yours, rather than off a column —
    // the two agree for an owned leg and only one of them is the definition.
    const returning = m.kind === 'return' || m.parentMissionId !== null;
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
      kind: m.kind === 'probe'
        ? 'probe'
        : m.kind === 'transfer' || m.kind === 'settlement' || m.kind === 'death_star'
          ? m.kind
          : 'fleet',
      targetName: returning ? row.originName : row.targetName,
      targetPlanetId: returning ? m.originPlanetId : m.targetPlanetId,
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

  /**
   * AND THE RAIDS THIS COMMANDER HAS OUT AT PIRATES. D150 — gap G1.
   *
   * A SECOND QUERY RATHER THAN A JOIN, because a pirate raid is not a `missions`
   * row and never will be: `missions.{originPlanetId, targetPlanetId}` are both
   * NOT NULL foreign keys to `planets`, and a pirate has no address. The mining
   * table hit the same wall and made the same choice, for the reason written over
   * `pirate_raids`.
   *
   * WITHOUT THIS THE FEATURE IS INVISIBLE TO ITS OWN OWNER. `traffic.ts` removes
   * the caller's own craft from the public contact list — deliberately, so a
   * commander never sees a decorated copy of their own fleet beside the real one —
   * which means this list is the ONLY place a launched raid is drawn. A player
   * would have watched their fleet leave and then vanish.
   */
  /*
    KEYED ON THE COMMANDER, NEVER ON THE PAD. D150.

    This asked "which raids left one of my worlds", which is a different question
    the moment a colony changes hands mid-flight — and D97 makes that an ordinary
    event, not an edge case. A captured pad moved the raider's own squadron into
    the CAPTOR's mission strip and out of the raider's, and this list is the only
    place a launched raid is drawn at all (`traffic` deliberately excludes the
    caller's own craft), so the commander who committed the fleet simply watched it
    vanish. `resolvePirateReturn` already delivers through `ownerPlayerId`; the
    picture now asks the same question the delivery does.

    A `planets` join is still needed for the leg's home end and is still made on
    `planetId`: the squadron is parked at the pad and flies its leg from there,
    whoever owns it now. Only the OWNERSHIP question moved.
  */
  /*
    `playerId` IS NULLABLE AS WELL AS OPTIONAL — `planets.controller_player_id` is
    null on an unclaimed world, and this projection is asked about one. A raid
    always has an owner, so no commander means no raids rather than every raid.
  */
  const raids = !playerId
    ? []
    : await db
        .select({
          raid: pirateRaids,
          asteroidKey: seasons.asteroidKey,
          originName: planets.name,
          originX: planets.x,
          originY: planets.y,
          originZ: planets.z,
        })
        .from(pirateRaids)
        .innerJoin(planets, eq(pirateRaids.planetId, planets.id))
        .innerJoin(seasons, eq(pirateRaids.seasonId, seasons.id))
        .where(and(
          eq(pirateRaids.ownerPlayerId, playerId),
          inArray(pirateRaids.status, ['outbound', 'returning']),
        ));

  if (raids.length > 0) {
    /*
      THE FLEET AS IT IS NOW, not as it launched. A returning raid has already
      taken its casualties, and `pirate_raids.fleet` is the immutable launch
      roster — drawing that on the way home would show ships the player watched
      die. The parked `units` rows are the live answer, exactly as they are for a
      mission.
    */
    const parked = await db
      .select({ planetId: units.planetId, location: units.location, hull: units.hull, count: units.count })
      .from(units)
      .where(inArray(units.location, raids.map((row) => `pirate:${row.raid.id}`)));
    const aboard = new Map<string, Fleet>();
    for (const row of parked) {
      if (row.count <= 0) continue;
      const fleet = aboard.get(row.location) ?? {};
      fleet[row.hull] = (fleet[row.hull] ?? 0) + row.count;
      aboard.set(row.location, fleet);
    }

    for (const { raid, asteroidKey, originName, originX, originY, originZ } of raids) {
      const returning = raid.status === 'returning';
      const arriveAt = returning ? raid.homeAt : raid.arriveAt;
      // A raid with no survivors has no return leg and no `homeAt`; it is closed
      // out by the arrival itself and must not be drawn as a flight.
      if (!arriveAt) continue;
      const spec = privatePirateField(asteroidKey)[raid.pirateIndex];
      if (!spec) continue;
      const home = { x: originX, y: originY, z: originZ };
      const meet = { x: raid.interceptX, y: raid.interceptY, z: raid.interceptZ };
      pending.push({
        id: raid.id,
        kind: 'pirate',
        // The callsign, never a sentence. `originName` is deliberately unused:
        // the world at this end is the caller's own and is named by the strip.
        targetName: pirateCallsign(asteroidKey, raid.pirateIndex),
        pirate: { level: spec.level, callsign: pirateCallsign(asteroidKey, raid.pirateIndex) },
        minutesRemaining: Math.max(0, Math.round((arriveAt.getTime() - now.getTime()) / 60_000)),
        arriveAt,
        leg: returning ? 'return' : 'outbound',
        fleet: aboard.get(`pirate:${raid.id}`) ?? raid.fleet,
        path: {
          from: returning ? meet : home,
          to: returning ? home : meet,
          departAt: returning ? raid.arriveAt : raid.departAt,
          arriveAt,
        },
      });
      void originName;
    }
  }

  /**
   * AND THE CONVOYS THIS COMMANDER HAS OUT AT THE MERCHANT. D156.
   *
   * A THIRD QUERY RATHER THAN A JOIN, for the reason the raid query above states:
   * `missions.{originPlanetId, targetPlanetId}` are both NOT NULL foreign keys to
   * `planets`, and the merchant has no address. Mining hit the wall first, the
   * pirate lane hit it second, and this is the third table to answer it the same
   * way.
   *
   * WITHOUT THIS THE FEATURE IS INVISIBLE TO ITS OWN OWNER, exactly as the raid
   * lane was: `traffic.ts` removes the caller's own craft from the public contact
   * list — deliberately, so a commander never sees a decorated copy of their own
   * fleet beside the real one — which makes this list the ONLY place a launched
   * convoy is drawn. A player would have watched their transports leave and then
   * vanish.
   *
   * KEYED ON THE COMMANDER, NEVER ON THE PAD. D150. A colony that changes hands
   * mid-flight is an ordinary event (D97), and asking "which convoys left one of my
   * worlds" would move the trader's own flight into the CAPTOR's strip and out of
   * the trader's. `resolveTradeReturn` delivers through `ownerPlayerId`; the
   * picture asks the same question the delivery does.
   */
  const convoys = !playerId
    ? []
    : await db
        .select({
          run: tradeRuns,
          originX: planets.x,
          originY: planets.y,
          originZ: planets.z,
        })
        .from(tradeRuns)
        .innerJoin(planets, eq(tradeRuns.planetId, planets.id))
        .where(and(
          eq(tradeRuns.ownerPlayerId, playerId),
          inArray(tradeRuns.status, ['outbound', 'returning']),
        ));

  for (const { run, originX, originY, originZ } of convoys) {
    const returning = run.status === 'returning';
    const arriveAt = returning ? run.homeAt : run.arriveAt;
    if (!arriveAt) continue;
    const home = { x: originX, y: originY, z: originZ };
    const meet = { x: run.interceptX, y: run.interceptY, z: run.interceptZ };
    pending.push({
      id: run.id,
      kind: 'trade',
      /**
       * THE EVENT KIND, NOT A SENTENCE. D150's shape, and the server has never
       * written user-facing copy.
       *
       * "Ticaret Gemisi" and "Trade Ship" are two strings for one fact, and both
       * of them live in `apps/web/src/i18n/locales/`. What travels is the stable
       * identifier the client already knows from `/api/galaxy/events`, so the
       * strip names the merchant in the reader's own language without this file
       * having an opinion about which one that is.
       */
      targetName: 'TRADE_SHIP',
      // There is no world on the far end, so no world is named. Absent, not null:
      // there is no field for a client to read a lie out of.
      minutesRemaining: Math.max(0, Math.round((arriveAt.getTime() - now.getTime()) / 60_000)),
      arriveAt,
      leg: returning ? 'return' : 'outbound',
      /*
        WHAT LEFT IS WHAT IS ABOARD, ON BOTH LEGS, AND THAT IS A PROPERTY OF THE
        LANE RATHER THAN AN ASSUMPTION. There is no combat at a merchant, so unlike
        a raid there are no casualties for the launch roster to be stale about — the
        parked `units` rows and this column can never disagree.
      */
      fleet: run.fleet,
      path: {
        from: returning ? meet : home,
        to: returning ? home : meet,
        /**
         * THE RETURN LEG STARTS WHEN THE DOCK ENDS, NOT WHEN THE CONVOY ARRIVED.
         * D166.
         *
         * This read the raw `run.arriveAt`, so the trader's OWN path was
         * `TRADE.dockSeconds` longer than the flight actually is — while
         * `traffic.ts` published the same leg from `dockEndsAt(run.arriveAt)` to
         * every other commander. One flight with two clocks: the owner's convoy
         * interpolated behind where every stranger saw it, and appeared to leave
         * the merchant while it was still alongside.
         *
         * `dockEndsAt` is also the instant `resolveTradeArrival` measures the
         * return from, so this is the number the queue is actually waiting on.
         * D51/D52: one fleet, one authoritative clock.
         */
        departAt: returning ? dockEndsAt(run.arriveAt) : run.departAt,
        arriveAt,
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
