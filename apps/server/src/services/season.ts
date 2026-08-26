import { and, desc, eq } from 'drizzle-orm';
import {
  GALAXY,
  MULTI_WORLD,
  SEASON,
  SERVERS,
  alloyRate,
  crystalRate,
  deuteriumStorageCap,
  generateGalaxy,
  selectNeutralSlots,
  shieldHp,
  storageCap,
  type GalaxySpec,
  type NeutralTier,
} from '@astera/rules';
import type { Db, Tx } from '../db/client.js';
import {
  buildings,
  neutralPlanetState,
  planets,
  satellites,
  scheduledEvents,
  seasonResults,
  seasons,
  shards,
  units,
} from '../db/schema.js';
import { addMinutes } from '../clock.js';
import { schedule } from '../worker/queue.js';

/**
 * The galaxy is never stored slot by slot — it is regenerated from `seed`
 * wherever it is needed, identically on server, simulator and client.
 *
 * ASTEROIDS NO LONGER GET ROWS EITHER (D19). They used to, on the grounds that
 * impacts must be schedulable; impacts were never scheduled, and the field is now
 * a deterministic function of the seed like everything else. The only fact about a
 * rock that a formula and a clock cannot produce is how much ore somebody else has
 * already taken out of it, and that lives in `asteroid_claims`.
 */
const cache = new Map<string, GalaxySpec>();
/** Two live galaxies plus deploy/test turnover, without a process-lifetime leak. */
const GALAXY_CACHE_MAX = 32;

