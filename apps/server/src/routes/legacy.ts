import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LEGACY_CATALOGUE } from '@astera/rules';
import { requireAuth } from './auth.js';
import { deferLegacyRefresh, ensureLegacyProfile, equipLegacyShowcase, equipLegacyTitle, legacyProgress, restoreLegacyAward, revealLegacyAwards, revokeLegacyAward } from '../services/legacy.js';
import { legacyAwardAudit, legacyAwardView, legacyCollectionView, legacyIdentity, legacyPlayerAccount, legacyProfileView, legacyResultAccount, legacyRevealsView, legacySeasonsView } from '../services/legacyView.js';
import { syncLegacyMonumentDuty } from '../services/legacyMonument.js';
import { requireAdmin } from './community.js';

const profileParams = z.object({ publicId: z.string().uuid() });
const collectionQuery = z.object({ limit: z.coerce.number().int().min(1).max(48).default(24), cursor: z.string().uuid().optional() }).strict();

export function registerLegacyRoutes(app: FastifyInstance): void {
  /** Re-reads the whole ledger: every goal crossed so far becomes a piece before anything is shown. */
  const evaluate = async (accountId: string) => {
    const at = app.clock.now();
    const profile = await ensureLegacyProfile(app.db, accountId);
    await app.db.transaction(async tx => {
      await syncLegacyMonumentDuty(tx, { accountId, at, adminUsernames: [...app.adminUsernames] });
      deferLegacyRefresh(tx, accountId, at);
    });
    return profile;
  };
  const profileFor = async (accountId: string, viewerId: string) =>
    legacyProfileView(app.db, (await evaluate(accountId)).publicId, viewerId);
  app.get('/api/admin/legacy/profiles/:publicId/awards', { preHandler: requireAdmin }, req => {
    const { publicId } = profileParams.parse(req.params);
    const { limit, cursor } = collectionQuery.parse(req.query);
    return legacyAwardAudit(app.db, publicId, limit, cursor);
  });
  app.post('/api/admin/legacy/awards/:awardId/restore', { preHandler: requireAdmin }, async req => {
    const { awardId } = z.object({ awardId: z.string().uuid() }).parse(req.params);
    const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).strict().parse(req.body);
    await restoreLegacyAward(app.db, req.accountId!, awardId, reason, app.clock.now());
    return { ok: true };
  });
  app.post('/api/admin/legacy/awards/:awardId/revoke', { preHandler: requireAdmin }, async req => {
    const { awardId } = z.object({ awardId: z.string().uuid() }).parse(req.params);
    const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).strict().parse(req.body);
    await revokeLegacyAward(app.db, req.accountId!, awardId, reason, app.clock.now());
    return { ok: true };
  });
  app.addHook('onRequest', (req, reply, done) => {
    if (req.url.startsWith('/api/legacy/') || req.url.startsWith('/api/admin/legacy/')) void reply.header('Cache-Control', 'private, no-store');
    done();
  });
  app.get('/api/legacy/me', { preHandler: requireAuth }, req => profileFor(req.accountId!, req.accountId!));
  app.get('/api/legacy/catalogue', { preHandler: requireAuth }, () => ({ definitions: LEGACY_CATALOGUE }));
  app.get('/api/legacy/me/progress', { preHandler: requireAuth }, async req => {
    const at = app.clock.now();
    await app.db.transaction(tx => syncLegacyMonumentDuty(tx, { accountId: req.accountId!, at, adminUsernames: [...app.adminUsernames] }));
    return { achievements: await legacyProgress(app.db, req.accountId!, at) };
  });
  app.get('/api/legacy/profiles/:publicId', { preHandler: requireAuth }, async req => {
    const identity = await legacyIdentity(app.db, profileParams.parse(req.params).publicId);
    return profileFor(identity.accountId, req.accountId!);
  });
  app.get('/api/legacy/players/:playerId', { preHandler: requireAuth }, async req => {
    const { playerId } = z.object({ playerId: z.string().uuid() }).parse(req.params);
    const accountId = await legacyPlayerAccount(app.db, playerId);
    return profileFor(accountId, req.accountId!);
  });
  app.get('/api/legacy/results/:resultId', { preHandler: requireAuth }, async req => {
    const { resultId } = z.object({ resultId: z.string().uuid() }).parse(req.params);
    return profileFor(await legacyResultAccount(app.db, resultId), req.accountId!);
  });
  app.get('/api/legacy/profiles/:publicId/collection', { preHandler: requireAuth }, req => {
    const { publicId } = profileParams.parse(req.params);
    const { limit, cursor } = collectionQuery.parse(req.query);
    return legacyCollectionView(app.db, publicId, limit, cursor);
  });
  app.get('/api/legacy/profiles/:publicId/awards/:awardId', { preHandler: requireAuth }, req => {
    const { publicId, awardId } = profileParams.extend({ awardId: z.string().uuid() }).parse(req.params);
    return legacyAwardView(app.db, publicId, awardId);
  });
  app.get('/api/legacy/profiles/:publicId/seasons', { preHandler: requireAuth }, req => {
    const { publicId } = profileParams.parse(req.params);
    const query = z.object({ limit: z.coerce.number().int().min(1).max(24).default(12),
      cursor: z.coerce.number().int().positive().max(2_147_483_647).optional() }).strict().parse(req.query);
    return legacySeasonsView(app.db, publicId, query.limit, query.cursor);
  });
  /**
   * THE REVEAL QUEUE. A piece stays here until its owner has watched it, so one won offline is
   * revealed at the next visit and none is revealed twice. Polling reads the queue only; the
   * first read of a session asks for `refresh=1`, which evaluates the ledger first.
   */
  app.get('/api/legacy/me/reveals', { preHandler: requireAuth }, async req => {
    const { refresh } = z.object({ refresh: z.literal('1').optional() }).strict().parse(req.query);
    if (refresh) await evaluate(req.accountId!);
    return legacyRevealsView(app.db, req.accountId!);
  });
  app.post('/api/legacy/me/reveals', { preHandler: requireAuth }, async req => {
    const { awardIds } = z.object({ awardIds: z.array(z.string().uuid()).max(50) }).strict().parse(req.body);
    return { revealed: await revealLegacyAwards(app.db, req.accountId!, awardIds, app.clock.now()) };
  });
  app.put('/api/legacy/me/showcase', { preHandler: requireAuth }, async req => {
    const { awardIds } = z.object({ awardIds: z.array(z.string().uuid()).max(6) }).strict().parse(req.body);
    await equipLegacyShowcase(app.db, req.accountId!, awardIds);
    return { ok: true };
  });
  app.put('/api/legacy/me/title', { preHandler: requireAuth }, async req => {
    const { awardId } = z.object({ awardId: z.string().uuid().nullable() }).strict().parse(req.body);
    await equipLegacyTitle(app.db, req.accountId!, awardId);
    return { ok: true };
  });
}
