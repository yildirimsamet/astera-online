import { CHAT, CHAT_LANGUAGES, HULLS, RESEARCH_PROJECT_IDS, STARTER_FEATURES, VESSEL_MODULES, type HullId } from '@astera/rules';
import { z } from 'zod';

export const repairBody = z.object({ module: z.enum(VESSEL_MODULES), stage: z.number().int().positive().max(20) }).strict();
export const unlockBody = z.object({ feature: z.enum(STARTER_FEATURES) }).strict();
/** No id opens every ready crate. The id's shape is checked against the table by the service. */
export const crateBody = z.object({ id: z.string().max(40).optional() }).strict();
export const orderParams = z.object({ id: z.string().uuid() });
/** The client says `targetPlanetId` because its screens do. Here it is a ship or a shared place. */
export const probeBody = z.object({ targetPlanetId: z.string().uuid(), originPlanetId: z.string().uuid().optional() }).strict();
export const watchBody = z.object({ targetPlanetId: z.string().uuid(), slot: z.number().int().min(0).max(8), observerPlanetId: z.string().uuid().optional() }).strict();

const hull = z.string().refine((id): id is HullId => id in HULLS);
const fleet = z.record(hull, z.number().int().positive().max(1000));

export const buildBody = z.object({ hull, count: z.number().int().min(1).max(1000) }).strict();
export const researchBody = z.object({ projectId: z.enum(RESEARCH_PROJECT_IDS) }).strict();
export const launchBody = z.object({
  targetPlanetId: z.string().uuid(),
  fleet,
  originPlanetId: z.string().uuid().optional(),
  acknowledgeShieldLoss: z.boolean().optional(),
}).strict();
export const miningBody = z.object({ asteroidId: z.string().regex(/^[A-Za-z0-9_-]{22}$/), craft: z.number().int().min(1).max(1000), originPlanetId: z.string().uuid().optional() }).strict();
export const harvestBody = z.object({ fieldId: z.string().uuid(), craft: z.number().int().min(1).max(1000), originPlanetId: z.string().uuid().optional() }).strict();
export const fuelBody = z.object({ amount: z.number().int().positive().max(1_000_000) }).strict();
export const migrateBody = z.object({ slot: z.number().int().min(0).max(100_000).optional() }).strict();
export const replayParams = z.object({ id: z.string().uuid() });
export const idempotencyHeader = z.string().min(1).max(200).optional();
const chatLanguage = z.enum(CHAT_LANGUAGES).default('tr');
export const blockBody = z.object({ targetPlayerId: z.string().uuid() }).strict();

export const returnSeenBody = z.object({ asOf: z.coerce.date() }).strict();

export const chatListQuery = z.object({ before: z.string().uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(50), language: chatLanguage });
export const chatPostBody = z.object({ content: z.string().trim().min(1).max(CHAT.maxChars), language: chatLanguage }).strict();
export const chatReadBody = z.object({ messageId: z.string().uuid(), language: chatLanguage }).strict();
