import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); });

function serverExclusions(): unknown {
  // Load the actual Node-only config in its native environment, outside jsdom.
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    "import config from './apps/server/vitest.config.ts'; process.stdout.write(JSON.stringify(config.test.exclude));"],
  { cwd: resolve(import.meta.dirname, '../../..'), encoding: 'utf8', env: process.env });
  expect(result.status, result.stderr).toBe(0);
  const exclusions: unknown = JSON.parse(result.stdout);
  return exclusions;
}

function simulationOptions(): unknown {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    "import config from './packages/sim/vitest.config.ts'; process.stdout.write(JSON.stringify(config.test));"],
  { cwd: resolve(import.meta.dirname, '../../..'), encoding: 'utf8', env: process.env });
  expect(result.status, result.stderr).toBe(0);
  const options: unknown = JSON.parse(result.stdout);
  return options;
}

it.each([undefined, '0', 'true'])('excludes the server snowball audit without explicit opt-in (%s)', value => {
  vi.stubEnv('ASTERA_INCLUDE_LONG_TESTS', value);
  expect(serverExclusions()).toContain('**/snowball-audit.test.*');
});

it('permits the snowball audit when the dedicated long-test command opts in', () => {
  vi.stubEnv('ASTERA_INCLUDE_LONG_TESTS', '1');
  const exclusions = serverExclusions();
  expect(exclusions).not.toContain('**/snowball-audit.test.*');
  expect(exclusions).toContain('**/node_modules/**');
});

it('keeps direct or recursive simulation test discovery empty without explicit opt-in', () => {
  vi.stubEnv('ASTERA_INCLUDE_LONG_TESTS', undefined);
  expect(simulationOptions()).toMatchObject({ include: [], passWithNoTests: true });
});

it('discovers the simulation suite only with explicit opt-in', () => {
  vi.stubEnv('ASTERA_INCLUDE_LONG_TESTS', '1');
  expect(simulationOptions()).toMatchObject({ include: ['test/**/*.test.ts'], passWithNoTests: false });
});
