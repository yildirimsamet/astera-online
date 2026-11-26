import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Recorded } from './record.js';
import { replay } from './replay.js';

/**
 * `tsx test/n1/replay-cli.ts RECORDING CLIENT_ROOT...`: reads the recording with the schemas of each
 * client root (a commit's `apps/web/src/api` and `packages/rules`, unpacked by tools/n1-contract.mjs).
 * Exits 1 when a live client cannot read a payload today's server sends.
 */
const [recording, ...roots] = process.argv.slice(2);
if (!recording || roots.length === 0) throw new Error('Usage: replay-cli.ts RECORDING CLIENT_ROOT...');
const lines = readFileSync(recording, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line) as Recorded);
let broken = false;
for (const root of roots) {
  const modules = new Map<string, Record<string, unknown>>();
  // A client with tolerant lists would skip the row; the check must see it fail (OTA F4, §5.3).
  const lists = join(root, 'apps/web/src/api/tolerantList.ts');
  if (existsSync(lists)) (await import(pathToFileURL(lists).href) as { strictLists: (on: boolean) => void }).strictLists(true);
  for (const module of new Set(lines.map(line => line.module))) {
    const file = join(root, 'apps/web/src/api', `${module}.ts`);
    if (existsSync(file)) modules.set(module, await import(pathToFileURL(file).href) as Record<string, unknown>);
  }
  const result = replay(lines, module => modules.get(module));
  console.log(`\n${root}: ${result.passed} payloads read, ${result.failures.length} broken fields`);
  if (result.skipped.length > 0) console.log(`  not in that client (never asked for): ${result.skipped.join(', ')}`);
  for (const failure of result.failures) {
    console.log(`  ✖ ${failure.module}.${failure.name} → ${failure.path || '(root)'}: ${failure.message} (${failure.count}×)`);
  }
  if (result.failures.length > 0 || result.passed === 0) broken = true;
}
process.exit(broken ? 1 : 0);
