import {
  ALL_HULLS,
  FLEET_V2_HULLS,
} from '@astera/rules';
import { z } from 'zod';

/** Zod requires a mutable non-empty tuple; rules-owned catalogs are readonly. */
const zodEnum = <T extends string>(values: readonly T[]) =>
  z.enum(values as unknown as [T, ...T[]]);

/** Every persisted/buildable hull, including preserved ground/mining hardware. */
export const allHullIdSchema = zodEnum(ALL_HULLS);

/** Every craft allowed to move; ground defence and Prospector are intentionally absent. */
export const mobileHullIdSchema = zodEnum(FLEET_V2_HULLS);

export const mobileFleetSchema = z.record(
  mobileHullIdSchema,
  z.number().int().min(0),
);

/**
 * The unauthenticated rehearsal vocabulary. Build IDs stay exhaustive so the
 * authoritative build service — not a second route catalog — owns availability.
 * Launch remains only for cached pre-queue rehearsals and uses the same mobile
 * manifest parser as every other server boundary.
 */
export const onboardingIntentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('upgrade'),
    building: z.enum(['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD']),
  }),
  z.object({
    kind: z.literal('build'),
    hull: allHullIdSchema,
    count: z.number().int().min(1).max(100),
  }),
  z.object({
    kind: z.literal('launch'),
    targetPlanetId: z.string().uuid(),
    fleet: mobileFleetSchema,
  }),
]);
