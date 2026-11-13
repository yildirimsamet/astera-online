/**
 * THE UI AUDIT'S HARD-TO-REACH WORLDS, ON A SEEDED CAPACITY DATABASE. NEVER PRODUCTION.
 *
 *   CAPACITY_SEED_CONFIRM=ASTERA_STAGING_ONLY DATABASE_URL=…_capacity \
 *   pnpm --filter @astera/server exec tsx src/cli/uiAuditStage.ts --yes
 *
 * Run after `capacity:seed`. cap0001 gets one colony and cap0002 the three-colony cap, the
 * nearest neutral worlds handed over through the settlement's own ownership primitive.
 * cap0001 also raids the nearest neutral world with a fleet big enough for its battle to be
 * watched; the seed's raids are too small for a replay. A second run changes nothing.
 */
import { parseArgs } from 'node:util';
import { and, eq, sql } from 'drizzle-orm';
import { MULTI_WORLD } from '@astera/rules';
import { loadDotEnv, loadEnv } from '../env.js';
import { createDb } from '../db/client.js';
import { accounts, missions, planets, players } from '../db/schema.js';
import { addMinutes, systemClock } from '../clock.js';
import { transferPlanetControl } from '../services/ownership.js';
import { recordPlayerLegacyFact } from '../services/legacyEvents.js';
import { launchAttack } from '../services/mission.js';
import { assertDisposableDatabase, assertNoRealAccounts } from './capacityGuard.js';

const COLONIES = [['cap0001', 1], ['cap0002', 3]] as const;
/** About a fifth of the seeded home fleet: well over half a first-tier garrison, far under the replay's ship limit. */
const RAID = { DART: 150, PIKE: 40, VIPER: 20 };

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { yes: { type: 'boolean' } } });
  loadDotEnv();
  const env = loadEnv();
  assertDisposableDatabase(env.DATABASE_URL, { yes: values.yes === true, confirm: process.env.CAPACITY_SEED_CONFIRM });
  const { db, close } = createDb(env.DATABASE_URL, { max: 2, applicationName: 'astera-ui-audit-stage' });
  try {
    await assertNoRealAccounts(db);
    for (const [username, wanted] of COLONIES) {
      const [commander] = await db
        .select({ playerId: players.id, seasonId: players.seasonId, planetId: planets.id, x: planets.x, y: planets.y, z: planets.z })
        .from(players)
        .innerJoin(accounts, eq(accounts.id, players.accountId))
        .innerJoin(planets, and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')))
        .where(eq(accounts.username, username));
      if (!commander) throw new Error(`${username} has no capital; run capacity:seed first`);
      const held = await db.select({ id: planets.id }).from(planets)
        .where(and(eq(planets.controllerPlayerId, commander.playerId), eq(planets.kind, 'COLONY')));
      const nearest = await db.select({ id: planets.id }).from(planets)
        .where(and(eq(planets.seasonId, commander.seasonId), eq(planets.kind, 'NEUTRAL')))
        .orderBy(sql`(${planets.x} - ${commander.x})^2 + (${planets.y} - ${commander.y})^2 + (${planets.z} - ${commander.z})^2`)
        .limit(Math.max(0, wanted - held.length));
      for (const world of nearest) {
        const now = systemClock.now();
        await db.transaction(async (tx) => {
          await transferPlanetControl(tx, {
            targetPlanetId: world.id,
            newPlayerId: commander.playerId,
            expectedControllerPlayerId: null,
            now,
            protectedUntil: addMinutes(now, MULTI_WORLD.occupationMinutes),
          });
          await recordPlayerLegacyFact(tx, commander.playerId, commander.seasonId, 'NEUTRAL_COLONIES', `colony:${world.id}`, now);
        });
      }
      console.log(`${username} colonies: ${String(held.length + nearest.length)}`);
      if (username !== 'cap0001') continue;
      const flying = await db.select({ id: missions.id }).from(missions)
        .innerJoin(planets, eq(planets.id, missions.targetPlanetId))
        .where(and(eq(missions.ownerPlayerId, commander.playerId), eq(missions.kind, 'attack'), eq(planets.kind, 'NEUTRAL')));
      if (flying.length > 0) continue;
      const [target] = await db.select({ id: planets.id }).from(planets)
        .where(and(eq(planets.seasonId, commander.seasonId), eq(planets.kind, 'NEUTRAL')))
        .orderBy(sql`(${planets.x} - ${commander.x})^2 + (${planets.y} - ${commander.y})^2 + (${planets.z} - ${commander.z})^2`)
        .limit(1);
      if (!target) throw new Error('no neutral world left to raid');
      const raid = await launchAttack(db, commander.planetId, target.id, RAID, systemClock, commander.playerId);
      console.log(`${username} raid lands at ${raid.arriveAt.toISOString()}`);
    }
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
