#!/usr/bin/env -S pnpm exec tsx
/**
 * Real HTTP + real SSE capacity runner for an isolated Astera staging database.
 * It refuses the production origin and never writes game state except through API
 * mutations a browser can make.
 *
 * CAPACITY_PASSWORD=... pnpm capacity:test -- \
 *   --base-urls http://127.0.0.1:3200,http://127.0.0.1:3201,http://127.0.0.1:3202 \
 *   --users 300 --connections 300 --scenario normal --duration-seconds 3600
 *
 * To exercise Nginx without making 300 staging logins look like one brute-force
 * source, authenticate through the loopback replicas and run everything else
 * through the proxy:
 *   --base-urls http://127.0.0.1:3380 \
 *   --login-base-urls http://127.0.0.1:3300,http://127.0.0.1:3301,http://127.0.0.1:3302
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { performance } from 'node:perf_hooks';
import {
  buildSchema,
  chatPageSchema,
  chatPostSchema,
  chatUnreadSchema,
  chroniclePageSchema,
  collectSchema,
  galaxySchema,
  intelSchema,
  launchSchema,
  leaderboardSchema,
  miningFieldSchema,
  miningLaunchSchema,
  miningStatusSchema,
  notificationsSchema,
  pendingSchema,
  planetSchema,
  planetsSchema,
  reportsSchema,
  rewardsSchema,
  seasonSchema,
  sessionSchema,
  trafficSchema,
} from '../apps/web/src/api/schemas.ts';

const PRODUCTION_HOSTS = new Set([
  'asteraonline.space',
  'www.asteraonline.space',
  'api.asteraonline.space',
  'socket.asteraonline.space',
]);
const SHARD_PREFIX = 'shard:';
const COALESCE_MS = 250;
const EVENT_DRAIN_MS = 2500;
const RECONNECT_RESYNC_MAX_MS = 5000;
const READ_NET_MS = 60_000;
const REQUEST_TIMEOUT_MS = 15_000;
const HISTOGRAM_MAX_MS = 60_000;
const METRIC_SNAPSHOT_CAPACITY = 2_048;

const cliArgs = process.argv.slice(2);
if (cliArgs[0] === '--') cliArgs.shift();
const { values } = parseArgs({
  args: cliArgs,
  options: {
    'base-urls': { type: 'string', default: 'http://127.0.0.1:3200' },
    'login-base-urls': { type: 'string' },
    users: { type: 'string', default: '100' },
    connections: { type: 'string' },
    scenario: { type: 'string', default: 'quiet' },
    'duration-seconds': { type: 'string', default: '600' },
    'ramp-seconds': { type: 'string', default: '60' },
    seed: { type: 'string', default: '99300' },
    report: { type: 'string' },
    'metrics-urls': { type: 'string' },
    'synthetic-xff': { type: 'boolean', default: true },
    'reconnect-at-seconds': { type: 'string' },
    'mining-pulse-at-seconds': { type: 'string' },
    'wave-launches': { type: 'string', default: '0' },
    'wave-seconds': { type: 'string', default: '10' },
    'max-rss-mb': { type: 'string', default: '512' },
    'min-worker-events': { type: 'string', default: '1' },
    'database-url': { type: 'string' },
  },
});

const intArg = (name, raw, min, max) => {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`--${name} must be an integer from ${String(min)} to ${String(max)}`);
  }
  return value;
};

const userCount = intArg('users', values.users, 1, 600);
const connectionCount = intArg('connections', values.connections ?? values.users, 1, 750);
if (connectionCount < userCount) {
  throw new Error('--connections must be at least --users; every claimed active account needs a live client');
}
const durationSeconds = intArg('duration-seconds', values['duration-seconds'], 10, 43_200);
const rampSeconds = intArg('ramp-seconds', values['ramp-seconds'], 0, 1800);
const seed = intArg('seed', values.seed, 1, 2_000_000_000);
const reconnectAtSeconds = values['reconnect-at-seconds'] === undefined
  ? null
  : intArg('reconnect-at-seconds', values['reconnect-at-seconds'], 1, durationSeconds - 1);
const miningPulseAtSeconds = values['mining-pulse-at-seconds'] === undefined
  ? null
  : intArg('mining-pulse-at-seconds', values['mining-pulse-at-seconds'], 1, durationSeconds - 1);
const waveLaunches = intArg('wave-launches', values['wave-launches'], 0, 600);
const waveSeconds = intArg('wave-seconds', values['wave-seconds'], 1, 300);
const maxRssMb = intArg('max-rss-mb', values['max-rss-mb'], 64, 65_536);
const minWorkerEvents = intArg('min-worker-events', values['min-worker-events'], 0, 1_000_000);
if (waveLaunches > Math.min(userCount, connectionCount)) {
  throw new Error('--wave-launches cannot exceed the number of distinct connected accounts');
}
const password = process.env.CAPACITY_PASSWORD;
if (!password || password.length < 8 || password.length > 200) {
  throw new Error('CAPACITY_PASSWORD must contain 8–200 characters.');
}

const scenarios = {
  quiet: { actionMeanSeconds: 0 },
  normal: { actionMeanSeconds: 600 },
  busy: { actionMeanSeconds: 240 },
};
const scenario = scenarios[values.scenario];
if (!scenario) throw new Error('--scenario must be quiet, normal or busy');

const safeBaseUrls = (name, input) => {
  const urls = input.split(',').map((raw) => raw.trim().replace(/\/$/, ''));
  if (urls.some((url) => url === '')) throw new Error(`--${name} contains an empty URL`);
  for (const raw of urls) {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Unsupported protocol: ${url.protocol}`);
    if (PRODUCTION_HOSTS.has(url.hostname.toLowerCase())) {
      throw new Error(`Refusing to run a capacity test against production origin ${url.origin}`);
    }
    const host = url.hostname.toLowerCase();
    const namedStaging = /(^|[.-])(staging|capacity|loadtest)([.-]|$)/.test(host);
    if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !namedStaging) {
      throw new Error(
        `Refusing unrecognised host ${url.origin}; use loopback or a hostname explicitly named staging/capacity/loadtest.`,
      );
    }
  }
  return urls;
};
const baseUrls = safeBaseUrls('base-urls', values['base-urls']);
const loginBaseUrls = safeBaseUrls(
  'login-base-urls',
  values['login-base-urls'] ?? values['base-urls'],
);
const metricsUrls = safeBaseUrls(
  'metrics-urls',
  values['metrics-urls'] ?? baseUrls.map((url) => `${url}/metrics`).join(','),
);
const databaseUrl = values['database-url'] ?? process.env.CAPACITY_DATABASE_URL ?? null;
if (databaseUrl !== null) {
  const parsed = new URL(databaseUrl);
  const database = decodeURIComponent(parsed.pathname.slice(1));
  const host = parsed.hostname.toLowerCase();
  const namedStaging = /(^|[.-])(staging|capacity|loadtest)([.-]|$)/.test(host);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('--database-url must use postgres:// or postgresql://');
  }
  if (!/(?:^|_)(capacity|staging|loadtest)$/.test(database)) {
    throw new Error(`Refusing reconciliation database "${database}"; it is not staging-named.`);
  }
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !namedStaging) {
    throw new Error(`Refusing unrecognised reconciliation database host ${host}`);
  }
}

let rngState = seed >>> 0;
const random = () => {
  rngState += 0x6d2b79f5;
  let value = rngState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
};
const pause = (ms, signal) => new Promise((done) => {
  if (signal?.aborted) return done();
  const timer = setTimeout(done, Math.max(0, ms));
  signal?.addEventListener('abort', () => {
    clearTimeout(timer);
    done();
  }, { once: true });
});
const percentile = (valuesToSort, p) => {
  if (valuesToSort.length === 0) return 0;
  const sorted = [...valuesToSort].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
};
/** One-millisecond buckets retain the entire run without retaining every request. */
const fullRunHistogram = () => ({
  bins: new Uint32Array(HISTOGRAM_MAX_MS + 2),
  total: 0,
  sum: 0,
  max: 0,
  overflow: 0,
});
const addSample = (histogram, value) => {
  if (!Number.isFinite(value) || value < 0) return;
  histogram.total += 1;
  histogram.sum += value;
  histogram.max = Math.max(histogram.max, value);
  const bucket = Math.min(HISTOGRAM_MAX_MS + 1, Math.ceil(value));
  histogram.bins[bucket] += 1;
  if (bucket > HISTOGRAM_MAX_MS) histogram.overflow += 1;
};
const histogramPercentile = (histogram, p) => {
  if (histogram.total === 0) return 0;
  const wanted = Math.max(1, Math.ceil((p / 100) * histogram.total));
  let seen = 0;
  for (let index = 0; index < histogram.bins.length; index += 1) {
    seen += histogram.bins[index];
    if (seen >= wanted) return index > HISTOGRAM_MAX_MS ? histogram.max : index;
  }
  return histogram.max;
};
const histogramSummary = (histogram) => ({
  samples: histogram.total,
  p50: histogramPercentile(histogram, 50),
  p95: histogramPercentile(histogram, 95),
  p99: histogramPercentile(histogram, 99),
  max: histogram.max,
  mean: histogram.total === 0 ? 0 : histogram.sum / histogram.total,
  overflow: histogram.overflow,
});
const usernameFor = (index) => `cap${String((index % userCount) + 1).padStart(4, '0')}`;
const syntheticIpFor = (index) => `198.18.${String(Math.floor(index / 254))}.${String((index % 254) + 1)}`;
const isLoopback = (raw) => ['127.0.0.1', 'localhost', '::1'].includes(new URL(raw).hostname);

