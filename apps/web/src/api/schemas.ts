import { z } from 'zod';
import type {
  BuildingId,
  ClarityState,
  FleetStatus,
  Grade,
  HullId,
  SatelliteId,
} from '@blindspace/rules';

/**
 * The API boundary.
 *
 * The server is ours, but its responses are still input: parsed here, typed from
 * here on, and never cast. A shape that drifts fails loudly at the edge instead of
 * quietly rendering `undefined` in the middle of a battle report.
 */

/** Compile-time proof that a Zod enum still spells the same union as the rules. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

export const hullId = z.enum(['WASP', 'LANCE', 'BULWARK', 'HAULER', 'BASTION']);
export const buildingId = z.enum(['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'RING']);
export const satelliteId = z.enum(['TELESCOPE', 'RADAR', 'AEGIS', 'VEIL', 'DRILL']);
export const fleetStatus = z.enum(['HOME', 'AWAY', 'UNKNOWN']);
export const clarityState = z.enum(['FULL', 'CLEAR', 'INTERMITTENT', 'DEGRADED', 'BLIND']);
export const grade = z.enum(['DECISIVE', 'PARTIAL', 'REPELLED']);

// If any of these stop compiling, the rules changed and this file has not.
const _hull: Exact<z.infer<typeof hullId>, HullId> = true;
const _building: Exact<z.infer<typeof buildingId>, BuildingId> = true;
const _satellite: Exact<z.infer<typeof satelliteId>, SatelliteId> = true;
const _status: Exact<z.infer<typeof fleetStatus>, FleetStatus> = true;
const _clarity: Exact<z.infer<typeof clarityState>, ClarityState> = true;
const _grade: Exact<z.infer<typeof grade>, Grade> = true;
void [_hull, _building, _satellite, _status, _clarity, _grade];

const fleet = z.record(hullId, z.number());
const vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() });
const resources = z.object({ alloy: z.number(), crystal: z.number() });
const band = z.object({ low: z.number(), high: z.number() });

/* ── identity ───────────────────────────────────────────────── */

export const sessionSchema = z.object({
  accountId: z.string(),
  displayName: z.string(),
  accessToken: z.string(),
});

export const placementSchema = z.object({
  seasonId: z.string(),
  playerId: z.string(),
  planetId: z.string(),
  planetName: z.string(),
  slotIndex: z.number(),
});

export const seasonSchema = z.object({
  seasonId: z.string(),
  shard: z.string(),
  /** The galaxy layout and every asteroid orbit are rebuilt from this locally. */
  seed: z.number(),
  status: z.string(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  playerCap: z.number(),
  players: z.number(),
});

/* ── your planet ────────────────────────────────────────────── */

export const planetSchema = z.object({
  planet: z.object({
    id: z.string(),
    name: z.string(),
    position: vec3,
    alloy: z.number(),
    crystal: z.number(),
    alloyCap: z.number(),
    crystalCap: z.number(),
    alloyPerHour: z.number(),
    crystalPerHour: z.number(),
    vaultFloor: z.number(),
    shield: z.number(),
    disruptedUntil: z.coerce.date().nullable(),
  }),
  buildings: z.record(buildingId, z.number()),
  nextCosts: z.record(buildingId, resources),
  satellites: z.record(satelliteId, z.number()),
  satelliteSlots: z.number(),
  fleet,
  ground: fleet,
  score: z.object({ wealth: z.number(), dominion: z.number() }),
});

export const upgradeSchema = z.object({
  type: buildingId,
  level: z.number(),
  alloy: z.number(),
  crystal: z.number(),
});

export const buildSchema = z.object({
  hull: hullId,
  built: z.number(),
  alloy: z.number(),
  crystal: z.number(),
});

export const satelliteInstallSchema = z.object({
  type: satelliteId,
  level: z.number(),
  slot: z.number(),
});

export const launchSchema = z.object({
  missionId: z.string(),
  arriveAt: z.coerce.date(),
  exposureMinutes: z.number(),
  homeDefenceAfter: z.number(),
});

/* ── the galaxy, at the tier of detail you have earned ──────── */

export const galaxySchema = z.object({
  you: z.object({ planetId: z.string(), playerId: z.string() }),
  planets: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      owner: z.string(),
      position: vec3,
      coreTier: z.number(),
      isSelf: z.boolean(),
      /**
       * ABSENT means "you are not watching this planet" — it does not mean
       * unknown. Nothing may ever invent a value for a missing key here.
       */
      fleet: z
        .object({
          status: fleetStatus,
          staleMinutes: z.number(),
          etaMinutes: z.number().nullable(),
          clarity: clarityState,
        })
        .optional(),
    }),
  ),
});

