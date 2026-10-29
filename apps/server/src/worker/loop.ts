import { runSilentSpaceSweep, SILENT_SPACE_INTERVAL_MS } from '../services/silentSpace.js';
import type { FastifyBaseLogger } from 'fastify';
import type { Clock } from '../clock.js';
import { countStatements, type Db } from '../db/client.js';
import { HANDLERS } from './handlers.js';
import { abandon, sweepStranded } from './abandon.js';
import { runBotSweep } from '../services/bots/sweep.js';
import { BOTS } from '../services/bots/personas.js';
import { claimDue, complete, fail, nextDueAt, reap } from './queue.js';
import { performance } from 'node:perf_hooks';
import { eq, sql } from 'drizzle-orm';
import { scheduledEvents } from '../db/schema.js';
import { VACATION_EVENT_KINDS } from '../services/vacation.js';
import { advanceSpawnGates } from '../services/spawnGate.js';
import { repairUnknownSignals } from '../services/unknownSignal.js';
import { processMediaDeletionQueue } from '../services/mediaErasure.js';
import { pruneErasureJournal } from '../services/erasureJournal.js';
import { expireContentReports } from '../services/contentReports.js';
import { SampleWindow } from '../services/runtimeMetrics.js';

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
  /** `BOTS_PER_GALAXY` is a ceiling over the population-driven seat target. */
  botsPerGalaxy?: number;
  silentSpaceEnabled?: boolean;
  silentSpaceBatch?: number;
  silentSpaceMaxShards?: number;
  silentSpaceExemptAccountIds?: readonly string[];
  /** Configured operator accounts are spectators to Dominion competition. */
  adminUsernames?: ReadonlySet<string>;
  /** Shared private upload directory; API replicas never run this worker task. */
  mediaDirectory?: string;
  erasureSecret?: string;
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
  /** The repairs, apart from the queue (F1.3): a pass that never returns stops them in silence. */
  maintenance: { lastAt: string | null; errors: number };
  /** SQL statements each event kind's handler ran (F0.2). */
  eventStatements: Record<string, { events: number; statements: ReturnType<SampleWindow['summary']> }>;
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
/** Spawn gate decisions (owner rule 2026-10-17): a planned birth waits at most this long to be shown. */
const SPAWN_GATE_EVERY_MS = 15_000;
/**
 * How soon the live loop claims again after a handler or a claim failed, however
 * short the poll. The retry budget is counted in attempts (D28) and was sized at
 * one a second; a quarter-second poll must not spend it four times as fast.
 */
const RETRY_AFTER_MS = 1_000;
/** How often the live loop runs the repairs, apart from the queue. Scaling plan F1.3. */
const MAINTENANCE_EVERY_MS = 1_000;

interface Maintained { reaped: number; stranded: number; botTurns: number }
interface Drained { claimed: number; processed: number; failed: number; abandoned: number; cutoff: Date }

export class EventWorker {
  private timer: NodeJS.Timeout | null = null;
  private maintenanceTimer: NodeJS.Timeout | null = null;
  private maintenanceTask: Promise<void> | null = null;
  /** One-shot timer for the next event due before the next poll. */
  private wakeTimer: NodeJS.Timeout | null = null;
  /** The due moment the last wake fired for; a second wake for it would spin. */
  private wokeFor: number | null = null;
  /** `performance.now()` before which the live loop does not claim. */
  private retryAt = 0;
  private maintainedAt: Date | null = null;
  private maintenanceErrors = 0;
  private running = false;
  private stopped = false;
  /** When the stranded sweep last ran. `-Infinity` so the first tick always does. */
  private sweptAt = -Infinity;
  /**
   * When the bot roster was last looked at.
   *
   * `0` rather than `-Infinity` merely for tidiness — the first tick sweeps either
   * way, and here that is WANTED: seating a roster and stamping presence is not
   * destructive, and a deploy should put commanders back in the sky at once rather
   * than a minute later.
   */
  private botsSweptAt = 0;
  private spawnGateAt = -Infinity;
  private unknownSignalSweepAt = -Infinity;
  private silentSpaceAt = -Infinity;
  private silentSpaceTask: Promise<void> | null = null;
  private mediaDeletionTask: Promise<void> | null = null;
  private mediaDeletionAt = -Infinity;
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
  private readonly eventStatements = new Map<string, { events: number; statements: SampleWindow }>();

