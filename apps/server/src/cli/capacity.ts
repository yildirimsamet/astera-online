/**
 * Deterministic capacity-fixture seeding. NEVER production.
 *
 *   CAPACITY_SEED_CONFIRM=ASTERA_STAGING_ONLY CAPACITY_PASSWORD=... \
 *   pnpm --filter @astera/server capacity:seed -- --yes --users 300 --seed 99300
 */
import { parseArgs } from 'node:util';
import { eq, inArray, sql } from 'drizzle-orm';
import { MULTI_WORLD, SERVERS } from '@astera/rules';
import { loadDotEnv, loadEnv } from '../env.js';
import { createDb } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { systemClock } from '../clock.js';
import {
  accounts,
  buildings,
  debrisFields,
  neutralPlanetState,
  planets,
  players,
  units,
} from '../db/schema.js';
import { hashPassword } from '../auth/password.js';
import { joinSeason } from '../services/player.js';
import { liveSeason } from '../services/season.js';
import { bootstrapServers } from '../services/servers.js';
import { launchAttack } from '../services/mission.js';
import { launchHarvest, launchMining, visibleAsteroids } from '../services/mining.js';

const CONFIRM = 'ASTERA_STAGING_ONLY';
const USER_PREFIX = 'cap';

const integer = (
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number => {
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(
      `Expected an integer from ${String(min)} to ${String(max)}, got ${String(raw)}`,
    );
  }
  return value;
};

function assertDisposableDatabase(databaseUrl: string, confirmed: boolean): void {
  const parsed = new URL(databaseUrl);
  const database = decodeURIComponent(parsed.pathname.slice(1));
  if (!/(?:^|_)(capacity|staging|loadtest)$/.test(database)) {
    throw new Error(
      `Refusing to seed database "${database}". Its name must end in _capacity, `
      + '_staging or _loadtest.',
    );
  }
  if (!confirmed || process.env.CAPACITY_SEED_CONFIRM !== CONFIRM) {
    throw new Error(`Refusing destructive staging seed. Pass --yes and CAPACITY_SEED_CONFIRM=${CONFIRM}.`);
  }
}

const usernameFor = (index: number): string => `${USER_PREFIX}${String(index + 1).padStart(4, '0')}`;

