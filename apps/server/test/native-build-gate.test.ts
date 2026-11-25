import { afterAll, describe, expect, it } from 'vitest';
import { Writable } from 'node:stream';
import { pino } from 'pino';
import { buildApp } from '../src/app.js';
import { testDb, testEnv } from './helpers.js';

afterAll(async () => { await (await testDb()).close(); });

async function app(minimum?: string) {
  const { db } = await testDb();
  const built = buildApp({ db, env: testEnv({ NATIVE_APP_ORIGINS: 'https://localhost', ...(minimum === undefined ? {} : { MIN_NATIVE_BUILD: minimum }) }),
    logger: pino({ level: 'silent' }) });
  await built.app.ready();
  return built;
}

describe('native build gate', () => {
  it.each([['4', 426], ['abc', 426], ['', 426], ['5', 401], ['12', 401]])('with minimum 5, build %j answers %i', async (build, status) => {
    const built = await app('5');
    try {
      const response = await built.app.inject({ url: '/api/auth/me', headers: { 'x-astera-build': build } });
      expect(response.statusCode).toBe(status);
      if (status === 426) expect(response.json()).toMatchObject({ error: 'UPDATE_REQUIRED' });
    } finally { await built.close(); }
  });

  it('never gates the web, which sends no build', async () => {
    const built = await app('5');
    try {
      expect((await built.app.inject({ url: '/api/auth/me' })).statusCode).toBe(401);
    } finally { await built.close(); }
  });

  it('is open by default', async () => {
    const built = await app();
    try {
      expect((await built.app.inject({ url: '/api/auth/me', headers: { 'x-astera-build': '1' } })).statusCode).toBe(401);
    } finally { await built.close(); }
  });

  it('lets the native origin name its web bundle (OTA F1)', async () => {
    const built = await app('5');
    try {
      const response = await built.app.inject({ method: 'OPTIONS', url: '/api/auth/me', headers: {
        origin: 'https://localhost', 'access-control-request-method': 'GET', 'access-control-request-headers': 'x-astera-web',
      } });
      expect(String(response.headers['access-control-allow-headers']).toLowerCase()).toContain('x-astera-web');
    } finally { await built.close(); }
  });

  /** OTA F1: one web bundle runs on many shells, so a request's log says which of each it came from. */
  it.each([
    [{ 'x-astera-build': '42', 'x-astera-web': 'a'.repeat(40) }, { shell: '42', web: 'a'.repeat(40) }],
    [{ 'x-astera-web': 'b'.repeat(40) }, { web: 'b'.repeat(40) }],
    [{ 'x-astera-build': '4x', 'x-astera-web': '<script>'.repeat(9) }, {}],
    [{}, {}],
  ])('logs the shell and web build a request names: %j', async (headers, expected) => {
    const lines: Record<string, unknown>[] = [];
    const sink = new Writable({ write(chunk: Buffer, _encoding, done) { lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>); done(); } });
    const { db } = await testDb();
    const built = buildApp({ db, env: testEnv(), logger: pino({ level: 'info' }, sink) });
    built.app.get('/api/__build-probe', (req) => { req.log.info('probe'); return {}; });
    await built.app.ready();
    try {
      await built.app.inject({ url: '/api/__build-probe', headers });
      const probe = lines.find(line => line.msg === 'probe');
      expect(probe).toBeDefined();
      expect({ shell: probe?.shell, web: probe?.web }).toEqual({ shell: undefined, web: undefined, ...expected });
    } finally { await built.close(); }
  });

  it('lets the native origin send its build', async () => {
    const built = await app('5');
    try {
      const response = await built.app.inject({ method: 'OPTIONS', url: '/api/auth/me', headers: {
        origin: 'https://localhost', 'access-control-request-method': 'GET', 'access-control-request-headers': 'x-astera-build',
      } });
      expect(response.statusCode).toBe(204);
      expect(String(response.headers['access-control-allow-headers']).toLowerCase()).toContain('x-astera-build');
    } finally { await built.close(); }
  });
});
