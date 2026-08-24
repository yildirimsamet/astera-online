import { performance } from 'node:perf_hooks';
import type { RuntimeMetrics } from './runtimeMetrics.js';

interface ReservedConnection {
  release(): void;
}

export interface ReservablePool {
  reserve(): Promise<ReservedConnection>;
}

/**
 * Measures how long this process waits for one of its own pool connections.
 *
 * PostgreSQL's activity view can show server-side waits, but it cannot see a
 * request queued inside postgres.js before a connection is assigned. Reserving
 * and immediately releasing one connection is the smallest real observation of
 * that queue. Only one probe may be in flight, so the observer cannot create its
 * own backlog while the pool is already saturated.
 */
export class DatabasePoolProbe {
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight: Promise<void> | null = null;
  private closed = false;

  constructor(
    private readonly pool: ReservablePool,
    private readonly metrics: RuntimeMetrics,
    private readonly intervalMs = 1000,
  ) {}

  start(): void {
    if (this.closed || this.timer !== null) return;
    void this.sample();
    this.timer = setInterval(() => void this.sample(), this.intervalMs);
    this.timer.unref();
  }

  sample(): Promise<void> {
    if (this.closed) return Promise.resolve();
    if (this.inFlight) return this.inFlight;

    const current = this.observe();
    this.inFlight = current;
    void current.then(() => {
      if (this.inFlight === current) this.inFlight = null;
    });
    return current;
  }

  async stop(): Promise<void> {
    this.closed = true;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    await this.inFlight;
  }

  private async observe(): Promise<void> {
    const startedAt = performance.now();
    let reserved: ReservedConnection | null = null;
    try {
      reserved = await this.pool.reserve();
      this.metrics.observeDatabaseAcquire(performance.now() - startedAt);
    } catch {
      this.metrics.observeDatabaseAcquireError();
    } finally {
      try {
        reserved?.release();
      } catch {
        this.metrics.observeDatabaseAcquireError();
      }
    }
  }
}
