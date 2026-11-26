import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyBaseLogger } from 'fastify';
import {
  ALL_HULLS, combatValue, distance, fleetCount, fleetSpeed, fleetSpeedMult, fleetValue, interceptOrbit, missionFuel,
  piratePosition, pirateStats, travelExact,
} from '@astera/rules';
import { type Clock, minutesSince } from '../../clock.js';
import type { Db, Queryable } from '../../db/client.js';
import { missions, notifications } from '../../db/schema.js';
import { GameError } from '../planet.js';
import { planetView, type PlanetView } from '../planetView.js';
import { launchPirateRaid } from '../pirateRaid.js';
import { loadPirateSnapshot, pirateId } from '../pirateField.js';
import { techOf } from '../researchState.js';
import { planPirateRaid, raidingWing } from './judgement.js';
import { BOTS, type BotPersona } from './personas.js';

/**
 * WHAT ITS OWN RADAR SAYS IS COMING. Owner plan 2026-11-26 (docs/bot-plani-2026-11-26.md F3.2);
 * the rule was first written for the moon hop (Ay F8). It reads ONLY this commander's
 * `incoming_fleet` warnings — the line a person's phone shows — so a raid the radar never saw is
 * a raid the bot knows nothing about.
 */
export interface RaidWarning {
  readonly warned: boolean;
  /** The warned fleet would meet or beat what stands at home. */
  readonly outmatched: boolean;
  /** When the first warned raid lands. */
  readonly impactAt: Date | null;
  /** That raid: what a commander decides about it, it decides once (`answerWarnings`). */
  readonly raidId: string | null;
}

const NO_WARNING: RaidWarning = { warned: false, outmatched: false, impactAt: null, raidId: null };

/** A warning's payload is stored JSON: parsed at the boundary, never cast. */
const warningPayload = z.object({
  fleet: z.record(z.enum(['DART', ...ALL_HULLS]), z.number()).optional(),
  mass: z.string().optional(),
}).passthrough().nullable();

export async function raidWarning(
  db: Queryable, playerId: string, planetId: string, view: PlanetView,
): Promise<RaidWarning> {
  const warned = await db.select({ refId: notifications.refId, payload: notifications.payload })
    .from(notifications)
    .where(and(eq(notifications.playerId, playerId), eq(notifications.kind, 'incoming_fleet')));
  const refIds = warned.map((row) => row.refId).filter((id): id is string => id !== null);
  if (refIds.length === 0) return NO_WARNING;
  const incoming = await db.select({ id: missions.id, arriveAt: missions.arriveAt }).from(missions).where(and(
    inArray(missions.id, refIds),
    eq(missions.status, 'in_flight'),
    eq(missions.targetPlanetId, planetId),
    eq(missions.targetBody, 'PLANET'),
  ));
  if (incoming.length === 0) return NO_WARNING;
  const ids = new Set(incoming.map((row) => row.id));
  const home = combatValue(view.fleet) + fleetValue(view.ground);
  let outmatched = false;
  for (const row of warned) {
    if (row.refId === null || !ids.has(row.refId)) continue;
    const parsed = warningPayload.safeParse(row.payload);
    const payload = parsed.success ? parsed.data : null;
    if (payload?.fleet) {
      if (combatValue(payload.fleet) >= home * 0.85) outmatched = true;
    } else if (payload?.mass === 'HEAVY' || payload?.mass === 'MEDIUM' || !payload?.mass) {
      outmatched = true;
    }
  }
  const first = incoming.reduce((a, b) => (b.arriveAt < a.arriveAt ? b : a));
  return { warned: true, outmatched, impactAt: first.arriveAt, raidId: first.id };
}

/**
 * THE FLEET LEAVES BEFORE THE RAID LANDS (F3.2): every warship, after a pirate it can beat and
 * far enough that it is still out when the raid arrives. Through the pirate service a phone
 * uses, so sight, fuel and the bay all bind. Returns the world as it stands after, or null.
 */
export async function fleetSave(
  db: Db, clock: Clock, seat: { playerId: string; planetId: string; seasonId: string },
  persona: BotPersona, view: PlanetView, impactAt: Date, did: string[], log: FastifyBaseLogger,
): Promise<PlanetView | null> {
  const wing = raidingWing(view.fleet, 1);
  if (fleetCount(wing) === 0) return null;
  const now = clock.now();
  const snapshot = await loadPirateSnapshot(db, seat.seasonId, now);
  const standing = snapshot.standing(now);
  if (standing.length === 0) return null;
  const nowMinutes = minutesSince(snapshot.startsAt, now);
  const tech = await techOf(db, seat.playerId);
  const speed = fleetSpeed(wing, tech) * fleetSpeedMult(view.orbit);
  const budget = { left: BOTS.forecastsPerTurn };
  const nearest = standing
    .map((spec) => ({ spec, d: distance(view.planet.position, piratePosition(spec, nowMinutes)) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  for (const { spec } of nearest) {
    // Timed to where it will be met, as the pirate service solves it: the orbit is quick.
    const hit = interceptOrbit(view.planet.position, speed, spec, spec.expiresAt, nowMinutes);
    if (!hit) continue;
    const d = distance(view.planet.position, hit.at);
    const away = hit.flightMinutes + travelExact(d, speed);
    if (now.getTime() + away * 60_000 <= impactAt.getTime()) continue;
    if (missionFuel(wing, d, 2) > view.planet.deuterium) continue;
    // Winnable is the question, not profitable: the haul is a bonus on a flight made to be away.
    const plan = planPirateRaid({
      fleet: view.fleet, tech, nerve: { ...persona.nerve, lootOverFuel: 0 }, distance: d,
      deuterium: view.planet.deuterium, crew: snapshot.livingRosterOf(spec.index),
      damageMult: pirateStats(spec.level).damageMult, hoard: snapshot.remainingLootOf(spec.index),
    }, budget);
    if (!plan) continue;
    try {
      await launchPirateRaid(db, seat.planetId, pirateId(snapshot.key, spec.index), wing, clock, seat.playerId);
    } catch (err) {
      if (!(err instanceof GameError)) throw err;
      log.debug({ code: err.code }, 'bot fleet save refused');
      continue;
    }
    did.push('fleet-save');
    return db.transaction((tx) => planetView(tx, seat.planetId, clock));
  }
  return null;
}
