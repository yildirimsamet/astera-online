import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { TEST_DATABASE_URL } from './helpers.js';

/**
 * THE FIXTURE A LOAD TEST STANDS ON MUST STILL BUILD. Found 2026-11-03.
 *
 * The first-season gift put ships on every new commander, the seed then inserted its own
 * fleet over them and died on the unique key, and nothing noticed until a run was due.
 * These are mid-season veterans, so they get no gift and exactly the fleet written here.
 */
const name = `astera_seed_${randomUUID().replaceAll('-', '').slice(0, 12)}_loadtest`;
const admin = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => undefined });
const seedUrl = (() => {
  const copy = new URL(TEST_DATABASE_URL);
  copy.pathname = `/${name}`;
  return copy.toString();
})();
const seeded = postgres(seedUrl, { max: 1, onnotice: () => undefined });

beforeAll(async () => { await admin.unsafe(`create database ${name}`); });
afterAll(async () => {
  await seeded.end();
  await admin.unsafe(`drop database if exists ${name} with (force)`);
  await admin.end();
});

it('builds, with exactly the fleet it names and no first-season gift', async () => {
  const run = spawnSync(resolve(import.meta.dirname, '../node_modules/.bin/tsx'), [
    'src/cli/capacity.ts', '--yes', '--users', '2', '--online', '2', '--missions', '0', '--miners', '0', '--seed', '99300',
  ], {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: seedUrl, CAPACITY_PASSWORD: 'capacity-seed-test', CAPACITY_SEED_CONFIRM: 'ASTERA_STAGING_ONLY' },
    timeout: 110_000,
  });
  expect(run.status, run.stdout + run.stderr).toBe(0);

  // Neutral worlds hold garrisons of their own: only the commanders' worlds are the fixture's.
  const fleets = await seeded<{ hull: string; count: number }[]>`
    select u.hull, u.count from units u
    join players p on p.id = u.owner_player_id
    join accounts a on a.id = p.account_id
    where u.location = 'home' and a.username like 'cap%' order by u.hull`;
  expect(fleets.filter((row) => row.hull === 'DART')).toEqual([{ hull: 'DART', count: 800 }, { hull: 'DART', count: 800 }]);
  expect(new Set(fleets.map((row) => row.hull))).toEqual(new Set(['COURIER', 'DART', 'PIKE', 'PROSPECTOR', 'VIPER']));
  const [gifted] = await seeded<{ count: number }[]>`
    select count(*)::int as count from satellites s
    join planets w on w.id = s.planet_id
    join players p on p.id = w.player_id
    join accounts a on a.id = p.account_id
    where a.username like 'cap%'`;
  expect(gifted?.count).toBe(0);
}, 120_000);
