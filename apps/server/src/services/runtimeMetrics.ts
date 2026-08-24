import { monitorEventLoopDelay, performance, PerformanceObserver } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';

const SAMPLE_CAPACITY = 4096;

class SampleWindow {
  private readonly values = new Float64Array(SAMPLE_CAPACITY);
  private size = 0;
  private cursor = 0;

  add(value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    this.values[this.cursor] = value;
    this.cursor = (this.cursor + 1) % this.values.length;
    this.size = Math.min(this.size + 1, this.values.length);
  }

  summary(): { samples: number; p50: number; p95: number; p99: number; max: number } {
    if (this.size === 0) return { samples: 0, p50: 0, p95: 0, p99: 0, max: 0 };
    const sorted = Array.from(this.values.slice(0, this.size)).sort((a, b) => a - b);
    const at = (percentile: number): number => {
      const index = Math.min(sorted.length - 1, Math.ceil((percentile / 100) * sorted.length) - 1);
      return sorted[index] ?? 0;
    };
    return { samples: sorted.length, p50: at(50), p95: at(95), p99: at(99), max: at(100) };
  }
}

interface RouteSamples {
  requests: number;
  errors: number;
  responseBytes: number;
  latency: SampleWindow;
}

export interface RuntimeStatus {
  instanceId: string;
  startedAt: string;
  uptimeSeconds: number;
  process: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    externalBytes: number;
    cpuPercentOfOneCore: number;
  };
  eventLoop: { p50Ms: number; p95Ms: number; p99Ms: number; maxMs: number };
  gc: { pauses: number; p50Ms: number; p95Ms: number; p99Ms: number; maxMs: number };
  databasePool: {
    acquireErrors: number;
    acquireMs: ReturnType<SampleWindow['summary']>;
  };
  routes: Record<string, {
    requests: number;
    errors: number;
    responseBytes: number;
    latencyMs: ReturnType<SampleWindow['summary']>;
  }>;
}

/**
 * Bounded, process-local capacity telemetry. D99.
 *
 * This is deliberately not a second database. Counters live only for the life of
 * one replica and the load runner snapshots every replica during a run. Latency
 * and GC samples use fixed-size rings, so a six-hour soak cannot turn metrics into
 * the memory leak it is supposed to detect.
 */
export class RuntimeMetrics {
  private readonly instanceId = randomUUID();
  private readonly startedAt = new Date();
  private readonly startedAtPerformance = performance.now();
  private readonly startedCpu = process.cpuUsage();
  private readonly eventLoop = monitorEventLoopDelay({ resolution: 20 });
  private readonly gc = new SampleWindow();
  private readonly databaseAcquire = new SampleWindow();
  private databaseAcquireErrors = 0;
  private readonly routes = new Map<string, RouteSamples>();
  private readonly gcObserver: PerformanceObserver;

  constructor() {
    this.eventLoop.enable();
    this.gcObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) this.gc.add(entry.duration);
    });
    this.gcObserver.observe({ entryTypes: ['gc'] });
  }

  observeRoute(
    method: string,
    route: string,
    statusCode: number,
    latencyMs: number,
    responseBytes: number,
  ): void {
    const key = `${method.toUpperCase()} ${route}`;
    const samples = this.routes.get(key) ?? {
      requests: 0,
      errors: 0,
      responseBytes: 0,
      latency: new SampleWindow(),
    };
    samples.requests += 1;
    if (statusCode >= 500) samples.errors += 1;
    samples.responseBytes += responseBytes;
    samples.latency.add(latencyMs);
    this.routes.set(key, samples);
  }

  observeDatabaseAcquire(latencyMs: number): void {
    this.databaseAcquire.add(latencyMs);
  }

  observeDatabaseAcquireError(): void {
    this.databaseAcquireErrors += 1;
  }

  status(): RuntimeStatus {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage(this.startedCpu);
    const elapsedMicros = Math.max(1, (performance.now() - this.startedAtPerformance) * 1000);
    const nsToMs = (value: number): number => Number.isFinite(value) ? value / 1_000_000 : 0;
    const gc = this.gc.summary();
    const routes: RuntimeStatus['routes'] = {};
    for (const [key, samples] of [...this.routes].sort(([a], [b]) => a.localeCompare(b))) {
      routes[key] = {
        requests: samples.requests,
        errors: samples.errors,
        responseBytes: samples.responseBytes,
        latencyMs: samples.latency.summary(),
      };
    }
    return {
      instanceId: this.instanceId,
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: (performance.now() - this.startedAtPerformance) / 1000,
      process: {
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
        externalBytes: memory.external,
        cpuPercentOfOneCore: ((cpu.user + cpu.system) / elapsedMicros) * 100,
      },
      eventLoop: {
        p50Ms: nsToMs(this.eventLoop.percentile(50)),
        p95Ms: nsToMs(this.eventLoop.percentile(95)),
        p99Ms: nsToMs(this.eventLoop.percentile(99)),
        maxMs: nsToMs(this.eventLoop.max),
      },
      gc: {
        pauses: gc.samples,
        p50Ms: gc.p50,
        p95Ms: gc.p95,
        p99Ms: gc.p99,
        maxMs: gc.max,
      },
      databasePool: {
        acquireErrors: this.databaseAcquireErrors,
        acquireMs: this.databaseAcquire.summary(),
      },
      routes,
    };
  }

  close(): void {
    this.eventLoop.disable();
    this.gcObserver.disconnect();
  }
}
