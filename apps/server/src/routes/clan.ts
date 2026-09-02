import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  acceptClanRequest,
  applyToClan,
  clanActor,
  clanLeaderboard,
  closeClanRequest,
  createClan,
  disbandClan,
  inviteToClan,
  kickClanMember,
  leaveClan,
  listPublicClans,
  markClanSeen,
  publicClan,
  readClanBadge,
  readClanEvents,
  readClanHome,
  setClanAidPolicy,
  transferClanLeadership,
  updateClanSettings,
} from '../services/clan.js';
import { idempotentMutation } from '../services/idempotency.js';
import { claimClanLoot, readClanDepot } from '../services/clanLoot.js';
import { markClanChatRead, postClanChat, readClanChat } from '../services/clanChat.js';
import { launchClanAid, quoteClanAid, readClanAid } from '../services/clanAid.js';
import { readClanStrength } from '../services/clanStrength.js';
import { requireAuth } from './auth.js';
import { mobileFleetSchema } from '../schemas/fleet.js';

const uuidParam = z.object({ clanId: z.string().uuid() }).strict();
const requestParam = z.object({ requestId: z.string().uuid() }).strict();
const listQuery = z.object({
  search: z.string().trim().max(40).optional(),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(30),
}).strict();
const cursorQuery = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
}).strict();
const createBody = z.object({
  name: z.string().min(1).max(80),
  tag: z.string().min(1).max(20),
  description: z.string().max(400).default(''),
  recruiting: z.boolean().default(true),
}).strict();
const playerBody = z.object({ playerId: z.string().uuid() }).strict();
const acceptBody = z.object({ acknowledgeHostile: z.boolean().default(false) }).strict();
const settingsBody = z.object({
  description: z.string().max(400),
  recruiting: z.boolean(),
}).strict();
const aidPolicyBody = z.object({ enabled: z.boolean() }).strict();
const messageBody = z.object({
  content: z.string().transform((value) => value.trim()).pipe(z.string().min(1).max(560)),
}).strict();
const chatReadBody = z.object({ messageId: z.string().uuid() }).strict();
const emptyBody = z.object({}).strict();
const resourcesBody = z.object({
  alloy: z.number().int().min(0),
  crystal: z.number().int().min(0),
  deuterium: z.number().int().min(0),
}).strict();
const aidBody = z.object({
  originPlanetId: z.string().uuid(),
  recipientPlayerId: z.string().uuid(),
  targetPlanetId: z.string().uuid(),
  fleet: mobileFleetSchema,
  cargo: resourcesBody,
}).strict();

function idempotencyKey(req: FastifyRequest): string {
  const parsed = z.string().min(8).max(128).safeParse(req.headers['idempotency-key']);
  if (!parsed.success) {
    // A Zod error keeps malformed route input in the common BAD_REQUEST path.
    return z.string().min(8).max(128).parse(req.headers['idempotency-key']);
  }
  return parsed.data;
}

async function mutate<T>(
  app: FastifyInstance,
  req: FastifyRequest,
  operation: string,
  body: unknown,
  action: Parameters<typeof idempotentMutation<T>>[2],
): Promise<T> {
  const actor = await clanActor(app.db, req.accountId!);
  return idempotentMutation(app.db, {
    playerId: actor.playerId,
    operation,
    key: idempotencyKey(req),
    body,
    now: app.clock.now(),
  }, action);
}

