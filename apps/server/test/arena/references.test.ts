import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import cookie from '@fastify/cookie';
import Fastify, { type LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerArena, type ArenaIdentify } from '../../src/arena/server.js';
import { FixedClock } from '../../src/clock.js';
import { loadEnv } from '../../src/env.js';

/**
 * Owner 2026-10-20: the private playtest flies the reference pack. Its files reach only
 * a seated pilot's browser, through a short signed cookie, and never a public URL.
 */
const ACCOUNTS: Record<string, { accountId: string; username: string; name: string; pilot: boolean }> = {
  'token-pilot': { accountId: '00000000-0000-4000-8000-00000000000a', username: 'alice', name: 'Alice', pilot: true },
  'token-guest': { accountId: '00000000-0000-4000-8000-00000000000c', username: 'carol', name: 'Carol', pilot: false },
};
const identify: ArenaIdentify = token => Promise.resolve(ACCOUNTS[token] ?? null);

let directory: string;
const closers: (() => Promise<void>)[] = [];
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'arena-refs-'));
  await mkdir(join(directory, 'dist/v2'), { recursive: true });
  await mkdir(join(directory, 'audio'));
  await mkdir(join(directory, 'raw'));
  await writeFile(join(directory, 'dist/v2/manifest.json'), '{"version":2}');
  await writeFile(join(directory, 'dist/ship.glb'), 'model');
  await writeFile(join(directory, 'audio/fire.ogg'), 'audio');
  await writeFile(join(directory, 'raw/private.apk'), 'private');
});
afterEach(async () => {
  while (closers.length) await closers.pop()?.();
  await rm(directory, { recursive: true, force: true });
});

async function arena(refDir: string | null = directory) {
  const env = loadEnv({ DATABASE_URL: 'postgres://test/arena_test', JWT_SECRET: 'test-secret-that-is-long-enough',
    ROLE: 'arena', ARENA_ENABLED: 'true', ARENA_ALLOWED_ORIGINS: 'https://asteraonline.space',
    ...(refDir ? { ARENA_REF_DIR: refDir } : {}) });
  const clock = new FixedClock(new Date('2026-10-20T20:00:00Z'));
  const app = Fastify();
  await app.register(cookie);
  app.decorate('clock', clock);
  registerArena(app, env, identify);
  await app.ready();
  closers.push(() => app.close());
  const open = (token?: string) => app.inject({ method: 'POST', url: '/arena/ref-session',
    headers: token ? { authorization: `Bearer ${token}` } : {} });
  const pass = (response: LightMyRequestResponse): string => {
    const set = response.cookies.find(c => c.name === 'astera_arena_ref');
    if (!set) throw new Error('no reference cookie');
    return `astera_arena_ref=${set.value}`;
  };
  const get = (url: string, cookieHeader?: string) => app.inject({ method: 'GET', url, headers: cookieHeader ? { cookie: cookieHeader } : {} });
  return { app, clock, open, pass, get };
}

describe('the private reference pack', () => {
  it('hands a seated pilot a short HttpOnly cookie scoped to the pack', async () => {
    const { open } = await arena();
    expect((await open()).statusCode).toBe(401);
    expect((await open('forged')).statusCode).toBe(401);
    expect((await open('token-guest')).statusCode).toBe(403);
    const granted = await open('token-pilot');
    expect(granted.statusCode).toBe(204);
    const set = granted.cookies.find(c => c.name === 'astera_arena_ref');
    expect(set).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/__ref', maxAge: 6 * 3600 });
  });

  it('serves pack files with the cookie and nothing without it', async () => {
    const { open, pass, get } = await arena();
    expect((await get('/__ref/dist/ship.glb')).statusCode).toBe(404);
    const ticket = pass(await open('token-pilot'));
    const model = await get('/__ref/dist/ship.glb', ticket);
    expect(model.statusCode).toBe(200);
    expect(model.body).toBe('model');
    expect(model.headers['content-type']).toBe('model/gltf-binary');
    expect(model.headers['cache-control']).toBe('private, max-age=86400');
    expect((await get('/__ref/audio/fire.ogg', ticket)).headers['content-type']).toBe('audio/ogg');
    expect((await get('/__ref/dist/v2/manifest.json', ticket)).body).toBe('{"version":2}');
  });

  it('refuses paths outside the served folders, traversal and missing files', async () => {
    const { open, pass, get } = await arena();
    const ticket = pass(await open('token-pilot'));
    for (const url of ['/__ref/raw/private.apk', '/__ref/dist/../raw/private.apk', '/__ref/dist/%2e%2e/raw/private.apk',
      '/__ref/dist/..%2fraw/private.apk', '/__ref/dist/missing.glb', '/__ref/dist']) {
      expect((await get(url, ticket)).statusCode, url).toBe(404);
    }
  });

  it('refuses a tampered or expired cookie', async () => {
    const { clock, open, pass, get } = await arena();
    const ticket = pass(await open('token-pilot'));
    const tampered = ticket.replace(/.$/, ch => (ch === 'a' ? 'b' : 'a'));
    expect((await get('/__ref/dist/ship.glb', tampered)).statusCode).toBe(404);
    clock.advance(6 * 60 + 1);
    expect((await get('/__ref/dist/ship.glb', ticket)).statusCode).toBe(404);
  });

  it('has no door at all when the server holds no pack', async () => {
    const { open, get } = await arena(null);
    expect((await open('token-pilot')).statusCode).toBe(404);
    expect((await get('/__ref/dist/ship.glb')).statusCode).toBe(404);
  });
});
