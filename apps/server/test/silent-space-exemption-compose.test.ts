import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { z } from 'zod';

const root = resolve(import.meta.dirname, '../../..');
const workerConfig = z.object({ services: z.object({ worker: z.object({ environment: z.object({ SILENT_SPACE_EXEMPT_ACCOUNT_IDS: z.string() }) }) }) });

it.each([false, true])('passes an explicit exemption to the worker and defaults it closed (stage=%s)', stage => {
  for (const ids of ['', '11111111-1111-4111-8111-111111111111']) {
    const result = spawnSync('docker', ['compose', '--env-file', '/dev/null', '-f', 'docker-compose.prod.yml',
      ...(stage ? ['-f', 'docker-compose.stage.yml'] : []), 'config', '--format', 'json'], {
      cwd: root, encoding: 'utf8', env: { ...process.env, COMPOSE_PROJECT_NAME: '',
        POSTGRES_USER: 'astera', POSTGRES_DB: 'astera', POSTGRES_PASSWORD: 'review-fixture-only', JWT_SECRET: 'review-fixture-secret-at-least-sixteen',
        POSTGRES_PORT: '5546', API_PORT_1: '3300', API_PORT_2: '3301', API_PORT_3: '3302', WORKER_PORT: '3310',
        ASTERA_GIT_COMMIT: '1'.repeat(40), ASTERA_STAGE_IMAGE: `astera-server:${'1'.repeat(40)}`, SILENT_SPACE_EXEMPT_ACCOUNT_IDS: ids },
    });
    expect(result.status, result.stderr).toBe(0);
    const config = workerConfig.parse(JSON.parse(result.stdout));
    expect(config.services.worker.environment.SILENT_SPACE_EXEMPT_ACCOUNT_IDS).toBe(ids);
  }
});
