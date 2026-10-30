import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

/**
 * THE HOST GATE KNOWS WHAT PRODUCTION RUNS. Scaling plan F0.1.
 *
 * `deploy/host-capacity-preflight.sh` fails a host whose production compose holds
 * any other service set, and checks each one's memory ceiling. A service added to
 * production without it (the arena did) turns the gate red for the wrong reason.
 */
const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const productionServices = () => {
  const compose = read('docker-compose.prod.yml');
  const body = compose.slice(compose.search(/^services:$/m)).split('\n').slice(1);
  const end = body.findIndex(line => /^\S/.test(line));
  return body.slice(0, end === -1 ? undefined : end)
    .flatMap(line => /^ {2}([a-z0-9-]+):\s*$/.exec(line)?.[1] ?? []).sort();
};

it('expects exactly the services production runs, each with a memory ceiling', () => {
  const script = read('deploy/host-capacity-preflight.sh');
  const expected = /expected=\$'([^']+)'/.exec(script)?.[1]?.split('\\n').sort();
  const ceilings = [...script.matchAll(/'([a-z0-9]+):(\d+)'/g)].map(match => match[1]).sort();
  expect(productionServices()).toEqual(['api1', 'api2', 'api3', 'arena', 'postgres', 'valkey', 'worker']);
  expect(expected).toEqual(productionServices());
  expect(ceilings).toEqual(productionServices());
});
