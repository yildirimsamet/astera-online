import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '../src');
const WEB_API = resolve(import.meta.dirname, '../../web/src/api');
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : []);

/** The server image copies `apps/web/src/api` and nothing else of the client (Dockerfile, server-build). */
it('imports from the web app only what the server image ships', () => {
  const outside = files(SRC).flatMap(file => [...readFileSync(file, 'utf8').matchAll(/from '(\.[^']*\/web\/src\/[^']*)'/g)]
    .map(match => resolve(file, '..', match[1]!))
    .filter(target => relative(WEB_API, target).startsWith('..'))
    .map(target => `${relative(SRC, file)} → ${relative(resolve(SRC, '../..'), target)}`));
  expect(outside).toEqual([]);
});
