import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { buildApp, type BuiltApp } from '../src/app.js';
import { testDb, testEnv } from './helpers.js';

let built: BuiltApp;
beforeEach(async () => {
  const { db } = await testDb();
  built = buildApp({ db, env: testEnv({ NATIVE_APP_ORIGINS: 'https://localhost,capacitor://localhost,http://localhost' }), logger: pino({ level: 'silent' }) });
  await built.app.ready();
});
afterEach(async () => { await built.close(); });
afterAll(async () => { await (await testDb()).close(); });

describe('native fetch and streaming CORS', () => {
  it.each(['https://localhost', 'capacitor://localhost', 'http://localhost'])('answers preflight for the explicitly configured %s origin', async origin => {
    const response = await built.app.inject({ method: 'OPTIONS', url: '/api/skins', headers: {
      origin, 'access-control-request-method': 'GET',
      'access-control-request-headers': 'authorization,content-type,x-placement,idempotency-key,x-astera-cosmetics,x-media-type',
    } });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    const headers = String(response.headers['access-control-allow-headers']).toLowerCase();
    for (const name of ['authorization', 'content-type', 'x-placement', 'idempotency-key', 'x-astera-cosmetics', 'x-media-type']) expect(headers).toContain(name);
    expect(String(response.headers.vary).toLowerCase()).toContain('origin');
  });

  it('exposes server clock and placement even on an authentication error', async () => {
    const response = await built.app.inject({ url: '/api/auth/me', headers: { origin: 'https://localhost' } });
    expect(response.statusCode).toBe(401);
    expect(response.headers['access-control-allow-origin']).toBe('https://localhost');
    const exposed = String(response.headers['access-control-expose-headers']).toLowerCase();
    for (const name of ['date', 'x-server-time', 'x-placement']) expect(exposed).toContain(name);
  });

  it.each(['null', 'https://localhost.evil.example', 'https://evil.example'])('never grants CORS access to %s', async origin => {
    const response = await built.app.inject({ method: 'OPTIONS', url: '/api/skins', headers: { origin, 'access-control-request-method': 'GET' } });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('keeps ordinary same-origin requests and their authentication checks', async () => {
    const response = await built.app.inject({ url: '/api/auth/me' });
    expect(response.statusCode).toBe(401);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

it('rejects wildcard/null origins and the debug HTTP origin in production configuration', () => {
  for (const origins of ['*', 'null', 'https://evil.example', 'http://localhost']) {
    expect(() => testEnv({ NODE_ENV: 'production', NATIVE_APP_ORIGINS: origins })).toThrow();
  }
});
