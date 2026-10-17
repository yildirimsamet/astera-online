import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';

/**
 * THE BACKUP REPORTS WHAT HAPPENED. Resource analysis follow-up 2026-10-14.
 *
 * The retention loop ended on `[[ -n "$f" ]] && rm …`, which is false when there is
 * nothing to prune, so a run that wrote a good dump exited 1. Cron hid it; anything
 * that checks the exit status (a release script, a monitor) saw a failed backup.
 */
const script = readFileSync(new URL('../../../deploy/backup.sh', import.meta.url), 'utf8');

function run(options: { keep?: number; existing?: string[]; dumpFails?: boolean; mediaFails?: boolean } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'astera-backup-test-'));
  const bin = resolve(root, 'bin');
  const dest = resolve(root, 'backups');
  mkdirSync(bin);
  mkdirSync(resolve(root, 'deploy'));
  mkdirSync(dest);
  writeFileSync(resolve(root, 'deploy/backup.sh'), script);
  writeFileSync(resolve(root, '.env'), 'POSTGRES_USER=astera\nPOSTGRES_DB=astera\n');
  for (const name of options.existing ?? []) writeFileSync(resolve(dest, name), 'old');
  writeFileSync(resolve(bin, 'docker'), options.dumpFails
    ? '#!/bin/bash\necho "pg_dump: connection refused" >&2\nexit 1\n'
    : '#!/bin/bash\nif [[ "$*" == *" tar "* ]]; then\n  '+(options.mediaFails ? 'exit 1' : 'echo media-archive')+'\nelse\n  echo "-- PostgreSQL database dump complete"\nfi\n', { mode: 0o755 });
  const result = spawnSync('/bin/bash', ['deploy/backup.sh'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, PATH: `${bin}:/usr/bin:/bin`, BACKUP_DIR: dest, BACKUP_KEEP: String(options.keep ?? 14) },
  });
  if (result.error) throw result.error;
  const files = readdirSync(dest).sort();
  const dumps = files.filter(name => /^astera-\d{8}-\d{6}\.sql\.gz$/.test(name));
  const latest = dumps.find(name => !(options.existing ?? []).includes(name));
  const content = latest ? gunzipSync(readFileSync(resolve(dest, latest))).toString() : null;
  rmSync(root, { recursive: true, force: true });
  return { ...result, files, dumps, content };
}

it('exits 0 after a good dump even when nothing needs pruning', () => {
  const result = run();
  expect(result.status, result.stderr).toBe(0);
  expect(result.dumps).toHaveLength(1);
  expect(result.content).toContain('database dump complete');
  expect(result.stdout).toMatch(/^wrote .*astera-\d{8}-\d{6}\.sql\.gz/m);
});

it('prunes beyond the retention count and still exits 0', () => {
  const result = run({ keep: 2, existing: ['astera-20200101-000000.sql.gz', 'astera-20200102-000000.sql.gz'] });
  expect(result.status, result.stderr).toBe(0);
  expect(result.dumps).toHaveLength(2);
  expect(result.dumps).not.toContain('astera-20200101-000000.sql.gz');
  expect(result.stdout).toContain('pruned astera-20200101-000000.sql.gz');
});

it('fails, and leaves no finished dump, when pg_dump fails', () => {
  const result = run({ dumpFails: true });
  expect(result.status).not.toBe(0);
  expect(result.dumps).toEqual([]);
});

it('backs up media alongside the database and prunes matching media archives', () => {
  const result = run({ keep: 1, existing: ['astera-20200101-000000.sql.gz', 'astera-20200101-000000.media.tar.gz'] });
  expect(result.status, result.stderr).toBe(0);
  const archive = result.dumps[0]!.replace('.sql.gz', '.media.tar.gz');
  expect(result.files).toContain(archive);
  expect(result.files).not.toContain('astera-20200101-000000.media.tar.gz');
});

it('does not publish a finished dump when the matching media backup fails', () => {
  const result = run({ mediaFails: true });
  expect(result.status).not.toBe(0);
  expect(result.dumps).toEqual([]);
});