const routeStats = new Map();
const eventRefreshMs = fullRunHistogram();
const committedStateFreshnessMs = fullRunHistogram();
const readLatencyMs = fullRunHistogram();
const mutationLatencyMs = fullRunHistogram();
const metricSnapshots = [];
const requestIntegrity = {
  unexpectedStatuses: 0,
  acceptedDomainRefusals: 0,
  invalidJson: 0,
  invalidPayloads: 0,
  successfulMutations: 0,
};
const publicState = {
  expected: 0,
  observed: 0,
  waveAttempts: 0,
  waveSucceeded: 0,
  miningPulseSucceeded: 0,
};
const pendingPublicContacts = new Map();
const recentlySeenContacts = new Map();
const streamStats = {
  opened: 0,
  reconnects: 0,
  forcedReconnectTriggered: 0,
  forcedReconnectCompleted: 0,
  failures: 0,
  events: 0,
  maxConnected: 0,
  connected: 0,
  connectedAtEnd: 0,
};

// The capacity runner exercises the same wire contracts as the browser. Keeping
// a second set of hand-written shape checks here would drift; importing the
// production client schemas makes a 200 with the wrong payload a failed run.
const responseSchemas = new Map([
  ['POST /api/auth/login', sessionSchema],
  ['GET /api/season', seasonSchema],
  ['GET /api/planet', planetSchema],
  ['GET /api/planets', planetsSchema],
  ['GET /api/galaxy', galaxySchema],
  ['GET /api/galaxy/traffic', trafficSchema],
  ['GET /api/leaderboard', leaderboardSchema],
  ['GET /api/intel', intelSchema],
  ['GET /api/notifications', notificationsSchema],
  ['GET /api/session/pending', pendingSchema],
  ['GET /api/reports', reportsSchema],
  ['GET /api/mining/field', miningFieldSchema],
  ['GET /api/mining/status', miningStatusSchema],
  ['GET /api/rewards', rewardsSchema],
  ['GET /api/chat/messages', chatPageSchema],
  ['POST /api/chat/messages', chatPostSchema],
  ['GET /api/chat/unread', chatUnreadSchema],
  ['GET /api/chronicle', chroniclePageSchema],
  ['POST /api/fleet/launch', launchSchema],
  ['POST /api/planet/collect', collectSchema],
  ['POST /api/planet/build', buildSchema],
  ['POST /api/mining/launch', miningLaunchSchema],
  ['POST /api/mining/harvest', miningLaunchSchema],
]);

const validErrorPayload = (body) => Boolean(
  body
  && typeof body === 'object'
  && !Array.isArray(body)
  && typeof body.error === 'string'
  && body.error.length > 0
  && typeof body.message === 'string'
  && (
    body.params === undefined
    || (
      body.params !== null
      && typeof body.params === 'object'
      && !Array.isArray(body.params)
      && Object.values(body.params).every((value) => (
        typeof value === 'string'
        || (typeof value === 'number' && Number.isFinite(value))
      ))
    )
  )
);

const routeRecord = (method, path) => {
  const key = `${method} ${path.split('?')[0]}`;
  const record = routeStats.get(key) ?? {
    requests: 0,
    status2xx: 0,
    status4xx: 0,
    status5xx: 0,
    networkErrors: 0,
    bytes: 0,
    status3xx: 0,
    invalidPayloads: 0,
    latencyMs: fullRunHistogram(),
    errors: {},
  };
  routeStats.set(key, record);
  return record;
};

const observePublicContacts = (vu, body) => {
  if (!body || !Array.isArray(body.contacts)) return;
  const seenAt = performance.now();
  for (const contact of body.contacts) {
    if (!contact || typeof contact.id !== 'string') continue;
    const expected = pendingPublicContacts.get(contact.id);
    if (expected && expected.accountIndex !== vu.accountIndex) {
      pendingPublicContacts.delete(contact.id);
      publicState.observed += 1;
      addSample(committedStateFreshnessMs, seenAt - expected.intentAt);
      continue;
    }
    recentlySeenContacts.set(contact.id, { seenAt, accountIndex: vu.accountIndex });
  }
  while (recentlySeenContacts.size > 10_000) {
    const oldest = recentlySeenContacts.keys().next().value;
    if (oldest === undefined) break;
    recentlySeenContacts.delete(oldest);
  }
};

const expectPublicContact = (id, accountIndex, intentAt) => {
  publicState.expected += 1;
  const alreadySeen = recentlySeenContacts.get(id);
  if (alreadySeen && alreadySeen.accountIndex !== accountIndex && alreadySeen.seenAt >= intentAt) {
    recentlySeenContacts.delete(id);
    publicState.observed += 1;
    addSample(committedStateFreshnessMs, alreadySeen.seenAt - intentAt);
    return;
  }
  pendingPublicContacts.set(id, { accountIndex, intentAt });
};

