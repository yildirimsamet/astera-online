import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { TEST_DATABASE_URL, testDb } from './helpers.js';

/**
 * PRODUCTION RUNS THE BUNDLE. Capacity fix plan, item 8 (2026-11-02).
 *
 * tsx kept a TypeScript compiler in every process: 157 MiB of container memory against
 * 73 MiB, and three times the CPU per start. What can go wrong is in the packaging, so
 * this starts the real file: the migration folder has to be found from where the bundle
 * lies, and every import has to link.
 */
const SERVER = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = join(SERVER, 'dist/server/index.mjs');

const freePort = () => new Promise<number>((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, () => {
    const address = probe.address();
    if (address === null || typeof address === 'string') { reject(new Error('no port')); return; }
    probe.close(() => { resolve(address.port); });
  });
});

const exited = (child: ChildProcess) => new Promise<number | null>((resolve) => {
  child.once('exit', (code) => { resolve(code); });
});

beforeAll(async () => {
  await testDb();
  execFileSync('pnpm', ['run', 'build'], { cwd: SERVER, stdio: 'pipe' });
}, 60_000);
afterAll(async () => { await (await testDb()).close(); });

it('carries the shared rules inside it instead of importing their TypeScript', () => {
  const source = readFileSync(BUNDLE, 'utf8');
  expect(source).not.toMatch(/from "@astera\//);
  expect(source).not.toMatch(/from "[^"]+\.ts"/);
});

it.each(['api', 'worker'])('starts as the %s role, answers and shuts down cleanly', async (role) => {
  const port = await freePort();
  const child = spawn(process.execPath, [BUNDLE], {
    cwd: SERVER,
    env: { PATH: process.env.PATH, NODE_ENV: 'development', ROLE: role, PORT: String(port), LOG_LEVEL: 'error', DATABASE_URL: TEST_DATABASE_URL, JWT_SECRET: 'test-secret-that-is-long-enough' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const gone = exited(child);
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  try {
    let answered = 0;
    for (let attempt = 0; attempt < 150 && answered === 0 && child.exitCode === null; attempt++) {
      try { answered = (await fetch(`http://127.0.0.1:${String(port)}/health`)).status; } catch { await delay(100); }
    }
    expect({ answered: answered > 0, output }).toEqual({ answered: true, output: '' });
    child.kill('SIGTERM');
    expect(await gone).toBe(0);
  } finally { child.kill('SIGKILL'); }
}, 30_000);
