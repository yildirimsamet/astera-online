import type { FastifyInstance } from 'fastify';
import { blockBody, buildBody, crateBody, chatListQuery, chatPostBody, chatReadBody, fuelBody, harvestBody, idempotencyHeader, launchBody, migrateBody, miningBody, orderParams, probeBody, repairBody, replayParams, researchBody, returnSeenBody, unlockBody, watchBody } from '../schemas/starter.js';
import { queueServerAnalytics } from '../services/analyticsServerFacts.js';
import { GameError } from '../services/planet.js';
import { blockStarterAuthor, markStarterChatRead, postStarterChat, readStarterChat, reportStarterChat, unreadStarterChat } from '../services/starter/chat.js';
import { dockFleet } from '../services/starter/dock.js';
import { enlistVessel } from '../services/starter/enlist.js';
import { launchVesselFleet, recallVesselFleet } from '../services/starter/fleet.js';
import { arrivalOwed, departureBoard, loadFuel, markArrivalSeen, migrationView, runDeparture } from '../services/starter/migration.js';
import { launchVesselHarvest, launchVesselMining, recallVesselMining, starterMiningView } from '../services/starter/mining.js';
import { buildAtVessel, researchAtVessel } from '../services/starter/orders.js';
import { starterReplayView, starterReportsView } from '../services/starter/reports.js';
import { assignVesselWatch, starterIntelView } from '../services/starter/intel.js';
import { MainSkyReader } from '../services/starter/mainSky.js';
import { launchVesselProbe } from '../services/starter/probe.js';
import { readStarterPending, starterTrafficView } from '../services/starter/traffic.js';
import { UniverseReader } from '../services/universe.js';
import { starterGalaxyView, starterSeasonView } from '../services/starter/publicView.js';
import { closeStarterReturn, readStarterReturn } from '../services/starter/returnStory.js';
import { cancelRepair, collectAtVessel, listNotifications, markNotificationsSeen, markUnlockSeen, openCrates, orderRepair } from '../services/starter/repair.js';
import { readVessel } from '../services/starter/vessel.js';
import { requireAuth } from './auth.js';

/**
 * THE COLONY SHIP'S OWN API. Plan §5.5. These routes never read a planet, a commander or a season:
 * a ship and what it can reach live in their own tables, and that absence is what keeps the two
 * galaxies from touching (K1). Every write locks the ship and settles it first (`withVesselLock`).
 */