const request = async (vu, path, options = {}) => {
  const method = options.method ?? 'GET';
  const record = routeRecord(method, path);
  const targetBaseUrl = options.baseUrl ?? vu?.baseUrl ?? baseUrls[0];
  const started = performance.now();
  let succeeded = false;
  record.requests += 1;
  try {
    const headers = {
      ...(vu?.token ? { authorization: `Bearer ${vu.token}` } : {}),
      ...(vu?.cookie ? { cookie: vu.cookie } : {}),
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(values['synthetic-xff'] && vu && isLoopback(targetBaseUrl)
        ? { 'x-forwarded-for': vu.syntheticIp }
        : {}),
    };
    const response = await fetch(`${targetBaseUrl}${path}`, {
      method,
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    record.bytes += Buffer.byteLength(text);
    if (response.status >= 500) record.status5xx += 1;
    else if (response.status >= 400) record.status4xx += 1;
    else if (response.status >= 300) record.status3xx += 1;
    else record.status2xx += 1;
    let body = null;
    let parsed = text !== '';
    try { body = text === '' ? null : JSON.parse(text); } catch {
      parsed = false;
      requestIntegrity.invalidJson += 1;
    }
    if (!response.ok) {
      const code = body && typeof body.error === 'string' ? body.error : `HTTP_${String(response.status)}`;
      record.errors[code] = (record.errors[code] ?? 0) + 1;
      if (!parsed || !validErrorPayload(body)) {
        requestIntegrity.invalidPayloads += 1;
        record.invalidPayloads += 1;
        requestIntegrity.unexpectedStatuses += 1;
      } else if (options.acceptedErrorCodes?.includes(code)) {
        requestIntegrity.acceptedDomainRefusals += 1;
      } else {
        requestIntegrity.unexpectedStatuses += 1;
      }
    } else {
      const routeKey = `${method} ${path.split('?')[0]}`;
      const schema = responseSchemas.get(routeKey);
      const valid = parsed
        && schema !== undefined
        && schema.safeParse(body).success
        && (options.validate === undefined || options.validate(body) === true);
      if (!valid) {
        requestIntegrity.invalidPayloads += 1;
        record.invalidPayloads += 1;
      } else {
        succeeded = true;
        if (method !== 'GET' && `${method} ${path.split('?')[0]}` !== 'POST /api/auth/login') {
          requestIntegrity.successfulMutations += 1;
        }
        if (vu && path.split('?')[0] === '/api/galaxy/traffic') {
          observePublicContacts(vu, body);
        }
      }
    }
    return { response, body, valid: succeeded, startedAt: started };
  } catch (error) {
    record.networkErrors += 1;
    const code = error instanceof Error ? error.name : 'NETWORK';
    record.errors[code] = (record.errors[code] ?? 0) + 1;
    return { response: null, body: null, valid: false, startedAt: started };
  } finally {
    const elapsed = performance.now() - started;
    addSample(record.latencyMs, elapsed);
    if (method === 'GET' && succeeded) addSample(readLatencyMs, elapsed);
    else if (succeeded && `${method} ${path.split('?')[0]}` !== 'POST /api/auth/login') {
      addSample(mutationLatencyMs, elapsed);
    }
  }
};

const shardReads = (kind) => {
  switch (kind.slice(SHARD_PREFIX.length)) {
    case 'launch': return ['/api/galaxy/traffic'];
    case 'arrival': return ['/api/galaxy/traffic', '/api/mining/field'];
    case 'mining': return ['/api/mining/field', '/api/galaxy/traffic'];
    case 'world': return ['/api/galaxy', '/api/leaderboard'];
    case 'score': return ['/api/leaderboard'];
    case 'chat': return ['/api/chat/messages', '/api/chat/unread'];
    case 'chronicle': return ['/api/chronicle'];
    case 'transfer': return ['/api/galaxy/traffic', '/api/session/pending', '/api/planet', '/api/planets'];
    case 'impact': return ['/api/galaxy/traffic', '/api/galaxy', '/api/planet', '/api/session/pending'];
    case 'control': return [
      '/api/galaxy/traffic', '/api/galaxy', '/api/planet', '/api/planets',
      '/api/session/pending', '/api/leaderboard',
    ];
    case 'recovery':
    case 'protection': return ['/api/galaxy', '/api/planet'];
    case 'season': return ['/api/season', '/api/planet', '/api/session/pending', '/api/leaderboard'];
    default: return [];
  }
};
const fullReads = [
  '/api/planet', '/api/planets', '/api/galaxy', '/api/intel',
  '/api/notifications?limit=30', '/api/session/pending', '/api/reports',
  '/api/galaxy/traffic', '/api/mining/field', '/api/mining/status',
  '/api/rewards', '/api/chat/messages',
  '/api/chat/unread', '/api/chronicle',
];

const noteEvent = (vu, kind) => {
  streamStats.events += 1;
  const paths = kind.startsWith(SHARD_PREFIX) ? shardReads(kind) : fullReads;
  if (paths.length === 0) return;
  if (vu.pendingEventAt === null) vu.pendingEventAt = performance.now();
  for (const path of paths) vu.pendingReads.add(path);
  if (vu.coalesceTimer !== null) return;
  vu.coalesceTimer = setTimeout(() => {
    vu.coalesceTimer = null;
    const due = [...vu.pendingReads];
    vu.pendingReads.clear();
    const eventAt = vu.pendingEventAt;
    vu.pendingEventAt = null;
    void Promise.all(due.map((path) => request(vu, path))).then((results) => {
      if (eventAt !== null && results.every((result) => result.valid)) {
        addSample(eventRefreshMs, performance.now() - eventAt);
      }
    });
  }, COALESCE_MS);
};

const parseSseFrames = (vu, state, chunk) => {
  state.buffer += state.decoder.decode(chunk, { stream: true });
  let split = state.buffer.indexOf('\n\n');
  while (split !== -1) {
    const frame = state.buffer.slice(0, split);
    state.buffer = state.buffer.slice(split + 2);
    const kind = frame.split('\n').find((line) => line.startsWith('event:'))?.slice(6).trim();
    if (kind) noteEvent(vu, kind);
    split = state.buffer.indexOf('\n\n');
  }
};

const streamLoop = async (vu, signal) => {
  let attempt = 0;
  while (!signal.aborted) {
    let isConnected = false;
    let forcedReconnect = false;
    const controller = new AbortController();
    const abort = () => controller.abort();
    vu.forceReconnect = () => {
      forcedReconnect = true;
      controller.abort();
    };
    signal.addEventListener('abort', abort, { once: true });
    const openedAt = performance.now();
    try {
      const response = await fetch(`${vu.baseUrl}/api/stream`, {
        headers: {
          authorization: `Bearer ${vu.token}`,
          ...(values['synthetic-xff'] && isLoopback(vu.baseUrl)
            ? { 'x-forwarded-for': vu.syntheticIp }
            : {}),
        },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`SSE ${String(response.status)}`);
      streamStats.opened += 1;
      if (vu.streamOpens > 0) streamStats.reconnects += 1;
      vu.streamOpens += 1;
      if (
        vu.forcedReconnectTarget !== null
        && vu.streamOpens >= vu.forcedReconnectTarget
      ) {
        vu.forcedReconnectTarget = null;
        streamStats.forcedReconnectCompleted += 1;
      }
      streamStats.connected += 1;
      isConnected = true;
      streamStats.maxConnected = Math.max(streamStats.maxConnected, streamStats.connected);
      if (vu.streamOpens > 1 && vu.reconnectResync === null) {
        const resync = (async () => {
          await pause(random() * RECONNECT_RESYNC_MAX_MS, signal);
          if (!signal.aborted) await Promise.all(fullReads.map((path) => request(vu, path)));
        })();
        vu.reconnectResync = resync;
        void resync.finally(() => {
          if (vu.reconnectResync === resync) vu.reconnectResync = null;
        });
      }
      const reader = response.body.getReader();
      const state = { buffer: '', decoder: new TextDecoder() };
      while (!signal.aborted) {
        const result = await reader.read();
        if (result.done) {
          if (!signal.aborted && !forcedReconnect) streamStats.failures += 1;
          break;
        }
        parseSseFrames(vu, state, result.value);
      }
      attempt = performance.now() - openedAt >= 5000 ? 0 : attempt + 1;
    } catch {
      if (!signal.aborted && !forcedReconnect) streamStats.failures += 1;
      attempt += 1;
    } finally {
      if (isConnected) streamStats.connected -= 1;
      vu.forceReconnect = null;
      signal.removeEventListener('abort', abort);
      controller.abort();
    }
    if (!signal.aborted) await pause(random() * Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)), signal);
  }
};

const initialReads = async (vu) => {
  const responses = await Promise.all([
    request(vu, '/api/season'),
    request(vu, '/api/planets'),
    request(vu, '/api/galaxy'),
    request(vu, '/api/galaxy/traffic'),
    request(vu, '/api/mining/field'),
    request(vu, '/api/mining/status'),
    request(vu, '/api/session/pending'),
    request(vu, '/api/notifications?limit=30'),
  ]);
  if (responses.some((result) => !result.valid)) {
    throw new Error(`cold-start read failed for ${usernameFor(vu.accountIndex)}`);
  }
  const galaxy = responses[2]?.body;
  const mining = responses[4]?.body;
  if (!Array.isArray(galaxy?.planets) || !Array.isArray(mining?.asteroids) || !Array.isArray(mining?.debris)) {
    requestIntegrity.invalidPayloads += 1;
    throw new Error(`cold-start payload shape failed for ${usernameFor(vu.accountIndex)}`);
  }
  vu.planets = Array.isArray(galaxy?.planets) ? galaxy.planets : [];
  vu.selfPlanetId = vu.planets.find((planet) => planet?.isSelf)?.id ?? null;
  vu.asteroids = Array.isArray(mining?.asteroids) ? mining.asteroids : [];
  vu.debris = Array.isArray(mining?.debris) ? mining.debris : [];
  if (typeof vu.selfPlanetId !== 'string') {
    requestIntegrity.invalidPayloads += 1;
    throw new Error(`capacity user ${usernameFor(vu.accountIndex)} has no self planet`);
  }
};

const safetyNetLoop = async (vu, signal) => {
  await pause(random() * READ_NET_MS, signal);
  while (!signal.aborted) {
    await Promise.all([
      request(vu, '/api/galaxy'),
      request(vu, '/api/galaxy/traffic'),
      request(vu, '/api/mining/field'),
      request(vu, '/api/mining/status'),
      request(vu, '/api/session/pending'),
    ]);
    await pause(READ_NET_MS, signal);
  }
};

const launch = async (vu) => {
  if (vu.planets.length > 1) {
    const candidates = vu.planets.filter((planet) => planet?.id && planet.id !== vu.selfPlanetId);
    const target = candidates[Math.floor(random() * candidates.length)];
    if (target) {
      const intentAt = performance.now();
      const result = await request(vu, '/api/fleet/launch', {
        method: 'POST',
        body: { targetPlanetId: target.id, fleet: { DART: 1 } },
        acceptedErrorCodes: [
          'NO_FREE_BAY', 'FLEET_ALREADY_COMMITTED', 'OCCUPATION_PROTECTED',
          'WORLD_RECOVERING', 'TIER_BAND', 'BASH_LIMIT', 'SEASON_ENDING',
        ],
      });
      if (result.valid && typeof result.body?.missionId === 'string') {
        expectPublicContact(result.body.missionId, vu.accountIndex, intentAt);
        return true;
      }
      if (result.response?.ok) requestIntegrity.invalidPayloads += 1;
      return false;
    }
  }
  return false;
};

const mutate = async (vu) => {
  const roll = random();
  if (roll < 0.7 && await launch(vu)) return;
  if (roll < 0.82) {
    await request(vu, '/api/planet/collect', { method: 'POST' });
    return;
  }
  if (roll < 0.92) {
    await request(vu, '/api/planet/build', { method: 'POST', body: { hull: 'DART', count: 1 } });
    return;
  }
  await request(vu, '/api/chat/messages', {
    method: 'POST',
    body: { content: `capacity pulse ${String(seed)} ${String(vu.index)}` },
  });
};

const actionLoop = async (vu, signal) => {
  if (scenario.actionMeanSeconds === 0) return;
  while (!signal.aborted) {
    const waitMs = -Math.log(Math.max(Number.EPSILON, 1 - random()))
      * scenario.actionMeanSeconds * 1000;
    await pause(waitMs, signal);
    if (!signal.aborted) await mutate(vu);
  }
};

const launchWave = async (vusToUse, signal) => {
  if (waveLaunches === 0) return;
  // One socket per account, interleaved by its position inside each 300-seat
  // shard. `slice(0, n)` would put an ostensibly two-galaxy wave entirely in
  // EU-1 and leave the production fan-out/worker contention untested.
  const unique = [...new Map(vusToUse.map((vu) => [vu.accountIndex, vu])).values()]
    .sort((left, right) => (
      (left.accountIndex % 300) - (right.accountIndex % 300)
      || left.accountIndex - right.accountIndex
    ));
  const selected = unique.slice(0, waveLaunches);
  await Promise.all(selected.map(async (vu, index) => {
    const delay = selected.length <= 1 ? 0 : (index / (selected.length - 1)) * waveSeconds * 1000;
    await pause(delay, signal);
    if (!signal.aborted) {
      publicState.waveAttempts += 1;
      if (await launch(vu)) publicState.waveSucceeded += 1;
    }
  }));
};

const reconnectStorm = async (vusToUse, signal) => {
  if (reconnectAtSeconds === null) return;
  await pause(reconnectAtSeconds * 1000, signal);
  if (signal.aborted) return;
  for (const vu of vusToUse) {
    if (vu.forceReconnect === null) continue;
    vu.forcedReconnectTarget = vu.streamOpens + 1;
    streamStats.forcedReconnectTriggered += 1;
    vu.forceReconnect();
  }
};

/** Publish one real shard:mining event after every stream is established. */
const miningPulse = async (vusToUse, signal) => {
  if (miningPulseAtSeconds === null) return;
  await pause(miningPulseAtSeconds * 1000, signal);
  if (signal.aborted) return;
  for (const vu of vusToUse) {
    for (const field of vu.debris) {
      if (typeof field?.id !== 'string') continue;
      const intentAt = performance.now();
      const { response, body } = await request(vu, '/api/mining/harvest', {
        method: 'POST',
        body: { fieldId: field.id, craft: 1 },
        acceptedErrorCodes: [
          'NO_FREE_BAY', 'NOT_ENOUGH_CRAFT', 'FIELD_GONE', 'ALREADY_HARVESTING',
        ],
      });
      if (response?.ok) {
        if (typeof body?.runId !== 'string') {
          requestIntegrity.invalidPayloads += 1;
          continue;
        }
        expectPublicContact(body.runId, vu.accountIndex, intentAt);
        publicState.miningPulseSucceeded += 1;
        return;
      }
    }
    for (const asteroid of vu.asteroids) {
      if (!Number.isInteger(asteroid?.index)) continue;
      const intentAt = performance.now();
      const { response, body } = await request(vu, '/api/mining/launch', {
        method: 'POST',
        body: { asteroidIndex: asteroid.index, craft: 1 },
        acceptedErrorCodes: [
          'NO_FREE_BAY', 'NOT_ENOUGH_CRAFT', 'ASTEROID_GONE', 'ASTEROID_EMPTY',
          'ALREADY_MINING', 'NEEDS_ISOTOPE_SPECTROMETRY', 'CANNOT_INTERCEPT',
        ],
      });
      if (response?.ok) {
        if (typeof body?.runId !== 'string') {
          requestIntegrity.invalidPayloads += 1;
          continue;
        }
        expectPublicContact(body.runId, vu.accountIndex, intentAt);
        publicState.miningPulseSucceeded += 1;
        return;
      }
    }
  }
  throw new Error('No capacity user could launch the requested mining pulse');
};

const login = async (vu) => {
  const { response, body } = await request(vu, '/api/auth/login', {
    method: 'POST',
    baseUrl: vu.loginBaseUrl,
    body: { username: usernameFor(vu.accountIndex), password },
  });
  if (!response?.ok || !body || typeof body.accessToken !== 'string') {
    throw new Error(`login failed for ${usernameFor(vu.accountIndex)} on ${vu.loginBaseUrl}`);
  }
  vu.token = body.accessToken;
  vu.cookie = response.headers.getSetCookie?.().map((value) => value.split(';')[0]).join('; ') ?? '';
};

const rawMetrics = async (url) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const validMetricSnapshot = (snapshot) => Boolean(
  snapshot
  && ['api', 'worker', 'both'].includes(snapshot.service?.role)
  && typeof snapshot.runtime?.instanceId === 'string'
  && snapshot.runtime.instanceId.length > 0
  && typeof snapshot.runtime?.startedAt === 'string'
  && finite(snapshot.runtime?.uptimeSeconds)
  && finite(snapshot.runtime?.process?.rssBytes)
  && finite(snapshot.runtime?.process?.cpuPercentOfOneCore)
  && finite(snapshot.runtime?.eventLoop?.p95Ms)
  && finite(snapshot.runtime?.eventLoop?.p99Ms)
  && finite(snapshot.host?.totalMemoryBytes)
  && finite(snapshot.host?.availableMemoryBytes)
  && finite(snapshot.host?.cpu?.cores)
  && finite(snapshot.host?.cpu?.idleMilliseconds)
  && finite(snapshot.host?.cpu?.totalMilliseconds)
  && (
    snapshot.container?.limitMemoryBytes === null
    || finite(snapshot.container?.limitMemoryBytes)
  )
  && finite(snapshot.container?.availableMemoryBytes)
  && finite(snapshot.database?.maxConnections)
  && finite(snapshot.database?.asteraConnections)
  && finite(snapshot.database?.waiting)
  && finite(snapshot.database?.poolAcquireErrors)
  && finite(snapshot.database?.poolAcquireMs?.p95)
  && typeof snapshot.projections?.enabled === 'boolean'
  && typeof snapshot.worker?.enabled === 'boolean'
  && (
    snapshot.worker.enabled !== true
    || (
      finite(snapshot.worker?.processed)
      && finite(snapshot.worker?.tickErrors)
      && finite(snapshot.worker?.unknownEvents)
      && finite(snapshot.worker?.handlerFailures)
      && finite(snapshot.worker?.abandoned)
      && finite(snapshot.worker?.latenessMs?.samples)
      && finite(snapshot.worker?.latenessMs?.p95)
      && finite(snapshot.worker?.latenessMs?.p99)
    )
  )
);

const summarizeMetrics = (frames) => {
  const cpuAverages = [];
  const cpuIntervals = [];
  const eventLoopP95 = [];
  const eventLoopP99 = [];
  const previousByUrl = new Map();
  let previousHostCpu = null;
  const hostCpuIntervals = [];
  let missing = 0;
  let malformed = 0;
  let maxRssBytes = 0;
  let maxHostMemoryRatio = 0;
  let maxContainerMemoryRatio = 0;
  let maxDatabaseConnectionRatio = 0;
  let maxDatabaseWaiting = 0;
  let maxPoolAcquireP95Ms = 0;
  let maxPoolAcquireErrors = 0;
  let processRestarts = 0;
  let apiBusFailures = 0;
  let rateLimitBackendFailures = 0;
  let slowStreamCloses = 0;
  const apiProcessIds = new Set();
  const workerProcessIds = new Set();
  const releaseCommits = new Set();
  let missingReleaseCommits = 0;
  let unexpectedRoles = 0;
  let inactiveWorkerRoles = 0;
  let workerFailures = 0;
  let workerProcessed = 0;
  let workerLatenessSamples = 0;
  let workerLatenessP95Ms = 0;
  let workerLatenessP99Ms = 0;
  const rssByUrl = new Map();
  const workerByUrl = new Map();

  for (const frame of frames) {
    const hostSample = frame.snapshots.find((snapshot) => validMetricSnapshot(snapshot));
    if (hostSample) {
      const current = hostSample.host.cpu;
      if (previousHostCpu) {
        const idleDelta = current.idleMilliseconds - previousHostCpu.idleMilliseconds;
        const totalDelta = current.totalMilliseconds - previousHostCpu.totalMilliseconds;
        if (totalDelta > 0 && idleDelta >= 0 && idleDelta <= totalDelta) {
          hostCpuIntervals.push((1 - idleDelta / totalDelta) * 100);
        }
      }
      previousHostCpu = current;
    }
    for (let index = 0; index < metricsUrls.length; index += 1) {
      const snapshot = frame.snapshots[index];
      if (snapshot === null || snapshot === undefined) {
        missing += 1;
        continue;
      }
      if (!validMetricSnapshot(snapshot)) {
        malformed += 1;
        continue;
      }
      const runtime = snapshot.runtime;
      const role = snapshot.service.role;
      if (typeof snapshot.service.commit === 'string' && snapshot.service.commit.length > 0) {
        releaseCommits.add(snapshot.service.commit);
      } else {
        missingReleaseCommits += 1;
      }
      if (role === 'api') apiProcessIds.add(runtime.instanceId);
      else if (role === 'worker') workerProcessIds.add(runtime.instanceId);
      else unexpectedRoles += 1;
      const cpuAverage = runtime.process.cpuPercentOfOneCore;
      cpuAverages.push(cpuAverage);
      eventLoopP95.push(runtime.eventLoop.p95Ms);
      eventLoopP99.push(runtime.eventLoop.p99Ms);
      maxRssBytes = Math.max(maxRssBytes, runtime.process.rssBytes);
      const rss = rssByUrl.get(index) ?? {
        first: runtime.process.rssBytes,
        last: runtime.process.rssBytes,
      };
      rss.last = runtime.process.rssBytes;
      rssByUrl.set(index, rss);
      if (snapshot.host.totalMemoryBytes > 0) {
        maxHostMemoryRatio = Math.max(
          maxHostMemoryRatio,
          (snapshot.host.totalMemoryBytes - snapshot.host.availableMemoryBytes)
            / snapshot.host.totalMemoryBytes,
        );
      }
      if (snapshot.container.limitMemoryBytes > 0) {
        maxContainerMemoryRatio = Math.max(
          maxContainerMemoryRatio,
          (snapshot.container.limitMemoryBytes - snapshot.container.availableMemoryBytes)
            / snapshot.container.limitMemoryBytes,
        );
      }

      const previous = previousByUrl.get(index);
      if (previous) {
        const elapsed = runtime.uptimeSeconds - previous.uptimeSeconds;
        if (elapsed <= 0 || snapshot.runtime.startedAt !== previous.startedAt) {
          processRestarts += 1;
        } else {
          const currentCpuSeconds = (cpuAverage / 100) * runtime.uptimeSeconds;
          const previousCpuSeconds = (previous.cpuAverage / 100) * previous.uptimeSeconds;
          cpuIntervals.push(((currentCpuSeconds - previousCpuSeconds) / elapsed) * 100);
        }
      }
      previousByUrl.set(index, {
        startedAt: snapshot.runtime.startedAt,
        uptimeSeconds: runtime.uptimeSeconds,
        cpuAverage,
      });

      const database = snapshot.database;
      if (database.maxConnections > 0) {
        maxDatabaseConnectionRatio = Math.max(
          maxDatabaseConnectionRatio,
          database.asteraConnections / database.maxConnections,
        );
      }
      maxDatabaseWaiting = Math.max(maxDatabaseWaiting, database.waiting);
      maxPoolAcquireP95Ms = Math.max(maxPoolAcquireP95Ms, database.poolAcquireMs.p95);
      maxPoolAcquireErrors = Math.max(maxPoolAcquireErrors, database.poolAcquireErrors);

      if (role === 'api') {
        if (snapshot.bus?.listening !== true) apiBusFailures += 1;
        if (snapshot.rateLimit?.mode !== 'shared' || snapshot.rateLimit?.status !== 'ready') {
          rateLimitBackendFailures += 1;
        }
        slowStreamCloses += Number(snapshot.stream?.slowClosed ?? 0);
      }
      if (role === 'worker') {
        if (!snapshot.worker.enabled) {
          inactiveWorkerRoles += 1;
        } else {
          const processed = Number(snapshot.worker.processed ?? 0);
          const worker = workerByUrl.get(index) ?? { first: processed, last: processed };
          worker.last = processed;
          workerByUrl.set(index, worker);
          workerLatenessSamples = Math.max(
            workerLatenessSamples,
            Number(snapshot.worker.latenessMs?.samples ?? 0),
          );
          workerLatenessP95Ms = Math.max(
            workerLatenessP95Ms,
            Number(snapshot.worker.latenessMs?.p95 ?? 0),
          );
          workerLatenessP99Ms = Math.max(
            workerLatenessP99Ms,
            Number(snapshot.worker.latenessMs?.p99 ?? 0),
          );
          workerFailures = Math.max(
            workerFailures,
            Number(snapshot.worker.tickErrors ?? 0)
              + Number(snapshot.worker.unknownEvents ?? 0)
              + Number(snapshot.worker.handlerFailures ?? 0)
              + Number(snapshot.worker.abandoned ?? 0),
          );
        }
      }
    }
  }

  const finalSnapshots = frames.at(-1)?.snapshots ?? [];
  let sharedCacheHits = 0;
  let sharedCacheMisses = 0;
  for (const snapshot of finalSnapshots) {
    if (!validMetricSnapshot(snapshot) || !snapshot.projections.enabled) continue;
    for (const name of ['publicGalaxy', 'traffic', 'mining']) {
      sharedCacheHits += Number(snapshot.projections[name]?.hits ?? 0);
      sharedCacheMisses += Number(snapshot.projections[name]?.misses ?? 0);
    }
  }
  const cacheReads = sharedCacheHits + sharedCacheMisses;
  let maxRssGrowthBytes = 0;
  let rssGrowthWithinAllowance = true;
  for (const rss of rssByUrl.values()) {
    const growth = Math.max(0, rss.last - rss.first);
    maxRssGrowthBytes = Math.max(maxRssGrowthBytes, growth);
    if (growth > Math.max(64 * 1024 * 1024, rss.first * 0.25)) {
      rssGrowthWithinAllowance = false;
    }
  }
  for (const worker of workerByUrl.values()) {
    workerProcessed += Math.max(0, worker.last - worker.first);
  }
  return {
    frames: frames.length,
    expectedSnapshots: frames.length * metricsUrls.length,
    missing,
    malformed,
    processRestarts,
    topology: {
      apiProcesses: apiProcessIds.size,
      workerProcesses: workerProcessIds.size,
      unexpectedRoles,
      inactiveWorkerRoles,
    },
    releaseCommits: [...releaseCommits].sort(),
    missingReleaseCommits,
    hostCpu: {
      p95: percentile(hostCpuIntervals, 95),
      max: hostCpuIntervals.length === 0 ? 0 : Math.max(...hostCpuIntervals),
      samples: hostCpuIntervals.length,
    },
    cpu: {
      averageP95: percentile(cpuAverages, 95),
      intervalP95: percentile(cpuIntervals, 95),
      intervalMax: cpuIntervals.length === 0 ? Math.max(0, ...cpuAverages) : Math.max(...cpuIntervals),
      intervalSamples: cpuIntervals.length,
    },
    eventLoop: {
      maxP95Ms: Math.max(0, ...eventLoopP95),
      maxP99Ms: Math.max(0, ...eventLoopP99),
    },
    maxRssBytes,
    maxHostMemoryRatio,
    maxContainerMemoryRatio,
    maxRssGrowthBytes,
    rssGrowthWithinAllowance,
    database: {
      maxConnectionRatio: maxDatabaseConnectionRatio,
      maxWaiting: maxDatabaseWaiting,
      maxPoolAcquireP95Ms,
      maxPoolAcquireErrors,
    },
    apiBusFailures,
    rateLimitBackendFailures,
    slowStreamCloses,
    workerFailures,
    workerProcessed,
    workerLateness: {
      samples: workerLatenessSamples,
      p95Ms: workerLatenessP95Ms,
      p99Ms: workerLatenessP99Ms,
    },
    sharedProjectionCache: {
      hits: sharedCacheHits,
      misses: sharedCacheMisses,
      hitRatio: cacheReads === 0 ? 0 : sharedCacheHits / cacheReads,
    },
  };
};
const metricLoop = async (signal) => {
  while (!signal.aborted) {
    const at = new Date().toISOString();
    const snapshots = await Promise.all(metricsUrls.map(rawMetrics));
    metricSnapshots.push({ at, snapshots });
    if (metricSnapshots.length > METRIC_SNAPSHOT_CAPACITY) metricSnapshots.shift();
    await pause(30_000, signal);
  }
};

const reconcileCapacityDatabase = async () => {
  if (databaseUrl === null) {
    return { available: false, passed: false, error: 'CAPACITY_DATABASE_URL/--database-url is required' };
  }
  const requireFromServer = createRequire(resolve('apps/server/package.json'));
  const postgresModule = await import(pathToFileURL(requireFromServer.resolve('postgres')).href);
  const postgres = postgresModule.default;
  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 2,
    connect_timeout: 5,
    connection: { application_name: 'astera-capacity-reconcile' },
  });
  try {
    const official = await sql.unsafe(`
      select sh.ordinal,
             sh.player_cap::int as "capacity",
             count(distinct p.id) filter (where p.id is not null)::int as "players",
             count(distinct pl.id) filter (where pl.kind = 'CAPITAL')::int as "capitals",
             count(distinct pl.id) filter (where pl.kind = 'NEUTRAL')::int as "neutrals",
             count(distinct pl.id) filter (
               where pl.kind = 'NEUTRAL' and ns.tier = 1
             )::int as "tier1",
             count(distinct pl.id) filter (
               where pl.kind = 'NEUTRAL' and ns.tier = 2
             )::int as "tier2",
             count(distinct pl.id) filter (
               where pl.kind = 'NEUTRAL' and ns.tier = 3
             )::int as "tier3"
        from shards sh
        join seasons se on se.shard_id = sh.id and se.status = 'live'
        left join players p on p.season_id = se.id
        left join planets pl on pl.season_id = se.id
        left join neutral_planet_state ns on ns.planet_id = pl.id
       where sh.ordinal between 1 and 2
       group by sh.ordinal, sh.player_cap
       order by sh.ordinal
    `);
    const [integrity] = await sql.unsafe(`
      select
        (select count(*)::int from accounts) as "accounts",
        (select count(*)::int from players) as "players",
        (select count(*)::int from planets where kind = 'CAPITAL') as "capitals",
        (select count(*)::int from seasons) as "totalSeasons",
        (select count(*)::int from seasons where status = 'live') as "liveSeasons",
        (select count(*)::int
           from seasons se join shards sh on sh.id = se.shard_id
          where se.status = 'live' and sh.ordinal not between 1 and 2) as "retiredLiveSeasons",
        (select count(*)::int from scheduled_events where status = 'failed') as "failedEvents",
        (select count(*)::int
           from scheduled_events
          where status = 'pending' and resolve_at < now() - interval '2 seconds') as "overdueEvents",
        (select count(*)::int
           from missions m
          where m.status = 'in_flight'
            and not exists (
              select 1 from scheduled_events e
               where e.ref_id = m.id
                 and e.status in ('pending', 'processing')
            )) as "missionsWithoutEvent",
        (select count(*)::int
           from mining_runs m
          where m.status in ('outbound', 'returning')
            and not exists (
              select 1 from scheduled_events e
               where e.ref_id = m.id
                 and e.status in ('pending', 'processing')
            )) as "miningRunsWithoutEvent",
        (select count(*)::int from (
          select kind, ref_id
            from scheduled_events
           where status in ('pending', 'processing')
             and ref_id is not null
             and kind <> 'season_act'
           group by kind, ref_id
          having count(*) > 1
        ) duplicate_events) as "duplicateActiveEvents",
        (select count(*)::int from (
          select player_id, kind, ref_id
            from notifications
           group by player_id, kind, ref_id
          having count(*) > 1
        ) duplicate_notifications) as "duplicateNotifications"
    `);
    const expectedPlayers = Array.from({ length: 2 }, (_, index) =>
      Math.max(0, Math.min(300, userCount - index * 300)));
    const officialShape = official.length === 2 && official.every((row, index) => (
      row.ordinal === index + 1
      && row.capacity === 300
      && row.players === expectedPlayers[index]
      && row.capitals === expectedPlayers[index]
      && row.neutrals === 51
      && row.tier1 === 30
      && row.tier2 === 15
      && row.tier3 === 6
    ));
    const integrityShape = Boolean(
      integrity
      && integrity.accounts === userCount
      && integrity.players === userCount
      && integrity.capitals === userCount
      && integrity.totalSeasons === 2
      && integrity.liveSeasons === 2
      && integrity.retiredLiveSeasons === 0
      && integrity.failedEvents === 0
      && integrity.overdueEvents === 0
      && integrity.missionsWithoutEvent === 0
      && integrity.miningRunsWithoutEvent === 0
      && integrity.duplicateActiveEvents === 0
      && integrity.duplicateNotifications === 0
    );
    return {
      available: true,
      passed: officialShape && integrityShape,
      official,
      integrity: integrity ?? null,
    };
  } catch (error) {
    return {
      available: true,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await sql.end({ timeout: 2 });
  }
};

