import { inArray, eq } from 'drizzle-orm';
import { MONUMENT_SEASON_DEFAULTS, MULTI_WORLD, SEASON, monumentDifficulty } from '@astera/rules';
import type { Db } from '../db/client.js';
import type { Clock } from '../clock.js';
import type { Env } from '../env.js';
import { monuments, seasons, shards } from '../db/schema.js';
import { bootstrapServers, wipeAllServers, type BootstrapOptions } from '../services/servers.js';
import { createSeason, liveSeason } from '../services/season.js';
import { forceSeasonEnd } from '../worker/handlers.js';

/** Disposable local worlds follow the checked-out rules; production seasons keep their deal. */
export async function bootstrapLocalWorld(
  db: Db,
  clock: Clock,
  env: Pick<Env, 'NODE_ENV' | 'DATABASE_URL' | 'ADMIN_USERNAMES'>,
  options: BootstrapOptions = {},
) {
  const hostname = new URL(env.DATABASE_URL).hostname;
  if (env.NODE_ENV !== 'development' || !['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    throw new Error('local-bootstrap requires development mode and a loopback database. Use season bootstrap for other environments.');
  }

  const current = MULTI_WORLD.rulesetVersion;
  const active = await db.select({ season: seasons, role: shards.role, code: shards.code })
    .from(seasons).innerJoin(shards, eq(seasons.shardId, shards.id))
    .where(inArray(seasons.status, ['live', 'frozen']));
  const main = active.filter(row => row.role === 'MAIN');
  const targets = main.length === 0 ? [] : await db.select({
    seasonId: monuments.seasonId, ordinal: monuments.ordinal, difficulty: monuments.difficulty,
  }).from(monuments).where(inArray(monuments.seasonId, main.map(row => row.season.id)))
    .orderBy(monuments.ordinal);
  const stale = main.filter(({ season }) => {
    if (season.status === 'frozen' || season.rulesetVersion !== current) return true;
    const layout = targets.filter(target => target.seasonId === season.id);
    return layout.length !== MONUMENT_SEASON_DEFAULTS.count
      || !layout.every((target, index) => target.ordinal === index + 1
        && target.difficulty === monumentDifficulty(index + 1));
  });

  const latest = { ...options, rulesetVersion: current };
  if (stale.length > 0) {
    console.log(`Refreshing obsolete local worlds: ${stale.map(row => row.code).join(', ')}. Accounts are preserved.`);
    const adminUsernames = new Set(env.ADMIN_USERNAMES);
    for (const { season } of active) {
      if (season.status === 'live') await forceSeasonEnd({ db, clock, adminUsernames }, season.id);
    }
    const wiped = await wipeAllServers(db, clock, latest);
    console.log(`Reset ${String(wiped.seasonsWiped)} local seasons to ruleset ${String(current)}.`);
  }

  const result = await bootstrapServers(db, clock, latest);
  const rehearsal = 'MONUMENT-LOCAL';
  if (await liveSeason(db, rehearsal)) result.existing.push(rehearsal);
  else {
    await createSeason(db, {
      shardCode: rehearsal, shardName: rehearsal, seed: 16005,
      startsAt: clock.now(), days: options.days ?? SEASON.days, playerCap: 60,
    });
    result.created.push(rehearsal);
  }
  return result;
}
