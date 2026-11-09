import { HULLS, STARTER_FEATURES, VESSEL_FACTS, VESSEL_HULLS, VESSEL_MODULES, type HullId } from '@astera/rules';
import { z } from 'zod';

const vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() });
const motion = z.object({
  origin: vec3, epochMs: z.number().finite(), periodYMs: z.number().finite().positive(), periodXMs: z.number().finite().positive(), stopAtMs: z.number().finite().optional(),
});
const resources = z.object({ alloy: z.number(), crystal: z.number(), deuterium: z.number() });
const vesselModule = z.enum(VESSEL_MODULES);
const vesselFact = z.enum(VESSEL_FACTS);
const hullId = z.string().refine((id): id is HullId => id in HULLS);
const feature = z.enum(STARTER_FEATURES);

/** What `/api/auth/me` says about a ship: enough to route a session, nothing to play with. */
export const vesselStandingSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['ACTIVE', 'DORMANT', 'DEPARTING']),
  starterGalaxyId: z.string(),
});

export const vesselOrderSchema = z.object({
  id: z.string(),
  queue: z.enum(['CONSTRUCTION', 'YARD', 'DOCK', 'RESEARCH']),
  /** A module under repair, a hull in the yard, a research project, or the station's one job. */
  subject: z.string(),
  stage: z.number().int().positive(),
  count: z.number().int().positive(),
  startedAt: z.coerce.date(),
  readyAt: z.coerce.date(),
  cost: resources,
});

/** The owner's view of their ship. Never sent for anyone else's. */
export const vesselSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['ACTIVE', 'DORMANT', 'DEPARTING']),
  galaxy: z.object({ id: z.string(), epoch: z.coerce.date(), ordinal: z.number().int().positive() }),
  /** When this ship gives up its place, with no progress before then. */
  quietAt: z.coerce.date(),
  position: vec3,
  alloy: z.number(),
  crystal: z.number(),
  deuterium: z.number(),
  bufferAlloy: z.number(),
  bufferCrystal: z.number(),
  bufferDeuterium: z.number(),
  shield: z.number(),
  lastTickMinutes: z.number(),
  modules: z.record(vesselModule, z.number()),
  research: z.record(z.string(), z.number()),
  facts: z.array(vesselFact),
  parts: z.number().int().nonnegative(),
  fuel: z.number().nonnegative(),
  pvpOpenAt: z.coerce.date().nullable(),
  recoveryUntil: z.coerce.date().nullable(),
  progress: z.object({ done: z.number(), total: z.number(), share: z.number() }),
  features: z.array(feature),
  unlockToAnnounce: feature.nullable(),
  /** The salvage crates (retention plan §6.2): sealed until their repair is done, then ready, then opened. */
  crates: z.array(z.object({
    id: z.string(), module: vesselModule, stage: z.number().int().positive(),
    /** The act it also waits for (N9); an older server sends only repairs' crates. */
    fact: vesselFact.nullable().default(null),
    alloy: z.number().nonnegative(), crystal: z.number().nonnegative(), state: z.enum(['sealed', 'ready', 'opened']),
  })).default([]),
  queue: z.array(vesselOrderSchema),
  fleet: z.record(z.string(), z.number()),
  damage: z.array(z.object({ hull: hullId, count: z.number().int().positive(), damageBp: z.number().int().min(0).max(9999), remainderBp: z.number().optional() })).default([]),
  jumpFuel: z.number(),
  /** Attack bays in the air right now. */
  flying: z.number().int().nonnegative().default(0),
});
export type VesselView = z.infer<typeof vesselSchema>;

export const vesselAnswerSchema = z.object({ vessel: vesselSchema });
/** A write's own answer beside the ship, which the transport turns into the world the screen asked for. */
export const vesselDeckSchema = z.object({ vessel: vesselSchema }).passthrough();

export const vesselCollectSchema = z.object({ vessel: vesselSchema, moved: resources, blocked: resources });
export const vesselCancelSchema = z.object({ vessel: vesselSchema, refund: resources });
export const vesselCratesSchema = z.object({ vessel: vesselSchema, opened: z.array(z.string()) });

/** The main galaxy as a picture: positions, flat and rounded, and no identity at all (K1). */
export const mainSkySchema = z.object({
  points: z.array(z.number()),
  worlds: z.number().int().nonnegative(),
  server: z.string(),
  seasonEndsAt: z.coerce.date().nullable(),
  monuments: z.array(z.object({ position: vec3, motion: motion.optional(), difficulty: z.enum(['LEGACY', 'EASY', 'HARD']), ordinal: z.number().int().min(1).max(8) })),
  clouds: z.array(z.object({
    mode: z.enum(['EMIT', 'SHELTER']),
    center: vec3,
    motion: motion.optional(),
    radius: z.number().positive(),
    intensityHpPerMinute: z.number().nonnegative(),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  })),
});
export type MainSky = z.infer<typeof mainSkySchema>;

export const universeSchema = z.object({
  galaxies: z.array(z.object({ ordinal: z.number().int().positive(), ships: z.number().int().nonnegative() })),
  mine: z.number().int().positive().nullable(),
});
export type UniverseView = z.infer<typeof universeSchema>;

const moved = resources.extend({ fleet: z.record(hullId, z.number()) });

/** The drive panel, before the press. Plan §3.8. */
export const migrationViewSchema = z.object({
  block: z.discriminatedUnion('code', [
    z.object({ code: z.literal('MIGRATION_NOT_READY') }),
    z.object({ code: z.literal('NO_FRONTIER') }),
    z.object({ code: z.literal('MIGRATION_FLEET_OUT'), flying: z.number() }),
    z.object({ code: z.literal('MIGRATION_SEASON_WAIT'), daysLeft: z.number() }),
  ]).nullable(),
  target: z.object({ shard: z.string(), name: z.string(), seasonEndsAt: z.coerce.date() }).nullable(),
  fuel: z.object({ loaded: z.number(), needed: z.number(), canLoad: z.boolean() }),
  cargo: moved,
  left: z.object({ alloy: z.number(), crystal: z.number(), deuterium: z.number(), ships: z.number() }),
  choices: z.array(z.object({ index: z.number(), x: z.number(), y: z.number(), z: z.number(), neighbours: z.number() })),
});
export type MigrationView = z.infer<typeof migrationViewSchema>;

export const landingSchema = z.object({
  placement: z.object({ shard: z.string(), shardName: z.string(), seasonId: z.string(), planetId: z.string(), playerId: z.string(), position: vec3 }),
  cargo: moved,
});
export type Landing = z.infer<typeof landingSchema>;

export const arrivalSchema = z.object({
  arrival: z.object({ shardName: z.string(), cargo: moved, planetId: z.string().nullable(), hull: z.enum(VESSEL_HULLS) }).nullable(),
  landedAt: z.coerce.date().nullable(),
});

export const departuresSchema = z.object({
  departures: z.array(z.object({ name: z.string(), country: z.string(), at: z.coerce.date(), x: z.number(), y: z.number(), z: z.number(), hull: z.enum(VESSEL_HULLS) })),
});

/** Ships that came into the main galaxy in the last minute: the hull, the galaxy it left, where it stood. */
export const inboundSchema = z.object({
  inbound: z.array(z.object({ hull: z.enum(VESSEL_HULLS), ordinal: z.number().int().positive(), at: z.coerce.date(), x: z.number(), y: z.number(), z: z.number() })),
});
export type Departure = z.infer<typeof departuresSchema>['departures'][number];

/** Optional on the wire: an older server does not know the word, and that means no. */
export const authCapabilitiesSchema = z.object({ starterGalaxy: z.boolean().optional() });