const vus = Array.from({ length: connectionCount }, (_, index) => ({
  index,
  accountIndex: index % userCount,
  baseUrl: baseUrls[index % baseUrls.length],
  loginBaseUrl: loginBaseUrls[index % loginBaseUrls.length],
  syntheticIp: syntheticIpFor(index % userCount),
  token: null,
  cookie: '',
  planets: [],
  asteroids: [],
  debris: [],
  selfPlanetId: null,
  streamOpens: 0,
  pendingReads: new Set(),
  pendingEventAt: null,
  coalesceTimer: null,
  forceReconnect: null,
  forcedReconnectTarget: null,
  reconnectResync: null,
}));

const startedAt = new Date();
process.stdout.write(
  `capacity: ${String(userCount)} accounts, ${String(connectionCount)} sockets, `
  + `${values.scenario}, ${String(durationSeconds)}s steady\n`,
);

const activityController = new AbortController();
const streamController = new AbortController();
const activityTasks = [{ label: 'metrics', promise: metricLoop(activityController.signal) }];
const streamTasks = [];
await Promise.all(vus.map(async (vu, index) => {
  const delay = connectionCount <= 1 ? 0 : (index / (connectionCount - 1)) * rampSeconds * 1000;
  await pause(delay);
  await login(vu);
  await initialReads(vu);
  // Open each stream as that player finishes the cold-start reads. This makes the
  // ramp a real browser ramp instead of opening every SSE socket in one herd at
  // the end of it.
  streamTasks.push({ label: `stream:${String(vu.index)}`, promise: streamLoop(vu, streamController.signal) });
  activityTasks.push(
    { label: `safety-net:${String(vu.index)}`, promise: safetyNetLoop(vu, activityController.signal) },
    { label: `actions:${String(vu.index)}`, promise: actionLoop(vu, activityController.signal) },
  );
}));
const steadyStartedAt = new Date();
activityTasks.push(
  { label: 'launch-wave', promise: launchWave(vus, activityController.signal) },
  { label: 'reconnect-storm', promise: reconnectStorm(vus, streamController.signal) },
  { label: 'mining-pulse', promise: miningPulse(vus, activityController.signal) },
);

