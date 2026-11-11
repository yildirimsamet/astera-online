import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { z } from 'zod';

/**
 * THE WORKER HOLDS THE FIREBASE KEY. Paid raid alerts and every other push leave from the
 * worker; a key in `.env` that compose never passes on left push silently off from the
 * 42d51ce8 deploy until 2026-11-10. The APIs send no push and get no key.
 */
const root = resolve(import.meta.dirname, '../../..');
const service = z.object({ environment: z.record(z.string()) });
const config = z.object({ services: z.object({ worker: service, api1: service, api2: service, api3: service }) });

it.each([undefined, 'a2V5'])('passes FCM_SERVICE_ACCOUNT to the worker only, empty by default (%s)', value => {
  const result = spawnSync('docker', ['compose', '--env-file', '/dev/null', '-f', 'docker-compose.prod.yml', 'config', '--format', 'json'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, COMPOSE_PROJECT_NAME: '',
      POSTGRES_USER: 'astera', POSTGRES_DB: 'astera', POSTGRES_PASSWORD: 'review-fixture-only', JWT_SECRET: 'review-fixture-secret-at-least-sixteen',
      ASTERA_GIT_COMMIT: '1'.repeat(40), FCM_SERVICE_ACCOUNT: value },
  });
  expect(result.status, result.stderr).toBe(0);
  const services = config.parse(JSON.parse(result.stdout)).services;
  expect(services.worker.environment.FCM_SERVICE_ACCOUNT).toBe(value ?? '');
  for (const api of [services.api1, services.api2, services.api3]) expect(api.environment).not.toHaveProperty('FCM_SERVICE_ACCOUNT');
});
