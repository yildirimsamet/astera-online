import { afterAll, describe, expect, it } from 'vitest';
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
