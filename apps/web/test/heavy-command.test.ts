import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * THE PC FROZE WHEN A TYPECHECK, A LINT AND THE TESTS RAN TOGETHER. Owner, 2026-11-03.
 *
 * The rule against it was only written down, and nothing stopped a second session, or
 * `pnpm -r` running four workspaces at once. These run the real launcher.
 */
const root = resolve(import.meta.dirname, '../../..');
const launcher = join(root, 'tools/heavy.mjs');
const node = process.execPath;

describe('the heavy command launcher', () => {
  let scratch: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), 'astera-heavy-test-'));
    // This suite may itself be running under the launcher, so it must not inherit that.
    env = { ...process.env, ASTERA_HEAVY_LOCK: join(scratch, 'lock') };
    delete env.ASTERA_HEAVY_HELD;
    delete env.NODE_OPTIONS;
  });

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  const run = (args: string[], overrides: NodeJS.ProcessEnv = {}) =>
    spawnSync(node, [launcher, ...args], { encoding: 'utf8', env: { ...env, ...overrides } });

  /** A job that notes when it started and ended. */
  const noting = (name: string): string[] => [node, '-e', `
    const { writeFileSync } = require('node:fs');
    const at = (mark) => writeFileSync(${JSON.stringify(scratch)} + '/${name}.' + mark, String(Date.now()));
    at('start');
    setTimeout(() => { at('end'); }, 400);
  `];
  const stamp = (name: string): number => Number(readFileSync(join(scratch, name), 'utf8'));
  const finished = (child: ReturnType<typeof spawn>) =>
    new Promise<number | null>((done) => { child.once('close', done); });

  it('runs two jobs one after the other, never together', async () => {
    const jobs = ['a', 'b'].map((name) =>
      spawn(node, [launcher, ...noting(name)], { env, stdio: 'ignore' }));
    await Promise.all(jobs.map(finished));
    const [first, second] = stamp('a.start') < stamp('b.start') ? ['a', 'b'] : ['b', 'a'];
    expect(stamp(`${second}.start`)).toBeGreaterThanOrEqual(stamp(`${first}.end`));
  });

  it('says a job is waiting, so a queued run does not look hung', async () => {
    const holder = spawn(node, [launcher, ...noting('holder')], { env, stdio: 'ignore' });
    await expect.poll(() => readdirSync(scratch), { timeout: 5_000 }).toContain('holder.start');
    const waiting = run([node, '-e', '']);
    await finished(holder);
    expect(waiting.status).toBe(0);
    expect(waiting.stderr).toMatch(/waiting/i);
  });

  it('gives back the exit code of what it ran', () => {
    expect(run([node, '-e', 'process.exit(23)']).status).toBe(23);
  });

  it('gives back the lock when a job fails', () => {
    expect(run([node, '-e', 'process.exit(1)']).status).toBe(1);
    const next = run([node, '-e', '']);
    expect(next.status).toBe(0);
    expect(next.stderr).not.toMatch(/waiting/i);
  });

  it('does not wait for itself when a heavy job starts another', () => {
    const inner = `require('node:child_process').execFileSync(${JSON.stringify(node)}, [${JSON.stringify(launcher)}, ${JSON.stringify(node)}, '-e', ''], { stdio: 'inherit' })`;
    const nested = spawnSync(node, [launcher, node, '-e', inner], { encoding: 'utf8', env, timeout: 15_000 });
    expect(nested.status).toBe(0);
  });

  it('sets the heap it was given and keeps the Node options already there', () => {
    const heap = "process.stdout.write(process.env.NODE_OPTIONS ?? '')";
    const result = run(['--heap', '3072', node, '-e', heap], { NODE_OPTIONS: '--no-warnings' });
    expect(result.stdout).toBe('--no-warnings --max-old-space-size=3072');
  });

  it('leaves the heap alone when given none', () => {
    const result = run([node, '-e', "process.stdout.write(process.env.NODE_OPTIONS ?? 'none')"]);
    expect(result.stdout).toBe('none');
  });

  it('still runs on a machine with neither flock nor systemd, such as a container', () => {
    const bin = join(scratch, 'bin');
    mkdirSync(bin);
    symlinkSync('/usr/bin/nice', join(bin, 'nice'));
    const result = run([node, '-e', 'process.stdout.write("ran")'], { PATH: bin });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('ran');
  });

  it('refuses to run nothing', () => {
    expect(run([]).status).toBe(2);
    expect(run(['--heap', 'lots', node]).status).toBe(2);
  });

  it('holds a job to the memory ceiling, with no swap to freeze the desktop on', async () => {
    const { heavyCommand } = await import('../../../tools/heavy.mjs');
    const { argv } = heavyCommand(['job'], { env: {}, lockFile: 'lock', hasLock: true, hasScope: true });
    expect(argv.slice(0, 3)).toEqual(['flock', '-o', 'lock']);
    expect(argv).toEqual(expect.arrayContaining(['systemd-run', '--user', '--scope', '--property=MemoryMax=9G', '--property=MemorySwapMax=0']));
    expect(argv.slice(-4)).toEqual(['nice', '-n', '10', 'job']);
  });
});

