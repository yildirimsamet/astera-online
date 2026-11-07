import { z } from 'zod';
import { analyticsPropertiesSchema, analyticsCampaignSchema } from './analyticsSchemas.js';
const filterCode = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_.:-]+$/);
export const analyticsFiltersSchema = z.object({ build: filterCode.optional(), locale: filterCode.optional(),
  trainingVersion: filterCode.optional(), platform: z.enum(['web', 'android', 'ios']).optional(),
  source: analyticsCampaignSchema.shape.utm_source });
export const analyticsAdminQuerySchema = analyticsFiltersSchema.extend({
  after: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(10),
  inactiveHours: z.coerce.number().pipe(z.union([z.literal(0), z.literal(24), z.literal(48), z.literal(72)])).default(24),
  username: z.string().trim().min(1).max(128).optional(),
}).strict();
export type AnalyticsFilters = z.infer<typeof analyticsFiltersSchema>;
const retention = z.object({ mature: z.boolean(), returned: z.boolean().nullable() });
const visitAttribution = z.object({ at: z.coerce.date(), build: z.string(), platform: z.string(), locale: z.string(), campaign: analyticsCampaignSchema }).nullable().default(null);
const cohortWindow = z.object({ mature: z.number(), returned: z.number(), pending: z.number() });
const lastEvidence = z.object({ name: z.string(), at: z.number(), mode: z.enum(['training', 'live', 'replay', 'arena']),
  source: z.enum(['client_observation', 'server_fact']), properties: analyticsPropertiesSchema }).nullable().default(null);
export const playerObservationSummarySchema = z.object({
  lastObservation: lastEvidence, lastSurface: lastEvidence, lastCommand: lastEvidence, lastBlocker: lastEvidence, lastOutcome: lastEvidence,
  foregroundMs: z.number(), interactionMs: z.number(), firstReadyAt: z.number().nullable(), commands: z.number(), untrusted: z.number(),
  sessions: z.array(z.object({ start: z.number(), end: z.number(), ending: z.enum(['open', 'observed_background', 'inferred_timeout']) })),
  lastTraining: z.object({ step: z.number().nullable(), scene: z.string().nullable(), at: z.number() }).nullable(),
  retention: z.object({ d1: retention, d3: retention, d7: retention }),
  return24h: retention.default({ mature: false, returned: null }),
  manualRetention: z.object({ d1: retention, d3: retention, d7: retention }).default({
    d1: { mature: false, returned: null }, d3: { mature: false, returned: null }, d7: { mature: false, returned: null } }),
});
const nonnegativeCount = z.number().int().nonnegative();
export const starterFunnelSchema = z.object({
  accounts: nonnegativeCount, sessions: nonnegativeCount, returnedAccounts: nonnegativeCount,
  steps: z.array(z.object({ scene: z.string(), accounts: nonnegativeCount, dropoff: nonnegativeCount })),
  push: z.object({ asked: nonnegativeCount, granted: nonnegativeCount, denied: nonnegativeCount }),
  crates: z.object({ accounts: nonnegativeCount, opened: nonnegativeCount }),
});
export const analyticsAdminSchema = z.object({
  starter: starterFunnelSchema.optional(),
  measuredAt: z.coerce.date(), windowStart: z.coerce.date(), nextAfter: z.string().uuid().nullable(),
  quality: z.object({ totalAccounts: z.number(), measuredAccounts: z.number(), visits: z.number(), untrusted: z.number() }),
  landing: z.object({ visibleVisits: z.number(), playVisits: z.number(), loginVisits: z.number(), loadFailedVisits: z.number(), trainingVisits: z.number() }),
  cohorts: z.array(z.object({ platform: z.string(), build: z.string(), locale: z.string(), source: z.string().nullable(), visits: z.number(), accounts: z.number(),
    anchorAccounts: z.number().default(0), retention: z.object({ d1: cohortWindow, d3: cohortWindow, d7: cohortWindow }).optional() })),
  cohortsTruncated: z.boolean(),
  daily: z.array(z.object({ day: z.coerce.date(), name: z.string(), mode: z.enum(['training', 'live', 'replay', 'arena']), events: z.number(), visitors: z.number() })),
  steps: z.array(z.object({ step: z.number(), attempts: z.number() })),
  players: z.array(z.object({ accountId: z.string().uuid(), username: z.string(), lastActiveAt: z.coerce.date().nullable(),
    firstVisit: visitAttribution, currentVisit: visitAttribution,
    lastProgressAt: z.coerce.date().nullable(), galaxy: z.string().nullable(),
    coverage: z.enum(['observed', 'unmeasured']), truncated: z.boolean(), summary: playerObservationSummarySchema.nullable() })),
});
export const analyticsTimelineSchema = z.object({
  nextBefore: z.object({ at: z.string(), id: z.string().uuid() }).nullable(),
  events: z.array(z.object({ id: z.string().uuid(), name: z.string(), mode: z.enum(['training', 'live', 'replay', 'arena']),
    source: z.enum(['client_observation', 'server_fact']), occurredAt: z.coerce.date(), receivedAt: z.coerce.date(),
    timeTrusted: z.boolean(), contextId: z.string().uuid(), sessionId: z.string().uuid(), properties: analyticsPropertiesSchema })),
});
export type AnalyticsAdminReport = z.infer<typeof analyticsAdminSchema>;
export type AnalyticsTimeline = z.infer<typeof analyticsTimelineSchema>;
export const anonymousVisitsSchema = z.object({ nextAfter: z.string().uuid().nullable(), visits: z.array(z.object({
  id: z.string().uuid(), createdAt: z.coerce.date(), metadata: z.object({ build: z.string(), platform: z.string(), locale: z.string(), campaign: analyticsCampaignSchema }),
})) });