const progress = setInterval(() => {
  const requests = [...routeStats.values()].reduce((total, record) => total + record.requests, 0);
  process.stdout.write(
    `  sockets ${String(streamStats.connected)}/${String(connectionCount)} · `
    + `requests ${String(requests)} · events ${String(streamStats.events)}\n`,
  );
}, 30_000);
progress.unref();

await pause(durationSeconds * 1000);
activityController.abort();
clearInterval(progress);
const activityResults = await Promise.allSettled(activityTasks.map((task) => task.promise));
// Stop writes first, then leave the live channel open long enough for the final
// committed event to invalidate, refetch and become observable.
await pause(EVENT_DRAIN_MS);
streamStats.connectedAtEnd = streamStats.connected;
streamController.abort();
for (const vu of vus) {
  if (vu.coalesceTimer !== null) clearTimeout(vu.coalesceTimer);
}
const streamResults = await Promise.allSettled(streamTasks.map((task) => task.promise));
await Promise.allSettled(vus.flatMap((vu) => vu.reconnectResync ? [vu.reconnectResync] : []));
const taskFailures = [
  ...activityResults.map((result, index) => ({ result, label: activityTasks[index]?.label ?? 'activity' })),
  ...streamResults.map((result, index) => ({ result, label: streamTasks[index]?.label ?? 'stream' })),
].filter(({ result }) => result.status === 'rejected').map(({ result, label }) => ({
  label,
  error: result.status === 'rejected'
    ? (result.reason instanceof Error ? result.reason.message : String(result.reason))
    : '',
}));