/** Memory grows with the files one ESLint has linted: 400 of them take about 2.6 GiB. */
describe('the lint command', () => {
  const planned = async (args: string[], files: string[]) => (await import('../../../tools/lint.mjs')).lintRuns(args, files);
  const many = (dir: string, count: number) => Array.from({ length: count }, (_, index) => `${dir}/f${String(index)}.ts`);
  const FLAGS = ['--no-warn-ignored', '--no-error-on-unmatched-pattern'];

  it('never gives one process more than 400 files', async () => {
    const runs = await planned([], many('apps/web/src', 1_001));
    expect(runs.map((run) => run.length - FLAGS.length)).toEqual([400, 400, 201]);
  });

  it('covers every file exactly once', async () => {
    const files = [...many('apps/web/src', 500), ...many('apps/server/src', 450), ...many('tools', 3), 'eslint.config.js'];
    const linted = (await planned([], files)).flat().filter((word) => !FLAGS.includes(word));
    expect([...linted].sort()).toEqual([...files].sort());
  });

  it('keeps a workspace to itself, so a process loads one type program', async () => {
    const runs = await planned([], ['apps/web/src/a.ts', 'apps/server/src/b.ts', 'apps/web/test/c.ts', 'packages/rules/src/d.ts', 'packages/sim/src/e.ts', 'tools/f.mjs', 'g.js']);
    const files = runs.map((run) => run.filter((word) => !FLAGS.includes(word)));
    expect(files).toEqual(expect.arrayContaining([
      ['apps/web/src/a.ts', 'apps/web/test/c.ts'],
      ['apps/server/src/b.ts'],
      ['packages/rules/src/d.ts'],
      ['packages/sim/src/e.ts'],
      ['tools/f.mjs', 'g.js'],
    ]));
    expect(files).toHaveLength(5);
  });

  it('fixes in every part', async () => {
    const runs = await planned(['--fix'], many('apps/web/src', 401));
    expect(runs).toHaveLength(2);
    for (const run of runs) expect(run).toContain('--fix');
  });

  it('runs every part even after one fails, and reports the failure at the end', async () => {
    const { runParts } = await import('../../../tools/lint.mjs');
    const ran: string[] = [];
    const code = runParts([['a'], ['b'], ['c']], ([part]) => {
      ran.push(part ?? '');
      return part === 'b' ? 3 : 0;
    });
    expect(ran).toEqual(['a', 'b', 'c']);
    expect(code).toBe(3);
  });

  it('reports success only when every part passed', async () => {
    const { runParts } = await import('../../../tools/lint.mjs');
    expect(runParts([['a'], ['b']], () => 0)).toBe(0);
  });

  it('runs once as told when told what to look at', async () => {
    expect(await planned(['apps/web/src/a.ts'], many('apps/web/src', 900))).toEqual([['apps/web/src/a.ts']]);
  });

  it('is what pnpm lint runs and what CI runs', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(manifest.scripts.lint).toBe('node tools/lint.mjs');
    expect(manifest.scripts['lint:fix']).toBe('node tools/lint.mjs --fix');
    const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
    expect(ci).toContain('- run: pnpm lint\n');
    expect(ci).not.toContain('pnpm lint --ignore-pattern');
  });

  it('lints what ESLint would find, and no file that has been deleted', async () => {
    const { sourceFiles } = await import('../../../tools/lint.mjs');
    const files = sourceFiles();
    expect(files).toContain('tools/lint.mjs');
    expect(files).toContain('apps/web/src/api/liveChannel.ts');
    expect(files.every((file) => /\.(?:[cm]?js|jsx|tsx?)$/.test(file))).toBe(true);
  });
});

describe('what goes through the launcher', () => {
  const scripts = (path: string): Record<string, string> => {
    const manifest = JSON.parse(readFileSync(join(root, path), 'utf8')) as { scripts: Record<string, string> };
    return manifest.scripts;
  };
  const LAUNCHER = 'node ../../tools/heavy.mjs';

  it.each(['apps/server', 'apps/web', 'packages/rules', 'packages/sim'])('%s queues its typecheck at 3 GiB', (workspace) => {
    expect(scripts(`${workspace}/package.json`).typecheck).toBe(`${LAUNCHER} --heap 3072 tsc --noEmit`);
  });

  it.each(['apps/server', 'apps/web', 'packages/rules'])('%s queues its tests, at most four workers of 1 GiB', (workspace) => {
    expect(scripts(`${workspace}/package.json`).test).toBe(`${LAUNCHER} --heap 1024 vitest run --minWorkers=1 --maxWorkers=4`);
  });

  /** Vitest refused the worker limit on its own, and a script's text cannot show that. */
  it('really starts tests with those options', () => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.NODE_OPTIONS;
    delete env.VITEST;
    delete env.VITEST_POOL_ID;
    delete env.VITEST_WORKER_ID;
    const result = spawnSync('pnpm', ['test', 'test/faults'], { cwd: join(root, 'packages/rules'), encoding: 'utf8', env });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toMatch(/Tests\s+.*\d+ passed/);
  }, 60_000);

  it('queues the long simulations, whose memory is theirs to set', () => {
    expect(scripts('packages/sim/package.json').test).toBe(`${LAUNCHER} vitest run --minWorkers=1 --maxWorkers=4`);
  });
});

describe('what a typecheck has to hold', () => {
  const sources = (dir: string): string[] =>
    readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file) && !file.includes('node_modules'))
      .map((file) => join(root, dir, file));

  /** One such line brought 614 files of server and Drizzle types into the client's check. */
  it('the client never imports server code, in the app or its tests', () => {
    const importing = [...sources('apps/web/src'), ...sources('apps/web/test')]
      .filter((file) => /(?:from|import\()\s*'[^']*server\/src\//.test(readFileSync(file, 'utf8')));
    expect(importing).toEqual([]);
  });

  /** Nothing is built from these: esbuild and Vite do the emitting. They only cost memory. */
  it('no workspace asks the compiler for declarations it never writes', () => {
    const config = JSON.parse(readFileSync(join(root, 'tsconfig.base.json'), 'utf8')) as { compilerOptions: Record<string, unknown> };
    expect(config.compilerOptions).not.toHaveProperty('declaration');
    expect(config.compilerOptions).not.toHaveProperty('declarationMap');
    expect(config.compilerOptions).not.toHaveProperty('sourceMap');
  });
});
