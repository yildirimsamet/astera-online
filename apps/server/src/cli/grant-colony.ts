/**
 * LOCAL DEV ONLY — hand a commander a colony so multi-world play can be tested.
 *
 * It goes through `transferPlanetControl`, the same primitive settlement and the
 * second strategic hit use, rather than a hand-written UPDATE. A colony is not one
 * row: the neutral state has to go, live research orders are cancelled, units are
 * reassigned and the sensor epoch is refreshed. A raw UPDATE produces a world the
 * planet view cannot render and a fog window that never re-opens.
 *
 *   pnpm --filter @astera/server tsx src/cli/grant-colony.ts <commander> [--near <planetId>]
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { parseArgs } from 'node:util';
import { createDb } from '../db/client.js';
import { accounts, planets, players } from '../db/schema.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { transferPlanetControl } from '../services/ownership.js';
import { MULTI_WORLD } from '@astera/rules';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { planet: { type: 'string' } },
});

const commander = positionals[0];
if (commander === undefined) {
  console.error('usage: grant-colony <commander name> [--planet <planetId>]');
  process.exitCode = 1;
} else {
  loadDotEnv();
  const env = loadEnv();
  const { db, close } = createDb(env.DATABASE_URL, { max: 2, applicationName: 'astera-grant-colony' });

  try {
    const [player] = await db
      .select({ id: players.id, name: accounts.displayName })
      .from(players)
      .innerJoin(accounts, eq(accounts.id, players.accountId))
      .where(eq(accounts.displayName, commander));
    if (!player) throw new Error(`no commander named ${commander}`);

    const [capital] = await db
      .select({ x: planets.x, y: planets.y, z: planets.z, seasonId: planets.seasonId })
      .from(planets)
      .where(and(eq(planets.controllerPlayerId, player.id), eq(planets.kind, 'CAPITAL')));
    if (!capital) throw new Error(`${commander} has no capital`);

    /*
      THE COMMANDER'S OWN GALAXY, AND LEAVING THIS OUT WAS THE WHOLE BUG.

      The first version filtered on `kind = 'NEUTRAL'` and an empty controller and
      nothing else. Every season generates its own neutral worlds — and names them
      by tier and index, so `Neutral T1-07` exists once per galaxy — which made the
      nearest match a world in the OTHER shard. The commander then owned a planet
      the disc could not draw, because `publicWorlds` filters by the caller's
      season while `/api/planets` does not: it was in the worlds list and nowhere
      on the map.

      `transferPlanetControl` now refuses that outright. This filter is what stops
      the tool asking for it in the first place.
    */
    const [target] = values.planet === undefined
      ? await db
          .select({ id: planets.id, name: planets.name })
          .from(planets)
          .where(and(
            eq(planets.seasonId, capital.seasonId),
            eq(planets.kind, 'NEUTRAL'),
            isNull(planets.controllerPlayerId),
          ))
          .orderBy(asc(sql`
            (${planets.x} - ${capital.x}) ^ 2
            + (${planets.y} - ${capital.y}) ^ 2
            + (${planets.z} - ${capital.z}) ^ 2
          `))
          .limit(1)
      : await db
          .select({ id: planets.id, name: planets.name })
          .from(planets)
          .where(eq(planets.id, values.planet));
    if (!target) throw new Error('no neutral world available');

    const now = new Date();
    await db.transaction(async (tx) => {
      await transferPlanetControl(tx, {
        targetPlanetId: target.id,
        newPlayerId: player.id,
        expectedControllerPlayerId: null,
        now,
        protectedUntil: new Date(now.getTime() + MULTI_WORLD.occupationMinutes * 60_000),
      });
    });

    console.log(`${target.name} is now a colony of ${player.name}`);
  } finally {
    await close();
  }
}