const endedAt = new Date();
const routes = {};
for (const [key, record] of [...routeStats].sort(([a], [b]) => a.localeCompare(b))) {
  routes[key] = {
    requests: record.requests,
    status2xx: record.status2xx,
    status3xx: record.status3xx,
    status4xx: record.status4xx,
    status5xx: record.status5xx,
    networkErrors: record.networkErrors,
    invalidPayloads: record.invalidPayloads,
    responseBytes: record.bytes,
    errors: record.errors,
    latencyMs: histogramSummary(record.latencyMs),
  };
}
let status5xx = 0;
let status4xx = 0;
let status3xx = 0;
let networkErrors = 0;
let rateLimited = 0;
for (const record of routeStats.values()) {
  status5xx += record.status5xx;
  status4xx += record.status4xx;
  status3xx += record.status3xx;
  networkErrors += record.networkErrors;
  rateLimited += record.errors.RATE_LIMITED ?? 0;
}
const reads = histogramSummary(readLatencyMs);
const mutations = histogramSummary(mutationLatencyMs);
const eventRefresh = histogramSummary(eventRefreshMs);
const committedStateFreshness = histogramSummary(committedStateFreshnessMs);
const finalMetrics = await Promise.all(metricsUrls.map(rawMetrics));
const metricFrames = [
  ...metricSnapshots,
  { at: endedAt.toISOString(), snapshots: finalMetrics },
];
const capacityMetrics = summarizeMetrics(metricFrames);
const databaseReconciliation = await reconcileCapacityDatabase();
const commit = (() => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {
    return process.env.GIT_COMMIT ?? null;
  }
})();
let worktreeDirty;
try {
  worktreeDirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() !== '';
} catch {
  worktreeDirty = null;
}
let serverImageId = process.env.CAPACITY_IMAGE_ID ?? null;
if (serverImageId === null) {
  try {
    serverImageId = execFileSync(
      'docker',
      ['image', 'inspect', 'astera-capacity-server:latest', '--format', '{{.Id}}'],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    serverImageId = null;
  }
}
const serverImageRevision = (() => {
  try {
    return execFileSync(
      'docker',
      [
        'image', 'inspect', 'astera-capacity-server:latest',
        '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}',
      ],
      { encoding: 'utf8' },
    ).trim();
  } catch {
    return null;
  }
})();
const runningServerImageIds = (() => {
  try {
    const containerIds = execFileSync(
      'docker',
      [
        'compose', '-f', 'docker-compose.capacity.yml', 'ps', '-q',
        'api1', 'api2', 'api3', 'worker',
      ],
      { encoding: 'utf8' },
    ).trim().split(/\s+/).filter(Boolean);
    if (containerIds.length !== 4) return null;
    return containerIds.map((containerId) => execFileSync(
      'docker',
      ['inspect', containerId, '--format', '{{.Image}}'],
      { encoding: 'utf8' },
    ).trim());
  } catch {
    return null;
  }
})();
const gates = {
  no5xx: status5xx === 0,
  noNetworkErrors: networkErrors === 0,
  noRateLimitStorm: rateLimited === 0,
  noUnexpectedHttpStatuses:
    status3xx === 0
    && requestIntegrity.unexpectedStatuses === 0,
  validApiPayloads:
    requestIntegrity.invalidJson === 0
    && requestIntegrity.invalidPayloads === 0,
  backgroundTasksCompleted: taskFailures.length === 0,
  readSamples: reads.samples > 0,
  readLatency: reads.samples > 0 && reads.p95 <= 250 && reads.p99 <= 500,
  mutationSamples:
    (scenario.actionMeanSeconds === 0 && waveLaunches === 0 && miningPulseAtSeconds === null)
    || mutations.samples > 0,
  mutationLatency:
    (scenario.actionMeanSeconds === 0 && waveLaunches === 0 && miningPulseAtSeconds === null)
    || (mutations.samples > 0 && mutations.p95 <= 400 && mutations.p99 <= 800),
  eventRefreshSamples:
    (publicState.expected === 0 && streamStats.events === 0)
    || eventRefresh.samples > 0,
  eventRefreshLatency:
    (publicState.expected === 0 && streamStats.events === 0)
    || (eventRefresh.samples > 0 && eventRefresh.p95 <= 1000 && eventRefresh.p99 <= 2000),
  committedStateObserved:
    publicState.expected === 0
    || (
      publicState.observed === publicState.expected
      && pendingPublicContacts.size === 0
      && committedStateFreshness.samples === publicState.expected
    ),
  committedStateFreshness:
    publicState.expected === 0
    || (
      committedStateFreshness.samples > 0
      && committedStateFreshness.p95 <= 1000
      && committedStateFreshness.p99 <= 2000
    ),
  waveCompleted:
    waveLaunches === 0
    || (
      publicState.waveAttempts === Math.min(waveLaunches, vus.length)
      && publicState.waveSucceeded === Math.min(waveLaunches, vus.length)
    ),
  miningPulseCompleted:
    miningPulseAtSeconds === null || publicState.miningPulseSucceeded === 1,
  stableSse:
    streamStats.maxConnected === connectionCount
    && streamStats.connectedAtEnd === connectionCount
    && streamStats.opened >= connectionCount,
  noUnexpectedSseFailures: streamStats.failures === 0,
  reconnectCompleted:
    reconnectAtSeconds === null
    || (
      streamStats.forcedReconnectTriggered === connectionCount
      && streamStats.forcedReconnectCompleted === connectionCount
      && vus.every((vu) => vu.forcedReconnectTarget === null)
    ),
  metricsAvailable:
    capacityMetrics.frames > 0
    && capacityMetrics.missing === 0
    && capacityMetrics.malformed === 0,
  processesStable: capacityMetrics.processRestarts === 0,
  processTopology:
    capacityMetrics.topology.apiProcesses === 3
    && capacityMetrics.topology.workerProcesses === 1
    && capacityMetrics.topology.unexpectedRoles === 0
    && capacityMetrics.topology.inactiveWorkerRoles === 0,
  cpuHeadroom:
    capacityMetrics.hostCpu.samples > 0
    && capacityMetrics.hostCpu.p95 <= 70
    && capacityMetrics.hostCpu.max <= 85,
  memoryHeadroom:
    capacityMetrics.maxRssBytes <= maxRssMb * 1024 * 1024
    && capacityMetrics.maxHostMemoryRatio <= 0.7
    && capacityMetrics.maxContainerMemoryRatio <= 0.7,
  memoryStable: capacityMetrics.rssGrowthWithinAllowance,
  eventLoopHeadroom:
    capacityMetrics.eventLoop.maxP95Ms <= 50
    && capacityMetrics.eventLoop.maxP99Ms <= 100,
  databaseHeadroom:
    capacityMetrics.database.maxConnectionRatio <= 0.8
    && capacityMetrics.database.maxWaiting === 0
    && capacityMetrics.database.maxPoolAcquireP95Ms <= 25
    && capacityMetrics.database.maxPoolAcquireErrors === 0,
  apiInfrastructureHealthy:
    capacityMetrics.apiBusFailures === 0
    && capacityMetrics.rateLimitBackendFailures === 0
    && capacityMetrics.slowStreamCloses === 0,
  workerHealthy:
    capacityMetrics.topology.workerProcesses === 1
    && capacityMetrics.workerFailures === 0
    && capacityMetrics.workerProcessed >= minWorkerEvents
    && capacityMetrics.workerLateness.samples >= minWorkerEvents
    && capacityMetrics.workerLateness.p95Ms <= 1000
    && capacityMetrics.workerLateness.p99Ms <= 2000,
  sharedProjectionCacheEfficient:
    userCount < 100 || capacityMetrics.sharedProjectionCache.hitRatio >= 0.95,
  databaseReconciled: databaseReconciliation.passed === true,
  releaseIdentity:
    commit !== null
    && serverImageId !== null
    && serverImageRevision === commit
    && runningServerImageIds !== null
    && runningServerImageIds.length === 4
    && runningServerImageIds.every((imageId) => imageId === serverImageId)
    && capacityMetrics.missingReleaseCommits === 0
    && capacityMetrics.releaseCommits.length === 1
    && capacityMetrics.releaseCommits[0] === commit
    && worktreeDirty === false,
};
const report = {
  schemaVersion: 3,
  commit,
  worktreeDirty,
  serverImageId,
  serverImageRevision,
  runningServerImageIds,
  runner: {
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
  },
  seed,
  scenario: values.scenario,
  startedAt: startedAt.toISOString(),
  steadyStartedAt: steadyStartedAt.toISOString(),
  endedAt: endedAt.toISOString(),
  rampSeconds,
  durationSeconds,
  accounts: userCount,
  connections: connectionCount,
  baseUrls,
  loginBaseUrls,
  metricsUrls,
  reconnectAtSeconds,
  miningPulseAtSeconds,
  waveLaunches,
  waveSeconds,
  maxRssMb,
  minWorkerEvents,
  routes,
  aggregate: {
    reads,
    mutations,
    eventRefresh,
    committedStateFreshness,
    status3xx,
    status4xx,
    status5xx,
    networkErrors,
    rateLimited,
  },
  requestIntegrity,
  publicState: {
    ...publicState,
    pending: pendingPublicContacts.size,
  },
  taskFailures,
  streams: streamStats,
  capacityMetrics,
  databaseReconciliation,
  gates,
  passed: Object.values(gates).every(Boolean),
  finalMetrics,
  metricSnapshots,
};

const stamp = startedAt.toISOString().replaceAll(':', '-').replaceAll('.', '-');
const reportPath = resolve(values.report ?? `artifacts/capacity/${stamp}-${values.scenario}-${String(connectionCount)}.json`);
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ report: reportPath, passed: report.passed, gates }, null, 2)}\n`);
if (!report.passed) process.exitCode = 1;