  constructor(
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly opts: WorkerOptions,
    private readonly log: FastifyBaseLogger,
  ) {}

  /** Maintenance, then the queue, in that order: what tests step through. */
  async tick(): Promise<TickResult> {
    return this.measured(async () => {
      const maintained = await this.maintain(this.clock.now());
      const { cutoff: _, ...drained } = await this.drain();
      // Silent Space bridge: disabling transfers must preserve every commander.
      // Never fall back to destructive reclaim while the transfer engine is offline.
      return { ...drained, reaped: maintained.reaped, abandoned: drained.abandoned + maintained.stranded,
        reclaimed: 0, botTurns: maintained.botTurns };
    });
  }

  private async measured<T extends Pick<TickResult, 'processed' | 'failed' | 'abandoned'>>(
    pass: () => Promise<T>,
  ): Promise<T> {
    const started = performance.now();
    try {
      const result = await pass();
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

  /**
   * THE REPAIRS. Scaling plan F1.3 (M7).
   *
   * The live loop runs these on their own timer and never waits for them: a two-second
   * sweep used to be two seconds on every battle due behind it. `tick()` still runs
   * them before its claim, so a test can step through both in order.
   */
  private async maintain(now: Date): Promise<Maintained> {
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
     * THE SPAWN GATE, on its own clock and its own catch like the sweeps above: a birth that
     * waits fifteen seconds to be decided costs nothing; a gate failure must never delay a raid.
     */
    if (now.getTime() - this.spawnGateAt >= SPAWN_GATE_EVERY_MS) {
      this.spawnGateAt = now.getTime();
      try {
        await advanceSpawnGates(this.db, this.clock, (err, seasonId) => {
          this.log.error({ err, seasonId }, 'spawn gate failed for one season; it retries next pass');
        });
      } catch (err) {
        this.log.error({ err }, 'spawn gate pass failed; the queue carries on regardless');
      }
    }

    if (now.getTime() - this.unknownSignalSweepAt >= 60_000) {
      this.unknownSignalSweepAt = now.getTime();
      try { await repairUnknownSignals(this.db, this.clock); }
      catch (err) { this.log.error({ err }, 'unknown signal clock repair failed; queue processing continues'); }
    }

    /**
     * THE COMMANDERS THE SERVER PLAYS. D159, and on the same terms as the
     * stranded sweep above: its own clock, its own `try/catch`, and no claim on the queue.
     *
     * It is the least important thing in this tick — a missed turn costs one
     * commander one upgrade and the next sweep is twenty seconds away — which is exactly
     * why it must be incapable of delaying a raid settling. The catch is the whole
     * point of it living here rather than inside `claimDue`'s path.
     */
    let botTurns = 0;
    if (this.opts.botsEnabled === true) {
      if (now.getTime() - this.botsSweptAt >= BOTS.sweepEveryMs) {
        this.botsSweptAt = now.getTime();
        try {
          const bots = await runBotSweep(this.db, this.clock, this.log, this.opts.botsPerGalaxy);
          botTurns = bots.turns;
          if (bots.seated > 0) {
            this.log.info({ seated: bots.seated }, 'seated commanders on a live galaxy');
          }
        } catch (err) {
          this.log.error({ err }, 'bot sweep failed; the queue carries on regardless');
        }
      }
    }

    this.startBackgroundMaintenance(now);
    this.maintainedAt = new Date();
    return { reaped, stranded, botTurns };
  }

  private async drain(): Promise<Drained> {
    // Read the clock at the queue, not at the pass start: everything due by now is claimed.
    const cutoff = this.clock.now();
    const due = await claimDue(this.db, this.opts.batch, cutoff);
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
        const run = async () => {
          const scope = { statements: 0 };
          try {
            await countStatements(scope, () => handler({
              db: this.db,
              clock: this.clock,
              adminUsernames: this.opts.adminUsernames,
            }, event));
          } finally {
            this.observeEventStatements(event.kind, scope.statements);
          }
        };
        if (VACATION_EVENT_KINDS.has(event.kind)) {
          const ran = await this.db.transaction(async tx => {
            // Admission waits on this fence BEFORE locking the season. Holding a
            // season row here across a separate handler transaction would invert
            // that order when an exclusive season request is already waiting.
            await tx.execute(sql`select pg_advisory_xact_lock_shared(hashtextextended(${`vacation:${event.seasonId}`}, 0))`);
            const [current] = await tx.select().from(scheduledEvents).where(eq(scheduledEvents.id, event.id));
            if (current?.status !== 'processing' || current.resolveAt.getTime() !== event.resolveAt.getTime()) return false;
            await run();
            await complete(tx, event.id);
            return true;
          });
          if (!ran) continue;
        } else {
          await run();
          await complete(this.db, event.id);
        }
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
          //
          // Guarded for the sweep's reason above: this runs inside the handler's
          // catch, so a throw here escaped `tick()` and left every event claimed
          // after it in `processing` until the reaper — other commanders' battles.
          let released = false;
          try {
            released = await abandon(this.db, event, this.clock);
          } catch (abandonError) {
            this.log.error(
              { err: abandonError, id: event.id, kind: event.kind, refId: event.refId },
              'abandoning an exhausted event failed; the batch carries on regardless',
            );
          }
          this.log.error(
            { id: event.id, kind: event.kind, refId: event.refId, released },
            'event abandoned after exhausting retries',
          );
          abandoned++;
        }
      }
    }

