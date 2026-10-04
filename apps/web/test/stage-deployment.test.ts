import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const sha = '1'.repeat(40);

function compose(stage: boolean, image = `astera-server:${sha}`) {
  return spawnSync('docker', [
    'compose', '--env-file', '/dev/null', '-f', 'docker-compose.prod.yml',
    ...(stage ? ['-f', 'docker-compose.stage.yml'] : []),
    'config', '--format', 'json',
  ], {
    cwd: root, encoding: 'utf8',
    env: {
      ...process.env,
      COMPOSE_PROJECT_NAME: '',
      POSTGRES_USER: 'astera', POSTGRES_DB: 'astera',
      POSTGRES_PASSWORD: 'stage-test-password', JWT_SECRET: 'stage-test-secret-at-least-sixteen',
      ASTERA_GIT_COMMIT: sha, ASTERA_STAGE_IMAGE: image,
      PADDLE_CHECKOUT_ENABLED: 'true', PADDLE_LIVE_API_KEY: 'production-key-must-be-cleared',
      PADDLE_CLIENT_SIDE_TOKEN: 'production-token-must-be-cleared', PADDLE_WEBHOOK_SECRET: 'production-secret-must-be-cleared',
      POLAR_CHECKOUT_ENABLED: 'true', POLAR_ACCESS_TOKEN: 'production-token-must-be-cleared',
      POLAR_WEBHOOK_SECRET: 'production-secret-must-be-cleared',
      ...(stage ? {
        POSTGRES_PORT: '5546', API_PORT_1: '3300', API_PORT_2: '3301', API_PORT_3: '3302', WORKER_PORT: '3310',
      } : {
        POSTGRES_PORT: '5545', API_PORT_1: '3200', API_PORT_2: '3201', API_PORT_3: '3202', WORKER_PORT: '3210',
      }),
    },
  });
}

describe('stage uses production topology with its own resources', () => {
  it('uses a separate project, containers, loopback ports, volume and pinned server image', () => {
    const result = compose(true);
    expect(result.status, result.stderr).toBe(0);
    const config: unknown = JSON.parse(result.stdout);
    const endpoints: [string, string][] = [
      ['api1', '3300'], ['api2', '3301'], ['api3', '3302'], ['worker', '3310'],
    ];
    for (const [service, port] of endpoints) {
      expect(config).toMatchObject({ services: { [service]: {
        container_name: `astera-${service}-stage`, image: `astera-server:${sha}`,
        ports: [{ host_ip: '127.0.0.1', published: port, target: service === 'worker' ? 3210 : 3200 }],
        environment: {
          DATABASE_URL: 'postgres://astera:stage-test-password@postgres:5432/astera',
          JWT_SECRET: 'stage-test-secret-at-least-sixteen',
          PADDLE_CHECKOUT_ENABLED: 'false', PADDLE_ENV: 'sandbox', PADDLE_LIVE_API_KEY: '',
          PADDLE_CLIENT_SIDE_TOKEN: '', PADDLE_WEBHOOK_SECRET: '',
          POLAR_CHECKOUT_ENABLED: 'false', POLAR_ENV: 'sandbox', POLAR_ACCESS_TOKEN: '', POLAR_WEBHOOK_SECRET: '',
          POLAR_RETURN_URL: 'https://stage.asteraonline.space/',
        },
      } } });
    }
    expect(config).toMatchObject({
      name: 'astera-stage', services: {
        postgres: { container_name: 'astera-postgres-stage', ports: [{ host_ip: '127.0.0.1', published: '5546', target: 5432 }] },
        valkey: { container_name: 'astera-valkey-stage' },
      },
      volumes: { astera_pgdata: { name: 'astera-stage_astera_pgdata' } },
      networks: { default: { name: 'astera-stage_default' } },
    });
    expect(config).toMatchObject({ services: {
      api1: { environment: { ROLE: 'api' } }, api2: { environment: { ROLE: 'api' } },
      api3: { environment: { ROLE: 'api' } }, worker: { environment: { ROLE: 'worker' } },
    } });
  });

  it('refuses stage without an explicit image', () => {
    const result = compose(true, '');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('ASTERA_STAGE_IMAGE');
  });

  it('keeps the production topology when the override is absent', () => {
    const result = compose(false);
    expect(result.status, result.stderr).toBe(0);
    const config: unknown = JSON.parse(result.stdout);
    expect(config).toMatchObject({
      name: 'astera', services: {
        api1: { container_name: 'astera-api1-prod', image: 'astera-server', ports: [{ published: '3200' }] },
        worker: { container_name: 'astera-worker-prod', image: 'astera-server', ports: [{ published: '3210' }] },
        postgres: { container_name: 'astera-postgres-prod', ports: [{ published: '5545' }] },
      },
      volumes: { astera_pgdata: { name: 'astera_astera_pgdata' } },
    });
  });
});

it('renders an isolated stage nginx vhost while preserving the production browser policies', () => {
  const result = spawnSync(process.execPath, ['tools/stage-nginx.mjs'], { cwd: root, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  const nginx = result.stdout;
  expect(nginx).toContain('upstream astera_stage_api {');
  for (const port of [3300, 3301, 3302]) expect(nginx).toContain(`server 127.0.0.1:${port}`);
  expect(nginx).toContain('server_name stage.asteraonline.space;');
  expect(nginx).toContain('root /var/www/astera-stage;');
  expect(nginx).toContain('/etc/letsencrypt/live/stage.asteraonline.space/fullchain.pem');
  expect(nginx).not.toMatch(/\b(?:www|api|socket)\.stage\.asteraonline/);
  expect(nginx).not.toContain('proxy_pass http://astera_api');
  expect(nginx).not.toMatch(/127\.0\.0\.1:320[012]/);
  expect(nginx).not.toContain('Access-Control-Allow-Origin');
  expect(nginx).toContain('proxy_buffering off;');
  expect(nginx).toContain("script-src 'nonce-$request_id' 'strict-dynamic'");
  const production = readFileSync(resolve(root, 'deploy/nginx/astera.conf'), 'utf8');
  expect(nginx.match(/add_header Content-Security-Policy .+/g))
    .toEqual(production.match(/add_header Content-Security-Policy .+/g));
});
