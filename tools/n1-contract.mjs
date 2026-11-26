#!/usr/bin/env node
// OTA F4, N-1 check (docs/canli-guncelleme-plani-2026-11-24.md §5.2). Before a deploy: can the client
// players run right now read what this commit's server sends?
//
//   node tools/n1-contract.mjs [COMMIT...]
//
// 1. Records every payload the server tests parse with a client schema (vitest.n1.config.ts), on a
//    throwaway `_test` database of its own.
// 2. Unpacks each COMMIT's client schemas and rules into apps/server/.n1/<sha>, and reads the recording
//    with them. Without a COMMIT it asks production which web release the app runs (/ota/latest.json).
// Exit 1 names each schema and field the live client cannot read.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const server = join(root, 'apps/server');
const work = join(server, '.n1');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

async function liveRelease() {
  const response = await fetch('https://asteraonline.space/ota/latest.json', { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`/ota/latest.json answered ${response.status}; name the live commit: node tools/n1-contract.mjs <sha>`);
  const body = await response.text();
  // From the network: anything but a full commit stops here, before a database or a file is touched.
  const version = /"version":"([a-f0-9]{40})"/u.exec(body)?.[1];
  if (!version) throw new Error(`/ota/latest.json names no release; name the live commit: node tools/n1-contract.mjs <sha>`);
  return version;
}

const commits = process.argv.slice(2).length > 0 ? process.argv.slice(2) : [await liveRelease()];
const shas = commits.map(commit => git('rev-parse', '--verify', `${commit}^{commit}`));

rmSync(work, { recursive: true, force: true });
const clients = shas.map(sha => {
  const dir = join(work, sha);
  mkdirSync(join(dir, 'node_modules/@astera'), { recursive: true });
  const archive = execFileSync('git', ['archive', sha, 'apps/web/src/api', 'packages/rules'], { cwd: root, maxBuffer: 512 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', dir], { input: archive });
  symlinkSync(join(dir, 'packages/rules'), join(dir, 'node_modules/@astera/rules'));
  return dir;
});

// Every server test that reads a payload with a client schema.
const testDir = join(server, 'test');
const files = readdirSync(testDir).filter(name => name.endsWith('.test.ts')
  && readFileSync(join(testDir, name), 'utf8').includes("from '../../web/src/api/")).map(name => `test/${name}`);

const database = `astera_n1_${process.pid}_test`;
const recording = join(work, 'recording.jsonl');
const pg = (...args) => execFileSync('docker', ['exec', 'astera-pg', ...args, '-U', 'astera', database], { stdio: 'ignore' });
pg('createdb');
// Cancelled or not, the database this run made goes with it.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => { try { pg('dropdb', '--force'); } finally { process.exit(130); } });
}
let recorded;
try {
  console.log(`Recording ${files.length} server test files on ${database}…`);
  recorded = spawnSync('node', ['../../tools/heavy.mjs', '--heap', '1024', 'pnpm', 'exec', 'vitest', 'run',
    '--config', 'vitest.n1.config.ts', '--maxWorkers=1', ...files], {
    cwd: server, stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, DATABASE_URL: `postgres://astera:astera@localhost:5433/${database}`, ASTERA_N1_RECORD: recording },
  });
} finally {
  pg('dropdb', '--force');
}
// A red test still recorded what it parsed before it failed; the replay below is the verdict.
if (recorded.status !== 0) console.warn('Some recording tests failed; their payloads up to the failure are still read.');

const replayed = spawnSync('pnpm', ['exec', 'tsx', 'test/n1/replay-cli.ts', recording, ...clients], { cwd: server, stdio: 'inherit' });
process.exit(replayed.status ?? 1);
