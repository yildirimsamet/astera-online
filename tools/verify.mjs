import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const excludeSims = args.length === 1 && args[0] === '--exclude-sims';
if (args.length > 0 && !excludeSims) {
  console.error('Usage: pnpm verify [--exclude-sims]');
  process.exit(2);
}

// Type and lint checks still cover the whole workspace. Only test execution is
// reduced; ordinary economy/resource transaction tests remain in the gate.
const commands = [
  ['typecheck'],
  ['lint'],
  excludeSims
    ? ['--filter', '!@astera/sim', '-r', 'run', 'test', '--exclude', '**/snowball-audit.test.*']
    : ['test'],
];

if (excludeSims) {
  console.log('Skipping @astera/sim and snowball audit tests (--exclude-sims).');
}

for (const command of commands) {
  const result = spawnSync('pnpm', command, {
    cwd: resolve(import.meta.dirname, '..'),
    stdio: 'inherit',
  });
  if (result.error) console.error(result.error.message);
  if (result.signal) console.error(`pnpm ${command.join(' ')} stopped by ${result.signal}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
