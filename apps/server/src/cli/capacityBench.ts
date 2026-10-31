/**
 * ROUTE COST ON THE CAPACITY DUMP. Capacity fix plan, item 0 (docs/capacity-fix-plan-2026-10-31.md).
 *
 * The load run told us the box saturates; it could not say which route spends the CPU,
 * because the profiles were mixed with start-up. This runs the real app in-process on a
 * restored copy of the 2,000-commander capacity database, warms every route, then
 * measures each one alone: latency, process CPU per request, SQL statements and bytes.
 * `--profile` records a CPU profile of the measured rounds only.
 *
 *   docker exec -i astera-pg pg_restore -U astera -d astera_bench_test --no-owner --no-privileges < capacity.dump
 *   DATABASE_URL=postgres://astera:astera@localhost:5433/astera_bench_test \
 *     pnpm exec tsx src/cli/capacityBench.ts --accounts 50 --rounds 3 [--profile out.cpuprofile] [--json out.json]
 *
 * Refuses any database whose name does not end in `_test`. Mutations write to that copy.
 */
import { writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { sql } from 'drizzle-orm';
import { pino } from 'pino';
import { buildApp } from '../app.js';
import { createDb } from '../db/client.js';
import { loadEnv } from '../env.js';
import { summarize, type BenchSample, type BenchSummary } from './capacityBenchSummary.js';

const { values } = parseArgs({ options: {
  accounts: { type: 'string', default: '50' },
  rounds: { type: 'string', default: '3' },
  concurrency: { type: 'string' },
  routes: { type: 'string' },
  profile: { type: 'string' },
  json: { type: 'string' },
} });
const url = process.env.DATABASE_URL ?? '';
if (!/_test(\?|$)/.test(url.split('/').pop() ?? '')) throw new Error('DATABASE_URL must name a *_test database');
const accountsWanted = Number(values.accounts);
const rounds = Number(values.rounds);
const concurrency = Number(values.concurrency ?? values.accounts);

interface Probe { name: string; method: 'GET' | 'POST'; url: string; body?: (user: User) => unknown }
interface User { accountId: string; authorization: string; targetPlanetId: string | null }

const READS: Probe[] = [
  { name: 'galaxy', method: 'GET', url: '/api/galaxy' },
  { name: 'traffic', method: 'GET', url: '/api/galaxy/traffic' },
  { name: 'mining-field', method: 'GET', url: '/api/mining/field' },
  { name: 'mining-status', method: 'GET', url: '/api/mining/status' },
  { name: 'pending', method: 'GET', url: '/api/session/pending' },
  { name: 'planets', method: 'GET', url: '/api/planets' },
  { name: 'season', method: 'GET', url: '/api/season' },
  { name: 'notifications', method: 'GET', url: '/api/notifications?limit=30' },
];
const WRITES: Probe[] = [
  { name: 'collect', method: 'POST', url: '/api/planet/collect' },
  { name: 'build', method: 'POST', url: '/api/planet/build', body: () => ({ hull: 'DART', count: 1 }) },
  { name: 'launch', method: 'POST', url: '/api/fleet/launch',
    body: (user) => ({ targetPlanetId: user.targetPlanetId, fleet: { DART: 1 } }) },
];
const wanted = values.routes?.split(',');
const probes = [...READS, ...WRITES].filter((probe) => !wanted || wanted.includes(probe.name));

const { db, close } = createDb(url, { max: 20 });
// The dump's own moment: the last activity it recorded, then real time on from there.
const [latest] = await db.execute<{ at: Date }>(sql`select max(last_active_at) as at from players`);
if (!latest) throw new Error('the dump has no commanders');
const base = new Date(latest.at).getTime();
const t0 = performance.now();
const clock = { now: () => new Date(base + (performance.now() - t0)) };
const env = loadEnv({ NODE_ENV: 'test', DATABASE_URL: url, JWT_SECRET: 'bench-secret-that-is-long-enough',
  RATE_LIMIT_MAX: '1000000', RATE_LIMIT_AUTH_MAX: '1000000', RATE_LIMIT_SIGNUP_MAX: '1000000' });
const built = buildApp({ db, env, clock, logger: pino({ level: 'silent' }) });
await built.app.ready();
await built.bus.start();

const rows = await db.execute<{ account_id: string }>(sql`select p.account_id from players p
  join seasons s on s.id = p.season_id and s.status = 'live' join accounts a on a.id = p.account_id
  where a.username like 'cap%' order by a.username limit ${accountsWanted}`);
const users: User[] = await Promise.all(rows.map(async (row) => ({
  accountId: row.account_id,
  authorization: `Bearer ${await built.app.tokens.issueAccess(row.account_id)}`,
  targetPlanetId: null,
})));

const call = async (user: User, probe: Probe): Promise<BenchSample> => {
  const started = performance.now();
  const response = await built.app.inject({ method: probe.method, url: probe.url,
    headers: { authorization: user.authorization, 'idempotency-key': crypto.randomUUID() },
    ...(probe.body ? { payload: probe.body(user) as Record<string, unknown> } : {}) });
  return { ms: performance.now() - started, statements: Number(response.headers['x-db-statements'] ?? 0),
    bytes: response.rawPayload.length, status: response.statusCode };
};
const inParallel = async <T>(items: readonly T[], run: (item: T) => Promise<void>) => {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) await run(items[next++]!);
  }));
};

// Each commander aims at some world that is not their own, as the load tool does.
for (const user of users) {
  const galaxy = await built.app.inject({ url: '/api/galaxy', headers: { authorization: user.authorization } });
  const planets = galaxy.json<{ planets: { id: string; isSelf?: boolean }[] }>().planets;
  user.targetPlanetId = planets.find((planet) => !planet.isSelf)?.id ?? null;
}

const session = values.profile ? new Session() : null;
if (session) { session.connect(); await session.post('Profiler.enable'); }
const results: Record<string, BenchSummary> = {};
for (const probe of probes) {
  await inParallel(users, async (user) => { await call(user, probe); }); // warm
  if (session) await session.post('Profiler.start');
  const samples: BenchSample[] = [];
  const cpuBefore = process.cpuUsage();
  for (let round = 0; round < rounds; round += 1) {
    await inParallel(users, async (user) => { samples.push(await call(user, probe)); });
  }
  const cpu = process.cpuUsage(cpuBefore);
  if (session && values.profile) {
    const { profile } = await session.post('Profiler.stop');
    await writeFile(values.profile.replace(/(\.cpuprofile)?$/, `-${probe.name}.cpuprofile`), JSON.stringify(profile));
  }
  results[probe.name] = summarize(samples, (cpu.user + cpu.system) / 1000);
  const r = results[probe.name]!;
  console.log(`${probe.name.padEnd(14)} n=${String(r.requests).padStart(4)}  cpu ${r.cpuMsPerRequest.toFixed(2).padStart(7)} ms/req`
    + `  p50 ${r.p50Ms.toFixed(1).padStart(7)}  p95 ${r.p95Ms.toFixed(1).padStart(7)} ms  sql ${r.statementsPerRequest.toFixed(1).padStart(5)}`
    + `  ${r.kbPerRequest.toFixed(1).padStart(7)} KB  ${JSON.stringify(r.statuses)}`);
}
if (values.json) await writeFile(values.json, `${JSON.stringify({ accounts: users.length, rounds, concurrency, results }, null, 2)}\n`);
session?.disconnect();
await built.close();
await close();
