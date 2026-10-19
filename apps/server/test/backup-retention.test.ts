import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, '../../../deploy/backup-retention.py');
const roots: string[] = [];
const fixture = () => { const root = mkdtempSync(join(tmpdir(), 'astera-retention-')); roots.push(root); return root; };
const stamp = (hours: number, release = false) => {
  const date = new Date(Date.now() - hours * 3_600_000).toISOString().replaceAll(/[-:]/g, '');
  return release ? `${date.slice(0, 8)}T${date.slice(9, 15)}Z` : `${date.slice(0, 8)}-${date.slice(9, 15)}`;
};
function run(root: string, ...args: string[]) {
  return spawnSync('python3', [script, '--directory', root, ...args], { encoding: 'utf8', timeout: 10_000 });
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it('defaults to dry run, uses the encoded snapshot time even on freshly copied files, and enforces the 30-day bound', () => {
  const root = fixture(); const old = `astera-${stamp(30 * 24)}.sql.gz`; const recent = `astera-${stamp(29 * 24)}.sql.gz`;
  for (const file of [old, recent, old.replace('.sql.gz', '.media.tar.gz')]) writeFileSync(join(root, file), 'private');
  const preview = run(root);
  expect(preview.status, preview.stderr).toBe(0);
  expect(preview.stdout).toContain(old); expect(preview.stdout).not.toContain(recent);
  expect(existsSync(join(root, old))).toBe(true);
  expect(run(root, '--apply').status).toBe(0);
  expect(existsSync(join(root, old))).toBe(false);
  expect(existsSync(join(root, old.replace('.sql.gz', '.media.tar.gz')))).toBe(false);
  expect(existsSync(join(root, recent))).toBe(true);
});

it('keeps the last fourteen daily pairs independently of private release snapshots', () => {
  const root = fixture();
  const names = Array.from({ length: 16 }, (_, i) => `astera-${stamp(i + 1)}.sql.gz`);
  for (const file of names) { writeFileSync(join(root, file), 'db'); writeFileSync(join(root, file.replace('.sql.gz', '.media.tar.gz')), 'media'); }
  expect(run(root, '--apply').status).toBe(0);
  for (const file of names.slice(0, 14)) expect(existsSync(join(root, file))).toBe(true);
  for (const file of names.slice(14)) {
    expect(existsSync(join(root, file))).toBe(false);
    expect(existsSync(join(root, file.replace('.sql.gz', '.media.tar.gz')))).toBe(false);
  }
});

it('expires private dumps, logs, environment copies and partial archives while preserving the active nonpersonal image pin', () => {
  const root = fixture(); const release = join(root, `astera-review-account-${stamp(31 * 24, true)}`);
  mkdirSync(join(release, 'nested'), { recursive: true });
  for (const name of ['database.sql.gz', 'runtime.env', 'clone-runtime.json', 'host.log', 'nested/media.tar.gz']) writeFileSync(join(release, name), 'private');
  writeFileSync(join(release, 'pinned-compose.yml'), 'services:\n  api1:\n    image: astera:sha\n');
  const partial = `astera-${stamp(31 * 24)}.sql.gz.partial`;
  const legacy = `astera-pve-81560c305d4c-${stamp(31 * 24)}.sql.gz`;
  const env = `astera-mail-env-${stamp(31 * 24, true)}-31cf1c37.env`;
  for (const name of [partial, legacy, env]) writeFileSync(join(root, name), 'private');
  const result = run(root, '--apply'); expect(result.status, result.stderr).toBe(0);
  for (const name of ['database.sql.gz', 'runtime.env', 'clone-runtime.json', 'host.log', 'nested/media.tar.gz']) expect(existsSync(join(release, name))).toBe(false);
  expect(readFileSync(join(release, 'pinned-compose.yml'), 'utf8')).toContain('image: astera:sha');
  for (const name of [partial, legacy, env]) expect(existsSync(join(root, name))).toBe(false);
  expect(run(root, '--apply').status).toBe(0);
});

it('never traverses symlinks or touches other projects, unrelated paths, or recent private releases', () => {
  const root = fixture(); const outside = fixture(); const old = `astera-mobile-native-${stamp(31 * 24, true)}`;
  writeFileSync(join(outside, 'private.sql'), 'outside'); symlinkSync(outside, join(root, old));
  const release = join(root, `astera-review-account-${stamp(31 * 24, true)}`); mkdirSync(release);
  symlinkSync(outside, join(release, 'outside')); writeFileSync(join(release, 'database.sql.gz'), 'expire');
  const recent = join(root, `astera-review-account-${stamp(1, true)}`); mkdirSync(recent); writeFileSync(join(recent, 'database.sql.gz'), 'keep');
  for (const name of ['hoofywood-20200101.sql.gz', 'astera-not-a-snapshot.sql.gz', 'notes.txt']) writeFileSync(join(root, name), 'keep');
  expect(run(root, '--apply').status).toBe(0);
  expect(readFileSync(join(outside, 'private.sql'), 'utf8')).toBe('outside');
  expect(existsSync(join(recent, 'database.sql.gz'))).toBe(true);
  expect(existsSync(join(release, 'database.sql.gz'))).toBe(false);
  for (const name of ['hoofywood-20200101.sql.gz', 'astera-not-a-snapshot.sql.gz', 'notes.txt']) expect(existsSync(join(root, name))).toBe(true);
  expect(run(root + '/.', '--keep', '0', '--apply').status).not.toBe(0);
  expect(run('/', '--apply').status).not.toBe(0);
  expect(run(join(root, old), '--apply').status).not.toBe(0);
});
