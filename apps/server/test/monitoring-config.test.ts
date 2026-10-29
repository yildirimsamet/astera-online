import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * ALARMS ARE CODE. Scaling plan F0.6.
 *
 * The monitoring stack is configuration, so its tests run the vendors' own
 * checkers: promtool validates the scrape config and replays every alert rule
 * against synthetic series (deploy/monitoring/alerts.test.yml), amtool validates
 * the rendered Alertmanager config. A rule that cannot fire is worse than none.
 */
const root = resolve(import.meta.dirname, '../../..');
const monitoring = resolve(root, 'deploy/monitoring');
const compose = readFileSync(resolve(root, 'docker-compose.monitoring.yml'), 'utf8');
const image = (name: string) => {
  const match = new RegExp(`image: (${name}:v[0-9.]+)`).exec(compose);
  if (!match?.[1]) throw new Error(`${name} is not pinned in docker-compose.monitoring.yml`);
  return match[1];
};
const scratch = mkdtempSync(resolve(tmpdir(), 'astera-monitoring-'));
afterAll(() => { rmSync(scratch, { recursive: true, force: true }); });

function tool(imageName: string, entrypoint: string, args: string[], mount = monitoring) {
  // As the operator, like production: the rendered config and relay password are mode 600.
  const user = `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`;
  const result = spawnSync('docker', ['run', '--rm', '--network', 'none', '--user', user, '-v', `${mount}:/work:ro`, '-w', '/work',
    '--entrypoint', entrypoint, imageName, ...args], { encoding: 'utf8', timeout: 120_000 });
  if (result.error) throw result.error;
  return result;
}

it('pins every image and keeps every listener on loopback', () => {
  const config = spawnSync('docker', ['compose', '-f', 'docker-compose.monitoring.yml', 'config', '--format', 'json'],
    { cwd: root, encoding: 'utf8', env: { ...process.env, COMPOSE_PROJECT_NAME: '' } });
  expect(config.status, config.stderr).toBe(0);
  const services = z.object({ name: z.string(), services: z.record(z.string(), z.object({
    image: z.string(), command: z.array(z.string()).nullish(), network_mode: z.string().optional(), ports: z.array(z.unknown()).optional(),
    volumes: z.array(z.object({ type: z.string(), source: z.string().optional() })).optional(),
  })) }).parse(JSON.parse(config.stdout));
  expect(services.name).toBe('astera-monitoring');
  for (const [name, service] of Object.entries(services.services)) {
    expect(service.image, name).toMatch(/:v?[0-9]+\.[0-9]+\.[0-9]+$/);
    // Host networking reaches the app's loopback ports; no port is published.
    expect(service.network_mode, name).toBe('host');
    expect(service.ports, name).toBeUndefined();
    const listen = (service.command ?? []).find(arg => arg.includes('listen-address='));
    expect(listen, name).toMatch(/=127\.0\.0\.1:\d+$/);
    // A deploy that checks out an older commit deletes files the checkout owns; a
    // bind-mounted file that vanished stops the container at its next restart.
    for (const volume of service.volumes ?? []) {
      if (volume.type === 'bind') expect(volume.source, name).not.toMatch(new RegExp(`^${root}/`));
    }
  }
});

it('accepts the scrape configuration', () => {
  const result = tool(image('prom/prometheus'), 'promtool', ['check', 'config', 'prometheus.yml']);
  expect(result.status, result.stdout + result.stderr).toBe(0);
});

it('fires every alert exactly where its tests say', () => {
  const result = tool(image('prom/prometheus'), 'promtool', ['test', 'rules', 'alerts.test.yml']);
  expect(result.status, result.stdout + result.stderr).toBe(0);
});

it('scrapes the app with ?format=prometheus and never stage', () => {
  const scrape = readFileSync(resolve(monitoring, 'prometheus.yml'), 'utf8');
  expect(scrape).toMatch(/format: \[prometheus\]/);
  for (const port of ['3200', '3201', '3202', '3210', '3220']) expect(scrape).toContain(`127.0.0.1:${port}`);
  for (const port of ['3300', '3301', '3302', '3310']) expect(scrape).not.toContain(`:${port}`);
});

it('renders a valid Alertmanager config that mails the owner through the configured relay', () => {
  const template = readFileSync(resolve(monitoring, 'alertmanager.yml.template'), 'utf8');
  expect(template).toContain('__ALERT_EMAIL__');
  // The address is personal data: it lives in the runtime env, never in the repository.
  expect(template).not.toMatch(/@gmail\.com/);
  writeFileSync(resolve(scratch, 'alertmanager.yml'), template.replaceAll('__ALERT_EMAIL__', 'owner@example.com'), { mode: 0o600 });
  writeFileSync(resolve(scratch, 'smtp_password'), 'fixture', { mode: 0o600 });
  const result = tool(image('prom/alertmanager'), 'amtool', ['check-config', 'alertmanager.yml'], scratch);
  expect(result.status, result.stdout + result.stderr).toBe(0);
});
