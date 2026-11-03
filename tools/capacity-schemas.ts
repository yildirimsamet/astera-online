import {
  activeGalaxyEventsSchema, announcementsPageSchema, brandRecallSchema, buildSchema, chatPageSchema, chatPostSchema,
  chatUnreadSchema, chroniclePageSchema, clanBadgeSchema, collectSchema, dmConversationsSchema, galaxySchema, intelSchema,
  launchSchema, leaderboardSchema, maintenanceWindowSchema, markedSchema, meSchema, miningFieldSchema, miningLaunchSchema,
  miningStatusSchema, monumentsSchema, mySupportSchema, notificationsSchema, pendingSchema, piratesSchema, planetSchema,
  planetsSchema, probeSchema, reportsSchema, returnSchema, returnSeenSchema, returnStatusSchema, rewardsSchema, seasonSchema,
  serverListSchema, sessionSchema, skinCollectionSchema, trafficSchema, unknownSignalsSchema, upgradeSchema,
} from '../apps/web/src/api/schemas.js';
import { commanderShipSchema } from '../apps/web/src/api/commanderShipSchemas.js';
import { communityPolicyStatusSchema } from '../apps/web/src/api/communityPolicySchemas.js';
import { legacyRevealsSchema } from '../apps/web/src/api/legacySchemas.js';

/**
 * The capacity runner exercises the same wire contracts as the browser. Keeping a
 * second set of hand-written shape checks would drift; importing the production client
 * schemas makes a 200 with the wrong payload a failed run.
 */
export const ROUTE_SCHEMAS = new Map<string, { safeParse: (body: unknown) => { success: boolean } }>([
  ['POST /api/auth/login', sessionSchema],
  ['POST /api/auth/refresh', sessionSchema],
  ['GET /api/auth/me', meSchema],
  ['GET /api/season', seasonSchema],
  ['GET /api/planet', planetSchema],
  ['GET /api/planets', planetsSchema],
  ['GET /api/planets/:id', planetSchema],
  ['GET /api/galaxy', galaxySchema],
  ['GET /api/galaxy/traffic', trafficSchema],
  ['GET /api/galaxy/events', activeGalaxyEventsSchema],
  ['GET /api/leaderboard', leaderboardSchema],
  ['GET /api/intel', intelSchema],
  ['GET /api/notifications', notificationsSchema],
  ['GET /api/session/pending', pendingSchema],
  ['GET /api/session/brand-recall', brandRecallSchema],
  ['GET /api/session/return', returnSchema],
  ['GET /api/reports', reportsSchema],
  ['GET /api/mining/field', miningFieldSchema],
  ['GET /api/mining/status', miningStatusSchema],
  ['GET /api/pirates', piratesSchema],
  ['GET /api/rewards', rewardsSchema],
  ['GET /api/skins', skinCollectionSchema],
  ['GET /api/monuments', monumentsSchema],
  ['GET /api/unknown-signals', unknownSignalsSchema],
  ['GET /api/return-applications', returnStatusSchema],
  ['GET /api/commander-ship', commanderShipSchema],
  ['GET /api/legacy/me/reveals', legacyRevealsSchema],
  ['GET /api/maintenance', maintenanceWindowSchema],
  ['GET /api/servers', serverListSchema],
  ['GET /api/clan/badge', clanBadgeSchema],
  ['GET /api/clan/support', mySupportSchema],
  ['GET /api/community/policy', communityPolicyStatusSchema],
  ['GET /api/announcements', announcementsPageSchema],
  ['GET /api/chat/messages', chatPageSchema],
  ['POST /api/chat/messages', chatPostSchema],
  ['GET /api/chat/unread', chatUnreadSchema],
  ['GET /api/dm/unread', chatUnreadSchema],
  ['GET /api/dm/conversations', dmConversationsSchema],
  ['GET /api/chronicle', chroniclePageSchema],
  ['POST /api/fleet/launch', launchSchema],
  ['POST /api/planet/collect', collectSchema],
  ['POST /api/planets/:id/collect', collectSchema],
  ['POST /api/planet/build', buildSchema],
  ['POST /api/planets/:id/build', buildSchema],
  ['POST /api/planets/:id/upgrade', upgradeSchema],
  ['POST /api/intel/probe', probeSchema],
  ['POST /api/session/return/seen', returnSeenSchema],
  ['POST /api/notifications/seen', markedSchema],
  ['POST /api/mining/launch', miningLaunchSchema],
  ['POST /api/mining/harvest', miningLaunchSchema],
]);
