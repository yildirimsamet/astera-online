import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
const root = resolve(import.meta.dirname, '../../..');
it('keeps all collection switches disabled by default and wires explicit web/server configuration', () => {
  const env = readFileSync(resolve(root, '.env.production.example'), 'utf8');
  expect(env).toContain('ANALYTICS_ENABLED=false'); expect(env).toContain('ANALYTICS_ADMIN_ENABLED=false');
  expect(env).toContain('VITE_ASTERA_PLAYER_ANALYTICS=0');
  const compose = readFileSync(resolve(root, 'docker-compose.prod.yml'), 'utf8');
  expect(compose).toContain('ANALYTICS_ENABLED: ${ANALYTICS_ENABLED:-false}');
  const docker = readFileSync(resolve(root, 'Dockerfile'), 'utf8');
  expect(docker).toContain('ARG VITE_ASTERA_PLAYER_ANALYTICS="0"');
  const deploy = readFileSync(resolve(root, 'deploy/deploy.sh'), 'utf8');
  expect(deploy).toContain('--build-arg "VITE_ASTERA_PLAYER_ANALYTICS=${PLAYER_ANALYTICS}"');
});
it('redacts the visit capability alongside account credentials in production request logging', () => {
  const entry = readFileSync(resolve(root, 'apps/server/src/index.ts'), 'utf8');
  expect(entry).toContain('req.headers["x-analytics-visitor"]');
});
it('includes shared observation contracts in both the server bundle build and runtime CLI sources', () => {
  const docker = readFileSync(resolve(root, 'Dockerfile'), 'utf8');
  const server = docker.slice(docker.indexOf('FROM manifests AS server-build'));
  expect(server.match(/COPY apps\/web\/src\/api\s+\.\/apps\/web\/src\/api/g)).toHaveLength(2);
});
