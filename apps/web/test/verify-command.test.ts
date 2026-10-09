import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const runner = join(root, 'tools/verify.mjs');

describe('workspace verification command', () => {
  let scratch: string;
  let callsFile: string;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'astera-verify-test-'));
    callsFile = join(scratch, 'calls.jsonl');
    // Execute the real launcher, with a harmless pnpm stand-in on PATH. No
    // database tests, balance studies or recursive verification run in this suite.
    writeFileSync(join(scratch, 'pnpm'), `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');
const args = process.argv.slice(2);
appendFileSync(process.env.VERIFY_TEST_CALLS, JSON.stringify(args) + '\\n');
if (args.includes(process.env.VERIFY_TEST_FAIL_AT)) process.exit(23);
`, { mode: 0o755 });
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  function run(args: string[] = [], failAt?: string) {
    return spawnSync(process.execPath, [runner, ...args], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${scratch}${delimiter}${process.env.PATH ?? ''}`,
        VERIFY_TEST_CALLS: callsFile,
        ...(failAt === undefined ? {} : { VERIFY_TEST_FAIL_AT: failAt }),
      },
    });
  }

  function calls(): unknown[] {
    try {
      return readFileSync(callsFile, 'utf8').trim().split('\n')
        .filter(Boolean).map((line): unknown => JSON.parse(line));
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
      throw error;
    }
  }

  it('keeps typecheck, lint and ordinary tests for the default invocation', () => {
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(calls()).toEqual([['typecheck'], ['lint'], ['test']]);
  });

  it.each([['--exclude-sims'], ['--', '--exclude-sims']])(
    'accepts the legacy ordinary-test option %j', (...args) => {
      const result = run(args);
      expect(result.status, result.stderr).toBe(0);
      expect(calls()).toEqual([
        ['typecheck'],
        ['lint'],
        ['test'],
      ]);
      expect(result.stdout).toContain('snowball');
    },
  );

  it.each([['--include-long-tests'], ['--', '--include-long-tests']])(
    'runs long tests only with the explicit option %j', (...args) => {
      const result = run(args);
      expect(result.status, result.stderr).toBe(0);
      expect(calls()).toEqual([['typecheck'], ['lint'], ['run', 'test:long']]);
    },
  );

  it.each(['typecheck', 'lint', 'test'])('stops and reports a failing %s', (stage) => {
    const result = run([], stage);
    expect(result.status, result.stderr).toBe(23);
    const stages = ['typecheck', 'lint', 'test'];
    expect(calls()).toEqual(stages.slice(0, stages.indexOf(stage) + 1).map((name) => [name]));
  });

  it('reports failures in the selected test suite instead of passing a partial verify', () => {
    const result = run(['--exclude-sims'], 'test');
    expect(result.status, result.stderr).toBe(23);
    expect(calls()).toHaveLength(3);
  });

  it('rejects an unknown option before starting any checks', () => {
    const result = run(['--exclude-sim']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Usage:');
    expect(calls()).toEqual([]);
  });

  it('fails when pnpm cannot be started', () => {
    const result = spawnSync(process.execPath, [runner], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: scratch + '/missing' },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ENOENT');
  });

  it('is the entry point used by pnpm verify', () => {
    const manifest: unknown = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(manifest).toMatchObject({ scripts: { verify: 'node tools/verify.mjs' } });
  });

  it('excludes the economy workspace by default and exposes an explicit long-test command', () => {
    const manifest: unknown = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(manifest).toMatchObject({ scripts: {
      test: "pnpm --filter '!@astera/sim' -r run test",
      'test:long': 'ASTERA_INCLUDE_LONG_TESTS=1 pnpm -r run test',
    } });
  });
});
