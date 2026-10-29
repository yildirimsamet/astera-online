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