export function galaxyOf(
  seasonId: string,
  seed: number,
  slots: number = GALAXY.defaultSlots,
): GalaxySpec {
  const key = `${seasonId}:${slots}`;
  let spec = cache.get(key);
  if (!spec) {
    spec = generateGalaxy(seed, slots);
    cache.set(key, spec);
    while (cache.size > GALAXY_CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  } else {
    // Map insertion order is the LRU list; a hit moves this season to the tail.
    cache.delete(key);
    cache.set(key, spec);
  }
  return spec;
}

/**
 * An ordinal for a shard that was created without one.
 *
 * The two live galaxies are numbered 1..2 by `bootstrapServers`, and the ordinal
 * carries the sequential-fill rule — so a shard made outside that path (every test
 * fixture, and any one-off galaxy) needs a number that is unique, stable across
 * re-creation, and provably out of the way of the supported live range. A hash offset past
 * `SERVERS.count` is all three: the same code always lands on the same ordinal, so
 * `onConflictDoUpdate` on a re-run is a no-op rather than a silent renumbering.
 */
function incidentalOrdinal(code: string): number {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return SERVERS.count + 1 + (Math.abs(h) % 1_000_000);
}

export interface CreateSeasonInput {
  shardCode: string;
  shardName?: string;
  /** Fill order. Live galaxies fill strictly in ascending ordinal. D21/D100. */
  ordinal?: number;
  seed: number;
  startsAt: Date;
  days?: number;
  playerCap?: number;
  /** Immutable activation boundary. New production seasons use v3. */
  rulesetVersion?: number;
}

export async function createSeason(db: Db, input: CreateSeasonInput) {
  const { shard, season } = await db.transaction((tx) => createSeasonIn(tx, input));
  return { shard, season, galaxy: galaxyOf(season.id, input.seed, input.playerCap ?? SERVERS.capacity) };
}

/** Create one season inside a larger atomic world operation. D88. */
export async function createSeasonIn(tx: Tx, input: CreateSeasonInput) {
  const cap = input.playerCap ?? SERVERS.capacity;
  const name = input.shardName ?? input.shardCode;
  const ordinal = input.ordinal ?? incidentalOrdinal(input.shardCode);
  const days = input.days ?? SEASON.days;
  const endsAt = addMinutes(input.startsAt, days * 24 * 60);
  const [shard] = await tx
      .insert(shards)
      .values({ code: input.shardCode, name, ordinal, playerCap: cap })
      .onConflictDoUpdate({ target: shards.code, set: { name, ordinal, playerCap: cap } })
      .returning();

  const [season] = await tx
      .insert(seasons)
      .values({
        shardId: shard!.id,
        seed: input.seed,
        status: 'live',
        startsAt: input.startsAt,
        endsAt,
        rulesetVersion: input.rulesetVersion ?? MULTI_WORLD.rulesetVersion,
      })
      .returning();

  await schedule(tx, {
    seasonId: season!.id,
    kind: 'season_end',
    refId: season!.id,
    resolveAt: endsAt,
  });
  await schedule(tx, {
    seasonId: season!.id,
    kind: 'season_rollover',
    refId: season!.id,
    resolveAt: addMinutes(endsAt, SEASON.afterglowMinutes),
  });
  for (const act of SEASON.actBoundaries) {
    await schedule(tx, {
      seasonId: season!.id,
      kind: 'season_act',
      refId: season!.id,
      payload: { act: act.id },
      resolveAt: addMinutes(input.startsAt, days * 24 * 60 * act.share),
    });
  }
  if (season!.rulesetVersion >= MULTI_WORLD.neutralWorldRulesetVersion) {
    await createNeutralWorlds(tx, season!.id, input.seed, input.startsAt);
  }
  return { shard: shard!, season: season! };
}

async function createNeutralWorlds(
  tx: Tx,
  seasonId: string,
  seed: number,
  startsAt: Date,
): Promise<void> {
  const spec = generateGalaxy(seed, MULTI_WORLD.neutralSlotPool);
  const selected = selectNeutralSlots(seed, spec.slots);
  const expected =
    MULTI_WORLD.neutralCounts[1]
    + MULTI_WORLD.neutralCounts[2]
    + MULTI_WORLD.neutralCounts[3];
  if (selected.length !== expected) {
    throw new Error(`neutral slot selection did not produce ${String(expected)} worlds`);
  }

  const ordinal = new Map<NeutralTier, number>([[1, 0], [2, 0], [3, 0]]);
  for (const neutral of selected) {
    const tier = neutral.tier;
    const template = MULTI_WORLD.neutral[tier];
    const number = (ordinal.get(tier) ?? 0) + 1;
    ordinal.set(tier, number);
    const alloyCap = storageCap(alloyRate(template.buildings.REFINERY), template.buildings.VAULT);
    const crystalCap = storageCap(crystalRate(template.buildings.EXTRACTOR), template.buildings.VAULT);
    const deuteriumCap = deuteriumStorageCap(
      crystalRate(template.buildings.EXTRACTOR),
      template.buildings.VAULT,
    );
    const nextReinforcementAt = template.reinforcementMinutes === null
      ? null
      : addMinutes(startsAt, template.reinforcementMinutes);
    const [world] = await tx
      .insert(planets)
      .values({
        controllerPlayerId: null,
        seasonId,
        kind: 'NEUTRAL',
        name: `Neutral T${String(tier)}-${String(number).padStart(2, '0')}`,
        slotIndex: neutral.slot.index,
        x: neutral.slot.x,
        y: neutral.slot.y,
        z: neutral.slot.z,
        alloy: alloyCap,
        crystal: crystalCap,
        // Neutrals never mint Deuterium, but the season starts with every shared
        // stockpile full. Once raided or spent this reserve can only decrease.
        deuterium: deuteriumCap,
        shield: tier === 3 ? shieldHp(3) : 0,
        lastTickAt: startsAt,
      })
      .returning();
    if (!world) throw new Error('failed to create neutral world');

    await tx.insert(buildings).values(
      Object.entries(template.buildings).map(([type, level]) => ({
        planetId: world.id,
        type,
        level,
      })),
    );
    if (tier === 3) {
      await tx.insert(satellites).values({ planetId: world.id, slot: 0, type: 'AEGIS', level: 3 });
    }
    const fleet = { ...template.fleet, ...template.ground };
    const unitRows = Object.entries(fleet)
      .filter(([, count]) => count > 0)
      .map(([hull, count]) => ({
        planetId: world.id,
        // Neutrals have no player owner. The expand column remains nullable for
        // system garrisons and is contracted only for player-owned units.
        ownerPlayerId: null,
        hull: hull as keyof typeof fleet,
        location: 'home',
        count,
      }));
    if (unitRows.length > 0) await tx.insert(units).values(unitRows);
    await tx.insert(neutralPlanetState).values({
      planetId: world.id,
      tier,
      profileSeed: neutral.profileSeed,
      nextReinforcementAt,
      economyAnchorAt: startsAt,
    });
    if (nextReinforcementAt) {
      await schedule(tx, {
        seasonId,
        kind: 'neutral_reinforce',
        refId: world.id,
        payload: { expectedAt: nextReinforcementAt.toISOString() },
        resolveAt: nextReinforcementAt,
      });
    }
  }
}

/**
 * Seat the three public Act beats on seasons created before D96.
 *
 * This is boot repair rather than migration data: PostgreSQL cannot use a new
 * enum value in the same transaction that adds it. The season lock makes two
 * workers starting together idempotent without adding a payload-expression
 * uniqueness rule to the queue.
 */
export async function ensureSeasonActs(db: Db): Promise<number> {
  const candidates = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(eq(seasons.status, 'live'));
  let inserted = 0;

  for (const candidate of candidates) {
    inserted += await db.transaction(async (tx) => {
      const [season] = await tx
        .select({
          id: seasons.id,
          startsAt: seasons.startsAt,
          endsAt: seasons.endsAt,
        })
        .from(seasons)
        .where(and(eq(seasons.id, candidate.id), eq(seasons.status, 'live')))
        .for('update');
      if (!season) return 0;

      const existing = await tx
        .select({ payload: scheduledEvents.payload })
        .from(scheduledEvents)
        .where(
          and(
            eq(scheduledEvents.seasonId, season.id),
            eq(scheduledEvents.kind, 'season_act'),
          ),
        );
      const existingActs = new Set(
        existing.flatMap((row) =>
          typeof row.payload?.act === 'string' ? [row.payload.act] : [],
        ),
      );
      let added = 0;
      const durationMs = season.endsAt.getTime() - season.startsAt.getTime();
      for (const act of SEASON.actBoundaries) {
        if (existingActs.has(act.id)) continue;
        await schedule(tx, {
          seasonId: season.id,
          kind: 'season_act',
          refId: season.id,
          payload: { act: act.id },
          resolveAt: new Date(season.startsAt.getTime() + durationMs * act.share),
        });
        added++;
      }
      return added;
    });
  }

  return inserted;
}

export async function liveSeason(db: Db, shardCode: string) {
  const [row] = await db
    .select({ season: seasons, shard: shards })
    .from(seasons)
    .innerJoin(shards, eq(seasons.shardId, shards.id))
    .where(and(eq(shards.code, shardCode), eq(seasons.status, 'live')))
    .limit(1);
  return row;
}

/** The one permanent story needed on session open, including where it happened. */
export async function latestSeasonResult(db: Db, accountId: string) {
  const [row] = await db
    .select({ result: seasonResults, shard: shards })
    .from(seasonResults)
    .innerJoin(seasons, eq(seasonResults.seasonId, seasons.id))
    .innerJoin(shards, eq(seasons.shardId, shards.id))
    .where(eq(seasonResults.accountId, accountId))
    .orderBy(desc(seasonResults.createdAt), desc(seasonResults.seasonId))
    .limit(1);
  if (!row) return null;
  return {
    ...row.result,
    shard: row.shard.code,
    shardName: row.shard.name === '' ? row.shard.code : row.shard.name,
  };
}

export async function occupiedSlots(db: Db, seasonId: string): Promise<Set<number>> {
  const rows = await db
    .select({ slotIndex: planets.slotIndex })
    .from(planets)
    .where(and(eq(planets.seasonId, seasonId), eq(planets.kind, 'CAPITAL')));
  return new Set(rows.map((r) => r.slotIndex));
}
