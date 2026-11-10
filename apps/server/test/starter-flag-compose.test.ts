import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { z } from 'zod';

/**
 * THE SHIP GALAXY'S DOOR REACHES THE APIS. The flag is read by the API role only; a value in `.env`
 * that compose never passes on would leave the door shut with every check green.
 */
const root = resolve(import.meta.dirname, '../../..');
const api = z.object({ environment: z.object({ STARTER_GALAXY_ENABLED: z.string() }) });
const config = z.object({ services: z.object({ api1: api, api2: api, api3: api }) });

it.each([undefined, 'true'])('passes STARTER_GALAXY_ENABLED to every API and keeps it shut by default (%s)', value => {
  const result = spawnSync('docker', ['compose', '--env-file', '/dev/null', '-f', 'docker-compose.prod.yml', 'config', '--format', 'json'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, COMPOSE_PROJECT_NAME: '',
      POSTGRES_USER: 'astera', POSTGRES_DB: 'astera', POSTGRES_PASSWORD: 'review-fixture-only', JWT_SECRET: 'review-fixture-secret-at-least-sixteen',
      ASTERA_GIT_COMMIT: '1'.repeat(40), STARTER_GALAXY_ENABLED: value },
  });
  expect(result.status, result.stderr).toBe(0);
  const services = config.parse(JSON.parse(result.stdout)).services;
  for (const role of [services.api1, services.api2, services.api3]) expect(role.environment.STARTER_GALAXY_ENABLED).toBe(value ?? 'false');
});
