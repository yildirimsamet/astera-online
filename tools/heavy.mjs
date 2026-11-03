#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { userInfo } from 'node:os';
import { fileURLToPath } from 'node:url';

/**
 * ONE HEAVY JOB AT A TIME ON THIS PC. Owner, 2026-11-03.
 *
 * A typecheck, a lint and the tests together ran the machine out of memory and froze
 * the desktop. The tests alone leave about 2.4 GiB free, and a compiler wants more.
 * Sessions queue on one lock for the whole machine, across worktrees; the kernel
 * releases it however a job ends. A job over the ceiling dies rather than swapping the
 * desktop to a stop. CI has no user systemd, so there only the lock applies.
 */
const MEMORY_MAX = '9G';

/**
 * @param {string[]} command
 * @param {{ env: NodeJS.ProcessEnv, heap?: number, lockFile: string, hasLock: boolean, hasScope: boolean }} options
 * @returns {{ argv: string[], env: NodeJS.ProcessEnv }}
 */
export function heavyCommand(command, { env, heap, lockFile, hasLock, hasScope }) {
  const nextEnv = { ...env, ASTERA_HEAVY_HELD: '1' };
  if (heap !== undefined) {
    const options = `--max-old-space-size=${String(heap)}`;
    nextEnv.NODE_OPTIONS = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ${options}` : options;
  }
  // Already inside a job: it holds the lock and the ceiling, and waiting would deadlock.
  if (env.ASTERA_HEAVY_HELD === '1') return { argv: command, env: nextEnv };
  return {
    argv: [
      // `-o`: a daemon the job leaves behind must not keep the lock.
      ...(hasLock ? ['flock', '-o', lockFile] : []),
      ...(hasScope ? ['systemd-run', '--user', '--scope', '--quiet', `--property=MemoryMax=${MEMORY_MAX}`, '--property=MemorySwapMax=0'] : []),
      'nice', '-n', '10',
      ...command,
    ],
    env: nextEnv,
  };
}

const succeeds = (program, args) => spawnSync(program, args, { stdio: 'ignore' }).status === 0;

function main(args) {
  let heap;
  if (args[0] === '--heap') {
    heap = Number(args[1]);
    if (!Number.isInteger(heap) || heap <= 0) return usage();
    args = args.slice(2);
  }
  if (args.length === 0) return usage();

  const lockFile = process.env.ASTERA_HEAVY_LOCK ?? `/tmp/astera-heavy-${String(userInfo().uid)}.lock`;
  const nested = process.env.ASTERA_HEAVY_HELD === '1';
  const hasLock = !nested && succeeds('flock', ['--version']);
  const hasScope = !nested && succeeds('systemd-run', ['--user', '--scope', '--quiet', 'true']);
  if (hasLock && !succeeds('flock', ['-n', lockFile, 'true'])) {
    console.error('Waiting for another heavy job on this PC to finish…');
  }

  const { argv, env } = heavyCommand(args, { env: process.env, heap, lockFile, hasLock, hasScope });
  const [program, ...rest] = argv;
  const result = spawnSync(program, rest, { stdio: 'inherit', env });
  if (result.error) console.error(result.error.message);
  if (result.signal) console.error(`${args.join(' ')} stopped by ${result.signal}`);
  return result.status ?? 1;
}

function usage() {
  console.error('Usage: node tools/heavy.mjs [--heap <MiB>] <command> [args…]');
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