async function main(): Promise<void> {
  const cliArgs = process.argv.slice(2);
  if (cliArgs[0] === '--') cliArgs.shift();
  const { values } = parseArgs({
    args: cliArgs,
    options: {
      yes: { type: 'boolean' },
      users: { type: 'string' },
      seed: { type: 'string' },
      missions: { type: 'string' },
      miners: { type: 'string' },
    },
  });
  loadDotEnv();
  const env = loadEnv();
  assertDisposableDatabase(env.DATABASE_URL, values.yes === true);

  const userCount = integer(
    values.users,
    SERVERS.capacity,
    1,
    SERVERS.capacity * SERVERS.count,
  );
  const seed = integer(values.seed, 99_300, 1, 2_000_000_000);
  const missionCount = integer(values.missions, Math.min(90, userCount), 0, userCount);
  const minerCount = integer(values.miners, Math.min(45, userCount), 0, userCount);
  const password = process.env.CAPACITY_PASSWORD;
  if (!password || password.length < 8 || password.length > 200) {
    throw new Error('CAPACITY_PASSWORD must contain 8–200 characters.');
  }

  const { db, close } = createDb(env.DATABASE_URL, {
    max: 12,
    applicationName: 'astera-capacity-seed',
  });
  try {
    await runMigrations(db);

    // This command is already guarded by the disposable-database name, --yes and
    // CAPACITY_SEED_CONFIRM. A gameplay wipe intentionally preserves accounts and
    // historical seasons, which makes repeated load tests accumulate state and can
    // hide fixture/reconciliation bugs. Capacity evidence must start from the same
    // empty application state every time; keep only Drizzle's migration journal.
    await db.execute(sql`
      truncate table
        account_rewards,
        reward_grants,
        request_log,
        notifications,
        mining_runs,
        debris_fields,
        asteroid_claims,
        watches,
        probe_reports,
        scan_events,
        battle_reports,
        scheduled_events,
        strategic_assets,
        missions,
        units,
        satellites,
        planet_research,
        buildings,
        neutral_planet_state,
        planets,
        galaxy_events,
        chat_messages,
        players,
        season_results,
        seasons,
        shards,
        accounts
      restart identity cascade
    `);
    await bootstrapServers(db, systemClock, {
      count: SERVERS.count,
      capacity: SERVERS.capacity,
      seedBase: seed - 7919,
    });
    const live: NonNullable<Awaited<ReturnType<typeof liveSeason>>>[] = [];
    for (let ordinal = 1; ordinal <= SERVERS.count; ordinal += 1) {
      const season = await liveSeason(db, `EU-${String(ordinal)}`);
      if (!season) throw new Error(`capacity seed opened no EU-${String(ordinal)} season`);
      live.push(season);
    }

    // One expensive hash, copied to accounts that intentionally share the same
    // staging-only password. Login still performs one real scrypt per user.
    const passwordHash = await hashPassword(password);
    const accountRows = await db
      .insert(accounts)
      .values(Array.from({ length: userCount }, (_, index) => {
        const username = usernameFor(index);
        return { username, displayName: `Capacity ${String(index + 1)}`, passwordHash };
      }))
      .onConflictDoUpdate({
        target: accounts.username,
        set: { passwordHash, displayName: sql`excluded.display_name` },
      })
      .returning({ id: accounts.id, username: accounts.username });
    const accountByName = new Map(accountRows.map((account) => [account.username, account.id]));

    const placements: { playerId: string; planetId: string; seasonId: string }[] = [];
    for (let index = 0; index < userCount; index += 1) {
      const accountId = accountByName.get(usernameFor(index));
      if (!accountId) throw new Error(`seed account ${usernameFor(index)} was not returned`);
      const galaxy = live[Math.floor(index / SERVERS.capacity)];
      if (!galaxy) throw new Error(`capacity user ${String(index + 1)} has no galaxy`);
      placements.push({
        ...await joinSeason(db, accountId, galaxy.season.id, systemClock),
        seasonId: galaxy.season.id,
      });
    }
    const placementsBySeason = new Map(live.map(({ season }) => [
      season.id,
      placements.filter((placement) => placement.seasonId === season.id),
    ]));

    const planetIds = placements.map((placement) => placement.planetId);
    await db.update(planets).set({
      alloy: 5_000_000,
      crystal: 2_500_000,
      deuterium: 500_000,
      bufferAlloy: 50_000,
      bufferCrystal: 25_000,
      bufferDeuterium: 5_000,
      lastTickAt: systemClock.now(),
    }).where(inArray(planets.id, planetIds));
    await db.update(buildings).set({ level: 8 }).where(inArray(buildings.planetId, planetIds));
    await db.update(players).set({ wealth: 1_000_000 });

    const fleet = [
      ['WASP', 800],
      ['LANCE', 120],
      ['HAULER', 120],
      ['RUNNER', 80],
      ['PROSPECTOR', 2],
    ] as const;
    await db.insert(units).values(placements.flatMap((placement) =>
      fleet.map(([hull, count]) => ({
        planetId: placement.planetId,
        ownerPlayerId: placement.playerId,
        hull,
        location: 'home',
        count,
      }))));

    // Public wrecks make the contested mining surface non-empty without inventing
    // a battle result or report. missionId is intentionally nullable for fixtures.
    const fixtureFields = await db
      .insert(debrisFields)
      .values(live.flatMap(({ season }) =>
        (placementsBySeason.get(season.id) ?? []).slice(0, 30).map((placement, index) => ({
          seasonId: season.id,
          planetId: placement.planetId,
          alloy: 20_000 + index * 100,
          crystal: 8_000 + index * 50,
          deuterium: 1_000,
          createdAt: systemClock.now(),
        })),
      ))
      .returning({ id: debrisFields.id, seasonId: debrisFields.seasonId });

    let launched = 0;
    for (let index = 0; index < missionCount; index += 1) {
      const populated = [...placementsBySeason.values()].filter((rows) => rows.length > 1);
      const group = populated[index % populated.length];
      if (!group) break;
      const localIndex = Math.floor(index / populated.length) % group.length;
      const origin = group[localIndex];
      const target = group[(localIndex + Math.min(17, group.length - 1)) % group.length];
      if (!origin || !target || origin === target) continue;
      await launchAttack(
        db,
        origin.planetId,
        target.planetId,
        { WASP: 3, HAULER: 1 },
        systemClock,
        origin.playerId,
      );
      launched += 1;
    }

    const rocksBySeason = new Map(await Promise.all(live.map(async ({ season }) => [
      season.id,
      await visibleAsteroids(db, season.id, systemClock.now()),
    ] as const)));
    const fieldsBySeason = new Map(live.map(({ season }) => [
      season.id,
      fixtureFields.filter((field) => field.seasonId === season.id),
    ]));
    let miners = 0;
    if ([...rocksBySeason.values()].some((rocks) => rocks.length > 0) || fixtureFields.length > 0) {
      const populated = [...placementsBySeason.entries()].filter(([, rows]) => rows.length > 0);
      for (let index = 0; index < minerCount; index += 1) {
        const entry = populated[index % populated.length];
        if (!entry) break;
        const [seasonId, group] = entry;
        const origin = group[group.length - 1 - (Math.floor(index / populated.length) % group.length)];
        const rocks = rocksBySeason.get(seasonId) ?? [];
        const fields = fieldsBySeason.get(seasonId) ?? [];
        const rock = rocks[index % rocks.length];
        const field = fields[index % fields.length];
        if (!origin) continue;
        if (rock && index % 2 === 0) {
          await launchMining(db, origin.planetId, rock.index, 1, systemClock, origin.playerId);
        } else if (field) {
          await launchHarvest(db, origin.planetId, field.id, 1, systemClock, origin.playerId);
        } else if (rock) {
          await launchMining(db, origin.planetId, rock.index, 1, systemClock, origin.playerId);
        } else {
          continue;
        }
        miners += 1;
      }
    }

    const neutralRows = await db
      .select({
        seasonId: planets.seasonId,
        tier: neutralPlanetState.tier,
        count: sql<number>`count(*)::int`,
      })
      .from(neutralPlanetState)
      .innerJoin(planets, eq(neutralPlanetState.planetId, planets.id))
      .groupBy(planets.seasonId, neutralPlanetState.tier);
    const expected = MULTI_WORLD.neutralCounts;
    const galaxySummary = live.map(({ season, shard }) => {
      const neutralByTier = new Map(
        neutralRows.filter((row) => row.seasonId === season.id).map((row) => [row.tier, row.count]),
      );
      const neutralCounts = {
        tier1: neutralByTier.get(1) ?? 0,
        tier2: neutralByTier.get(2) ?? 0,
        tier3: neutralByTier.get(3) ?? 0,
      };
      if (
        neutralCounts.tier1 !== expected[1]
        || neutralCounts.tier2 !== expected[2]
        || neutralCounts.tier3 !== expected[3]
      ) {
        throw new Error(
          `capacity fixture neutral mismatch in ${shard.code}: ${JSON.stringify(neutralCounts)}`,
        );
      }
      return {
        code: shard.code,
        seasonId: season.id,
        capitals: placementsBySeason.get(season.id)?.length ?? 0,
        neutrals: {
          ...neutralCounts,
          total: neutralCounts.tier1 + neutralCounts.tier2 + neutralCounts.tier3,
        },
      };
    });

    if (galaxySummary.length !== SERVERS.count) {
      throw new Error(`capacity fixture opened ${String(galaxySummary.length)} galaxies`);
    }

    process.stdout.write(`${JSON.stringify({
      database: new URL(env.DATABASE_URL).pathname.slice(1),
      seed,
      accounts: userCount,
      capitals: userCount,
      galaxies: galaxySummary,
      missions: launched,
      miningRuns: miners,
      usernamePattern: `${USER_PREFIX}0001..${usernameFor(userCount - 1)}`,
    }, null, 2)}\n`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
