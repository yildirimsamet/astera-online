import type { RuntimeStatus } from './runtimeMetrics.js';
import type { StreamStatus } from './streamRegistry.js';
import type { WorkerStatus } from '../worker/loop.js';

/**
 * Prometheus text exposition of the loopback-only /metrics report. Scaling plan F0.6.
 *
 * The route gathers the figures; this only names and formats them, so the alert
 * rules in deploy/monitoring depend on one list rather than on the JSON layout.
 */
export interface MetricFamily {
  name: string;
  type: 'counter' | 'gauge';
  help: string;
  samples: { labels?: Record<string, string>; value: number }[];
}

interface Summary { p50: number; p95: number; p99: number; max: number }

const escapeLabel = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
const quantiles = (summary: Summary, labels: Record<string, string> = {}) => [
  { labels: { ...labels, quantile: '0.5' }, value: summary.p50 },
  { labels: { ...labels, quantile: '0.95' }, value: summary.p95 },
  { labels: { ...labels, quantile: '0.99' }, value: summary.p99 },
  { labels: { ...labels, quantile: '1' }, value: summary.max },
];

export function prometheusText(families: readonly MetricFamily[]): string {
  let out = '';
  for (const family of families) {
    if (family.samples.length === 0) continue;
    out += `# HELP ${family.name} ${family.help}\n# TYPE ${family.name} ${family.type}\n`;
    for (const { labels, value } of family.samples) {
      const pairs = Object.entries(labels ?? {}).map(([key, label]) => `${key}="${escapeLabel(label)}"`).join(',');
      out += `${family.name}${pairs ? `{${pairs}}` : ''} ${Number.isNaN(value) ? 'NaN' : String(value)}\n`;
    }
  }
  return out;
}

export interface PrometheusInput {
  role: string;
  commit: string;
  runtime: RuntimeStatus;
  streams: StreamStatus;
  connections: { active: number | null; idle: number | null; waiting: number | null };
  /** Worker roles only, so a figure is never reported three times. */
  worker?: { status: WorkerStatus; oldestDueSeconds: number; lastTickSeconds: number; lastMaintenanceSeconds: number };
  archive?: { enabled: boolean; lastSuccessAgeSeconds: number | null; failing: boolean; failedTotal: number };
}

export function metricFamilies(input: PrometheusInput): MetricFamily[] {
  const { runtime } = input;
  const routes = Object.entries(runtime.routes);
  const gauge = (name: string, help: string, samples: MetricFamily['samples']): MetricFamily => ({ name, type: 'gauge', help, samples });
  const counter = (name: string, help: string, samples: MetricFamily['samples']): MetricFamily => ({ name, type: 'counter', help, samples });
  const families: MetricFamily[] = [
    gauge('astera_build_info', 'Role and commit of this process.', [{ labels: { role: input.role, commit: input.commit }, value: 1 }]),
    gauge('astera_process_resident_bytes', 'Resident memory of this process.', [{ value: runtime.process.rssBytes }]),
    gauge('astera_event_loop_delay_ms', 'Event loop delay since the process started.', quantiles({
      p50: runtime.eventLoop.p50Ms, p95: runtime.eventLoop.p95Ms, p99: runtime.eventLoop.p99Ms, max: runtime.eventLoop.maxMs })),
    gauge('astera_db_pool_acquire_ms', 'Wait for a pooled database connection, recent samples.', quantiles(runtime.databasePool.acquireMs)),
    counter('astera_db_pool_acquire_errors_total', 'Failed pool acquisitions.', [{ value: runtime.databasePool.acquireErrors }]),
    gauge('astera_db_connections', 'This database\'s Astera connections by state.', (['active', 'idle', 'waiting'] as const)
      .flatMap(state => input.connections[state] === null ? [] : [{ labels: { state }, value: input.connections[state] }])),
    counter('astera_route_requests_total', 'Requests by route.', routes.map(([route, r]) => ({ labels: { route }, value: r.requests }))),
    counter('astera_route_errors_total', 'Server errors (5xx) by route.', routes.map(([route, r]) => ({ labels: { route }, value: r.errors }))),
    gauge('astera_route_latency_ms', 'Response time by route, recent samples.', routes.flatMap(([route, r]) => quantiles(r.latencyMs, { route }))),
    gauge('astera_route_statements', 'SQL statements per request by route, recent samples.', routes.flatMap(([route, r]) => quantiles(r.statements, { route }))),
    gauge('astera_stream_active', 'Open live (SSE) connections.', [{ value: input.streams.active }]),
    counter('astera_stream_slow_closed_total', 'Live connections closed for falling behind.', [{ value: input.streams.slowClosed }]),
    counter('astera_stream_superseded_total', 'Live connections closed for a newer one on the same account.', [{ value: input.streams.supersededClosed }]),
  ];
  if (input.worker) {
    const { status } = input.worker;
    families.push(
      gauge('astera_worker_oldest_due_seconds', 'Age of the oldest event that is due and still pending.', [{ value: input.worker.oldestDueSeconds }]),
      gauge('astera_worker_last_tick_seconds', 'Seconds since the worker last finished a tick.', [{ value: input.worker.lastTickSeconds }]),
      gauge('astera_worker_last_maintenance_seconds', 'Seconds since the worker last finished a maintenance pass.',
        [{ value: input.worker.lastMaintenanceSeconds }]),
      counter('astera_worker_maintenance_errors_total', 'Maintenance passes that threw.', [{ value: status.maintenance.errors }]),
      gauge('astera_worker_lateness_ms', 'How late events resolved, recent samples.', quantiles(status.latenessMs)),
      gauge('astera_worker_wake_ms', 'How late the claim came after an event was due, recent samples.', quantiles(status.wakeMs)),
      gauge('astera_worker_queue_ms', 'Wait from the claim to the handler starting, recent samples.', quantiles(status.queueMs)),
      counter('astera_worker_busy_ms_total', 'Milliseconds spent running events.', [{ value: status.busyMs }]),
      counter('astera_worker_processed_total', 'Events resolved.', [{ value: status.processed }]),
      counter('astera_worker_handler_failures_total', 'Event handler failures (retried).', [{ value: status.handlerFailures }]),
      counter('astera_worker_abandoned_total', 'Events abandoned after exhausting retries.', [{ value: status.abandoned }]),
      counter('astera_worker_tick_errors_total', 'Ticks that threw.', [{ value: status.tickErrors }]),
      gauge('astera_worker_event_statements', 'SQL statements per event by kind, recent samples.',
        Object.entries(status.eventStatements).flatMap(([kind, e]) => quantiles(e.statements, { kind }))),
      gauge('astera_worker_event_duration_ms', 'Run time per event by kind, recent samples.',
        Object.entries(status.eventStatements).flatMap(([kind, e]) => quantiles(e.durationMs, { kind }))),
    );
  }
  if (input.archive) {
    const { archive } = input;
    families.push(
      gauge('astera_pg_archive_enabled', 'Whether PostgreSQL archives WAL (continuous backup).', [{ value: archive.enabled ? 1 : 0 }]),
      gauge('astera_pg_archive_last_success_age_seconds', 'Seconds since a WAL segment was last archived.',
        archive.lastSuccessAgeSeconds === null ? [] : [{ value: archive.lastSuccessAgeSeconds }]),
      gauge('astera_pg_archive_failing', 'The last archive attempt failed.', [{ value: archive.failing ? 1 : 0 }]),
      counter('astera_pg_archive_failed_total', 'Failed archive attempts since the statistics reset.', [{ value: archive.failedTotal }]),
    );
  }
  return families;
}
