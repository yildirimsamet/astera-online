import { pino } from 'pino';
import { afterEach, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { prometheusText } from '../src/services/prometheusMetrics.js';
import { seedWorld, testEnv } from './helpers.js';

/**
 * PROMETHEUS READS THE SAME LOOPBACK-ONLY /metrics. Scaling plan F0.6.
 *
 * `?format=prometheus` renders the figures the alerts and panels need as text
 * exposition, on the route Nginx already keeps off the internet; the JSON report
 * the capacity runner reads stays exactly as it was.
 */
const silent = pino({ level: 'silent' });
let built: ReturnType<typeof buildApp> | undefined;
afterEach(async () => { await built?.close(); built = undefined; });

const sample = (text: string, name: string, labels = '') => {
  const line = text.split('\n').find(l => l.startsWith(`${name}${labels ? `{${labels}}` : ''} `));
  return line === undefined ? undefined : Number(line.split(' ').at(-1));
};

it('renders route, worker and archive figures as text exposition', async () => {
  const f = await seedWorld(1);
  built = buildApp({ env: testEnv(), clock: f.clock, logger: silent });
  const token = await built.app.tokens.issueAccess(f.accountIds[0]!);
  expect((await built.app.inject({ url: '/api/planets', headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);
  const app = built;
  await vi.waitFor(() => { expect(app.metrics.status().routes['GET /api/planets']).toBeDefined(); });

  const response = await built.app.inject({ url: '/metrics?format=prometheus' });
  expect(response.statusCode).toBe(200);
  expect(response.headers['content-type']).toMatch(/^text\/plain; version=0\.0\.4/);
  const text = response.body;
  // Every non-comment line is `name{labels} value`.
  for (const line of text.split('\n').filter(l => l && !l.startsWith('#'))) {
    expect(line).toMatch(/^[a-z_:][a-z0-9_:]*(\{[^}]*\})? -?[0-9.e+-]+$|^[a-z_:][a-z0-9_:]*(\{[^}]*\})? NaN$/);
  }
  expect(sample(text, 'astera_build_info', 'role="both",commit=""')).toBe(1);
  expect(sample(text, 'astera_route_requests_total', 'route="GET /api/planets"')).toBe(1);
  expect(sample(text, 'astera_route_statements', 'route="GET /api/planets",quantile="1"')).toBeGreaterThan(0);
  expect(sample(text, 'astera_route_latency_ms', 'route="GET /api/planets",quantile="0.95"')).toBeGreaterThan(0);
  expect(sample(text, 'astera_event_loop_delay_ms', 'quantile="0.99"')).toBeGreaterThanOrEqual(0);
  // Nothing is overdue in a fresh world; the worker's queue age is still reported.
  expect(sample(text, 'astera_worker_oldest_due_seconds')).toBe(0);
  expect(sample(text, 'astera_worker_handler_failures_total')).toBe(0);
  // The test cluster does not archive; production reports the age of the last segment.
  expect(sample(text, 'astera_pg_archive_enabled')).toBe(0);
  expect(sample(text, 'astera_pg_archive_failing')).toBe(0);
});

it('leaves the JSON report unchanged', async () => {
  const f = await seedWorld(1);
  built = buildApp({ env: testEnv(), clock: f.clock, logger: silent });
  const response = await built.app.inject({ url: '/metrics' });
  expect(response.headers['content-type']).toMatch(/^application\/json/);
  expect(response.json<{ service: { role: string } }>().service.role).toBe('both');
});

it('escapes label values so a route can never break the exposition', () => {
  const text = prometheusText([{ name: 'astera_route_requests_total', type: 'counter', help: 'Requests.',
    samples: [{ labels: { route: 'GET /a"b\\c\nd' }, value: 2 }] }]);
  expect(text).toContain('astera_route_requests_total{route="GET /a\\"b\\\\c\\nd"} 2\n');
  expect(text).toContain('# TYPE astera_route_requests_total counter\n');
});
