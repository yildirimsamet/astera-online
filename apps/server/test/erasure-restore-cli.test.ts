import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('refuses restore writes without explicit maintenance confirmation before loading credentials or connecting', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli/erasureRestore.ts', '--apply', '--journal-dir', '/missing-private-journal'], { cwd: process.cwd(), encoding: 'utf8', timeout: 10_000 });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('maintenance-confirmed');
  expect(result.stdout).toBe('');
});
it('prevents the legacy name-based CLI from bypassing the verified account-deletion workflow', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli/season.ts', 'delete-account', 'NeverRegisteredJournalFixture', '--yes'], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: 'postgres://nobody:nothing@127.0.0.1:1/erasure_cli_test', JWT_SECRET: 'fixture-legacy-cli-secret-only-for-tests' },
  });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('verified account-deletion');
});
