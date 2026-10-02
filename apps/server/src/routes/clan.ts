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
import { donateToClanTreasury, upgradeClanLevel } from '../services/clanTreasury.js';
import {
  cancelClanWarOperation,
  markClanWarTarget,
  quoteClanWarContribution,
  readClanWar,
  recallClanWarContribution,
  sendClanWarContribution,
  startClanWar,
} from '../services/clanWar.js';
import { idempotentMutation } from '../services/idempotency.js';
import { claimClanLoot, readClanDepot } from '../services/clanLoot.js';
import { markClanChatRead, postClanChat, readClanChat } from '../services/clanChat.js';
import { launchClanAid, quoteClanAid, readClanAid } from '../services/clanAid.js';
import { readClanStrength } from '../services/clanStrength.js';
import {
  quoteClanSupport,
  recallClanSupport,
  sendBackClanSupport,
  sendClanSupport,
} from '../services/clanSupport.js';
import { readMySupport } from '../services/clanSupportView.js';
import { requireAuth } from './auth.js';
import { mobileFleetSchema } from '../schemas/fleet.js';

const uuidParam = z.object({ clanId: z.string().uuid() }).strict();
const requestParam = z.object({ requestId: z.string().uuid() }).strict();
const contributionParam = z.object({ contributionId: z.string().uuid() }).strict();
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
  replyToMessageId: z.string().uuid().optional(),
}).strict();
const chatReadBody = z.object({ messageId: z.string().uuid() }).strict();
const emptyBody = z.object({}).strict();
const resourcesBody = z.object({
  alloy: z.number().int().min(0),
  crystal: z.number().int().min(0),
  deuterium: z.number().int().min(0),
}).strict();
/**
 * A DONATION IS WHOLE UNITS OUT OF ONE WORLD THE CALLER HOLDS.
 *
 * The ceiling is the clan's, so it is not expressible here and is checked inside
 * the transaction; what this refuses is the shape — fractions, negatives and a
 * request that moves nothing at all.
 */
const donateBody = z.object({
  planetId: z.string().uuid(),
  resources: resourcesBody,
}).strict();
/**
 * The rung the caller believes they are buying. Checked rather than trusted, so
 * two taps cannot buy two rungs and a member cannot be surprised by a level
 * somebody else's purse paid for while they were reading the screen.
 */
const upgradeBody = z.object({
  expectedLevel: z.number().int().min(1).max(9),
}).strict();
/**
 * Disbanding destroys the clan purse and nobody is refunded, so the leader has to
 * say so. Absent reads as false, which is safe: the refusal names what would burn.
 */
const disbandBody = z.object({
  acknowledgeTreasuryBurn: z.boolean().default(false),
}).strict();
/** The world the clan is going to hit. Everything else about it is server-decided. */
const warTargetBody = z.object({ targetPlanetId: z.string().uuid() }).strict();
/**
 * The leader has read that launching gives up their own shield, and said yes.
 * Only a fleetless coordinator can still be holding one by this point, but the
 * field is always accepted so the client never has to know which case it is in.
 */
