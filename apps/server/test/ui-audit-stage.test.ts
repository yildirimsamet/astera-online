import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { TEST_DATABASE_URL } from './helpers.js';

/**
 * THE UI AUDIT'S HARD-TO-REACH WORLDS. UI/UX stage 1, 2026-11-11.
 *
 * A colony takes a claim, a flight and a landing; the audit photographs the planet sheet
 * of one, and of a commander at the three-colony cap, and a battle replay, which a raid
 * smaller than half the defence does not get. The staging command hands neutral worlds over
 * through the settlement's own ownership primitive and launches the raid through the
 * player's own launch, on a seeded capacity database only.
 */
const name = `astera_stage_${randomUUID().replaceAll('-', '').slice(0, 12)}_loadtest`;
const admin = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => undefined });
const stagedUrl = (() => {
  const copy = new URL(TEST_DATABASE_URL);
  copy.pathname = `/${name}`;
  return copy.toString();
})();
const staged = postgres(stagedUrl, { max: 1, onnotice: () => undefined });
const tsx = resolve(import.meta.dirname, '../node_modules/.bin/tsx');
const cwd = resolve(import.meta.dirname, '..');
const env = { ...process.env, DATABASE_URL: stagedUrl, CAPACITY_PASSWORD: 'ui-audit-stage-test', CAPACITY_SEED_CONFIRM: 'ASTERA_STAGING_ONLY' };
const stage = (args: string[]) => spawnSync(tsx, ['src/cli/uiAuditStage.ts', ...args], { cwd, encoding: 'utf8', env, timeout: 60_000 });

beforeAll(async () => {
  await admin.unsafe(`create database ${name}`);
  const seed = spawnSync(tsx, ['src/cli/capacity.ts', '--yes', '--users', '3', '--online', '0', '--missions', '0', '--miners', '0', '--seed', '99300'], { cwd, encoding: 'utf8', env, timeout: 110_000 });
  expect(seed.status, seed.stdout + seed.stderr).toBe(0);
}, 120_000);

afterAll(async () => {
  await staged.end();
  await admin.unsafe(`drop database if exists ${name} with (force)`);
  await admin.end();
});

const colonies = () => staged<{ username: string; colonies: number }[]>`
  select a.username, count(w.id)::int as colonies from accounts a
  join players p on p.account_id = a.id
  left join planets w on w.player_id = p.id and w.kind = 'COLONY'
  group by a.username order by a.username`;

it('refuses without the staging confirmation', () => {
  const run = stage([]);
  expect(run.status).not.toBe(0);
  expect(run.stderr).toMatch(/--yes/);
});

it('gives cap0001 one colony and cap0002 the three-colony cap, and leaves everyone else alone', async () => {
  const run = stage(['--yes']);
  expect(run.status, run.stdout + run.stderr).toBe(0);
  expect(await colonies()).toEqual([
    { username: 'cap0001', colonies: 1 },
    { username: 'cap0002', colonies: 3 },
    { username: 'cap0003', colonies: 0 },
  ]);
}, 70_000);

const raids = () => staged<{ fleet: Record<string, number> }[]>`
  select m.fleet from missions m
  join players p on p.id = m.owner_player_id
  join accounts a on a.id = p.account_id
  join planets w on w.id = m.target_planet_id
  where a.username = 'cap0001' and m.kind = 'attack' and w.kind = 'NEUTRAL'`;

it('sends cap0001 at a neutral world with a fleet big enough for its battle to be watched', async () => {
  const [raid, ...more] = await raids();
  expect(more).toEqual([]);
  expect(raid?.fleet).toEqual({ DART: 150, PIKE: 40, VIPER: 20 });
});

it('can run again without a fourth colony, a second raid or an error', async () => {
  const run = stage(['--yes']);
  expect(run.status, run.stdout + run.stderr).toBe(0);
  expect((await colonies()).map((row) => row.colonies)).toEqual([1, 3, 0]);
  expect(await raids()).toHaveLength(1);
}, 70_000);
