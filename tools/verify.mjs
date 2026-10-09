import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const includeLongTests = args.length === 1 && args[0] === '--include-long-tests';
const legacyExcludeSims = args.length === 1 && args[0] === '--exclude-sims';
if (args.length > 0 && !includeLongTests && !legacyExcludeSims) {
  console.error('Usage: pnpm verify [--include-long-tests | --exclude-sims]');
  process.exit(2);
}

// Type and lint always cover the workspace. Long economy simulations and the
// snowball audit require an explicit user request; ordinary resource tests stay.
const commands = [
  ['typecheck'],
  ['lint'],
  includeLongTests ? ['run', 'test:long'] : ['test'],
];

if (!includeLongTests) {
  console.log('Skipping economy simulations and snowball audit tests; explicit user request required.');
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
