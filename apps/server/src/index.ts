import { pino } from 'pino';
import { buildApp } from './app.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const log = pino({ level: env.LOG_LEVEL });
const { app, worker, bus, close } = buildApp({ env, logger: log });

/**
 * One image, two roles. The api and worker process groups run the same build;
 * ROLE decides which half wakes up. Running both is the default for local dev
 * and for a shard small enough not to need the separation.
 */
async function main(): Promise<void> {
  if (env.ROLE === 'worker' || env.ROLE === 'both') {
    worker.start();
    log.info('event worker started');
  }
  if (env.ROLE === 'api' || env.ROLE === 'both') {
    // Only the API serves streams, so only the API needs to LISTEN.
    await bus.start();
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    log.info({ port: env.PORT }, 'api listening');
  }
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
