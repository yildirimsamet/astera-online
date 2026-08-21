import type { FastifyBaseLogger } from 'fastify';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { HANDLERS } from './handlers.js';
import { abandon, sweepStranded } from './abandon.js';
import { reclaimIdleSeats } from '../services/reclaim.js';
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
  /**
   * Flights released rather than resolved.
   *
   * Two causes, counted together because the outcome is identical: an event that
   * ran out of retries (D28), and a flight found with no event at all (D46).
   */
  abandoned: number;
  /** Seats freed from commanders who stopped coming back. */
  reclaimed: number;
}

/**
 * The entire heartbeat of the game.
 *
 * `tick()` is deliberately a plain method rather than something buried inside a
 * timer, so tests can drive it step by step and assert crash behaviour without
 * faking clocks or racing a scheduler.
 */
/**
 * How often the stranded-flight sweep runs, independently of the tick rate.
 *
 * Deliberately NOT derived from `WORKER_POLL_MS`: that number is how late the world
 * is allowed to be, and it is meant to keep going down. This one is how often a
 * repair for a bug that should never happen goes looking.
 *
 * Zero on the first tick, so a process that starts up after a crash sweeps at once
 * rather than half a minute later — which is exactly when there is most likely to
 * be something to find.
 */
const SWEEP_EVERY_MS = 30_000;

/**
 * How often idle seats are reclaimed. TEN MINUTES, and it is deliberately slow.
 *
 * The thing being measured is three days long, so the difference between checking
 * every minute and every ten is nothing to a player and is the difference between
 * a scan of `players` six times an hour and sixty. It is also a DESTRUCTIVE sweep:
 * a slower cadence means a commander who comes back in the same minute the cutoff
 * passes is far more likely to be seen as active before anything is taken apart,
 * on top of the locked re-read that already guarantees it.
 */
const RECLAIM_EVERY_MS = 10 * 60_000;

export class EventWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;
  /** When the stranded sweep last ran. `-Infinity` so the first tick always does. */
  private sweptAt = -Infinity;
  /**
   * When idle seats were last reclaimed. `0` rather than `-Infinity`, so a process
   * that restarts does NOT immediately take worlds apart: a deploy, a crash loop or
   * a local `pnpm dev` should never be the thing that triggers a destructive sweep
   * on its first tick. It waits its full interval like any other run.
   */
  private reclaimedAt = 0;

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

    /**
     * Flights whose event row is simply gone. D46.
     *
     * Swept here rather than in `fail`, because there is nothing to fail: the
     * event does not exist, so `reap` cannot requeue it and the retry budget never
     * runs out. Without this a stranded flight holds a bay for the rest of the
     * season and `/health` reports `ok` throughout — which is exactly how one went
     * thirteen hours unnoticed on a live galaxy.
     *
     * ITS OWN CATCH, AND THE REASON IS A REGRESSION THIS CAUSED. A sweep is a
     * REPAIR; claiming due events is the worker's actual job. Unguarded, a repair
     * that throws runs before `claimDue` and takes the entire queue down with it —
     * which is precisely what happened the first time this shipped: an unrelated
     * broken insert inside `abandon` turned "one stranded mission" into "no fleet
     * in the galaxy ever lands again", every five seconds, silently.
     *
     * A repair that cannot run is a bug worth shouting about. It is not a reason
     * to stop resolving everybody else's battles.
     */
    /**
     * AND IT RUNS ON ITS OWN CLOCK, NOT ON THE QUEUE'S. D52.
     *
     * The sweep is two correlated `NOT EXISTS` scans over `missions` and
     * `mining_runs`, and it ran on every tick — which was defensible at the old
     * five-second poll and stopped being so the moment that became one second, for
     * a reason that has nothing to do with the sweep: `WORKER_POLL_MS` is now the
     * latency of the whole world (a raid settling, a fleet landing), and tying a
     * repair's cost to it means every future improvement in how live the game feels
     * is paid for five times over in scans of a table that grows all season.
     *
     * A stranded flight is a flight whose EVENT ROW IS GONE — the safety net under
     * a bug, not a scheduled part of the loop — and it is only even considered
     * after `STRANDED_GRACE_MINUTES`. Half a minute of latency on a repair for
     * something that should never happen is free; half a minute of latency on a
     * battle is the thing this whole pass was about.
     */
    let stranded = 0;
    if (now.getTime() - this.sweptAt >= SWEEP_EVERY_MS) {
      this.sweptAt = now.getTime();
      try {
        stranded = await sweepStranded(this.db, this.clock);
        if (stranded > 0) {
          this.log.error({ stranded }, 'released flights that had no event to resolve them');
        }
      } catch (err) {
        this.log.error({ err }, 'stranded-flight sweep failed; the queue carries on regardless');
      }
    }

    /**
     * IDLE SEATS, ON THE SAME TERMS AS THE STRANDED SWEEP AND FOR THE SAME REASON.
     *
     * Its own clock, and its own catch. Housekeeping may never stop the event
     * queue — a repair that throws before `claimDue` turns "one world could not be
     * reclaimed" into "no fleet in the galaxy ever lands again", which is exactly
     * how the stranded sweep went wrong the first time it shipped.
     *
     * `reclaimIdleSeats` already isolates each world in its own transaction, so
     * this catch is the outer belt: it is there for a failure to READ the candidate
     * list at all.
     */
    let reclaimed = 0;
    if (this.reclaimedAt === 0) {
      this.reclaimedAt = now.getTime();
    } else if (now.getTime() - this.reclaimedAt >= RECLAIM_EVERY_MS) {
      this.reclaimedAt = now.getTime();
      try {
        const result = await reclaimIdleSeats(this.db, this.clock);
        reclaimed = result.reclaimed.length;
        if (reclaimed > 0 || result.failed > 0) {
          this.log.warn(
            { freed: result.reclaimed, deferred: result.deferred, failed: result.failed },
            'reclaimed seats from commanders who stopped coming back',
          );
        }
      } catch (err) {
        this.log.error({ err }, 'idle-seat sweep failed; the queue carries on regardless');
      }
    }

    const due = await claimDue(this.db, this.opts.batch, now);
    let processed = 0;
    let failed = 0;
    let abandoned = 0;

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
        const { exhausted } = await fail(this.db, event.id, err);
        if (exhausted) {
          // Out of retries. Nothing reads a `failed` row again, so whatever this
          // event was going to resolve has to be released here or it is stranded
          // for the rest of the season — holding a flight bay, its units parked
          // off-planet, and blocking its origin-target pair. D28.
          const released = await abandon(this.db, event, this.clock);
          this.log.error(
            { id: event.id, kind: event.kind, refId: event.refId, released },
            'event abandoned after exhausting retries',
          );
          abandoned++;
        }
      }
    }

    return {
      claimed: due.length,
      processed,
      failed,
      reaped,
      abandoned: abandoned + stranded,
      reclaimed,
    };
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
