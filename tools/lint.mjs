#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const FILES_PER_PROCESS = 400;
const FLAGS = ['--no-warn-ignored', '--no-error-on-unmatched-pattern'];

/** Each workspace has its own type program; a process that keeps to one loads only that. */
const workspaceOf = (file) => /^(?:apps|packages)\/[^/]+\//.exec(file)?.[0] ?? '';

/**
 * ESLINT IN PARTS, BECAUSE THE WHOLE DOES NOT FIT. Owner, 2026-11-03.
 *
 * A type-aware ESLint grows with every file it lints: 400 files take about 2.6 GiB, and
 * the server, the client's source or its tests alone each ran out of the 3 GiB heap.
 * Each part is its own process behind the machine's lock, so it hands its memory back.
 * Told what to look at, it runs once, exactly as told.
 *
 * @param {string[]} args
 * @param {string[]} files
 * @returns {string[][]}
 */
export function lintRuns(args, files) {
  if (args.length > 1 || (args.length === 1 && args[0] !== '--fix')) return [args];
  const byWorkspace = Map.groupBy(files, workspaceOf);
  return [...byWorkspace.values()].flatMap((group) => {
    const parts = [];
    for (let at = 0; at < group.length; at += FILES_PER_PROCESS) {
      parts.push([...FLAGS, ...args, ...group.slice(at, at + FILES_PER_PROCESS)]);
    }
    return parts;
  });
}

/** Everything Git would keep, tracked or new: what ESLint ignores it ignores itself. */
export function sourceFiles() {
  const listed = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (listed.status !== 0) throw new Error(`git ls-files failed: ${listed.stderr}`);
  return listed.stdout.split('\n').filter((file) => /\.(?:[cm]?js|jsx|tsx?)$/.test(file) && existsSync(resolve(root, file)));
}

/**
 * Every part runs even after one fails, so one lint shows every error there is.
 *
 * @param {string[][]} runs
 * @param {(run: string[]) => number} runOne
 * @returns {number} the first failure's exit code, or 0
 */
export function runParts(runs, runOne) {
  let failure = 0;
  runs.forEach((run, index) => {
    if (runs.length > 1) console.log(`Lint part ${String(index + 1)} of ${String(runs.length)}`);
    const status = runOne(run);
    if (status !== 0 && failure === 0) failure = status;
  });
  return failure;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const runs = lintRuns(args, args.length === 0 || args[0] === '--fix' ? sourceFiles() : []);
  process.exit(runParts(runs, (run) => {
    const result = spawnSync(process.execPath, [
      resolve(root, 'tools/heavy.mjs'), '--heap', '3072',
      process.execPath, resolve(root, 'node_modules/eslint/bin/eslint.js'), ...run,
    ], { cwd: root, stdio: 'inherit' });
    if (result.error) console.error(result.error.message);
    return result.status ?? 1;
  }));
}
