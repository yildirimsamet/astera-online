import { afterAll, afterEach, beforeEach, expect, it } from 'vitest';
import { pino } from 'pino';
import { z } from 'zod';
import { buildApp, type BuiltApp } from '../src/app.js';
import { findAccount } from '../src/services/account.js';
import { seedWorld, testDb, testEnv, type Fixture } from './helpers.js';

let fixture: Fixture;
let built: BuiltApp;
beforeEach(async () => {
  fixture = await seedWorld(1);
  built = buildApp({ db: fixture.db, clock: fixture.clock,
    env: testEnv({ NATIVE_AUTH_ENABLED: 'true', NATIVE_APP_ORIGINS: 'https://localhost', SSE_HEARTBEAT_MS: '100' }), logger: pino({ level: 'silent' }) });
  await built.app.ready();
  await built.app.listen({ port: 0, host: '127.0.0.1' });
});
afterEach(async () => { await built.close(); });
afterAll(async () => { await (await testDb()).close(); });

it('exposes the unbuffered native stream through CORS and closes it after this device logs out', async () => {
  const account = await findAccount(fixture.db, fixture.accountIds[0]!);
  if (!account) throw new Error('Missing fixture account');
  const session = await built.app.nativeSessions.open(account);
  const address = built.app.server.address();
  if (!address || typeof address === 'string') throw new Error('Missing port');
  const abort = new AbortController();
  const deadline = setTimeout(() => { abort.abort(); }, 2500);
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/stream`, {
      headers: { origin: 'https://localhost', authorization: `Bearer ${session.accessToken}` }, signal: abort.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://localhost');
    expect(response.headers.get('access-control-expose-headers')).toContain('x-server-time');
    expect(response.headers.get('x-server-time')).toBe(String(fixture.clock.now().getTime()));
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    const reader = response.body!.getReader();
    const first = z.object({ value: z.instanceof(Uint8Array) }).parse(await reader.read());
    expect(new TextDecoder().decode(first.value)).toContain(': connected');
    await built.app.nativeSessions.logout({ sessionId: session.nativeSessionId, refreshToken: session.refreshToken });
    let done = false;
    for (let i = 0; i < 10 && !done; i++) { done = (await reader.read()).done; }
    expect(done).toBe(true);
    expect(abort.signal.aborted).toBe(false);
    const denied = await built.app.inject({ url: '/api/auth/me', headers: { authorization: `Bearer ${session.accessToken}` } });
    expect(denied.statusCode).toBe(401);
  } finally { clearTimeout(deadline); abort.abort(); }
});
