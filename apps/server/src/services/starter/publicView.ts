import { MULTI_WORLD, isFeatureOpen, lookOfShare, moduleStage, playsFirstHunt, sensorZone, vesselSphere, type VesselLook } from '@astera/rules';
import { and, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Clock } from '../../clock.js';
import type { Queryable } from '../../db/client.js';
import { shards, starterGalaxies, starterSites, vesselProbeReports, vessels } from '../../db/schema.js';
import { GameError } from '../planet.js';
import { progressOf, refuseLeft } from './vessel.js';
import { partSight, siteName } from './world.js';

/** This galaxy has no end, and a season clock reaching zero sends a client to the galaxy list. */
const FAR_AWAY_MS = 365 * 86_400_000;

/** On the map and in the count: a sleeping ship has left both until it wakes. */
const STILL_HERE = inArray(vessels.status, ['ACTIVE', 'DEPARTING']);

async function aboard(q: Queryable, accountId: string) {
  const [found] = await q.select({ row: vessels, galaxy: starterGalaxies, shard: shards }).from(vessels)
    .innerJoin(starterGalaxies, eq(starterGalaxies.id, vessels.starterGalaxyId))
    .innerJoin(shards, eq(shards.id, starterGalaxies.shardId))
    .where(eq(vessels.accountId, accountId));
  if (!found) throw new GameError('VESSEL_NOT_FOUND', 'This account has no colony ship', 404);
  refuseLeft(found.row);
  return found;
}

/** Shaped as the main `/api/season`, because the galaxy screen cannot open without one. Plan §5.7. */
export async function starterSeasonView(q: Queryable, accountId: string, clock: Clock) {
  const { galaxy, shard } = await aboard(q, accountId);
  const [count] = await q.select({ n: sql<number>`count(*)::int` }).from(vessels)
    .where(and(eq(vessels.starterGalaxyId, galaxy.id), STILL_HERE));
  return {
    seasonId: galaxy.id,
    shard: shard.code,
    shardName: shard.name,
    seed: galaxy.seed,
    status: 'live',
    startsAt: galaxy.epoch,
    endsAt: new Date(clock.now().getTime() + FAR_AWAY_MS),
    playerCap: galaxy.capacity,
    players: count?.n ?? 0,
    rulesetVersion: MULTI_WORLD.rulesetVersion,
    rivals: [],
    result: null,
    shieldUntil: null,
    shieldKind: null,
  };
}

const LEVELS = [1, 2, 3] as const;
const tierOf = (level: number): 1 | 2 | 3 => LEVELS[Math.max(0, Math.min(level, LEVELS.length) - 1)] ?? 1;
const THREATS = ['GUARDED', 'GUARDED', 'FORTIFIED'] as const;
const RESERVES = ['LOW', 'LOW', 'RICH'] as const;
const threatOf = (level: number): (typeof THREATS)[number] => THREATS[tierOf(level) - 1]!;
const reserveOf = (level: number): (typeof RESERVES)[number] => RESERVES[tierOf(level) - 1]!;

/** Someone else's hull is a wreck until a probe has read otherwise, and then it stays as read (§3.11). */
function lookFromReading(snapshot: Record<string, unknown> | undefined): VesselLook {
  const repair = z.object({ repair: z.object({ low: z.number(), high: z.number() }) }).safeParse(snapshot);
  if (!repair.success) return 'WRECKED';
  return lookOfShare((repair.data.repair.low + repair.data.repair.high) / 200);
}

/**
 * THE MAP, SHAPED AS THE MAIN `/api/galaxy`. A ship you have not earned is a position and nothing
 * else: absent, not null, so that a modified client has nothing to look for (D127). Every ship is
 * Core 1 here, which keeps the tier band shut without the band's code knowing about ships.
 */
