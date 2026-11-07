/**
 * THE SHIP GALAXIES UNDER LOAD: `tools/capacity.mjs --scenario starter`. Seed with `pnpm starter
 * seed-capacity`. Reads and writes at the rates of a player on a ship, one stream each. It measures
 * the API, which is what ships add; the main game's run keeps its own report. Step up from what held:
 * never open at the top number.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

/** Per player per minute. Screens read on arrival and on events, so the galaxy read is the big one. */
const READS = [
  { route: 'GET /api/starter/vessel', path: '/api/starter/vessel', perMinute: 2 },
  { route: 'GET /api/starter/galaxy', path: '/api/starter/galaxy', perMinute: 1 },
  { route: 'GET /api/starter/traffic', path: '/api/starter/traffic', perMinute: 1 },
  { route: 'GET /api/starter/pending', path: '/api/starter/pending', perMinute: 1 },
  { route: 'GET /api/starter/mining', path: '/api/starter/mining', perMinute: 0.5 },
  { route: 'GET /api/starter/intel', path: '/api/starter/intel', perMinute: 0.5 },
  { route: 'GET /api/starter/notifications', path: '/api/starter/notifications', perMinute: 0.5 },
];
const WRITES = [
  { route: 'POST /api/starter/collect', path: '/api/starter/collect', perMinute: 0.5 },
  { route: 'POST /api/starter/build', path: '/api/starter/build', perMinute: 0.2, body: { hull: 'DART', count: 1 }, accepted: ['QUEUE_FULL', 'INSUFFICIENT_RESOURCES', 'FEATURE_LOCKED'] },
];

const percentile = (sorted, share) => sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];

export async function runStarterCapacity({ baseUrl, password, users, durationSeconds, rampSeconds, report }) {
  const seen = new Map();
  const note = (route, ms, ok) => {
    const row = seen.get(route) ?? { times: [], failed: 0 };
    row.times.push(ms);
    if (!ok) row.failed += 1;
    seen.set(route, row);
  };
  const abort = new AbortController();
  const ask = async (vu, { route, path, body, accepted = [] }) => {
    const started = performance.now();
    try {
      const answer = await fetch(`${baseUrl}${path}`, {
        method: route.startsWith('POST') ? 'POST' : 'GET', signal: abort.signal,
        headers: { authorization: `Bearer ${vu.token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const text = await answer.text();
      const refused = !answer.ok && accepted.some(code => text.includes(code));
      note(route, performance.now() - started, answer.ok || refused);
    } catch (error) {
      if (!abort.signal.aborted) { note(route, performance.now() - started, false); void error; }
    }
  };
  const sleep = (ms) => new Promise((done) => {
    const timer = setTimeout(done, ms);
    abort.signal.addEventListener('abort', () => { clearTimeout(timer); done(); }, { once: true });
  });
  const loop = async (vu, entry) => {
    const meanMs = 60_000 / entry.perMinute;
    await sleep(Math.random() * meanMs);
    while (!abort.signal.aborted) {
      await ask(vu, entry);
      await sleep(-Math.log(Math.max(Number.EPSILON, 1 - Math.random())) * meanMs);
    }
  };
  const stream = async (vu) => {
    try {
      const answer = await fetch(`${baseUrl}/api/stream`, { headers: { authorization: `Bearer ${vu.token}` }, signal: abort.signal });
      note('STREAM /api/stream', 0, answer.ok);
      await answer.body?.pipeTo(new WritableStream());
    } catch { /* The run ending closes it. */ }
  };

  const tasks = [];
  let joined = 0;
  for (let index = 0; index < users; index += 1) {
    const username = `cap${String(5000 + index)}`;
    await new Promise(done => { setTimeout(done, (rampSeconds * 1000) / users); });
    const login = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
    if (!login.ok) throw new Error(`login failed for ${username}: ${String(login.status)}`);
    const { accessToken } = await login.json();
    const vu = { token: accessToken };
    joined += 1;
    tasks.push(stream(vu), ...[...READS, ...WRITES].map(entry => loop(vu, entry)));
  }
  await sleep(durationSeconds * 1000);
  abort.abort();
  await Promise.allSettled(tasks);

  const routes = Object.fromEntries([...seen].map(([route, row]) => {
    const sorted = [...row.times].sort((a, b) => a - b);
    return [route, { count: sorted.length, failed: row.failed, p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95), p99: percentile(sorted, 0.99) }];
  }));
  const out = { scenario: 'starter', users: joined, durationSeconds, routes };
  const path = resolve(report ?? `artifacts/capacity/${new Date().toISOString().replace(/[:.]/g, '-')}-starter-${String(joined)}.json`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(out, null, 2));
  process.stdout.write(`capacity starter: ${String(joined)} ships, report ${path}\n`);
  for (const [route, row] of Object.entries(routes)) {
    process.stdout.write(`  ${route.padEnd(36)} n=${String(row.count).padStart(6)} failed=${String(row.failed).padStart(4)} p95=${row.p95 === null ? '-' : row.p95.toFixed(0)}ms\n`);
  }
  return out;
}
