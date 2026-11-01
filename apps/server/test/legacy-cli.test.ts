import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const run = promisify(execFile);
const path = fileURLToPath(new URL('../src/cli/legacy.ts', import.meta.url));
it('explains the preview default without loading credentials or opening a database', async () => {
  const result = await run(process.execPath, ['--import', 'tsx', path, '--help'], { env: {
    ...process.env, DATABASE_URL: 'invalid-connection-that-must-not-be-used', NODE_OPTIONS: '--max-old-space-size=1024',
  } });
  expect(result.stdout).toContain('backfill');
  expect(result.stdout).toContain('--apply');
  expect(result.stderr).toBe('');
});
it('rejects unknown commands before reading environment or connecting', async () => {
  const result = run(process.execPath, ['--import', 'tsx', path, 'delete-everything'], { env: {
    ...process.env, DATABASE_URL: 'invalid-connection-that-must-not-be-used', NODE_OPTIONS: '--max-old-space-size=1024',
  } });
  await expect(result).rejects.toMatchObject({ code: 1 });
  await expect(result).rejects.toThrow('Unknown legacy command');
});
