import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import {
  ECONOMY_PROFILE,
  GALAXY,
  MULTI_WORLD,
  NEUTRAL_OPENING,
  SEASON,
  SERVERS,
  alloyRate,
  crystalRate,
  deuteriumRate,
  deuteriumStorageCap,
  generateGalaxy,
  neutralDemand,
  neutralOpeningOrder,
  neutralOpenings,
  selectNeutralSlots,
  shieldHp,
  storageCap,
  CURRENT_SEASON_RANK_REWARD_PROGRAM_VERSION,
  type GalaxySpec,
  type NeutralTier,
  MONUMENT_SEASON_DEFAULTS,
  MONUMENT_BALANCE,
  monumentDifficulty,
} from '@astera/rules';
import type { Db, Tx } from '../db/client.js';
import {
  buildings,
  neutralPlanetState,
  planets,
  players,
  satellites,
  scheduledEvents,
  seasonResults,
  seasonCycles,
  seasons,
  shards,
  monuments,
  hpRadiationSources,
  units,
} from '../db/schema.js';
import { addMinutes } from '../clock.js';
import { schedule } from '../worker/queue.js';
import { floorHour, scheduleAsteroidHour } from './asteroidSpawn.js';
import { seedGalaxyEventCalendar } from './galaxyEvents.js';
import { CURRENT_SEASON_STATS_VERSION } from './seasonArchive.js';
import { colonyStandings } from './ownership.js';
import { isPerson } from './people.js';
import { publishShard } from '../stream/bus.js';
import { recordGalaxyEvent } from './chronicle.js';

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
  /** Waiting provisioning preserves the original period exactly. */
  endsAt?: Date;
  initializedAt?: Date;
  role?: 'MAIN' | 'WAITING';
  playerCap?: number;
  /** Immutable activation boundary. New production seasons use Fleet V2 ruleset v4. */
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
  const days = input.days ?? ECONOMY_PROFILE.seasonDays;
  const endsAt = input.endsAt ?? addMinutes(input.startsAt, days * 24 * 60);
  const initializedAt = input.initializedAt ?? input.startsAt;
  // One lock makes max+1 a durable identity rather than a race between shard
  // bootstrap transactions. Exact period matches still share the same number.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('season-cycle-ordinal'))`);
  const [existingCycle] = await tx
    .select()
    .from(seasonCycles)
    .where(and(
      eq(seasonCycles.startsAt, input.startsAt),
      eq(seasonCycles.endsAt, endsAt),
    ))
    .limit(1);
  const [nextCycle] = existingCycle ? [] : await tx
    .select({ ordinal: sql<number>`coalesce(max(${seasonCycles.ordinal}), 0)::int + 1` })
    .from(seasonCycles);
  const [insertedCycle] = existingCycle ? [] : await tx
    .insert(seasonCycles)
    .values({
      ordinal: nextCycle?.ordinal ?? 1,
      statsVersion: CURRENT_SEASON_STATS_VERSION,
      rewardProgramVersion: CURRENT_SEASON_RANK_REWARD_PROGRAM_VERSION,
      startsAt: input.startsAt,
      endsAt,
    })
    .returning();
  const cycle = existingCycle ?? insertedCycle;
  if (!cycle) throw new Error('Season cycle allocation returned no row');
  const [shard] = await tx
      .insert(shards)
      .values({ code: input.shardCode, name, ordinal, playerCap: cap, role: input.role ?? 'MAIN' })
      .onConflictDoUpdate({ target: shards.code, set: { name, ordinal, playerCap: cap } })
      .returning();

  const [season] = await tx
      .insert(seasons)
      .values({
        shardId: shard!.id,
        cycleId: cycle.id,
        seed: input.seed,
        status: 'live',
        startsAt: input.startsAt,
        endsAt,
        rulesetVersion: input.rulesetVersion ?? MULTI_WORLD.rulesetVersion,
        statsVersion: cycle.statsVersion,
        /*
          ON THE DYNAMIC ASTEROID FIELD FROM ITS FIRST INSTANT. 2026-09-16. The first
          hour is opened at the later of the start and the moment the season was
          provisioned, so a waiting galaxy does not open hours nobody could play.
        */
        asteroidDynamicFrom: (input.rulesetVersion ?? MULTI_WORLD.rulesetVersion)
            >= MULTI_WORLD.dynamicAsteroidFieldRulesetVersion
          ? input.startsAt
          : null,
      })
      .returning();

  if (season!.rulesetVersion >= MULTI_WORLD.monumentRulesetVersion) {
    await seedApprovedMonuments(tx, season!, initializedAt);
  }

  await seedGalaxyEventCalendar(tx, season!, initializedAt);
  if (season!.asteroidDynamicFrom !== null) {
    const opensAt = initializedAt > season!.startsAt ? initializedAt : season!.startsAt;
    await scheduleAsteroidHour(tx, {
      seasonId: season!.id,
      hourStartsAt: floorHour(opensAt),
      resolveAt: opensAt,
    });
  }

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
    const resolveAt = new Date(input.startsAt.getTime() + (endsAt.getTime() - input.startsAt.getTime()) * act.share);
    await tx.insert(scheduledEvents).values({
      seasonId: season!.id,
      kind: 'season_act',
      refId: season!.id,
      payload: { act: act.id },
      resolveAt,
      // Durable done markers prevent boot repair from replaying past season acts.
      status: resolveAt < initializedAt ? 'done' : 'pending',
    });
  }
  if (season!.rulesetVersion >= MULTI_WORLD.neutralWorldRulesetVersion) {
    const staged = season!.rulesetVersion >= MULTI_WORLD.neutralCensusRulesetVersion;
    await createNeutralWorlds(
      tx,
      season!.id,
      input.seed,
      initializedAt,
      staged ? NEUTRAL_OPENING.initial : MULTI_WORLD.neutralCounts,
    );
    if (staged) {
      const firstCensusAt = new Date(
        season!.startsAt.getTime() + NEUTRAL_OPENING.firstCensusDays * 24 * 60 * 60_000,
      );
      if (firstCensusAt < season!.endsAt) {
        await scheduleNeutralCensus(tx, {
          seasonId: season!.id,
          censusAt: firstCensusAt,
        });
      }
    }
  }
  return { shard: shard!, season: season! };
}