export async function starterGalaxyView(q: Queryable, accountId: string, clock: Clock) {
  const { row, galaxy } = await aboard(q, accountId);
  const now = clock.now();
  const progress = progressOf(row);
  // The dark points arrive with the survey antenna (§3.7), and the lock lives here, not in a menu.
  const others = isFeatureOpen(progress, 'intel')
    ? await q.select({ id: vessels.id, name: vessels.name, x: vessels.x, y: vessels.y, z: vessels.z, pvpOpenAt: vessels.pvpOpenAt, recoveryUntil: vessels.recoveryUntil }).from(vessels)
      .where(and(eq(vessels.starterGalaxyId, galaxy.id), STILL_HERE, ne(vessels.id, row.id)))
    : [];
  const reports = others.length === 0 ? [] : await q.select({
    targetVesselId: vesselProbeReports.targetVesselId, targetName: vesselProbeReports.targetName, at: vesselProbeReports.at, snapshot: vesselProbeReports.snapshot,
  }).from(vesselProbeReports).where(and(eq(vesselProbeReports.observerVesselId, row.id), isNotNull(vesselProbeReports.deliveredAt))).orderBy(desc(vesselProbeReports.at));
  const lastLook = new Map<string, (typeof reports)[number]>();
  for (const report of reports) if (report.targetVesselId && !lastLook.has(report.targetVesselId)) lastLook.set(report.targetVesselId, report);
  const outposts = isFeatureOpen(progress, 'fleet')
    ? await q.select().from(starterSites).where(and(eq(starterSites.starterGalaxyId, galaxy.id), eq(starterSites.kind, 'OUTPOST')))
    : [];
  const seesPart = outposts.length > 0 ? await partSight(q, row) : () => false;
  const position = { x: row.x, y: row.y, z: row.z };
  // The first hunt's two, marked alike until the first outpost win (§5.2): where to look, not which guard is which.
  const hunting = !progress.facts.includes('FIRST_OUTPOST_VICTORY');
  const firstHunt = (site: (typeof outposts)[number]): boolean =>
    hunting && site.respawnAt === null && playsFirstHunt(position, { x: site.x, y: site.y, z: site.z, level: site.level, guard: site.guardFull });
  const telescope = moduleStage(progress, 'TELESCOPE');
  const sphere = vesselSphere(position, telescope, moduleStage(progress, 'RADAR'), row.id);
  return {
    you: { planetId: row.id, playerId: row.id, capitalPlanetId: row.id, planetIds: [row.id] },
    sensors: [{ ...sphere, telescope: telescope > 0 }],
    planets: [
      {
        id: row.id,
        body: 'VESSEL' as const,
        name: row.name,
        owner: row.name,
        kind: 'CAPITAL' as const,
        controller: { kind: 'PLAYER' as const, playerId: row.id, displayName: row.name },
        position,
        coreTier: 1,
        coreLevel: 1,
        intel: 'RESOLVED' as const,
        satellites: [],
        shielded: row.shield > 0,
        isSelf: true,
        isOwned: true,
        isCapital: true,
        state: { kind: 'NORMAL' as const },
      },
      ...others.map((other) => {
        const at = { x: other.x, y: other.y, z: other.z };
        const point = { id: other.id, body: 'VESSEL' as const, position: at, isSelf: false, isOwned: false };
        const look = lastLook.get(other.id);
        const seen = sensorZone([sphere], at) === 'IDENTIFIED';
        // Absent, not null: a ship you have not earned has nothing here for a modified client to read.
        if (!seen && !look) return { ...point, intel: 'UNKNOWN' as const, state: { kind: 'NORMAL' as const } };
        const shield = other.pvpOpenAt && other.pvpOpenAt > now ? other.pvpOpenAt : null;
        const recovery = other.recoveryUntil && other.recoveryUntil > now ? other.recoveryUntil : null;
        return {
          ...point,
          intel: seen ? 'RESOLVED' as const : 'REMEMBERED' as const,
          ...(seen ? {} : { seenAt: look!.at }),
          name: other.name,
          owner: other.name,
          kind: 'CAPITAL' as const,
          controller: { kind: 'PLAYER' as const, playerId: other.id, displayName: other.name },
          coreTier: 1,
          coreLevel: 1,
          satellites: [],
          look: lookFromReading(look?.snapshot),
          state: recovery ? { kind: 'RECOVERY' as const, until: recovery }
            : shield ? { kind: 'PROTECTED' as const, until: shield } : { kind: 'NORMAL' as const },
        };
      }),
      ...outposts.map(site => ({
        id: site.id,
        body: 'OUTPOST' as const,
        position: { x: site.x, y: site.y, z: site.z },
        intel: 'RESOLVED' as const,
        isSelf: false,
        isOwned: false,
        name: siteName(site),
        owner: '',
        kind: 'NEUTRAL' as const,
        controller: { kind: 'NEUTRAL' as const, tier: tierOf(site.level) },
        coreTier: site.level,
        coreLevel: site.level,
        satellites: [],
        state: { kind: 'NORMAL' as const },
        neutral: { tier: tierOf(site.level), threat: threatOf(site.level), reserve: reserveOf(site.level), claimUntil: null },
        ...(seesPart(site) ? { hasPart: true } : {}),
        ...(firstHunt(site) ? { firstHunt: true } : {}),
      })),
    ],
    rivals: [],
    result: null,
  };
}
