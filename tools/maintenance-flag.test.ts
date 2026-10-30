import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';

/**
 * THE OPERATOR'S SWITCH FOR THE MAINTENANCE FLAG. Scaling plan F0.9.
 *
 * `deploy/maintenance.sh on <reopening>` writes the file nginx answers the API with;
 * `off` removes it. The reopening is the instant the client counts down to, so a
 * value `date` cannot read is refused rather than written.
 */
const script = resolve(import.meta.dirname, '../deploy/maintenance.sh');
let dir: string;
const run = (...args: string[]) => spawnSync('bash', [script, ...args], {
  encoding: 'utf8', env: { ...process.env, ASTERA_MAINTENANCE_DIR: dir, ASTERA_SUDO: '' },
});
const flag = () => resolve(dir, 'maintenance.json');

beforeEach(() => { dir = mkdtempSync(resolve(tmpdir(), 'astera-flag-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

it('raises the flag with the reopening in UTC and takes it down again', () => {
  expect(run('on', '2026-11-02T03:15:00+02:00').status).toBe(0);
  expect(JSON.parse(readFileSync(flag(), 'utf8'))).toEqual({
    error: 'MAINTENANCE', message: 'Astera is under maintenance', params: { endsAt: '2026-11-02T01:15:00.000Z' },
  });
  expect(run('status').stdout).toMatch(/on until 2026-11-02T01:15:00.000Z/u);
  expect(run('off').status).toBe(0);
  expect(existsSync(flag())).toBe(false);
  expect(run('status').stdout).toMatch(/off/u);
});

it('refuses a reopening it cannot read, and an unknown word', () => {
  expect(run('on', 'tomorrow-ish').status).not.toBe(0);
  expect(run('on').status).not.toBe(0);
  expect(run('open').status).not.toBe(0);
  expect(existsSync(flag())).toBe(false);
});