/** Deal the approved monument map atomically with a new HP-radiation season. */
async function seedApprovedMonuments(
  tx: Tx,
  season: typeof seasons.$inferSelect,
  settledAt: Date,
): Promise<void> {
  const rows = await tx.insert(monuments).values(MONUMENT_SEASON_DEFAULTS.positions.map((position, index) => {
    const difficulty = monumentDifficulty(index + 1);
    const balance = MONUMENT_BALANCE[difficulty];
    return {
      seasonId: season.id,
      ordinal: index + 1,
      difficulty,
      ...position,
      capacity: balance.capacity,
      productionPerMinute: balance.productionPerMinute,
      garrison: { ...balance.garrison },
      garrisonTemplate: { ...balance.garrison },
      garrisonTech: { ...MONUMENT_SEASON_DEFAULTS.garrisonTech },
      garrisonDamage: [],
      settledAt,
    };
  })).returning({ id: monuments.id, ordinal: monuments.ordinal, x: monuments.x, y: monuments.y, z: monuments.z });
  if (rows.length !== MONUMENT_SEASON_DEFAULTS.count) {
    throw new Error(`approved monument deal created ${String(rows.length)} targets`);
  }
  await tx.insert(hpRadiationSources).values(rows.map((row) => ({
    seasonId: season.id,
    anchorKind: 'MONUMENT' as const,
    anchorId: row.id,
    x: row.x,
    y: row.y,
    z: row.z,
    radius: MONUMENT_SEASON_DEFAULTS.cloudRadius,
    intensityHpPerMinute: MONUMENT_BALANCE[monumentDifficulty(row.ordinal)].intensityHpPerMinute,
    mode: 'EMIT' as const,
    activeFrom: season.startsAt,
    activeUntil: null,
    label: `Monument ${String(row.ordinal)} cloud`,
  })));
}