const warStartBody = z.object({
  acknowledgeShieldLoss: z.boolean().default(false),
  /** The combined leg's pace; the service checks the rung against this flight. Plan §15.5a. */
  pace: z.number().positive().max(1).optional(),
}).strict();
const warQuoteBody = z.object({
  originPlanetId: z.string().uuid(),
  fleet: mobileFleetSchema,
}).strict();
/** Klan Savunma Desteği: which world sends, which clanmate world receives, and the ships. */
const supportBody = z.object({
  originPlanetId: z.string().uuid(),
  hostPlanetId: z.string().uuid(),
  fleet: mobileFleetSchema,
}).strict();
const waveParam = z.object({ waveId: z.string().uuid() }).strict();
const warContributionBody = z.object({
  originPlanetId: z.string().uuid(),
  fleet: mobileFleetSchema,
  /** The sender has read that this gives up their own shield, and said yes. */
  acknowledgeShieldLoss: z.boolean().default(false),
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

  /**
   * THE CLAN'S OWN WAR SCREEN, and members only.
   *
   * The purse, the rung and the shared hangar are what decide whether a clan's
   * next operation is worth fearing. A rival reading them would be reading the
   * clan's plan; the public profile carries `level` and nothing else.
   */
  app.get('/api/clan/war', { preHandler: requireAuth }, async (req) => {
    const actor = await clanActor(app.db, req.accountId!);
    return readClanWar(app.db, actor, app.clock.now());
  });

  /** My support waves still out — the Fleet page's "Klan desteği" group. */
  app.get('/api/clan/support', { preHandler: requireAuth }, async (req) => {
    const actor = await clanActor(app.db, req.accountId!);
    return readMySupport(app.db, actor.playerId);
  });

  /** Decides nothing: the send recomputes every figure under its own locks. */
  app.post('/api/clan/support/quote', { preHandler: requireAuth }, async (req) => {
    const body = supportBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return quoteClanSupport(app.db, {
      senderPlayerId: actor.playerId,
      ...body,
      clock: { now: () => now },
    });
  });

  app.post('/api/clan/support', { preHandler: requireAuth }, async (req) => {
    const body = supportBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.support.send',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => sendClanSupport(tx, {
      senderPlayerId: actor.playerId,
      ...body,
      clock: { now: () => now },
    }));
  });

  /** The sender turns their wave — in flight (normal recall) or standing at the host. */
  app.post('/api/clan/support/:waveId/recall', { preHandler: requireAuth }, async (req) => {
    const { waveId } = waveParam.parse(req.params);
    emptyBody.parse(req.body ?? {});
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.support.recall',
      key: idempotencyKey(req),
      body: { waveId },
      now,
    }, (tx) => recallClanSupport(tx, { playerId: actor.playerId, waveId, clock: { now: () => now } }));
  });

  /** The host sends a wave back — "Geri gönder" on the Hangar page. */
  app.post('/api/clan/support/:waveId/send-back', { preHandler: requireAuth }, async (req) => {
    const { waveId } = waveParam.parse(req.params);
    emptyBody.parse(req.body ?? {});
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.support.sendBack',
      key: idempotencyKey(req),
      body: { waveId },
      now,
    }, (tx) => sendBackClanSupport(tx, { playerId: actor.playerId, waveId, clock: { now: () => now } }));
  });

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

  app.post('/api/clan/war/target', { preHandler: requireAuth }, async (req) => {
    const body = warTargetBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.war.target',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => markClanWarTarget(tx, {
      actor,
      targetPlanetId: body.targetPlanetId,
      clock: { now: () => now },
    }));
  });

  /** Decides nothing: the dispatch recomputes every figure under its own locks. */
  app.post('/api/clan/war/contributions/quote', { preHandler: requireAuth }, async (req) => {
    const body = warQuoteBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return quoteClanWarContribution(app.db, {
      actor,
      originPlanetId: body.originPlanetId,
      fleet: body.fleet,
      clock: { now: () => now },
    });
  });

  app.post('/api/clan/war/contributions', { preHandler: requireAuth }, async (req) => {
    const body = warContributionBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.war.contribute',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => sendClanWarContribution(tx, {
      actor,
      originPlanetId: body.originPlanetId,
      fleet: body.fleet,
      acknowledgeShieldLoss: body.acknowledgeShieldLoss,
      clock: { now: () => now },
    }));
  });

  app.post('/api/clan/war/contributions/:contributionId/recall', {
    preHandler: requireAuth,
  }, async (req) => {
    const { contributionId } = contributionParam.parse(req.params);
    emptyBody.parse(req.body ?? {});
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.war.recall',
      key: idempotencyKey(req),
      body: { contributionId },
      now,
    }, (tx) => recallClanWarContribution(tx, {
      actor,
      contributionId,
      clock: { now: () => now },
    }));
  });

  app.post('/api/clan/war/start', { preHandler: requireAuth }, async (req) => {
    const body = warStartBody.parse(req.body ?? {});
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.war.start',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => startClanWar(tx, {
      actor,
      acknowledgeShieldLoss: body.acknowledgeShieldLoss,
      pace: body.pace,
      clock: { now: () => now },
    }));
  });

  app.post('/api/clan/war/cancel', { preHandler: requireAuth }, async (req) => {
    emptyBody.parse(req.body ?? {});
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.war.cancel',
      key: idempotencyKey(req),
      body: {},
      now,
    }, (tx) => cancelClanWarOperation(tx, { actor, clock: { now: () => now } }));
  });

  app.post('/api/clan/treasury/donate', { preHandler: requireAuth }, async (req) => {
    const body = donateBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.treasury.donate',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => donateToClanTreasury(tx, {
      actor,
      planetId: body.planetId,
      resources: body.resources,
      clock: { now: () => now },
    }));
  });

  app.post('/api/clan/level/upgrade', { preHandler: requireAuth }, async (req) => {
    const body = upgradeBody.parse(req.body);
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.level.upgrade',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => upgradeClanLevel(tx, {
      actor,
      expectedLevel: body.expectedLevel,
      clock: { now: () => now },
    }));
  });

  app.post('/api/clan/disband', { preHandler: requireAuth }, async (req) => {
    const body = disbandBody.parse(req.body ?? {});
    const actor = await clanActor(app.db, req.accountId!);
    const now = app.clock.now();
    return idempotentMutation(app.db, {
      playerId: actor.playerId,
      operation: 'clan.disband',
      key: idempotencyKey(req),
      body,
      now,
    }, (tx) => disbandClan(tx, {
      actor,
      now,
      acknowledgeTreasuryBurn: body.acknowledgeTreasuryBurn,
    }));
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
    }, (tx) => postClanChat(tx, { playerId: actor.playerId, content: body.content, now,
      replyToMessageId: body.replyToMessageId }))
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
