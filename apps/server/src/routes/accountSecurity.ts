import { performance } from 'node:perf_hooks';
import { randomInt } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Env } from '../env.js';
import { emailSchema } from '../auth/email.js';
import { passwordSchema } from '../auth/credentials.js';
import { securityLocales } from '../services/accountSecurity.js';
import { requireAuth } from './auth.js';
import { GameError } from '../services/planet.js';
import { recordMailWebhook, verifyMailWebhook } from '../services/mail.js';

const locale = z.enum(securityLocales).default('en');
const proof = z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }).strict();
const operationId = z.object({ operationId: z.string().uuid() }).strict();
export function registerAccountSecurityRoutes(app: FastifyInstance, env: Env): void {
  const privateOptions = { bodyLimit: 4096, preHandler: requireAuth, config: { rateLimit: app.limits.auth } };
  const publicOptions = { bodyLimit: 4096, config: { rateLimit: app.limits.auth } };
  app.addHook('onSend', (req, reply, payload, done) => {
    if (req.url.startsWith('/api/auth/')) void reply.header('Cache-Control', 'no-store');
    done(null, payload);
  });
  app.get('/api/auth/capabilities', () => app.accountSecurity.capabilities());
  app.get('/api/auth/security', { preHandler: requireAuth }, req => app.accountSecurity.status(req.accountId!));
  app.post('/api/auth/email/request', privateOptions, async (req, reply) => {
    const body = z.object({ email: emailSchema, currentPassword: z.string().min(1).max(200), locale }).strict().parse(req.body);
    await app.accountSecurity.limitSendIp(req.ip);
    const result = await app.accountSecurity.request(req.accountId!, req.authVersion!, body.email, body.currentPassword, body.locale);
    return reply.code(202).send(result);
  });
  app.post('/api/auth/email/change/request', privateOptions, async (req, reply) => {
    const body = z.object({ newEmail: emailSchema, currentPassword: z.string().min(1).max(200), locale }).strict().parse(req.body);
    await app.accountSecurity.limitSendIp(req.ip);
    const result = await app.accountSecurity.request(req.accountId!, req.authVersion!, body.newEmail, body.currentPassword, body.locale, true);
    return reply.code(202).send(result);
  });
  for (const [url, purpose] of [
    ['/api/auth/email/verify', 'bind'], ['/api/auth/email/change/confirm-old', 'change_old'], ['/api/auth/email/change/confirm-new', 'change_new'],
  ] as const) {
    app.post(url, privateOptions, async (req, reply) => {
      const body = proof.parse(req.body);
      const result = await app.accountSecurity.complete(body.challengeId, body.code, purpose, { accountId: req.accountId!, version: req.authVersion! });
      if (result.reauthenticate) void reply.clearCookie('bs_refresh', { path: '/' });
      return { ok: true, ...result };
    });
  }
  app.post('/api/auth/email/resend', privateOptions, req => {
    const { operationId: id } = operationId.parse(req.body);
    return app.accountSecurity.limitSendIp(req.ip).then(() => app.accountSecurity.resend(req.accountId!, req.authVersion!, id));
  });
  app.post('/api/auth/email/cancel', privateOptions, async req => {
    const { operationId: id } = operationId.parse(req.body); await app.accountSecurity.cancel(req.accountId!, id); return { ok: true };
  });
  app.post('/api/auth/password/reset/request', publicOptions, async (req, reply) => {
    const body = z.object({ email: emailSchema, locale }).strict().parse(req.body);
    await app.accountSecurity.limitSendIp(req.ip);
    const started = performance.now();
    const result = await app.accountSecurity.resetRequest(body.email, body.locale);
    // Provider delivery is queued; ordinary lookup differences do not set response timing.
    await delay(Math.max(0, 150 + randomInt(0, 25) - (performance.now() - started)));
    return reply.code(202).send(result);
  });
  app.post('/api/auth/password/reset/complete', publicOptions, async (req, reply) => {
    const body = proof.extend({ newPassword: passwordSchema }).parse(req.body);
    const started = performance.now();
    try {
      await app.accountSecurity.complete(body.challengeId, body.code, 'reset', undefined, body.newPassword);
      void reply.clearCookie('bs_refresh', { path: '/' }); return { ok: true, reauthenticate: true };
    } finally {
      await delay(Math.max(0, 150 + randomInt(0, 25) - (performance.now() - started)));
    }
  });
  app.register((scope, _options, done) => {
    scope.removeContentTypeParser('application/json');
    scope.addContentTypeParser('application/json', { parseAs: 'string', bodyLimit: 64 * 1024 }, (_req, body, parsed) => { parsed(null, body); });
    scope.post('/api/mail/resend/webhook', { bodyLimit: 64 * 1024 }, async req => {
      const id = req.headers['svix-id']; const timestamp = req.headers['svix-timestamp']; const signature = req.headers['svix-signature'];
      if (typeof req.body !== 'string' || typeof id !== 'string' || typeof timestamp !== 'string' || typeof signature !== 'string'
        || !verifyMailWebhook(req.body, id, timestamp, signature, env.RESEND_WEBHOOK_SECRET, app.clock.now())) {
        throw new GameError('MAIL_SIGNATURE_INVALID', 'Invalid signature', 401);
      }
      let body: unknown;
      try { body = JSON.parse(req.body); } catch { throw new GameError('INVALID_BODY', 'Invalid body', 400); }
      await recordMailWebhook(app.db, id, body, app.clock.now()); return { ok: true };
    });
    done();
  });
}
