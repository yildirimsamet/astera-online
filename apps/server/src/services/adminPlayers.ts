import { and, asc, count, eq, gt, gte, inArray, isNull, lte, or, sql, sum } from 'drizzle-orm';
import { SERVERS, SILENT_SPACE, type Resources } from '@astera/rules';
import type { Db } from '../db/client.js';
import { accounts, buildings, chatMutes, miningRuns, planetFaults, planets, players, satellites, seasons, shards } from '../db/schema.js';
import { buildingLevelsFrom, economyAt, hardwareOf } from './planet.js';
import { isPerson } from './people.js';

const zero = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });

/** Bounded page with batched holdings/hardware/activity. This read never advances economy rows. */
export async function listAdminPlayers(db: Db, input: { before?: string; limit: number }, now: Date) {
  return db.transaction(async tx => {
    const onlineSince = new Date(now.getTime() - SERVERS.onlineWindowMinutes * 60_000);
    const rows = await tx.select({
      playerId: players.id, username: accounts.username, displayName: accounts.displayName,
      accountId: accounts.id, seasonId: players.seasonId, galaxy: shards.name, galaxyCode: shards.code,
      lastActiveAt: players.lastActiveAt,
    }).from(players)
      .innerJoin(accounts, eq(accounts.id, players.accountId))
      .innerJoin(seasons, eq(seasons.id, players.seasonId))
      .innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(and(isPerson, gte(players.lastActiveAt, onlineSince), input.before ? gt(players.id, input.before) : undefined))
      .orderBy(asc(players.id)).limit(input.limit + 1);
    const page = rows.slice(0, input.limit);
    if (page.length === 0) return { players: [], nextBefore: null, measuredAt: now, onlineWindowMinutes: SERVERS.onlineWindowMinutes };
    const ids = page.map(row => row.playerId);
    const holdings = await tx.select({ world: planets, season: seasons, role: shards.role }).from(planets)
      .innerJoin(seasons, eq(seasons.id, planets.seasonId))
      .innerJoin(shards, eq(shards.id, seasons.shardId))
      .where(inArray(planets.controllerPlayerId, ids));
    const worldIds = holdings.map(row => row.world.id);
    const cutoff = new Date(now.getTime() - 24 * 3600_000);
    const [buildingRows, hardwareRows, faultRows, mining, pirates, mutes] = await Promise.all([
      worldIds.length ? tx.select().from(buildings).where(inArray(buildings.planetId, worldIds)) : Promise.resolve([]),
      worldIds.length ? tx.select().from(satellites).where(inArray(satellites.planetId, worldIds)) : Promise.resolve([]),
      worldIds.length ? tx.select().from(planetFaults).where(inArray(planetFaults.planetId, worldIds)) : Promise.resolve([]),
      tx.select({ owner: miningRuns.ownerPlayerId, dispatches: count(), miners: sum(miningRuns.craft) }).from(miningRuns)
        .where(and(inArray(miningRuns.ownerPlayerId, ids), eq(miningRuns.targetKind, 'asteroid'),
          gte(miningRuns.departAt, cutoff), lte(miningRuns.departAt, now))).groupBy(miningRuns.ownerPlayerId),
      tx.execute<{ owner: string; dispatches: number; ships: number }>(sql`
        SELECT owner_player_id AS owner, count(*)::int AS dispatches,
          sum((SELECT coalesce(sum(value::numeric), 0) FROM jsonb_each_text(fleet)))::float8 AS ships
        FROM pirate_raids WHERE owner_player_id IN (${sql.join(ids.map(id => sql`${id}::uuid`), sql`, `)})
          AND depart_at >= ${cutoff.toISOString()}::timestamptz AND depart_at <= ${now.toISOString()}::timestamptz
        GROUP BY owner_player_id
      `),
      tx.select().from(chatMutes).where(and(inArray(chatMutes.accountId, page.map(row => row.accountId)),
        or(isNull(chatMutes.expiresAt), gt(chatMutes.expiresAt, now)))),
    ]);
    const resources = new Map(ids.map(id => [id, { storage: zero(), buffer: zero() }]));
    for (const { world, season, role } of holdings) {
      const levels = buildingLevelsFrom(buildingRows.filter(row => row.planetId === world.id));
      const hardware = hardwareOf(hardwareRows.filter(row => row.planetId === world.id), levels);
      const faults = faultRows.filter(row => row.planetId === world.id);
      const leak = faults.find(row => row.kind === 'VAULT_LEAK');
      const leakedSoFar = leak ? { alloy: leak.leakedAlloy + world.pendingLeakAlloy,
        crystal: leak.leakedCrystal + world.pendingLeakCrystal, deuterium: leak.leakedDeuterium + world.pendingLeakDeuterium } : undefined;
      const { state } = economyAt(world, levels, hardware, season, now, faults.map(row => row.kind), leakedSoFar,
        role === 'WAITING' ? SILENT_SPACE.productionPace : 1);
      const totals = world.controllerPlayerId ? resources.get(world.controllerPlayerId) : undefined;
      if (!totals) continue;
      totals.storage.alloy += state.alloy; totals.storage.crystal += state.crystal; totals.storage.deuterium += state.deuterium;
      totals.buffer.alloy += state.bufferAlloy; totals.buffer.crystal += state.bufferCrystal; totals.buffer.deuterium += state.bufferDeuterium;
    }
    const miningByOwner = new Map(mining.map(row => [row.owner, row]));
    const piratesByOwner = new Map(pirates.map(row => [row.owner, row]));
    return {
      players: page.map(({ accountId, ...row }) => ({ ...row,
        resources: resources.get(row.playerId) ?? { storage: zero(), buffer: zero() },
        activity: { asteroidDispatches: miningByOwner.get(row.playerId)?.dispatches ?? 0,
          minersSent: Number(miningByOwner.get(row.playerId)?.miners ?? 0),
          pirateDispatches: piratesByOwner.get(row.playerId)?.dispatches ?? 0,
          pirateShipsSent: piratesByOwner.get(row.playerId)?.ships ?? 0 },
        mutes: mutes.filter(mute => mute.accountId === accountId).map(({ channel, expiresAt }) => ({ channel, expiresAt })),
      })),
      nextBefore: rows.length > input.limit ? page.at(-1)?.playerId ?? null : null,
      measuredAt: now, onlineWindowMinutes: SERVERS.onlineWindowMinutes,
    };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
}
