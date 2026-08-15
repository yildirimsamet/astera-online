import type { FastifyBaseLogger } from 'fastify';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { HANDLERS } from './handlers.js';
import { claimDue, complete, fail, reap } from './queue.js';

export interface WorkerOptions {
  pollMs: number;
  batch: number;
  staleMinutes: number;
}

export interface TickResult {
  claimed: number;
  processed: number;
  failed: number;
  reaped: number;
}

/**
 * The entire heartbeat of the game.
 *
 * `tick()` is deliberately a plain method rather than something buried inside a
 * timer, so tests can drive it step by step and assert crash behaviour without
 * faking clocks or racing a scheduler.
 */
export class EventWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;

  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly opts: WorkerOptions,
    private readonly log: FastifyBaseLogger,
  ) {}

  async tick(): Promise<TickResult> {
    const now = this.clock.now();
    const reaped = await reap(this.db, this.opts.staleMinutes, now);
    if (reaped > 0) {
      this.log.warn({ reaped }, 'returned abandoned events to the queue');
    }

    const due = await claimDue(this.db, this.opts.batch, now);
    let processed = 0;
    let failed = 0;

    for (const event of due) {
      const handler = HANDLERS[event.kind];
      if (!handler) {
        // An unknown kind is a deploy-skew bug, not a transient failure. Mark it
        // done so it cannot spin forever, and shout about it.
        this.log.error({ kind: event.kind, id: event.id }, 'no handler for event kind');
        await complete(this.db, event.id);
        continue;
      }
      try {
        await handler({ db: this.db, clock: this.clock }, event);
        await complete(this.db, event.id);
        processed++;
      } catch (err) {
        failed++;
        this.log.error({ err, id: event.id, kind: event.kind }, 'event handler threw');
        await fail(this.db, event.id, err);
      }
    }

    return { claimed: due.length, processed, failed, reaped };
  }

  /**
   * On startup this drains everything already overdue, in resolve_at order. A
   * server that was down for six hours resolves six hours of history correctly,
   * because every event carries the time it was meant to fire at.
   */
  start(): void {
    if (this.timer) return;
    this.stopped = false;
    const run = async () => {
      if (this.running || this.stopped) return;
      this.running = true;
      try {
        const result = await this.tick();
        if (result.claimed > 0) this.log.info(result, 'worker tick');
      } catch (err) {
        this.log.error({ err }, 'worker tick failed');
      } finally {
        this.running = false;
      }
    };
    void run();
    this.timer = setInterval(() => void run(), this.opts.pollMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Let an in-flight tick finish rather than tearing its transaction down.
    while (this.running) await new Promise((r) => setTimeout(r, 20));
  }
}
