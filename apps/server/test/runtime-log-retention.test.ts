import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, '../../../deploy/runtime-log-retention.py');
const roots: string[] = [];
function fixture() { const root = mkdtempSync(join(tmpdir(), 'astera-runtime-retention-')); roots.push(root); return root; }
function name(days: number) { return 'runtime-' + new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10) + '.log'; }
function run(directory: string, ...args: string[]) { return spawnSync('python3', [script, '--directory', directory, ...args], { encoding: 'utf8', timeout: 10_000 }); }
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

it('previews by default and expires old daily records despite fresh copy timestamps', () => {
  const root = fixture(); const old = name(30); const fresh = name(28);
  writeFileSync(join(root, old), 'private old connection'); writeFileSync(join(root, fresh), 'recent');
  const preview = run(root); expect(preview.status, preview.stderr).toBe(0);
  expect(preview.stdout).toContain(old); expect(preview.stdout).not.toContain(fresh); expect(existsSync(join(root, old))).toBe(true);
  const applied = run(root, '--apply'); expect(applied.status, applied.stderr).toBe(0);
  expect(existsSync(join(root, old))).toBe(false); expect(readFileSync(join(root, fresh), 'utf8')).toBe('recent');
  expect(run(root, '--apply').status).toBe(0);
});

it('keeps foreign files, malformed calendar dates, nested directories and linked targets untouched', () => {
  const root = fixture(); const outside = fixture();
  writeFileSync(join(outside, 'personal'), 'outside'); symlinkSync(join(outside, 'personal'), join(root, name(40)));
  mkdirSync(join(root, 'nested')); writeFileSync(join(root, 'nested', name(40)), 'nested');
  for (const file of ['runtime-2026-02-30.log', 'other-2020-01-01.log', 'notes.txt']) writeFileSync(join(root, file), 'keep');
  expect(run(root, '--apply').status).toBe(0);
  expect(readFileSync(join(outside, 'personal'), 'utf8')).toBe('outside');
  expect(readFileSync(join(root, 'nested', name(40)), 'utf8')).toBe('nested');
  for (const file of ['runtime-2026-02-30.log', 'other-2020-01-01.log', 'notes.txt']) expect(existsSync(join(root, file))).toBe(true);
});

it('refuses broad directories and roots reached through a symlink', () => {
  const root = fixture(); const outside = fixture(); symlinkSync(outside, join(root, 'linked'));
  for (const directory of ['/', '/tmp', '/home', join(root, 'linked')]) expect(run(directory, '--apply').status).not.toBe(0);
});
