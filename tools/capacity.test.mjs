import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

/**
 * The server keeps three live streams per account and closes the oldest as
 * `superseded` (scaling plan F1.1). A run that opened more per account would
 * measure its own reconnect storm, so the arguments are refused up front.
 */
const root = resolve(import.meta.dirname, '..');

it('refuses more than three connections per capacity account', () => {
  const run = spawnSync(resolve(root, 'node_modules/.bin/tsx'), ['tools/capacity.mjs', '--users', '2', '--connections', '7'],
    { cwd: root, encoding: 'utf8', env: { ...process.env, CAPACITY_PASSWORD: '' }, timeout: 60_000 });
  expect(run.status).not.toBe(0);
  expect(run.stderr).toContain('--connections cannot exceed 3 per --users account');
});

const runner = (args) => spawnSync(resolve(root, 'node_modules/.bin/tsx'), ['tools/capacity.mjs', ...args],
  { cwd: root, encoding: 'utf8', env: { ...process.env, CAPACITY_PASSWORD: '' }, timeout: 60_000 });

/** Seats come from SERVERS (2 × 1,000), so the plan's L3 run fits and nothing past it does. Scaling plan F0.1. */
it('accepts a thousand online commanders on 1,250 streams', () => {
  const run = runner(['--users', '1000', '--connections', '1250', '--seeded-accounts', '2000']);
  // Every argument passed; only the missing password stops it.
  expect(run.stderr).toContain('CAPACITY_PASSWORD must contain 8–200 characters.');
});

it('refuses more online commanders than the galaxies seat', () => {
  expect(runner(['--users', '2001']).stderr).toContain('--users must be an integer from 1 to 2000');
});

it('refuses a seed smaller than the online set', () => {
  expect(runner(['--users', '1000', '--seeded-accounts', '999']).stderr)
    .toContain('--seeded-accounts must be an integer from 1000 to 2000');
});