    return { claimed: due.length, processed, failed, abandoned, cutoff };
  }

  private startBackgroundMaintenance(now: Date): void {
    // A separate promise owns maintenance: fleet resolution never awaits a move.
    if (this.opts.silentSpaceEnabled && !this.stopped && this.silentSpaceTask === null
      && now.getTime() - this.silentSpaceAt >= SILENT_SPACE_INTERVAL_MS) {
      this.silentSpaceAt = now.getTime();
      this.silentSpaceTask = runSilentSpaceSweep(this.db, this.clock, {
        onError: (err) => { this.log.error({ err }, 'Silent Space commander deferred after an error'); },
        batchSize: this.opts.silentSpaceBatch ?? 5, maxWaitingShards: this.opts.silentSpaceMaxShards ?? 16,
        adminUsernames: this.opts.adminUsernames ? [...this.opts.adminUsernames] : undefined,
        exemptAccountIds: this.opts.silentSpaceExemptAccountIds,
      }).then(result => {
        if (result.ran) this.log.info(result, 'Silent Space five-minute maintenance');
      }).catch((err: unknown) => {
        this.log.error({ err }, 'Silent Space maintenance failed; fleet resolution continues');
      }).finally(() => {
        // The persisted lease takes its timestamp after tick entry. Starting the
        // next interval at completion prevents an early no-op from skipping a tour.
        this.silentSpaceAt = this.clock.now().getTime();
        this.silentSpaceTask = null;
      });
    }

    if (this.opts.mediaDirectory && !this.stopped && !this.mediaDeletionTask && now.getTime() - this.mediaDeletionAt >= 60_000) {
      this.mediaDeletionAt = now.getTime();
      const directory = this.opts.mediaDirectory; const secret = this.opts.erasureSecret;
      this.mediaDeletionTask = processMediaDeletionQueue(this.db, this.opts.mediaDirectory)
        .then(result => {
          if (result.deferred > 0) this.log.error(result, 'Media erasure deferred; retrying next minute');
        })
        .catch(() => { this.log.error('Media erasure queue unavailable; fleet processing continues'); })
        .then(async () => {
          if (secret) await pruneErasureJournal(this.db, { directory, secret }, now);
        })
        .catch(() => { this.log.error('Erasure journal maintenance unavailable; retrying next minute'); })
        .then(async () => { await expireContentReports(this.db, now); })
        .catch(() => { this.log.error('Content report expiry unavailable; retrying next minute'); })
        .finally(() => { this.mediaDeletionTask = null; });
    }
  }

  private observeEventStatements(kind: string, statements: number): void {
    const samples = this.eventStatements.get(kind) ?? { events: 0, statements: new SampleWindow() };
    samples.events += 1;
    samples.statements.add(statements);
    this.eventStatements.set(kind, samples);
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
      maintenance: { lastAt: this.maintainedAt?.toISOString() ?? null, errors: this.maintenanceErrors },
      eventStatements: Object.fromEntries([...this.eventStatements].sort(([a], [b]) => a.localeCompare(b))
        .map(([kind, samples]) => [kind, { events: samples.events, statements: samples.statements.summary() }])),
    };
  }

  /**
   * On startup this drains everything already overdue, in resolve_at order. A
   * server that was down for six hours resolves six hours of history correctly,
   * because every event carries the time it was meant to fire at.
   *
   * WHEN IT WAKES. Scaling plan F1.3 (M8). After each drain it asks for the next
   * moment due before the next poll and sets a one-shot timer for it, so an event
   * known to this queue resolves on its moment; the poll only bounds how late an
   * event scheduled since then can be. The repairs run on their own timer beside it.
   */
  start(): void {
    if (this.timer) return;
    this.stopped = false;
    const run = async () => {
      // The batch loop checks stopped before every claim, including the first.
      if (this.running || performance.now() < this.retryAt) return;
      this.running = true;
      try {
        while (!this.stopped) {
          const { cutoff, ...result } = await this.measured(() => this.drain());
          if (result.claimed > 0) this.log.info(result, 'worker tick');
          if (result.failed > 0) {
            // Failed events keep the retry pace so immediate draining cannot burn their retries.
            this.retryAt = performance.now() + RETRY_AFTER_MS;
            break;
          }
          // A full batch implies possible backlog; anything less is the queue caught up.
          if (result.claimed < this.opts.batch) {
            await this.armWake(cutoff, run);
            break;
          }
          // Keep batches sequential while allowing shutdown and HTTP to progress.
          await new Promise<void>(resolve => setImmediate(resolve));
        }
      } catch (err) {
        this.log.error({ err }, 'worker tick failed');
        this.retryAt = performance.now() + RETRY_AFTER_MS;
      } finally {
        this.running = false;
      }
    };
    const maintain = () => {
      if (this.maintenanceTask || this.stopped) return;
      this.maintenanceTask = this.maintain(this.clock.now())
        .then(() => undefined, (err: unknown) => {
          this.maintenanceErrors += 1;
          this.log.error({ err }, 'maintenance pass failed; the queue carries on regardless');
        })
        .finally(() => { this.maintenanceTask = null; });
    };
    void run();
    this.timer = setInterval(() => void run(), this.opts.pollMs);
    this.timer.unref();
    maintain();
    this.maintenanceTimer = setInterval(maintain, MAINTENANCE_EVERY_MS);
    this.maintenanceTimer.unref();
  }

  private async armWake(cutoff: Date, run: () => Promise<void>): Promise<void> {
    let next: Date | null;
    try {
      next = await nextDueAt(this.db, cutoff, new Date(cutoff.getTime() + this.opts.pollMs));
    } catch (err) {
      this.log.error({ err }, 'next-due lookup failed; the poll carries on');
      return;
    }
    // Already woken for it and the clock had not reached it: the poll takes it.
    if (next === null || this.stopped || next.getTime() === this.wokeFor) return;
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    const due = next.getTime();
    // One millisecond late rather than early: a timer may fire just before its time.
    const delay = Math.max(0, Math.ceil(due - this.clock.now().getTime())) + 1;
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = null;
      this.wokeFor = due;
      void run();
    }, delay);
    this.wakeTimer.unref();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    for (const timer of [this.timer, this.maintenanceTimer]) if (timer) clearInterval(timer);
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.timer = null;
    this.maintenanceTimer = null;
    this.wakeTimer = null;
    // Let an in-flight tick finish rather than tearing its transaction down.
    while (this.running) await new Promise((r) => setTimeout(r, 20));
    await this.maintenanceTask;
    await this.silentSpaceTask;
    await this.mediaDeletionTask;
  }
}
