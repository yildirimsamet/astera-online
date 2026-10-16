import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { eq } from 'drizzle-orm';
import { buildApp, type BuiltApp } from '../src/app.js';
import { FixedClock } from '../src/clock.js';
import { accounts, mailOutbox, securityAudit } from '../src/db/schema.js';
import { MailSendError, recordMailWebhook, type MailMessage } from '../src/services/mail.js';
import { testDb, testEnv, truncateAll } from './helpers.js';

const password = 'correct-horse-battery';
let built: BuiltApp;
let token: string;
let accountId: string;
let clock: FixedClock;
const sent: MailMessage[] = [];
let failures = 0;
const sendKeys: string[] = [];
const headers = () => ({ authorization: `Bearer ${token}` });
const post = (url: string, body: object, auth = true) => built.app.inject({ method: 'POST', url, payload: body, headers: auth ? headers() : {} });
const drain = async () => { for (let i = 0; i < 8; i++) await built.mail.tick(); };
const lastCode = () => {
  const code = sent.at(-1)?.text.match(/\b\d{6}\b/)?.[0];
  if (!code) throw new Error('No code delivered');
  return code;
};
const request = async (email = 'pilot@example.com') => {
  const response = await post('/api/auth/email/request', { email, currentPassword: password, locale: 'tr' });
  expect(response.statusCode).toBe(202);
  await drain();
  return response.json<{ challengeId: string; expiresAt: string }>();
};
const bind = async () => {
  const { challengeId } = await request();
  const response = await post('/api/auth/email/verify', { challengeId, code: lastCode() });
  expect(response.statusCode).toBe(200);
};
const login = async (email = 'pilot@example.com', pass = password) => {
  const response = await post('/api/auth/login', { identifier: email, password: pass }, false);
  expect(response.statusCode).toBe(200);
  token = response.json<{ accessToken: string }>().accessToken;
};
beforeEach(async () => {
  const { db } = await testDb(); await truncateAll(db); sent.length = 0; failures = 0; sendKeys.length = 0;
  clock = new FixedClock(new Date('2026-10-16T12:00:00Z'));
  built = buildApp({ db, clock, logger: pino({ level: 'silent' }), env: testEnv({
    ACCOUNT_EMAIL_ENABLED: 'true', PASSWORD_RECOVERY_ENABLED: 'true', MAIL_DELIVERY_ENABLED: 'true',
    AUTH_CODE_HMAC_SECRET: 'test-hmac-secret-that-is-at-least-32-characters', MAIL_OUTBOX_ENCRYPTION_KEY: 'ab'.repeat(32),
  }), mailer: { send: (message, key) => { sendKeys.push(key); if (failures-- > 0) return Promise.reject(new MailSendError(false)); sent.push(message); return Promise.resolve(`mail-${sent.length}`); } } });
  await built.app.ready();
  const response = await post('/api/auth/register', { username: 'Vantage', password }, false);
  ({ accessToken: token, accountId } = response.json<{ accessToken: string; accountId: string }>());
});
afterEach(async () => { await built.close(); });
afterAll(async () => { await (await testDb()).close(); });

