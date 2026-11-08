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
  await writeFile(join(directory, 'dist/v2/manifest-lite.json'), JSON.stringify({ ships: { classes: Object.fromEntries(['akinci', 'muhafiz', 'kilavuz'].map(ship => [ship, { model: '/__ref/dist/ship.glb', engines: [[0, 0, -0.4]], nozzle: .03 }])) } }));
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

describe('galaxy ship assets for a commander who never entered the hangar', () => {
  it('gives an ordinary signed-in observer only the three ship models, without opening the arena pack', async () => {
    const { app, get } = await arena();
    const granted = await app.inject({ method: 'GET', url: '/arena/galaxy-ships', headers: { authorization: 'Bearer token-guest' } });
    expect(granted.statusCode).toBe(200);
    const view = granted.json<{ models: Record<string, { url: string }> }>();
    expect(Object.keys(view.models)).toEqual(['akinci', 'muhafiz', 'kilavuz']);
    const ticket = granted.cookies.find(c => c.name === 'astera_galaxy_ships');
    expect(ticket).toBeDefined();
    const cookie = `astera_galaxy_ships=${ticket!.value}`;
    expect((await get(view.models.akinci!.url, cookie)).body).toBe('model');
    expect((await get('/__ref/audio/fire.ogg', cookie)).statusCode).toBe(404);
    expect((await get('/__ref/dist/ship.glb', `astera_arena_ref=${ticket!.value}`)).statusCode).toBe(404);
  });
  it('answers missing packs without sending the client to absent model URLs', async () => {
    const { app } = await arena(null);
    const response = await app.inject({ method: 'GET', url: '/arena/galaxy-ships', headers: { authorization: 'Bearer token-guest' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ models: null });
  });
  it('requires a live account even though arena admission is unnecessary', async () => {
    const { app } = await arena();
    for (const token of ['', 'forged']) {
      const response = await app.inject({ method: 'GET', url: '/arena/galaxy-ships', headers: { authorization: `Bearer ${token}` } });
      expect(response.statusCode).toBe(401);
    }
  });
});

it('renews the galaxy-only asset ticket after a long browser session', async () => {
  const { app, clock, get } = await arena();
  const open = () => app.inject({ method: 'GET', url: '/arena/galaxy-ships', headers: { authorization: 'Bearer token-guest' } });
  const first = await open();
  const cookie = first.cookies.find(c => c.name === 'astera_galaxy_ships')!;
  clock.advance(6 * 60 + 1);
  expect((await get('/arena/galaxy-ships/akinci.glb', `astera_galaxy_ships=${cookie.value}`)).statusCode).toBe(404);
  const renewed = (await open()).cookies.find(c => c.name === 'astera_galaxy_ships')!;
  expect((await get('/arena/galaxy-ships/akinci.glb', `astera_galaxy_ships=${renewed.value}`)).statusCode).toBe(200);
});

it('recovers when prepared ship files arrive after the first catalogue read', async () => {
  await rm(join(directory, 'dist/ship.glb'));
  const { app } = await arena();
  const read = () => app.inject({ method: 'GET', url: '/arena/galaxy-ships', headers: { authorization: 'Bearer token-guest' } });
  expect((await read()).json()).toEqual({ models: null });
  await writeFile(join(directory, 'dist/ship.glb'), 'model');
  expect((await read()).json<{ models: unknown }>().models).not.toBeNull();
});

it('keeps valid HTTP framing when a prepared ship file is replaced', async () => {
  const { app, get } = await arena();
  const granted = await app.inject({ method: 'GET', url: '/arena/galaxy-ships', headers: { authorization: 'Bearer token-guest' } });
  const ticket = granted.cookies.find(c => c.name === 'astera_galaxy_ships')!;
  const nextModel = 'new model with a different byte length';
  await writeFile(join(directory, 'dist/ship.glb'), nextModel);
  const response = await get('/arena/galaxy-ships/akinci.glb', `astera_galaxy_ships=${ticket.value}`);
  expect(response.statusCode).toBe(200);
  const declared = response.headers['content-length'];
  if (declared !== undefined) expect(declared).toBe(String(Buffer.byteLength(nextModel)));
  expect(response.body).toBe(nextModel);
});
