import type { FastifyBaseLogger } from 'fastify';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { HANDLERS } from './handlers.js';
import { abandon, sweepStranded } from './abandon.js';
import { reclaimIdleSeats } from '../services/reclaim.js';
import { runBotSweep } from '../services/bots/sweep.js';
import { BOTS } from '../services/bots/personas.js';
import { claimDue, complete, fail, reap } from './queue.js';
import { performance } from 'node:perf_hooks';

export interface WorkerOptions {
  pollMs: number;
  batch: number;
  staleMinutes: number;
  /**
   * Whether the server plays commanders of its own. D159.
   *
   * OFF UNLESS SOMEBODY SAID SO. This seats accounts, writes population figures and
   * launches real fleets at real players; a default that did any of that because a
   * process happened to boot would be the wrong default in every direction.
   */
  botsEnabled?: boolean;
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
  /** Turns taken by the commanders the server plays. D159. */
  botTurns: number;
}

export interface WorkerStatus {
  enabled: boolean;
  running: boolean;
  ticks: number;
  tickErrors: number;
  processed: number;
  /** Event kinds this image did not know and therefore could not resolve. */
  unknownEvents: number;
  handlerFailures: number;
  abandoned: number;
  lastTickAt: string | null;
  lastDurationMs: number | null;
  p95DurationMs: number;
  maxDurationMs: number;
  latenessMs: {
    samples: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
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
  /**
   * When the bot roster was last looked at.
   *
   * `0` rather than `-Infinity` merely for tidiness — the first tick sweeps either
   * way, and here that is WANTED: seating a roster and stamping presence is not
   * destructive, and a deploy should put commanders back in the sky at once rather
   * than a minute later.
   */
  private botsSweptAt = 0;
  private ticks = 0;
  private tickErrors = 0;
  private processed = 0;
  private unknownEvents = 0;
  private handlerFailures = 0;
  private abandoned = 0;
  private lastTickAt: Date | null = null;
  private lastDurationMs: number | null = null;
  private readonly durations: number[] = [];
  private readonly lateness: number[] = [];

  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly opts: WorkerOptions,
    private readonly log: FastifyBaseLogger,
  ) {}

  async tick(): Promise<TickResult> {
    const started = performance.now();
    try {
      const result = await this.executeTick();
      this.ticks += 1;
      this.processed += result.processed;
      this.handlerFailures += result.failed;
      this.abandoned += result.abandoned;
      this.lastTickAt = new Date();
      return result;
    } catch (error) {
      this.tickErrors += 1;
      throw error;
    } finally {
      const duration = performance.now() - started;
      this.lastDurationMs = duration;
      this.durations.push(duration);
      if (this.durations.length > 512) this.durations.shift();
    }
  }

  private async executeTick(): Promise<TickResult> {
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

    /**
     * THE COMMANDERS THE SERVER PLAYS. D159, and on the same terms as the two
     * sweeps above: its own clock, its own `try/catch`, and no claim on the queue.
     *
     * It is the least important thing in this tick — a missed turn costs one
     * commander one upgrade and the next sweep is a minute away — which is exactly
     * why it must be incapable of delaying a raid settling. The catch is the whole
     * point of it living here rather than inside `claimDue`'s path.
     */
    let botTurns = 0;
    if (this.opts.botsEnabled === true) {
      if (now.getTime() - this.botsSweptAt >= BOTS.sweepEveryMs) {
        this.botsSweptAt = now.getTime();
        try {
          const bots = await runBotSweep(this.db, this.clock, this.log);
          botTurns = bots.turns;
          if (bots.seated > 0) {
            this.log.info({ seated: bots.seated }, 'seated commanders on a live galaxy');
          }
        } catch (err) {
          this.log.error({ err }, 'bot sweep failed; the queue carries on regardless');
        }
      }
    }

    const due = await claimDue(this.db, this.opts.batch, now);
    let processed = 0;
    let failed = 0;
    let abandoned = 0;

    for (const event of due) {
      this.lateness.push(Math.max(0, this.clock.now().getTime() - event.resolveAt.getTime()));
      if (this.lateness.length > 512) this.lateness.shift();
      const handler = HANDLERS[event.kind];
      if (!handler) {
        // An unknown kind is a deploy-skew bug, not a transient failure. Mark it
        // done so it cannot spin forever, and shout about it.
        this.log.error({ kind: event.kind, id: event.id }, 'no handler for event kind');
        this.unknownEvents += 1;
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
      botTurns,
    };
  }

  status(): WorkerStatus {
    const sorted = [...this.durations].sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    const lateness = [...this.lateness].sort((a, b) => a - b);
    const latenessAt = (percentile: number): number => {
      if (lateness.length === 0) return 0;
      const index = Math.min(
        lateness.length - 1,
        Math.max(0, Math.ceil(lateness.length * percentile) - 1),
      );
      return lateness[index] ?? 0;
    };
    return {
      enabled: this.timer !== null,
      running: this.running,
      ticks: this.ticks,
      tickErrors: this.tickErrors,
      processed: this.processed,
      unknownEvents: this.unknownEvents,
      handlerFailures: this.handlerFailures,
      abandoned: this.abandoned,
      lastTickAt: this.lastTickAt?.toISOString() ?? null,
      lastDurationMs: this.lastDurationMs,
      p95DurationMs: sorted[p95Index] ?? 0,
      maxDurationMs: sorted.at(-1) ?? 0,
      latenessMs: {
        samples: lateness.length,
        p50: latenessAt(0.5),
        p95: latenessAt(0.95),
        p99: latenessAt(0.99),
        max: lateness.at(-1) ?? 0,
      },
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