describe('verified email lifecycle', () => {
  it('queues encrypted mail, keeps pending email out of login, then switches login and revokes the session', async () => {
    const { challengeId } = await request(' PILOT@EXAMPLE.COM ');
    const [row] = await built.db.select().from(mailOutbox);
    expect(row?.payload).toBeNull(); // cleared after provider acceptance
    expect((await post('/api/auth/login', { identifier: 'pilot@example.com', password }, false)).statusCode).toBe(401);
    expect((await post('/api/auth/email/verify', { challengeId, code: 'wrong' })).statusCode).toBe(400);
    const response = await post('/api/auth/email/verify', { challengeId, code: lastCode() });
    expect(response.statusCode).toBe(200);
    expect((await built.app.inject({ url: '/api/auth/me', headers: headers() })).statusCode).toBe(401);
    expect((await post('/api/auth/login', { username: 'Vantage', password }, false)).statusCode).toBe(401);
    await login();
    const status = await built.app.inject({ url: '/api/auth/security', headers: headers() });
    expect(status.json<{ loginMethod: string }>().loginMethod).toBe('email');
    expect((await built.db.select().from(accounts).where(eq(accounts.id, accountId)))[0]?.displayName).toBe('Vantage');
    expect((await built.db.select().from(securityAudit)).map(row => row.kind)).toContain('email_verified');
  });
  it('expires codes and persists failed attempts instead of rolling them back', async () => {
    const { challengeId } = await request(); const code = lastCode();
    for (let i = 0; i < 5; i++) expect((await post('/api/auth/email/verify', { challengeId, code: code === '000000' ? '111111' : '000000' })).statusCode).toBe(400);
    expect((await post('/api/auth/email/verify', { challengeId, code })).statusCode).toBe(400);
    clock.advance(1.01);
    const second = await request('second@example.com');
    clock.advance(10);
    expect((await post('/api/auth/email/verify', { challengeId: second.challengeId, code: lastCode() })).statusCode).toBe(400);
  });
  it('returns uniform reset requests and consumes a reset code only once', async () => {
    await bind(); await login(); clock.advance(1.01);
    const known = await post('/api/auth/password/reset/request', { email: 'pilot@example.com' }, false);
    const unknown = await post('/api/auth/password/reset/request', { email: 'unknown@example.com' }, false);
    expect(known.statusCode).toBe(202); expect(unknown.statusCode).toBe(202);
    expect(Object.keys(known.json<object>())).toEqual(Object.keys(unknown.json<object>()));
    await drain(); const code = lastCode(); const { challengeId } = known.json<{ challengeId: string }>();
    const reset = () => post('/api/auth/password/reset/complete', { challengeId, code, newPassword: 'a-new-correct-password' }, false);
    const results = await Promise.all([reset(), reset()]);
    expect(results.map(r => r.statusCode).sort()).toEqual([200, 400]);
    expect((await built.app.inject({ url: '/api/auth/me', headers: headers() })).statusCode).toBe(401);
    await login('pilot@example.com', 'a-new-correct-password');
  });
  it('requires both old and new mailboxes to change the login address', async () => {
    await bind(); await login(); clock.advance(1.01);
    const old = await post('/api/auth/email/change/request', { newEmail: 'new@example.com', currentPassword: password });
    expect(old.statusCode).toBe(202); await drain();
    expect(sent.at(-1)?.to).toBe('pilot@example.com');
    const { challengeId } = old.json<{ challengeId: string }>(); const oldCode = lastCode();
    expect((await post('/api/auth/email/change/confirm-new', { challengeId, code: oldCode })).statusCode).toBe(400);
    expect((await post('/api/auth/email/change/confirm-old', { challengeId, code: oldCode })).statusCode).toBe(200);
    await drain(); expect(sent.at(-1)?.to).toBe('new@example.com');
    expect((await post('/api/auth/email/change/confirm-new', { challengeId, code: lastCode() })).statusCode).toBe(200);
    expect((await post('/api/auth/login', { identifier: 'pilot@example.com', password }, false)).statusCode).toBe(401);
    await login('new@example.com');
  });
});


