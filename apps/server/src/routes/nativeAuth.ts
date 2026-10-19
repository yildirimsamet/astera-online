import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { loginBody, registerBody } from '../auth/credentials.js';
import { authenticate, registerAccount } from '../services/account.js';
import { registerOnboardingRoutes } from './onboarding.js';

const credential = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const session = z.object({ sessionId: z.string().uuid(), refreshToken: credential });
const rotation = session.extend({ nextRefreshToken: credential }).strict()
  .refine(body => body.refreshToken !== body.nextRefreshToken, 'Rotation must use a fresh credential');

export function registerNativeAuthRoutes(app: FastifyInstance, firstGameShieldEnabled: boolean): void {
  app.addHook('onSend', (req, reply, payload, done) => {
    if (req.url.startsWith('/api/native/')) void reply.header('Cache-Control', 'no-store');
    done(null, payload);
  });
  app.post('/api/native/auth/register', { bodyLimit: 4096, config: { rateLimit: app.limits.signup } }, async req => {
    const body = registerBody.strict().parse(req.body ?? {});
    requireCurrentCommunityPolicy(body.communityPolicyVersion);
    const account = await registerAccount(app.db, body, firstGameShieldEnabled, app.clock.now());
    return app.nativeSessions.open(account);
  });
  app.post('/api/native/auth/login', { bodyLimit: 4096, config: { rateLimit: app.limits.auth } }, async req => {
    const account = await authenticate(app.db, loginBody.parse(req.body ?? {}));
    return app.nativeSessions.open(account);
  });
  app.post('/api/native/auth/refresh', { bodyLimit: 4096 }, req => app.nativeSessions.refresh(rotation.parse(req.body ?? {})));
  app.post('/api/native/auth/logout', { bodyLimit: 4096 }, async req => {
    await app.nativeSessions.logout(session.strict().parse(req.body ?? {}));
    return { ok: true };
  });
  registerOnboardingRoutes(app, firstGameShieldEnabled,
    (_app, _reply, account) => app.nativeSessions.open({ ...account, authVersion: account.authVersion ?? 0 }), '/api/native/onboarding/claim');
}
import { requireCurrentCommunityPolicy } from '../services/communityPolicy.js';
