import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { z } from 'zod';

/**
 * CONTINUOUS BACKUP IS PROD-ONLY. Scaling plan F0.4, owner 2026-10-28.
 *
 * Production PostgreSQL ships every WAL segment to an off-site, encrypted pgBackRest
 * repository, so a lost VPS loses at most a minute instead of a day. Stage merges the
 * same postgres service; it must never archive into, or even hold the keys of, the
 * production repository: a second cluster pushing to the same stanza poisons it.
 */
const root = resolve(import.meta.dirname, '../../..');
const postgresConfig = z.object({ services: z.object({ postgres: z.object({
  image: z.string(),
  build: z.object({ context: z.string() }).optional(),
  command: z.array(z.string()).nullish(),
  environment: z.record(z.string(), z.string().nullable()),
}) }) });
const secrets = {
  PGBACKREST_REPO1_S3_BUCKET: 'fixture-bucket', PGBACKREST_REPO1_S3_ENDPOINT: 's3.eu-central-003.backblazeb2.com',
  PGBACKREST_REPO1_S3_REGION: 'eu-central-003', PGBACKREST_REPO1_S3_KEY: 'fixture-key-id',
  PGBACKREST_REPO1_S3_KEY_SECRET: 'fixture-application-key', PGBACKREST_REPO1_CIPHER_PASS: 'fixture-cipher-pass',
};

function postgres(stage: boolean) {
  const result = spawnSync('docker', ['compose', '--env-file', '/dev/null', '-f', 'docker-compose.prod.yml',
    ...(stage ? ['-f', 'docker-compose.stage.yml'] : []), 'config', '--format', 'json'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, COMPOSE_PROJECT_NAME: '',
      POSTGRES_USER: 'astera', POSTGRES_DB: 'astera', POSTGRES_PASSWORD: 'review-fixture-only', JWT_SECRET: 'review-fixture-secret-at-least-sixteen',
      POSTGRES_PORT: '5546', API_PORT_1: '3300', API_PORT_2: '3301', API_PORT_3: '3302', WORKER_PORT: '3310',
      ASTERA_GIT_COMMIT: '1'.repeat(40), ASTERA_STAGE_IMAGE: `astera-server:${'1'.repeat(40)}`, ...secrets },
  });
  expect(result.status, result.stderr).toBe(0);
  const service = postgresConfig.parse(JSON.parse(result.stdout)).services.postgres;
  const command = service.command ?? [];
  const settings = new Map(command.flatMap((arg, i) => command[i - 1] === '-c' ? [arg.split(/=(.*)/s).slice(0, 2) as [string, string]] : []));
  return { service, settings };
}

it('archives every WAL segment of production to the encrypted off-site repository within a minute', () => {
  const { service, settings } = postgres(false);
  expect(settings.get('archive_mode')).toBe('on');
  expect(settings.get('archive_timeout')).toBe('60');
  expect(settings.get('archive_command')).toBe('pgbackrest --stanza=astera archive-push %p');
  expect(service.environment).toMatchObject({
    ...secrets, PGBACKREST_STANZA: 'astera', PGBACKREST_REPO1_TYPE: 's3', PGBACKREST_REPO1_CIPHER_TYPE: 'aes-256-cbc',
    PGBACKREST_PG1_PATH: '/var/lib/postgresql/data', PGBACKREST_PG1_USER: 'astera',
  });
});

it('keeps the 30-day personal-data ceiling: the repository expires full backups and their WAL', () => {
  const retention = Number(postgres(false).service.environment.PGBACKREST_REPO1_RETENTION_FULL);
  // Daily full backups: the oldest restorable point is `retention` days back, never 30.
  expect(retention).toBeGreaterThanOrEqual(7);
  expect(retention).toBeLessThanOrEqual(28);
});

it('bundles small files and uploads in parallel: one object per file took ~10 minutes for an empty cluster', () => {
  // Measured 2026-10-28 from the VPS: ~0.3 s per B2 request, ~1,000 relation files.
  expect(postgres(false).service.environment).toMatchObject({ PGBACKREST_REPO1_BUNDLE: 'y', PGBACKREST_PROCESS_MAX: '2' });
});

it('loads query statistics in the same restart (Q13)', () => {
  expect(postgres(false).settings.get('shared_preload_libraries')?.split(',')).toEqual(expect.arrayContaining(['pg_stat_statements', 'auto_explain']));
});

it('builds the archiving image from the exact PostgreSQL build production already runs', () => {
  const { service } = postgres(false);
  expect(service.build?.context).toBe(resolve(root, 'deploy/postgres'));
  const dockerfile = readFileSync(resolve(root, 'deploy/postgres/Dockerfile'), 'utf8');
  // A floating tag would turn the archive restart into an unplanned minor upgrade.
  expect(dockerfile).toMatch(/^FROM postgres:16[.\w-]*@sha256:[0-9a-f]{64}$/m);
  expect(dockerfile).toMatch(/apk add --no-cache pgbackrest/);
});

it('never archives stage or hands it the production repository keys', () => {
  const { service, settings } = postgres(true);
  expect(settings.get('archive_mode') ?? 'off').toBe('off');
  expect(settings.has('archive_command')).toBe(false);
  for (const name of Object.keys(secrets)) expect(service.environment[name] ?? '').toBe('');
});
