import { pino } from 'pino';
import { buildApp } from './app.js';
import { assertSchemaCurrent } from './db/migrate.js';
import { loadDotEnv, loadEnv } from './env.js';
import { ensureSeasonActs } from './services/season.js';
import { ensureGalaxyEventLifecycleEvents } from './services/galaxyEvents.js';

loadDotEnv();
const env = loadEnv();
const log = pino({ level: env.LOG_LEVEL });
const { app, db, worker, bus, rateLimitBackend, close } = buildApp({ env, logger: log });

/**
 * One image, two roles. The api and worker process groups run the same build;
 * ROLE decides which half wakes up. Running both is the default for local dev
 * and for a shard small enough not to need the separation.
 */
async function main(): Promise<void> {
  /**
   * REFUSE TO RUN AGAINST A DATABASE THIS BUILD IS AHEAD OF. D47.
   *
   * A missing migration is a deploy that did not finish, and it does not fail
   * loudly on its own: the API answers, planets produce, `/health` says `ok`, and
   * the only symptom is that every worker tick throws on the one insert that
   * touches the missing column — so no fleet in the galaxy ever lands again. That
   * ran for an hour on a development shard before anyone read the log.
   *
   * Checked here rather than applied here on purpose. Running migrations
   * automatically at boot means N replicas racing the same DDL, and it hides the
   * mistake instead of reporting it. The fix is one command, and the message says
   * which one.
   */
  await assertSchemaCurrent(db);

  if (env.ROLE === 'worker' || env.ROLE === 'both') {
    const actsScheduled = await ensureSeasonActs(db);
    if (actsScheduled > 0) {
      log.info({ actsScheduled }, 'scheduled missing season acts');
    }
    const galaxyEventMomentsScheduled = await ensureGalaxyEventLifecycleEvents(db);
    if (galaxyEventMomentsScheduled > 0) {
      log.info({ galaxyEventMomentsScheduled }, 'scheduled missing galaxy-event moments');
    }
    worker.start();
    log.info('event worker started');
  }
  if (env.ROLE === 'api' || env.ROLE === 'both') {
    try {
      await rateLimitBackend.start();
    } catch (err) {
      // Gameplay buckets are fail-open and strict auth/seat buckets fail closed.
      // A disposable counter outage must not take every API replica down at boot;
      // ioredis keeps reconnecting in the background.
      log.error({ err }, 'shared rate-limit store unavailable; gameplay is fail-open, auth is fail-closed');
    }
    // Only the API serves streams, so only the API needs to LISTEN.
    await bus.start();
  }
  // The worker exposes only `/health` and `/metrics` (see app.ts), bound by the
  // production compose file to host loopback. This makes its tick duration and
  // queue state observable without turning it into a public API replica.
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  log.info({ port: env.PORT, role: env.ROLE }, 'server listening');
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    log.info({ signal }, 'shutting down');
    // Let an in-flight tick finish its transaction rather than tearing it down.
    void close().then(() => process.exit(0));
  });
}

main().catch((err: unknown) => {
  log.error({ err }, 'failed to start');
  process.exit(1);
});