describe('security failure and concurrency boundaries', () => {
  it('does not reveal reset account existence when its private attempt budget is exhausted', async () => {
    await bind(); await login(); clock.advance(1.01);
    for (let round = 0; round < 3; round++) {
      if (round > 0) clock.advance(1.01);
      const known = await post('/api/auth/password/reset/request', { email: 'pilot@example.com' }, false);
      const unknown = await post('/api/auth/password/reset/request', { email: 'unknown@example.com' }, false);
      await drain(); const wrong = lastCode() === '000000' ? '111111' : '000000';
      for (let attempt = 0; attempt < 4; attempt++) {
        const knownResult = await post('/api/auth/password/reset/complete', { challengeId: known.json<{ challengeId: string }>().challengeId, code: wrong, newPassword: 'replacement-password' }, false);
        const unknownResult = await post('/api/auth/password/reset/complete', { challengeId: unknown.json<{ challengeId: string }>().challengeId, code: wrong, newPassword: 'replacement-password' }, false);
        expect(knownResult.statusCode).toBe(400);
        expect(knownResult.json<unknown>()).toEqual(unknownResult.json<unknown>());
      }
    }
  });
  it.each(['exhausted', 'consumed', 'expired'] as const)('does not let an %s reset challenge drain the budget of a fresh request', async state => {
    await bind(); clock.advance(1.01);
    const first = await post('/api/auth/password/reset/request', { email: 'pilot@example.com' }, false);
    const { challengeId } = first.json<{ challengeId: string }>(); await drain();
    const code = lastCode(); const wrong = code === '000000' ? '111111' : '000000';
    const complete = (id: string, proof: string) => post('/api/auth/password/reset/complete', { challengeId: id, code: proof, newPassword: 'replacement-password' }, false);
    if (state === 'consumed') expect((await complete(challengeId, code)).statusCode).toBe(200);
    else if (state === 'expired') clock.advance(10.01);
    else for (let attempt = 0; attempt < 5; attempt++) expect((await complete(challengeId, wrong)).statusCode).toBe(400);
    for (let attempt = 0; attempt < 10; attempt++) expect((await complete(challengeId, wrong)).statusCode).toBe(400);
    clock.advance(1.01);
    const next = await post('/api/auth/password/reset/request', { email: 'pilot@example.com' }, false);
    expect(next.statusCode).toBe(202); await drain();
    expect((await complete(next.json<{ challengeId: string }>().challengeId, lastCode())).statusCode).toBe(200);
  });
  it('keeps candidate mail activity off public health and available on internal metrics', async () => {
    await bind(); clock.advance(1.01);
    await post('/api/auth/password/reset/request', { email: 'pilot@example.com' }, false);
    const health = await built.app.inject({ url: '/health' });
    expect(health.json<{ checks: object }>().checks).not.toHaveProperty('mail');
    const metrics = await built.app.inject({ url: '/metrics' });
    expect(metrics.statusCode).toBe(200);
    expect(metrics.json<{ mail: { queued: number } }>().mail.queued).toBe(1);
  });
  it('never stores a plaintext code and retries delivery with the same idempotency key', async () => {
    const response = await post('/api/auth/email/request', { email: 'pilot@example.com', currentPassword: password });
    expect(response.statusCode).toBe(202);
    const [queued] = await built.db.select().from(mailOutbox);
    expect(queued?.payload).not.toContain('pilot@example.com');
    expect(await built.mail.status()).toMatchObject({ queued: 1, failed: 0 });
    failures = 1; await built.mail.tick();
    expect(sent).toHaveLength(0);
    clock.advance(1); await built.mail.tick();
    expect(sendKeys).toHaveLength(2); expect(sendKeys[0]).toBe(sendKeys[1]);
    expect(sent).toHaveLength(1);
  });
  it('allows only one account to bind an address without reserving it while pending', async () => {
    const first = await request(); const firstCode = lastCode(); const firstToken = token;
    const registration = await post('/api/auth/register', { username: 'OtherCommander', password }, false);
    token = registration.json<{ accessToken: string }>().accessToken; clock.advance(1.01);
    const second = await request(); const secondCode = lastCode();
    const results = await Promise.all([
      built.app.inject({ method: 'POST', url: '/api/auth/email/verify', headers: { authorization: `Bearer ${firstToken}` }, payload: { challengeId: first.challengeId, code: firstCode } }),
      post('/api/auth/email/verify', { challengeId: second.challengeId, code: secondCode }),
    ]);
    expect(results.map(r => r.statusCode).sort()).toEqual([200, 409]);
  });
  it('invalidates the old code when resending and never sends cancelled queued proofs', async () => {
    const first = await request(); const oldCode = lastCode(); clock.advance(1.01);
    expect((await post('/api/auth/email/resend', { operationId: first.challengeId })).statusCode).toBe(200);
    expect((await post('/api/auth/email/verify', { challengeId: first.challengeId, code: oldCode })).statusCode).toBe(400);
    await post('/api/auth/email/cancel', { operationId: first.challengeId }); await drain();
    expect(sent).toHaveLength(1);
  });
  it('keeps verification separate from delivery and preserves complaint suppression on late delivery events', async () => {
    await request();
    const now = clock.now();
    await recordMailWebhook(built.db, 'delivery-one', { type: 'email.delivered', data: { email_id: 'mail-1' } }, now);
    expect((await built.db.select().from(accounts).where(eq(accounts.id, accountId)))[0]?.emailVerifiedAt).toBeNull();
    await recordMailWebhook(built.db, 'complaint-one', { type: 'email.complained', data: { email_id: 'mail-1' } }, now);
    await recordMailWebhook(built.db, 'delivery-two', { type: 'email.delivered', data: { email_id: 'mail-1' } }, now);
    expect((await built.db.select().from(mailOutbox))[0]?.status).toBe('failed');
  });
  it('requests webhook redelivery when a valid delivery event races provider acceptance persistence', async () => {
    await expect(recordMailWebhook(built.db, 'early-event', { type: 'email.delivered', data: { email_id: 'mail-1' } }, clock.now())).rejects.toMatchObject({ status: 503 });
    await request();
    await recordMailWebhook(built.db, 'early-event', { type: 'email.delivered', data: { email_id: 'mail-1' } }, clock.now());
    expect((await built.db.select().from(mailOutbox))[0]?.status).toBe('delivered');
  });
});


it('limits public send attempts by IP without revealing whether an address is registered', async () => {
  for (let i = 0; i < 20; i++) {
    const result = await post('/api/auth/password/reset/request', { email: `unknown${String(i)}@example.com` }, false);
    expect(result.statusCode).toBe(202);
  }
  expect((await post('/api/auth/password/reset/request', { email: 'another@example.com' }, false)).statusCode).toBe(429);
});


it('delivers security alerts even if a later credential change supersedes their account version', async () => {
  await built.db.transaction(tx => built.mail.queue(tx, accountId, 0, { to: 'pilot@example.com', subject: 'Security alert', text: 'Your password changed', html: '<p>Your password changed</p>' }));
  await built.db.update(accounts).set({ authVersion: 1 }).where(eq(accounts.id, accountId));
  await drain();
  expect(sent.map(message => message.subject)).toContain('Security alert');
});
