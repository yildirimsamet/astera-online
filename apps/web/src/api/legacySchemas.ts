import { z } from 'zod';
import { seasonCommanderProfileSchema } from './schemas.js';

const integer = z.number().int().nonnegative().safe();
const positive = integer.positive();
const category = z.enum(['SEASON', 'COMBAT', 'EXPLORATION', 'PRODUCTION', 'CLAN', 'CAREER', 'SUPPORT']);
const form = z.enum(['TROPHY', 'MEDAL', 'PIN', 'COIN', 'PLAQUE', 'MINIATURE', 'ARTIFACT']);
const scope = z.enum(['CAREER', 'SEASON', 'YEAR']);
const definition = z.object({ id: z.string(), metric: z.string(), goals: z.array(positive).min(1), category, form, scope }).strict();

export const legacyAwardSchema = z.object({
  id: z.string().uuid(), definitionId: z.string(), tier: positive, edition: z.string(), category, form,
  rarity: z.enum(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']), sourceSeasonId: z.string().uuid().nullable(),
  earnedAt: z.coerce.date().nullable(), grantedAt: z.coerce.date(),
  /** The closed season an award names, as players count seasons. */
  seasonOrdinal: positive.nullable(),
  /** A season podium's place on its ladder; every other award has none. */
  rank: positive.nullable(),
}).strict();

export const legacyProfileSchema = z.object({
  publicId: z.string().uuid(), commanderName: z.string(), country: z.string().nullable(), joinedAt: z.coerce.date(),
  portrait: z.string(), backdrop: z.string(), self: z.boolean(), activeTitle: legacyAwardSchema.nullable(),
  collection: z.object({ count: integer }).strict(),
  career: z.object({ seasons: integer, bestHonorRank: positive.nullable(), bestDominionRank: positive.nullable() }).strict(),
  showcase: z.array(z.object({ slot: integer.max(5), awardId: z.string().uuid(), award: legacyAwardSchema }).strict()).max(6),
}).strict();

export const legacyCatalogueSchema = z.object({ definitions: z.array(definition) }).strict();
export const legacyProgressSchema = z.object({ achievements: z.array(definition.extend({ progress: integer })) }).strict();
export const legacyCollectionSchema = z.object({
  awards: z.array(legacyAwardSchema.extend({ owners: positive })), nextCursor: z.string().uuid().nullable(),
}).strict();
export const legacyAwardDetailSchema = z.object({
  award: legacyAwardSchema, owners: positive,
  condition: z.object({ metric: z.string(), goal: positive, scope }).strict(),
  season: z.object({ seasonId: z.string().uuid(), ordinal: positive, galaxy: z.string(),
    startsAt: z.coerce.date(), closedAt: z.coerce.date().nullable() }).strict().nullable(),
}).strict();
export const legacySeasonsSchema = z.object({
  seasons: z.array(z.object({
    resultId: z.string().uuid(), seasonId: z.string().uuid(), ordinal: positive, galaxy: z.string(),
    startsAt: z.coerce.date(), closedAt: z.coerce.date().nullable(),
    endReason: z.enum(['SCHEDULED_END', 'FORCED_WIPE']).nullable(),
    honorRank: positive.nullable(), honorScore: z.number().int().safe().nullable(), dominionRank: positive, dominion: z.number().int().safe(),
    stats: seasonCommanderProfileSchema.shape.selected.shape.stats,
  }).strict()), nextCursor: positive.nullable(),
}).strict();

/** Pieces won and not yet watched, oldest first; `total` counts beyond the page. */
export const legacyRevealsSchema = z.object({ awards: z.array(legacyAwardSchema), total: integer }).strict();
export const legacyRevealedSchema = z.object({ revealed: integer }).strict();

export type LegacyProfile = z.infer<typeof legacyProfileSchema>;
export type LegacyAward = z.infer<typeof legacyAwardSchema>;
export type LegacyCollection = z.infer<typeof legacyCollectionSchema>;
export type LegacySeasons = z.infer<typeof legacySeasonsSchema>;
export type LegacySeason = LegacySeasons['seasons'][number];
export type LegacyAwardDetail = z.infer<typeof legacyAwardDetailSchema>;
export type LegacyProgress = z.infer<typeof legacyProgressSchema>;
export type LegacyCollectedAward = LegacyCollection['awards'][number];