export function registerStarterRoutes(app: FastifyInstance): void {
  const mainSky = new MainSkyReader(app.db, app.clock);
  const universe = new UniverseReader(app.db, app.clock);

  app.post('/api/starter/enlist', { preHandler: requireAuth }, async (req) => {
    // The flag closes the door to new ships only. Whoever has one is answered with it (§7).
    if (!app.starterGalaxyEnabled) throw new GameError('STARTER_CLOSED', 'New colony ships are not open yet', 403);
    await enlistVessel(app.db, req.accountId!, app.clock, app.adminUsernames);
    return { vessel: await readVessel(app.db, req.accountId!, app.clock) };
  });

  app.get('/api/starter/vessel', { preHandler: requireAuth }, async (req) =>
    ({ vessel: await readVessel(app.db, req.accountId!, app.clock) }));

  app.get('/api/starter/season', { preHandler: requireAuth }, (req) => starterSeasonView(app.db, req.accountId!, app.clock));

  app.get('/api/starter/galaxy', { preHandler: requireAuth }, (req) => starterGalaxyView(app.db, req.accountId!, app.clock));

  app.get('/api/starter/main-sky', { preHandler: requireAuth }, async (req, reply) => {
    const { body, etag } = await mainSky.read(req.accountId!);
    // The client keeps it half an hour and then asks, and asking costs a 304.
    void reply.header('etag', etag).header('cache-control', 'private, max-age=1800');
    if (req.headers['if-none-match'] === etag) return reply.code(304).send();
    return body;
  });

  // For a commander in the main galaxy as much as for a ship: the one read both sides share.
  app.get('/api/universe', { preHandler: requireAuth }, (req) => universe.read(req.accountId!));

  app.post('/api/starter/collect', { preHandler: requireAuth }, (req) => collectAtVessel(app.db, req.accountId!, app.clock));

  app.post('/api/starter/repair', { preHandler: requireAuth }, async (req) => {
    const { module, stage } = repairBody.parse(req.body ?? {});
    return { vessel: await orderRepair(app.db, req.accountId!, module, stage, app.clock) };
  });

  app.post('/api/starter/orders/:id/cancel', { preHandler: requireAuth }, (req) => {
    const { id } = orderParams.parse(req.params);
    return cancelRepair(app.db, req.accountId!, id, app.clock);
  });

  app.post('/api/starter/unlocks/seen', { preHandler: requireAuth }, async (req) => {
    const { feature } = unlockBody.parse(req.body ?? {});
    return { vessel: await markUnlockSeen(app.db, req.accountId!, feature, app.clock) };
  });

  app.post('/api/starter/crates/open', { preHandler: requireAuth }, (req) => {
    const { id } = crateBody.parse(req.body ?? {});
    return openCrates(app.db, req.accountId!, id, app.clock);
  });

  app.post('/api/starter/probe', { preHandler: requireAuth }, (req) => {
    const { targetPlanetId } = probeBody.parse(req.body ?? {});
    return launchVesselProbe(app.db, req.accountId!, targetPlanetId, app.clock);
  });

  app.post('/api/starter/watch', { preHandler: requireAuth }, (req) => {
    const { targetPlanetId, slot } = watchBody.parse(req.body ?? {});
    return assignVesselWatch(app.db, req.accountId!, targetPlanetId, slot, app.clock);
  });

  app.get('/api/starter/intel', { preHandler: requireAuth }, (req) => starterIntelView(app.db, req.accountId!, app.clock));

  app.get('/api/starter/traffic', { preHandler: requireAuth }, (req) => starterTrafficView(app.db, req.accountId!, app.clock));

  app.get('/api/starter/pending', { preHandler: requireAuth }, (req) => readStarterPending(app.db, req.accountId!, app.clock));

  app.post('/api/starter/build', { preHandler: requireAuth }, (req) => {
    const { hull, count } = buildBody.parse(req.body ?? {});
    return buildAtVessel(app.db, req.accountId!, hull, count, app.clock);
  });

  app.post('/api/starter/research', { preHandler: requireAuth }, (req) => {
    const { projectId } = researchBody.parse(req.body ?? {});
    return researchAtVessel(app.db, req.accountId!, projectId, app.clock);
  });

  app.post('/api/starter/dock', { preHandler: requireAuth }, (req) => dockFleet(app.db, req.accountId!, app.clock));

  app.post('/api/starter/fleet/launch', { preHandler: requireAuth }, (req) => {
    const body = launchBody.parse(req.body ?? {});
    return launchVesselFleet(app.db, req.accountId!, body, idempotencyHeader.parse(req.headers['idempotency-key']), app.clock);
  });

  app.post('/api/starter/fleet/:id/recall', { preHandler: requireAuth }, (req) => {
    const { id } = orderParams.parse(req.params);
    return recallVesselFleet(app.db, req.accountId!, id, app.clock);
  });

  app.get('/api/starter/mining', { preHandler: requireAuth }, (req) => starterMiningView(app.db, req.accountId!, app.clock));

  app.post('/api/starter/mining/launch', { preHandler: requireAuth }, (req) => {
    const { asteroidId, craft } = miningBody.parse(req.body ?? {});
    return launchVesselMining(app.db, req.accountId!, asteroidId, craft, app.clock);
  });

  app.post('/api/starter/mining/harvest', { preHandler: requireAuth }, (req) => {
    const { fieldId, craft } = harvestBody.parse(req.body ?? {});
    return launchVesselHarvest(app.db, req.accountId!, fieldId, craft, app.clock);
  });

  app.post('/api/starter/mining/runs/:id/recall', { preHandler: requireAuth }, (req) => {
    const { id } = orderParams.parse(req.params);
    return recallVesselMining(app.db, req.accountId!, id, app.clock);
  });

  app.get('/api/starter/reports', { preHandler: requireAuth }, (req) => starterReportsView(app.db, req.accountId!, app.clock));

  app.get('/api/starter/reports/BATTLE/:id/replay', { preHandler: requireAuth }, (req) => {
    const { id } = replayParams.parse(req.params);
    return starterReplayView(app.db, req.accountId!, id);
  });

  app.get('/api/starter/notifications', { preHandler: requireAuth }, async (req) =>
    ({ notifications: await listNotifications(app.db, req.accountId!) }));

  app.post('/api/starter/fuel', { preHandler: requireAuth }, async (req) => {
    const { amount } = fuelBody.parse(req.body ?? {});
    return { vessel: await loadFuel(app.db, req.accountId!, amount, app.clock) };
  });

  app.get('/api/starter/migration', { preHandler: requireAuth }, (req) => migrationView(app.db, req.accountId!, app.clock));

  app.post('/api/starter/migrate', { preHandler: requireAuth }, async (req) => {
    const { slot } = migrateBody.parse(req.body ?? {});
    const landing = await runDeparture(app.db, req.accountId!, app.clock, { slot });
    // A ship's commander takes their main-galaxy seat here, so this is where the funnel says so (§5).
    queueServerAnalytics(app, req, { accountId: req.accountId!, name: 'placement_completed', refId: landing.placement.playerId });
    return landing;
  });

  app.get('/api/starter/departures', { preHandler: requireAuth }, (req) => departureBoard(app.db, req.accountId!));

  // Asked from the main game after the landing: the account has no ship left to go through.
  app.get('/api/starter/arrival', { preHandler: requireAuth }, (req) => arrivalOwed(app.db, req.accountId!));

  app.post('/api/starter/arrival/seen', { preHandler: requireAuth }, async (req) => {
    await markArrivalSeen(app.db, req.accountId!, app.clock);
    return { ok: true };
  });

  app.get('/api/starter/return', { preHandler: requireAuth }, (req) => readStarterReturn(app.db, req.accountId!, app.clock));

  app.post('/api/starter/return/seen', { preHandler: requireAuth }, async (req) => {
    const { asOf } = returnSeenBody.parse(req.body ?? {});
    await closeStarterReturn(app.db, req.accountId!, asOf, app.clock);
    return { ok: true as const };
  });

  app.get('/api/starter/chat/messages', { preHandler: requireAuth }, (req) => {
    const { limit, language, before } = chatListQuery.parse(req.query);
    return readStarterChat(app.db, req.accountId!, limit, language, before);
  });

  app.post('/api/starter/chat/messages', { preHandler: requireAuth }, async (req) => {
    const { content, language } = chatPostBody.parse(req.body ?? {});
    return { message: await postStarterChat(app.db, req.accountId!, content, language, app.clock) };
  });

  app.get('/api/starter/chat/unread', { preHandler: requireAuth }, async (req) => ({
    count: await unreadStarterChat(app.db, req.accountId!, chatListQuery.parse(req.query).language),
  }));

  app.post('/api/starter/chat/read', { preHandler: requireAuth }, async (req) => {
    const { messageId } = chatReadBody.parse(req.body ?? {});
    return { ok: true as const, readAt: await markStarterChatRead(app.db, req.accountId!, messageId) };
  });

  app.post('/api/starter/chat/report', { preHandler: requireAuth }, (req) => reportStarterChat(app.db, req.accountId!, req.body, app.clock));

  app.post('/api/starter/chat/block', { preHandler: requireAuth }, (req) => {
    const { targetPlayerId } = blockBody.parse(req.body ?? {});
    return blockStarterAuthor(app.db, req.accountId!, targetPlayerId, app.clock);
  });

  app.post('/api/starter/notifications/seen', { preHandler: requireAuth }, async (req) => {
    return { marked: await markNotificationsSeen(app.db, req.accountId!) };
  });
}