export const leaderboardSchema = z.object({
  ladder: z.array(
    z.object({
      rank: z.number(),
      playerId: z.string(),
      name: z.string(),
      dominion: z.number(),
      wealth: z.number(),
    }),
  ),
  you: z
    .object({
      rank: z.number(),
      playerId: z.string(),
      name: z.string(),
      dominion: z.number(),
      wealth: z.number(),
    })
    .nullable(),
});

/* ── intel ──────────────────────────────────────────────────── */

export const intelSchema = z.object({
  watching: z.array(
    z.object({
      slot: z.number(),
      targetPlanetId: z.string(),
      targetName: z.string(),
      ownerName: z.string(),
      reading: z.object({
        status: fleetStatus,
        staleMinutes: z.number(),
        etaMinutes: z.number().nullable(),
        state: clarityState,
        clarity: z.number(),
      }),
    }),
  ),
  radarLog: z.array(
    z.object({
      at: z.coerce.date(),
      bearing: z.string().nullable(),
      originPlanetName: z.string().nullable(),
    }),
  ),
  probeReports: z.array(
    z.object({
      targetPlanetId: z.string(),
      targetName: z.string(),
      at: z.coerce.date(),
      accuracy: z.number(),
      stock: band,
      defence: band,
      fleetSize: band,
      fleetHome: z.boolean(),
      detected: z.boolean(),
    }),
  ),
  probeCost: resources,
});

export const watchSchema = z.object({ slot: z.number(), targetPlanetId: z.string() });

export const probeSchema = z.object({
  missionId: z.string(),
  arriveAt: z.coerce.date(),
  flightMinutes: z.number(),
});

/* ── the return moment ──────────────────────────────────────── */

export const unlockable = z.enum(['TELESCOPE', 'RADAR', 'EXPLORER', 'VEIL']);

const pendingThread = z.object({
  kind: z.enum(['fleet', 'probe', 'incoming']),
  targetName: z.string(),
  minutesRemaining: z.number(),
  leg: z.enum(['outbound', 'return']).optional(),
  /**
   * ABSENT on an inbound attack, always. Its origin is what Radar L5 sells and its
   * heading is most of what L2's bearing costs, so the server never sends one —
   * there is no field here for a modified client to read.
   */
  path: z
    .object({
      from: vec3,
      to: vec3,
      departAt: z.coerce.date(),
      arriveAt: z.coerce.date(),
    })
    .optional(),
});

export const pendingSchema = z.object({ pending: z.array(pendingThread) });

export const returnSchema = z.object({
  awayMinutes: z.number(),
  entries: z.array(
    z.object({
      kind: z.enum(['fleet_returned', 'raided', 'raid_result', 'scan_detected', 'accrued', 'unlock']),
      title: z.string(),
      detail: z.string(),
      at: z.coerce.date(),
    }),
  ),
  pending: z.array(pendingThread),
  newUnlocks: z.array(unlockable),
});

export const unlocksSchema = z.object({ unlocked: z.array(unlockable) });

export const notificationsSchema = z.object({
  notifications: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['incoming_fleet', 'fleet_returned', 'raided', 'scan_detected']),
      payload: z.unknown(),
      seen: z.boolean(),
      at: z.coerce.date(),
    }),
  ),
});

export const markedSchema = z.object({ marked: z.number() });

const vec = z.object({ x: z.number(), y: z.number(), z: z.number() });

/**
 * Other players' fleets, deliberately unattributable.
 *
 * No id, owner, kind or destination — and `from`/`to` are points on the middle of
 * a flight, not the planets at either end. See the server's `services/traffic.ts`
 * for why each of those is load-bearing.
 */
export const trafficSchema = z.object({
  contacts: z.array(
    z.object({
      from: vec,
      to: vec,
      startAt: z.coerce.date(),
      endAt: z.coerce.date(),
    }),
  ),
});
export type Contact = z.infer<typeof trafficSchema>['contacts'][number];

export type Session = z.infer<typeof sessionSchema>;
export type Placement = z.infer<typeof placementSchema>;
export type SeasonInfo = z.infer<typeof seasonSchema>;
export type PlanetView = z.infer<typeof planetSchema>;
export type GalaxyView = z.infer<typeof galaxySchema>;
export type GalaxyPlanet = GalaxyView['planets'][number];
export type Leaderboard = z.infer<typeof leaderboardSchema>;
export type IntelView = z.infer<typeof intelSchema>;
export type WatchView = IntelView['watching'][number];
export type ProbeReport = IntelView['probeReports'][number];
export type ScanRow = IntelView['radarLog'][number];
export type ReturnPayload = z.infer<typeof returnSchema>;
export type ReturnEntry = ReturnPayload['entries'][number];
export type PendingThread = z.infer<typeof pendingThread>;
export type Unlockable = z.infer<typeof unlockable>;
export type LaunchResult = z.infer<typeof launchSchema>;
export type NotificationView = z.infer<typeof notificationsSchema>['notifications'][number];