export function registerClanRoutes(app: FastifyInstance): void {
  app.get('/api/clan/badge', { preHandler: requireAuth }, async (req) =>
    readClanBadge(app.db, req.accountId!, app.clock.now()));

  app.get('/api/clan/me', { preHandler: requireAuth }, async (req) =>
    readClanHome(app.db, req.accountId!, app.clock.now()));

  app.get('/api/clan/strength', { preHandler: requireAuth }, async (req) =>
    readClanStrength(app.db, req.accountId!));

  app.get('/api/clans', { preHandler: requireAuth }, async (req) =>
    listPublicClans(app.db, req.accountId!, listQuery.parse(req.query)));

  app.get('/api/clans/leaderboard', { preHandler: requireAuth }, async (req) =>
    clanLeaderboard(app.db, req.accountId!));

  app.get('/api/clans/:clanId', { preHandler: requireAuth }, async (req) => {
    const { clanId } = uuidParam.parse(req.params);
    return publicClan(app.db, req.accountId!, clanId);
  });

  app.get('/api/clan/events', { preHandler: requireAuth }, async (req) =>
    readClanEvents(app.db, req.accountId!, {
      ...cursorQuery.parse(req.query),
      now: app.clock.now(),
    }));

  app.get('/api/clan/depot', { preHandler: requireAuth }, async (req) =>
    readClanDepot(app.db, req.accountId!));

  app.get('/api/clan/aid', { preHandler: requireAuth }, async (req) =>
    readClanAid(app.db, req.accountId!));

  app.get('/api/clan/chat', { preHandler: requireAuth }, async (req) =>
    readClanChat(app.db, req.accountId!, {
      ...cursorQuery.parse(req.query),
      now: app.clock.now(),
    }));

  app.post('/api/clan/aid/quote', { preHandler: requireAuth }, async (req) => {
    const body = aidBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    return quoteClanAid(app.db, {
      senderPlayerId: actor.playerId,
      ...body,
      now: app.clock.now(),
    });
  });

  app.post('/api/clan/create', { preHandler: requireAuth }, async (req) => {
    const body = createBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.create',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => createClan(tx, {
      actor,
      ...body,
      clock: { now: () => now },
    }));
  });

  app.post('/api/clans/:clanId/apply', { preHandler: requireAuth }, async (req) => {
    const { clanId } = uuidParam.parse(req.params);
    emptyBody.parse(req.body ?? {});
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.apply',
      key: idempotencyKey(req),
      body: { clanId },
      now,
    }, (tx) => applyToClan(tx, { actor, clanId, now }));
  });

  app.post('/api/clan/invite', { preHandler: requireAuth }, async (req) => {
    const body = playerBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.invite',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => inviteToClan(tx, { actor, playerId: body.playerId, now }));
  });

  app.post('/api/clan/requests/:requestId/accept', { preHandler: requireAuth }, async (req) => {
    const { requestId } = requestParam.parse(req.params);
    const body = acceptBody.parse(req.body ?? {});
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.request.accept',
      key: idempotencyKey(req),
      body: { requestId, ...body },
      now,
    }, (tx) => acceptClanRequest(tx, { actor, requestId, ...body, now }));
  });

  for (const action of ['reject', 'withdraw'] as const) {
    app.post(`/api/clan/requests/:requestId/${action}`, { preHandler: requireAuth }, async (req) => {
      const { requestId } = requestParam.parse(req.params);
      emptyBody.parse(req.body ?? {});
      const actor = await clanActor(app.db, req.accountId!);
      const now = app.clock.now();
      return idempotentMutation(app.db, {
        playerId: actor.playerId,
        operation: `clan.request.${action}`,
        key: idempotencyKey(req),
        body: { requestId },
        now,
      }, (tx) => closeClanRequest(tx, {
        actor,
        requestId,
        action: action === 'reject' ? 'REJECT' : 'WITHDRAW',
        now,
      }));
    });
  }

  app.post('/api/clan/leave', { preHandler: requireAuth }, async (req) => {
    emptyBody.parse(req.body ?? {});
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.leave',
      key: idempotencyKey(req),
      body: {},
      now,
    }, (tx) => leaveClan(tx, { actor, now }));
  });

  app.post('/api/clan/kick', { preHandler: requireAuth }, async (req) => {
    const body = playerBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.kick',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => kickClanMember(tx, { actor, playerId: body.playerId, now }));
  });

  app.post('/api/clan/leadership', { preHandler: requireAuth }, async (req) => {
    const body = playerBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.leadership',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => transferClanLeadership(tx, { actor, playerId: body.playerId, now }));
  });

  app.post('/api/clan/settings', { preHandler: requireAuth }, async (req) => {
    const body = settingsBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.settings',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => updateClanSettings(tx, { actor, ...body, now }));
  });

  app.post('/api/clan/aid-policy', { preHandler: requireAuth }, async (req) => {
    const body = aidPolicyBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.aid-policy',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => setClanAidPolicy(tx, { actor, enabled: body.enabled, now }));
  });

  app.post('/api/clan/disband', { preHandler: requireAuth }, async (req) => {
    emptyBody.parse(req.body ?? {});
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.disband',
      key: idempotencyKey(req),
      body: {},
      now,
    }, (tx) => disbandClan(tx, { actor, now }));
  });

  app.post('/api/clan/depot/claim', { preHandler: requireAuth }, async (req) => {
    emptyBody.parse(req.body ?? {});
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.depot.claim',
      key: idempotencyKey(req),
      body: {},
      now,
    }, (tx) => claimClanLoot(tx, { playerId: actor.playerId, clock: { now: () => now } }));
  });

  app.post('/api/clan/aid/launch', { preHandler: requireAuth }, async (req) => {
    const body = aidBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.aid.launch',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => launchClanAid(tx, {
      senderPlayerId: actor.playerId,
      ...body,
      clock: { now: () => now },
    }));
  });

  app.post('/api/clan/chat/messages', { preHandler: requireAuth }, async (req) => {
    const body = messageBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.chat.post',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => postClanChat(tx, { playerId: actor.playerId, content: body.content, now }))
      .then((message) => ({ message }));
  });

  app.post('/api/clan/chat/read', { preHandler: requireAuth }, async (req) => {
    const body = chatReadBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.chat.read',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => markClanChatRead(tx, {
      playerId: actor.playerId,
      messageId: body.messageId,
      now,
    }))
      .then((readAt) => ({ readAt }));
  });

  app.post('/api/clan/read', { preHandler: requireAuth }, async (req) => {
    emptyBody.parse(req.body ?? {});
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return mutate(app, req, 'clan.read', {}, (tx) => markClanSeen(tx, actor.playerId, now))
      .then((readAt) => ({ readAt }));
  });
}