async function createNeutralWorlds(
  tx: Tx,
  seasonId: string,
  seed: number,
  startsAt: Date,
  counts: Readonly<Record<NeutralTier, number>>,
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
  await openNeutralWorlds(tx, seasonId, seed, startsAt, counts, selected);
}

const emptyNeutralCounts = (): Record<NeutralTier, number> => ({ 1: 0, 2: 0, 3: 0 });

async function openNeutralWorlds(
  tx: Tx,
  seasonId: string,
  seed: number,
  startsAt: Date,
  counts: Readonly<Record<NeutralTier, number>>,
  selectedInput?: readonly ReturnType<typeof selectNeutralSlots>[number][],
): Promise<Record<NeutralTier, number>> {
  const selected = selectedInput ?? selectNeutralSlots(
    seed,
    generateGalaxy(seed, MULTI_WORLD.neutralSlotPool).slots,
  );
  const ordered = neutralOpeningOrder(seed, selected);
  const existingRows = await tx
    .select({ slotIndex: planets.slotIndex })
    .from(planets)
    .where(eq(planets.seasonId, seasonId));
  const occupied = new Set(existingRows.map((row) => row.slotIndex));
  const opened = emptyNeutralCounts();
  for (const tier of [1, 2, 3] as const) {
    const tierOrder = ordered.filter((entry) => entry.tier === tier);
    let remaining = Math.min(
      Math.max(0, Math.floor(counts[tier])),
      tierOrder.filter((entry) => !occupied.has(entry.slot.index)).length,
    );
    for (const [ordinal, neutral] of tierOrder.entries()) {
      if (remaining <= 0) break;
      if (occupied.has(neutral.slot.index)) continue;
      await createNeutralWorld(tx, seasonId, neutral, startsAt, ordinal + 1);
      occupied.add(neutral.slot.index);
      opened[tier] += 1;
      remaining -= 1;
    }
  }
  return opened;
}

/** Shared seed template for a new galaxy and a colony reset after inactivity. */
export async function createNeutralWorld(
  tx: Tx, seasonId: string, neutral: ReturnType<typeof selectNeutralSlots>[number], startsAt: Date, number: number,
): Promise<void> {
  const tier = neutral.tier;
  const template = MULTI_WORLD.neutral[tier];
  const alloyCap = storageCap(alloyRate(template.buildings.REFINERY), template.buildings.VAULT);
  const crystalCap = storageCap(crystalRate(template.buildings.EXTRACTOR), template.buildings.VAULT);
  /*
    A SEEDED STOCKPILE, NOT A PRODUCTION CEILING. T5.

    A caretaker world has no refinery and makes no deuterium, so a cap derived
    from its own rate would be zero and the whole PvE deuterium source would
    vanish with it. What it holds is a stockpile somebody left there, and the
    Extractor's rate is the size the game has always given it — kept exactly,
    but no longer dressed up as a production ceiling it is not. `advanceNeutralEconomy`
    never touches deuterium, so nothing re-clamps this afterwards.
  */
  const deuteriumStock = deuteriumStorageCap(
    deuteriumRate(template.buildings.DEUTERIUM_PLANT),
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
      deuterium: deuteriumStock,
      // The dome is the template's own (D209); a tier without one reads zero.
      shield: shieldHp(template.instruments.AEGIS),
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
  if (template.instruments.AEGIS > 0) {
    await tx.insert(satellites).values({
      planetId: world.id, slot: 0, type: 'AEGIS', level: template.instruments.AEGIS,
    });
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

const NEUTRAL_CENSUS_INTERVAL_MS = NEUTRAL_OPENING.censusEveryHours * 60 * 60_000;

const neutralCensusKey = (seasonId: string, censusAt: Date): string =>
  `neutral-census:${seasonId}:${censusAt.toISOString()}`;

/** One durable link in the daily census chain. */
export async function scheduleNeutralCensus(
  db: Tx | Db,
  input: { seasonId: string; censusAt: Date; resolveAt?: Date },
): Promise<void> {
  await schedule(db, {
    seasonId: input.seasonId,
    kind: 'neutral_census',
    refId: input.seasonId,
    dedupeKey: neutralCensusKey(input.seasonId, input.censusAt),
    payload: { censusAt: input.censusAt.toISOString() },
    resolveAt: input.resolveAt ?? input.censusAt,
  });
}

/** Count demand, materialise only the unmet addresses, and publish one public fact. */
export async function runNeutralCensus(
  tx: Tx,
  input: { seasonId: string; censusAt: Date },
): Promise<Record<NeutralTier, number>> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`neutral-census:${input.seasonId}`}))`);
  const [season] = await tx
    .select()
    .from(seasons)
    .where(eq(seasons.id, input.seasonId))
    .for('update');
  if (season?.status !== 'live') return emptyNeutralCounts();
  if (
    season.rulesetVersion < MULTI_WORLD.neutralCensusRulesetVersion
    || input.censusAt >= season.endsAt
  ) return emptyNeutralCounts();

  const commanders = await tx
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.seasonId, input.seasonId), isPerson));
  const standings = await colonyStandings(tx, commanders.map((row) => row.id));
  const demand = neutralDemand([...standings.values()]);
  const selected = selectNeutralSlots(
    season.seed,
    generateGalaxy(season.seed, MULTI_WORLD.neutralSlotPool).slots,
  );
  const tierBySelectedSlot = new Map(selected.map((entry) => [entry.slot.index, entry.tier]));
  const worldRows = await tx
    .select({
      slotIndex: planets.slotIndex,
      kind: planets.kind,
      tier: neutralPlanetState.tier,
    })
    .from(planets)
    .leftJoin(neutralPlanetState, eq(neutralPlanetState.planetId, planets.id))
    .where(eq(planets.seasonId, input.seasonId));
  const stillNeutral = emptyNeutralCounts();
  const opened = emptyNeutralCounts();
  for (const world of worldRows) {
    if (
      world.kind === 'NEUTRAL'
      && (world.tier === 1 || world.tier === 2 || world.tier === 3)
    ) stillNeutral[world.tier] += 1;
    const selectedTier = tierBySelectedSlot.get(world.slotIndex);
    if (selectedTier !== undefined) opened[selectedTier] += 1;
  }
  const wanted = neutralOpenings({
    demand,
    stillNeutral,
    opened,
    cap: MULTI_WORLD.neutralCounts,
  });
  const materialised = await openNeutralWorlds(
    tx,
    input.seasonId,
    season.seed,
    input.censusAt,
    wanted,
    selected,
  );
  const total = materialised[1] + materialised[2] + materialised[3];
  if (total > 0) {
    await recordGalaxyEvent(tx, {
      seasonId: input.seasonId,
      kind: 'neutral_opened',
      refId: input.censusAt.toISOString(),
      subjectPlanetId: null,
      payload: { total, tiers: materialised },
      occurredAt: input.censusAt,
    });
    await publishShard(tx, input.seasonId, 'world');
  }
  return materialised;
}

/** Resolve once even after downtime, then jump the chain to its next future day. */
export async function resolveNeutralCensus(
  tx: Tx,
  input: { seasonId: string; censusAt: Date; now: Date },
): Promise<Record<NeutralTier, number>> {
  const opened = await runNeutralCensus(tx, input);
  const [season] = await tx
    .select({ status: seasons.status, endsAt: seasons.endsAt })
    .from(seasons)
    .where(eq(seasons.id, input.seasonId));
  if (season?.status !== 'live') return opened;
  let next = new Date(input.censusAt.getTime() + NEUTRAL_CENSUS_INTERVAL_MS);
  while (next <= input.now) next = new Date(next.getTime() + NEUTRAL_CENSUS_INTERVAL_MS);
  if (next < season.endsAt) {
    await scheduleNeutralCensus(tx, { seasonId: input.seasonId, censusAt: next });
  }
  return opened;
}

/** Repair a missing daily chain without replaying every census missed during downtime. */
export async function ensureNeutralCensusEvents(db: Db, now: Date): Promise<number> {
  const live = await db
    .select()
    .from(seasons)
    .where(and(
      eq(seasons.status, 'live'),
      gte(seasons.rulesetVersion, MULTI_WORLD.neutralCensusRulesetVersion),
    ));
  let inserted = 0;
  for (const season of live) {
    const first = new Date(
      season.startsAt.getTime() + NEUTRAL_OPENING.firstCensusDays * 24 * 60 * 60_000,
    );
    if (first >= season.endsAt || now >= season.endsAt) continue;
    const [active] = await db
      .select({ id: scheduledEvents.id })
      .from(scheduledEvents)
      .where(and(
        eq(scheduledEvents.seasonId, season.id),
        eq(scheduledEvents.kind, 'neutral_census'),
        inArray(scheduledEvents.status, ['pending', 'processing']),
      ))
      .limit(1);
    if (active) continue;

    let censusAt = first;
    if (censusAt <= now) {
      const elapsed = now.getTime() - censusAt.getTime();
      censusAt = new Date(
        censusAt.getTime() + Math.floor(elapsed / NEUTRAL_CENSUS_INTERVAL_MS) * NEUTRAL_CENSUS_INTERVAL_MS,
      );
    }
    while (censusAt < season.endsAt) {
      const [existing] = await db
        .select({ status: scheduledEvents.status })
        .from(scheduledEvents)
        .where(eq(scheduledEvents.dedupeKey, neutralCensusKey(season.id, censusAt)))
        .limit(1);
      if (!existing) break;
      censusAt = new Date(censusAt.getTime() + NEUTRAL_CENSUS_INTERVAL_MS);
    }
    if (censusAt >= season.endsAt) continue;
    await scheduleNeutralCensus(db, {
      seasonId: season.id,
      censusAt,
      resolveAt: censusAt <= now ? now : censusAt,
    });
    inserted += 1;
  }
  return inserted;
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

/**
 * EVERY SLOT A WORLD OF ANY KIND STANDS ON. The collision truth, not a seat count.
 *
 * `planets_season_slot_idx` is per SEASON, so a neutral world and a colony hold
 * their address exactly as hard as a capital does. This read once filtered on
 * `kind = 'CAPITAL'` and was correct for as long as the two ranges could not meet:
 * capitals fill `0..playerCap-1` and `selectNeutralSlots` draws from indexes at or
 * above `MULTI_WORLD.capitalSlots`. Raising a live galaxy's stored cap past that
 * boundary — the temporary EU-1 measure — makes them overlap, and then a filter
 * hands `pickSpawnSlot` a slot that is already built on.
 *
 * The failure is not one lost join. `pickSpawnSlot` is deterministic, so the retry
 * re-reads an unchanged set, picks the same taken slot again, and the join reports
 * `SHARD_FULL` on a galaxy with empty seats — while `listServers` still reads it as
 * open, which keeps the sequential frontier from moving on to the next galaxy.
 *
 * NOT THE CAPACITY QUESTION. That one is `seatedCommanders`, and merging the two
 * breaks the opposite half: the 65 neutrals sit outside the window, so counting
 * worlds against the cap refuses every join into an empty galaxy.
 */
export async function occupiedSlots(db: Db, seasonId: string): Promise<Set<number>> {
  const rows = await db
    .select({ slotIndex: planets.slotIndex })
    .from(planets)
    .where(eq(planets.seasonId, seasonId));
  return new Set(rows.map((r) => r.slotIndex));
}

/**
 * How many commander seats this galaxy has handed out. The capacity truth.
 *
 * A capital is what a seat IS — one account, one commander, one protected world —
 * so this counts the same rows `listServers` counts against `shards.playerCap`.
 * Colonies are captured neutrals and cost no seat; neutrals cost none either.
 */
export async function seatedCommanders(db: Db, seasonId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(planets)
    .where(and(eq(planets.seasonId, seasonId), eq(planets.kind, 'CAPITAL')));
  return row?.n ?? 0;
}
