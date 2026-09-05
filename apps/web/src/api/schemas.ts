import { z } from 'zod';
import type {
  BuildQueueId,
  BuildingId,
  ClarityState,
  FleetStatus,
  Grade,
  HullId,
  InstrumentId,
  MassClass,
  ResearchProjectId,
  Resources,
  SatelliteId,
} from '@astera/rules';

/**
 * The API boundary.
 *
 * The server is ours, but its responses are still input: parsed here, typed from
 * here on, and never cast. A shape that drifts fails loudly at the edge instead of
 * quietly rendering `undefined` in the middle of a battle report.
 */

/** Compile-time proof that a Zod enum still spells the same union as the rules. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

export const hullId = z.enum([
  'DART', 'PIKE', 'RAMPART', 'WARDEN', 'COURIER',
  'VIPER', 'TALON', 'STRONGHOLD', 'SENTINEL', 'WAYFARER',
  'TEMPEST', 'BALLISTA', 'LEVIATHAN', 'PRAETORIAN', 'ATLAS', 'NULLIFIER',
  'CATACLYSM', 'CITADEL',
  'BASTION', 'THORN', 'PROSPECTOR',
]);
export const buildingId = z.enum([
  'CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD', 'HANGAR', 'DEUTERIUM_PLANT',
]);
/**
 * TWO ID SPACES, BECAUSE THEY ARE TWO KINDS OF THING. D25.
 *
 * Instruments are on the ground and carry levels; satellites take an orbit slot
 * and are bought once. They were one enum of five, and every screen that read it
 * had to know which of the five behaved which way.
 */
export const instrumentId = z.enum(['TELESCOPE', 'RADAR', 'AEGIS', 'VEIL']);
export const satelliteId = z.enum(['FOUNDRY', 'UPLINK', 'DERRICK', 'BEACON']);
export const fleetStatus = z.enum(['HOME', 'AWAY', 'UNKNOWN']);
/** All a stranger is entitled to know about a craft in transit. D123. */
export const massClass = z.enum(['LIGHT', 'MEDIUM', 'HEAVY']);
export const clarityState = z.enum(['FULL', 'CLEAR', 'INTERMITTENT', 'DEGRADED', 'BLIND']);
export const grade = z.enum(['DECISIVE', 'PARTIAL', 'REPELLED']);
export const researchProjectId = z.enum([
  'ISOTOPE_SPECTROMETRY', 'DENSE_FUEL_CELLS', 'GRAVITIC_CHARGES', 'DEATH_STAR_PROTOCOL',
  'DEUTERIUM_SYNTHESIS', 'YARD_AUTOMATION', 'PROSPECTOR_HOLDS', 'CARGO_HOLDS',
  'STARSHIP_ENGINEERING', 'SHIP_POWER', 'SHIP_ARMOR', 'SHIP_PROPULSION',
  'EMPLACEMENT_DOCTRINE', 'INTERCEPTION_GRID', 'STRATEGIC_STOCKPILE',
]);

// If any of these stop compiling, the rules changed and this file has not.
const _hull: Exact<z.infer<typeof hullId>, HullId> = true;
const _building: Exact<z.infer<typeof buildingId>, BuildingId> = true;
const _instrument: Exact<z.infer<typeof instrumentId>, InstrumentId> = true;
const _satellite: Exact<z.infer<typeof satelliteId>, SatelliteId> = true;
const _status: Exact<z.infer<typeof fleetStatus>, FleetStatus> = true;
const _mass: Exact<z.infer<typeof massClass>, MassClass> = true;
const _clarity: Exact<z.infer<typeof clarityState>, ClarityState> = true;
const _grade: Exact<z.infer<typeof grade>, Grade> = true;
const _research: Exact<z.infer<typeof researchProjectId>, ResearchProjectId> = true;
void [
  _hull, _building, _instrument, _satellite,
  _status, _mass, _clarity, _grade, _research,
];

const fleet = z.record(hullId, z.number());
const vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() });
const resources = z.object({ alloy: z.number(), crystal: z.number(), deuterium: z.number() });
const band = z.object({ low: z.number(), high: z.number() });

const timedConstructionOrder = z.object({
  id: z.string(),
  queue: z.literal('CONSTRUCTION'),
  slot: z.number().int().min(0),
  kind: z.enum(['BUILDING', 'INSTRUMENT', 'SATELLITE', 'RESEARCH']),
  subject: z.string(),
  count: z.number().int().min(1),
  startedAt: z.coerce.date(),
  finishesAt: z.coerce.date(),
  cost: resources,
});

const timedYardOrder = z.object({
  id: z.string(),
  queue: z.literal('YARD'),
  slot: z.number().int().min(0),
  kind: z.literal('HULL'),
  subject: z.string(),
  count: z.number().int().min(1),
  startedAt: z.coerce.date(),
  finishesAt: z.coerce.date(),
  cost: resources,
});

const timedResearchOrder = z.object({
  id: z.string(),
  slot: z.number().int().min(0),
  projectId: researchProjectId,
  level: z.number().int().min(1),
  startedAt: z.coerce.date(),
  finishesAt: z.coerce.date(),
  cost: resources,
});

/**
 * A pre-account rehearsal can stage a commitment but cannot name its server time.
 * The explicit discriminator keeps ordinary API payloads on the timed branch.
 */
const stagedConstructionOrder = timedConstructionOrder.omit({
  startedAt: true,
  finishesAt: true,
}).extend({
  staged: z.literal(true),
  startedAt: z.undefined().optional(),
  finishesAt: z.undefined().optional(),
});

const stagedYardOrder = timedYardOrder.omit({
  startedAt: true,
  finishesAt: true,
}).extend({
  staged: z.literal(true),
  startedAt: z.undefined().optional(),
  finishesAt: z.undefined().optional(),
});

/* ── identity ───────────────────────────────────────────────── */

export const sessionSchema = z.object({
  accountId: z.string(),
  /** Folded to lower case server-side; this is the key, not the label. */
  username: z.string(),
  displayName: z.string(),
  accessToken: z.string(),
});

/**
 * Who the caller is AND where they stand, in one answer.
 *
 * The placement is what decides which screen opens: a commander with a planet goes
 * to their galaxy, one without goes to the server list. Asking twice would show
 * the wrong screen for a frame.
 */
export const seasonResultSchema = z.object({
  seasonId: z.string(),
  accountId: z.string(),
  finalRank: z.number(),
  dominion: z.number(),
  damageDealt: z.number(),
  damageTaken: z.number(),
  rivalName: z.string().nullable(),
  biggestRaid: z.number(),
  title: z.string(),
  recap: z.object({
    commanderName: z.string(),
    planetName: z.string(),
    battles: z.number(),
    attacks: z.number(),
    defences: z.number(),
    rival: z.object({ commanderName: z.string(), battles: z.number() }).nullable(),
    biggestRaid: z.object({ value: z.number(), opponentName: z.string() }).nullable(),
    /** Final seasonal clan identity. Power is wiped; this story survives. D114. */
    clan: z.object({
      name: z.string(),
      tag: z.string(),
      finalRank: z.number().int().positive(),
      dominion: z.number(),
      topThree: z.boolean(),
    }).nullable().optional(),
  }),
  createdAt: z.coerce.date(),
});

export const historicalSeasonResultSchema = seasonResultSchema.extend({
  shard: z.string(),
  shardName: z.string(),
});

export const meSchema = z.object({
  accountId: z.string(),
  username: z.string(),
  displayName: z.string(),
  /** Older servers do not know the operations panel and safely default to no access. */
  isAdmin: z.boolean().default(false),
  placement: z
    .object({ shard: z.string(), shardName: z.string(), planetName: z.string() })
    .nullable(),
  /** Added after D85; an older server still opens a session without it. */
  latestResult: historicalSeasonResultSchema.nullable().optional(),
});

/* ── the galaxies you can choose between ────────────────────── */

export const serverStatus = z.enum(['open', 'full', 'locked', 'closed']);

export const serverSchema = z.object({
  code: z.string(),
  name: z.string(),
  ordinal: z.number(),
  planets: z.number(),
  capacity: z.number(),
  online: z.number(),
  status: serverStatus,
  endsAt: z.coerce.date().nullable(),
  yours: z.boolean(),
});

export const serverListSchema = z.object({
  servers: z.array(serverSchema),
  placement: z.object({ shard: z.string(), name: z.string() }).nullable(),
});

export const placementSchema = z.object({
  shard: z.string(),
  shardName: z.string(),
  seasonId: z.string(),
  playerId: z.string(),
  planetId: z.string(),
  planetName: z.string(),
  slotIndex: z.number(),
});

export const okSchema = z.object({ ok: z.boolean() });

export const seasonSchema = z.object({
  seasonId: z.string(),
  shard: z.string(),
  /** Added after the first season payload; old servers remain readable. */
  shardName: z.string().optional(),
  /** Public galaxy generation identity. Private asteroid schedules use a server-only key. */
  seed: z.number(),
  status: z.string(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  playerCap: z.number(),
  players: z.number(),
  /**
   * Commanders whose last authenticated request was inside the online window.
   *
   * Optional so a client one deploy ahead of the server still parses — the same
   * rule every added field follows here.
   */
  online: z.number().optional(),
  /**
   * Distinct commanders seen in this galaxy over `SERVERS.dayWindowMinutes`.
   *
   * Optional for the same rolling-deploy reason as `online`, and read the same
   * way: absent means "this server does not say", never zero.
   */
  onlineToday: z.number().optional(),
  result: seasonResultSchema.nullable().optional(),
  /** One seasonal identity marker; optional only for rolling-deploy compatibility. D91. */
  rivalPlanetId: z.string().nullable().optional(),
  /** Stable commander identity, so every world they control wears the same mark. */
  rivalPlayerId: z.string().nullable().optional(),
});

/**
 * THE SIX NUMBERS THAT MAKE ONE ORBIT, AND THE SAME SIX A DISCOVERED ROCK CARRIES.
 *
 * Given these, the client runs the shared `interceptOrbit` the server runs, which
 * is what stops the launch screen and the server disagreeing about the minute a
 * convoy meets the merchant.
 */
const galaxyOrbitSchema = z.object({
  radius: z.number().positive(),
  period: z.number().positive(),
  phase: z.number(),
  inclination: z.number(),
  ascendingNode: z.number(),
  speed: z.number().positive(),
});

const tradeRateSchema = z.object({
  alloy: z.number().positive(),
  crystal: z.number().positive(),
  deuterium: z.number().positive(),
});

const activeGalaxyEventSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().uuid(),
    kind: z.literal('ASTEROID_SHOWER'),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    asteroidSpawnMultiplier: z.number().gt(1),
  }),
  /**
   * Ticaret Gemisi. D156. Unlike a pirate, whose elements ARE its route and stay
   * server-private (D150), the merchant is an announced public moment and the disc
   * may draw its whole circle — but only while it is actually there.
   */
  z.object({
    id: z.string().uuid(),
    kind: z.literal('TRADE_SHIP'),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    rate: tradeRateSchema,
    /** Minutes since season start — the clock `orbit` is evaluated on. */
    appearsAtMinute: z.number(),
    expiresAtMinute: z.number(),
    orbit: galaxyOrbitSchema,
  }),
]);

const knownGalaxyEventKinds: ReadonlySet<string> = new Set(
  activeGalaxyEventSchema.options.map((option) => option.shape.kind.value),
);

/**
 * FORWARD-COMPATIBLE ON PURPOSE, AND THAT IS ALSO ITS ONE HAZARD.
 *
 * An unknown kind is dropped so a server that learns a new public event never
 * blanks the chip on an older client. The cost is that a kind the server publishes
 * correctly and this file has not been taught simply never appears, with no error
 * anywhere — which is exactly what happened while `activeGalaxyEventsSchema` knew
 * only `ASTEROID_SHOWER`: a live trade ship arrived on every response and was
 * silently discarded. `contract.test.ts` now parses this route with a live
 * merchant on it so the drop can never be the reason a kind is missing again.
 */
export const activeGalaxyEventsSchema = z.object({
  events: z.array(z.unknown()).transform((rows, context) => rows.flatMap((row, index) => {
    const identity = z.object({ kind: z.string() }).passthrough().safeParse(row);
    if (!identity.success || !knownGalaxyEventKinds.has(identity.data.kind)) return [];
    const parsed = activeGalaxyEventSchema.safeParse(row);
    if (parsed.success) return [parsed.data];
    for (const issue of parsed.error.issues) {
      context.addIssue({ ...issue, path: [index, ...issue.path] });
    }
    return [];
  })),
});

export const rivalSetSchema = z.object({
  rivalPlanetId: z.string().nullable(),
  rivalPlayerId: z.string().nullable().optional(),
});

/* ── your planet ────────────────────────────────────────────── */

export const planetSchema = z.object({
  planet: z.object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(['CAPITAL', 'COLONY']).optional(),
    position: vec3,
    alloy: z.number(),
    crystal: z.number(),
    deuterium: z.number(),
    alloyCap: z.number(),
    crystalCap: z.number(),
    deuteriumCap: z.number(),
    alloyPerHour: z.number(),
  /** Zero on a world with no refinery, and absent on a server that predates one. */
  deuteriumPerHour: z.number().optional(),
    crystalPerHour: z.number(),
    /**
     * The works: uncollected production, and the ceiling it stops at. D16.
     *
     * Both are needed here, not just the amount, because the interface has to say
     * "full in 3h 20m" before it can say "FULL — you are throwing away 160/h", and
     * only the second of those is a reason to open the game right now.
     */
    bufferAlloy: z.number(),
    bufferCrystal: z.number(),
    bufferDeuterium: z.number(),
    bufferAlloyCap: z.number(),
    bufferCrystalCap: z.number(),
    bufferDeuteriumCap: z.number(),
    vaultFloor: z.number(),
    vaultProtected: resources,
    vaultCapacity: resources,
    shield: z.number(),
    shieldMax: z.number(),
    shieldPerHour: z.number(),
    disruptedUntil: z.coerce.date().nullable(),
    recoveryUntil: z.coerce.date().nullable().optional(),
    protectedUntil: z.coerce.date().nullable().optional(),
  }),
  buildings: z.record(buildingId, z.number()),
  nextCosts: z.record(buildingId, resources),
  /** The four on the ground, with their levels. D25. */
  instruments: z.record(instrumentId, z.number()),
  effectiveInstruments: z.record(instrumentId, z.number()).optional(),
  /**
   * What the next level of each instrument costs, priced by the server.
   *
   * The client could compute this — `instrumentCost` is a pure function it already
   * imports — but every other price on this payload is authoritative, and a screen
   * that mixes the two is one modifier away from offering a purchase the endpoint
   * will refuse.
   */
  instrumentCosts: z.record(instrumentId, resources),
  /**
   * What is in orbit, and how much room there is. D25.
   *
   * A list rather than a map of levels: a satellite has no levels, and `orbitSlots`
   * is what the Command Core has opened — 1, 2, 3 or 4.
   */
  orbit: z.array(satelliteId),
  effectiveOrbit: z.array(satelliteId).optional(),
  orbitSlots: z.number(),
  /** Flat, because a satellite is bought once and never raised. */
  satelliteCosts: z.record(satelliteId, resources),
  research: z.array(z.object({
    id: researchProjectId,
    /**
     * The rung held and the top of the ladder. T7: research belongs to the
     * commander now and can carry a level, so `completed` alone stopped being the
     * whole story. Optional for a rolling deploy against an older server; every
     * current project tops out at one, where `level > 0` and `completed` agree.
     */
    level: z.number().optional(),
    maxLevel: z.number().optional(),
    /** The price of the NEXT rung, or of the top one when there is no next. */
    cost: resources,
    discovered: z.boolean(),
    completed: z.boolean(),
    completedAt: z.coerce.date().nullable(),
    available: z.boolean(),
    /** Gates projected through earlier Construction orders; absent on an older server. */
    queueDiscovered: z.boolean().optional(),
    queueAvailable: z.boolean().optional(),
    availableAt: z.coerce.date(),
    prerequisite: researchProjectId.nullable(),
    /**
     * WHETHER THE PROJECT NAMED BY `prerequisite` IS DONE — the second half of the
     * sentence, and for five projects the only half that is ever false.
     *
     * `prerequisite` alone says what stands in front; without these it cannot say
     * whether it is still standing there, and the card fell back to the one gate it
     * could read: a spent act clock. Optional for a rolling deploy, where an older
     * server means the card keeps the behaviour it already had.
     */
    prerequisiteMet: z.boolean().optional(),
    queuePrerequisiteMet: z.boolean().optional(),
  })),
  /** One commander-wide queue, repeated in planet responses for atomic mutation updates. */
  researchQueue: z.array(timedResearchOrder).optional(),
  /**
   * Work already paid for, in the order the server will finish it.
   *
   * Optional for rolling deploys: an older server simply means an empty-looking
   * queue, while a new server can still serve an older cached client. Completion
   * is an absolute instant; the client derives every countdown from the shared
   * server clock rather than accepting a second, inevitably stale duration.
   */
  queues: z.object({
    CONSTRUCTION: z.array(z.union([timedConstructionOrder, stagedConstructionOrder])),
    YARD: z.array(z.union([timedYardOrder, stagedYardOrder])),
  }).optional(),
  strategic: z.object({
    id: z.string(),
    status: z.enum(['BUILDING', 'PAUSED', 'READY']),
    readyAt: z.coerce.date().nullable(),
    remainingSeconds: z.number().nullable(),
  }).nullable().optional(),
  /**
   * THE ANTI-STRATEGIC CHARGE, ON ITS OWN KEY. T10 · T12.
   *
   * `strategic` used to be the only strategic thing a world could hold, and the
   * server read it back untyped — so a charge started after a weapon reported
   * itself AS the weapon. Two kinds of asset, two keys; nothing infers one from
   * the other. Optional for a rolling deploy against an older server, where a
   * missing key simply means no charge is known.
   */
  interceptor: z.object({
    id: z.string(),
    status: z.enum(['BUILDING', 'PAUSED', 'READY']),
    readyAt: z.coerce.date().nullable(),
    remainingSeconds: z.number().nullable(),
  }).nullable().optional(),
  colonies: z.object({
    highestCore: z.number(),
    colonies: z.number(),
    reservations: z.number(),
    capacity: z.number(),
  }).optional(),
  fleet,
  ground: fleet,
  /** Your own craft that are off the planet right now. Ownership, not readiness. */
  fleetAway: fleet,
  /** Craft in the air, and how many bays the Command Core has opened. D28. */
  flight: z.object({ used: z.number(), total: z.number() }),
  /**
   * Ownership ceilings, including craft away from the world. T4/T4b.
   * Optional only for a rolling deploy against an older server.
   */
  capacity: z.object({
    hangar: z.number(),
    hangarUsed: z.number(),
    ground: z.number(),
    groundUsed: z.number(),
  }).optional(),
  score: z.object({ wealth: z.number(), dominion: z.number() }),
});

export const planetsSchema = z.object({
  playerId: z.string(),
  seasonId: z.string(),
  capitalPlanetId: z.string(),
  planets: z.array(planetSchema),
});

/**
 * EVERY MUTATION ANSWERS WITH THE WHOLE WORLD. D53.
 *
 * Each of these used to be a fragment, and the client threw it away and refetched
 * `/api/planet` to find out what its own action had done — two round trips for one
 * tap, in a game whose construction model is "instant on payment, no build timers".
 * The server now builds the same view it would have served on that second request,
 * inside the transaction that did the work, so the client writes it straight into
 * the cache and there is no second request at all.
 *
 * The fragment stays: it says what THIS action did, which a whole-world payload
 * cannot, and it is what the toast and the flash on the row read.
 */
const withPlanet = { planet: planetSchema };

export const upgradeSchema = z.object({
  type: buildingId,
  level: z.number(),
  alloy: z.number(),
  crystal: z.number(),
  ...withPlanet,
});

export const buildSchema = z.object({
  hull: hullId,
  built: z.number(),
  alloy: z.number(),
  crystal: z.number(),
  ...withPlanet,
});

export const researchCompleteSchema = z.object({
  projectId: researchProjectId,
  ...withPlanet,
});

/** Raising one of the four on the ground. D25. */
export const instrumentRaiseSchema = z.object({
  type: instrumentId,
  level: z.number(),
  ...withPlanet,
});

/** Putting one of the four in orbit. No level — it is up or it is not. D25. */
export const satelliteInstallSchema = z.object({
  type: satelliteId,
  slot: z.number(),
  ...withPlanet,
});

export const buildCancelSchema = z.object({
  orderId: z.string(),
  refund: resources,
  ...withPlanet,
});


/* ── rewards ────────────────────────────────────────────────── */

/**
 * WHAT THE GAME OWES YOU FOR PLAYING IT.
 *
 * `id` is `CHAIN:GOAL` and is parsed as a plain STRING, never as an enum — the
 * same rule the notification kinds are read under, and for the same reason. A
 * chain added on the server one deploy ahead of a phone must cost that phone one
 * unrenderable card, not the whole panel: `z.enum` would reject the array and
 * `data` would stay undefined, so a player would see an empty rewards screen
 * rather than a shorter one.
 *
 * `metric` is what decides the SENTENCE under a goal — "3 of 5 probes sent"
 * against "Command Core L5" — because those are different kinds of number and one
 * phrasing could not have carried both. Unknown values render as a count, which
 * is the honest fallback: a figure and a target.
 */
export const rewardTier = z.object({
  id: z.string(),
  goal: z.number(),
  alloy: z.number(),
  crystal: z.number(),
  state: z.enum(['locked', 'claimable', 'claimed']),
});

export const rewardsSchema = z.object({
  chains: z.array(
    z.object({
      id: z.string(),
      metric: z.string(),
      /**
       * `season` or `account`, parsed as a plain string for the same reason `id`
       * and `metric` are: a server one deploy ahead must cost this build one card
       * that reads a little plainly, never an empty panel.
       *
       * OPTIONAL, AND ABSENT READS AS `season` AT EVERY USE SITE. An older server
       * sends nothing, and silence has exactly one safe reading: the card then
       * says only what it has always said. Claiming "paid once, for ever" about a
       * reward that is not is the single wrong answer here, and it is the one
       * answer a missing field can never produce.
       */
      scope: z.string().optional(),
      progress: z.number(),
      tiers: z.array(rewardTier),
    }),
  ),
  /** How many tiers are waiting. The menu badge is this number and nothing else. */
  claimable: z.number(),
});

export const rewardClaimSchema = z.object({
  granted: resources,
  rewards: rewardsSchema,
  ...withPlanet,
});



/* ── the galaxy, at the tier of detail you have earned ──────── */

export const galaxySchema = z.object({
  you: z.object({
    planetId: z.string(),
    playerId: z.string(),
    capitalPlanetId: z.string().optional(),
    planetIds: z.array(z.string()).optional(),
  }),
  /**
   * WHERE YOUR OWN EYES ARE. D125.
   *
   * One post per world you control: its position, and how far its Telescope
   * reaches. Always finite: D126 capped it, because an unbounded top rung meant
   * one maxed Telescope deleted the horizon for a whole season.
   *
   * The disc draws the boundary from this, and the traffic layer solves against it
   * for the instant a contact will cross — which is what turns a crossing into
   * something you watch rather than something that pops between two reads.
   *
   * Optional so a client ahead of its server still parses.
   */
  sensors: z
    .array(z.object({
      /** Which of your own worlds these eyes are. Optional for an older server. */
      planetId: z.string().optional(),
      at: vec3,
      /** False is the free naked-eye neighbourhood, true is a working Telescope. */
      telescope: z.boolean().default(false),
      /**
       * THE TWO CIRCLES, UNDER THE NAMES THE MODEL USES. `@astera/rules/sight`.
       *
       * `identify` is the Telescope: inside it you see the craft itself. `detect`
       * is the Radar: inside it you get a question mark that moves, and nothing
       * more. Outside both a craft does not exist for you.
       *
       * They were `reach` / `sense` / `warn`, three wire names for two facts, and
       * `warn` was published for releases without a single reader — nothing on the
       * client knew what it was for. One name per fact, shared with the server.
       */
      identify: z.number(),
      detect: z.number().default(0),
    }))
    .optional(),
  /**
   * Live clan identity is deliberately separate from sight. It names only the
   * current crew and their fixed world locations; it carries no development,
   * hardware, traffic or sensor fields. Missing keeps an older server usable.
   */
  clanPresence: z.object({
    clan: z.object({ id: z.string(), name: z.string(), tag: z.string() }),
    members: z.array(z.object({
      playerId: z.string(),
      username: z.string(),
      worlds: z.array(z.object({
        planetId: z.string(),
        name: z.string(),
        position: vec3,
      })),
    })),
  }).nullable().optional(),
  planets: z.array(
    z.object({
      id: z.string(),
      /**
       * HOW MUCH OF THIS WORLD YOU HAVE EARNED. D127.
       *
       *   · `RESOLVED`   — inside a Telescope's reach. Live, complete, exactly the
       *                    galaxy that existed before any of this.
       *   · `REMEMBERED` — a probe has been there. The world stays DARK; what it
       *                    gains are the facts that probe saw, frozen at `seenAt`.
       *                    The target may have built since; you see what you went
       *                    and looked at.
       *   · `UNKNOWN`    — a point. Every other field is ABSENT, not null: the fog
       *                    here is enforced by omission, because a nulled field is
       *                    one a modified client can look for.
       *
       * Optional, and absent means `RESOLVED`, so a client ahead of its server
       * renders the galaxy it always did rather than blanking all of it.
       */
      intel: z.enum(['RESOLVED', 'REMEMBERED', 'UNKNOWN']).default('RESOLVED'),
      /** When the probe observed this world. `REMEMBERED` only. */
      seenAt: z.coerce.date().optional(),
      name: z.string().default(''),
      owner: z.string().default(''),
      kind: z.enum(['CAPITAL', 'COLONY', 'NEUTRAL']).optional(),
      controller: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('PLAYER'), playerId: z.string(), displayName: z.string() }),
        z.object({ kind: z.literal('NEUTRAL'), tier: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
      ]).optional(),
      /** Public seasonal identity, never membership-private state. D114. */
      clan: z.object({ id: z.string(), name: z.string(), tag: z.string() }).nullable().optional(),
      /** Exact public Dominion rank only for the three podium commanders. */
      dominionRank: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
      position: vec3,
      coreTier: z.number().default(1),
      /**
       * The exact Command Core level, public since the dyson rings — the ring
       * count steps every three levels and the colour every one, and neither can
       * be drawn from the tier. See `publicGalaxy` for what that trades away.
       */
      coreLevel: z.number().default(0),
      /**
       * The instruments in orbit, types only and never levels (D15). Hardware is
       * public — it is a physical object anyone can see — while what it can DO
       * stays behind a probe.
       */
      satellites: z.array(satelliteId).default([]),
      /**
       * Is there a dome around this world. D25.
       *
       * The Aegis is a ground instrument now and so is not in `satellites`, but a
       * shield shell is a physical object anyone can see and deterrence only works
       * if it is legible. A boolean, never a level: how strong the dome is stays
       * behind a probe, and that is the number that decides the raid.
       */
      shielded: z.boolean().default(false),
      isSelf: z.boolean(),
      isOwned: z.boolean().optional(),
      isCapital: z.boolean().optional(),
      /** Client-derived from current `clanPresence`; never inferred from stale intel. */
      clanmate: z.boolean().optional(),
      state: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('NORMAL') }),
        z.object({ kind: z.literal('RECOVERY'), until: z.coerce.date() }),
        z.object({ kind: z.literal('PROTECTED'), until: z.coerce.date() }),
      ]).default({ kind: 'NORMAL' }),
      /**
       * EVERY FIELD BUT THE CLAIM CLOCK IS EARNED. D127.
       *
       * Tier is development, and threat and reserve are readings of how defended
       * and how full the world is — none of them survive the fog. What does is a
       * LIVE claim window, because D112 makes the race public and a race only the
       * people who already probed the rock can see is not a race.
       *
       * They are optional rather than a second shape because one object with
       * absent fields is what the wire actually carries; a discriminated union
       * would be a second contract to keep in step for no gain. The last version
       * had them REQUIRED and the server sent two of five — `z.coerce.date` turned
       * the missing one into an Invalid Date and the whole galaxy failed to parse.
       */
      neutral: z.object({
        tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        threat: z.enum(['UNGUARDED', 'GUARDED', 'FORTIFIED']).optional(),
        reserve: z.enum(['EMPTY', 'LOW', 'RICH']).optional(),
        claimUntil: z.coerce.date().nullable(),
        nextReinforcementAt: z.coerce.date().nullable().optional(),
      }).optional(),
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
      username: z.string(),
      planetId: z.string().optional(),
      planetName: z.string().optional(),
      coreTier: z.number().optional(),
      score: z.number(),
      clan: z.object({ id: z.string(), name: z.string(), tag: z.string() }).nullable().optional(),
    }),
  ),
  you: z
    .object({
      rank: z.number(),
      playerId: z.string(),
      username: z.string(),
      planetId: z.string().optional(),
      planetName: z.string().optional(),
      coreTier: z.number().optional(),
      score: z.number(),
      clan: z.object({ id: z.string(), name: z.string(), tag: z.string() }).nullable().optional(),
    })
    .nullable(),
});

/* ── seasonal clans ─────────────────────────────────────────── */

const clanRole = z.enum(['LEADER', 'MEMBER']);
const clanRequestKind = z.enum(['APPLICATION', 'INVITATION']);
const clanRequestStatus = z.enum([
  'PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'CLOSED',
]);

export const publicClanSchema = z.object({
  id: z.string(),
  name: z.string(),
  tag: z.string(),
  description: z.string(),
  recruiting: z.boolean(),
  leaderName: z.string(),
  memberCount: z.number().int().nonnegative(),
  score: z.number(),
});

export const clanDirectorySchema = z.object({
  clans: z.array(publicClanSchema),
  total: z.number().int().nonnegative(),
});

export const clanLeaderboardSchema = z.object({
  clans: z.array(publicClanSchema.extend({
    rank: z.number().int().positive(),
    self: z.boolean(),
  })),
});

export const clanBadgeSchema = z.object({
  available: z.boolean(),
  membership: z.object({
    clanId: z.string(),
    name: z.string(),
    tag: z.string(),
    role: clanRole,
    matureAt: z.coerce.date(),
    mature: z.boolean(),
  }).nullable(),
  attention: z.boolean(),
  attentionCount: z.number().int().nonnegative(),
  /** Chat only; management and depot attention must never light the chat beacon. */
  clanChatUnread: z.number().int().nonnegative(),
});

export const clanStrengthSchema = z.object({
  clan: z.object({ id: z.string(), name: z.string(), tag: z.string() }),
  totals: z.object({
    clanDominion: z.number(),
    memberDominion: z.number(),
    ships: z.number().int().nonnegative(),
    fleetValue: z.number().nonnegative(),
    groundDefences: z.number().int().nonnegative(),
    worlds: z.number().int().nonnegative(),
    activeFlights: z.number().int().nonnegative(),
  }),
  composition: z.array(z.object({
    hull: hullId,
    count: z.number().int().positive(),
  })),
  members: z.array(z.object({
    playerId: z.string(),
    username: z.string(),
    role: clanRole,
    dominion: z.number(),
    ships: z.number().int().nonnegative(),
    worlds: z.number().int().nonnegative(),
  })),
});

const outsideClanRequest = z.object({
  id: z.string(),
  clanId: z.string(),
  clanName: z.string(),
  clanTag: z.string(),
  kind: clanRequestKind,
  status: clanRequestStatus,
  expiresAt: z.coerce.date(),
  resolvedAt: z.coerce.date().nullable(),
});

const memberClanRequest = z.object({
  id: z.string(),
  playerId: z.string(),
  username: z.string(),
  kind: clanRequestKind,
  status: clanRequestStatus,
  expiresAt: z.coerce.date(),
});

export const clanHomeSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('OUTSIDE'),
    requests: z.array(outsideClanRequest),
    depot: resources,
    creation: z.object({
      capitalPlanetId: z.string(),
      coreLevel: z.number().int().nonnegative(),
      requiredCoreLevel: z.number().int().positive(),
      cost: resources,
      affordable: z.boolean(),
      unlockedAt: z.coerce.date().nullable(),
    }),
  }),
  z.object({
    state: z.literal('MEMBER'),
    clan: z.object({
      id: z.string(),
      name: z.string(),
      tag: z.string(),
      description: z.string(),
      recruiting: z.boolean(),
      score: z.number(),
      role: clanRole,
      matureAt: z.coerce.date(),
      mature: z.boolean(),
      aidEnabled: z.boolean(),
    }),
    members: z.array(z.object({
      playerId: z.string(),
      username: z.string(),
      role: clanRole,
      slot: z.number().int().min(0).max(4),
      joinedAt: z.coerce.date(),
      matureAt: z.coerce.date(),
      mature: z.boolean(),
      aidEnabled: z.boolean(),
      lastActiveAt: z.coerce.date(),
      activeRecently: z.boolean(),
    })),
    requests: z.array(memberClanRequest),
  }),
]);

export const clanRequestCreatedSchema = z.object({
  requestId: z.string(),
  expiresAt: z.coerce.date(),
});
export const clanRequestAcceptedSchema = z.object({
  clanId: z.string(),
  playerId: z.string(),
  slot: z.number().int().min(0).max(4),
  matureAt: z.coerce.date(),
  hostileFlightsContinue: z.boolean(),
});
export const clanRequestClosedSchema = z.object({
  requestId: z.string(),
  status: z.enum(['REJECTED', 'WITHDRAWN']),
});

export const clanCreatedSchema = z.object({
  clanId: z.string(),
  name: z.string(),
  tag: z.string(),
  capitalPlanetId: z.string(),
  planet: planetSchema,
});

export const clanDepotSchema = z.object({
  resources,
  purseRemaining: resources,
});

export const clanDepotClaimSchema = z.object({
  claimed: resources,
  remaining: resources,
  planet: planetSchema,
});

export const clanAidSchema = z.object({
  transfers: z.array(z.object({
    id: z.string(),
    direction: z.enum(['OUTGOING', 'INCOMING']),
    status: z.enum(['OUTBOUND', 'RETURNING', 'DELIVERED', 'RETURNED']),
    counterpart: z.object({ playerId: z.string(), username: z.string() }),
    origin: z.object({ planetId: z.string(), name: z.string() }),
    target: z.object({ planetId: z.string(), name: z.string() }),
    fleet,
    cargo: resources,
    value: resources,
    departAt: z.coerce.date(),
    arriveAt: z.coerce.date(),
    committedAt: z.coerce.date(),
    allowanceReleasesAt: z.coerce.date(),
    resolvedAt: z.coerce.date().nullable(),
  })),
});

export const clanAidQuoteSchema = z.object({
  clanId: z.string(),
  canLand: z.boolean(),
  /**
   * What the flight burns, and whether the sender has it. T6.
   * Optional only for a rolling deploy against a server that predates the charge.
   */
  fuel: z.number().optional(),
  hasFuel: z.boolean().optional(),
  withinAllowance: z.boolean(),
  bay: z.object({
    used: z.number().int().nonnegative(),
    total: z.number().int().positive(),
    available: z.boolean(),
  }),
  cargoCapacity: z.number().nonnegative(),
  value: resources,
  /**
   * What is LEFT of the receiver's window, and never the window itself: the
   * allowance is four hours of their nominal production, so publishing it would
   * hand a clanmate the economy a probe is sold for. D114.
   */
  remaining: resources,
  nextReleaseAt: z.coerce.date().nullable(),
  arriveAt: z.coerce.date(),
  possibleReturnAt: z.coerce.date(),
  canFinishBeforeSeasonEnd: z.boolean(),
  travelMinutes: z.number().nonnegative(),
});

export const clanAidLaunchSchema = z.object({
  missionId: z.string(),
  arriveAt: z.coerce.date(),
  value: resources,
  remaining: resources,
  nextReleaseAt: z.coerce.date(),
  planet: planetSchema,
});

const clanMessageSchema = z.object({
  id: z.string(),
  authorPlayerId: z.string(),
  planetId: z.string(),
  username: z.string(),
  content: z.string(),
  createdAt: z.coerce.date(),
  self: z.boolean(),
});

export const clanChatPageSchema = z.object({
  messages: z.array(clanMessageSchema),
  nextBefore: z.string().nullable(),
});
export const clanChatPostSchema = z.object({ message: clanMessageSchema });
export const clanChatReadSchema = z.object({ readAt: z.coerce.date() });

export const clanEventsPageSchema = z.object({
  events: z.array(z.object({
    id: z.string(),
    seasonId: z.string(),
    clanId: z.string(),
    kind: z.string(),
    actorPlayerId: z.string().nullable(),
    actorName: z.string().nullable(),
    subjectPlayerId: z.string().nullable(),
    subjectName: z.string().nullable(),
    payload: z.record(z.unknown()),
    occurredAt: z.coerce.date(),
  })),
  nextBefore: z.string().nullable(),
});

export const clanSettingsSchema = z.object({ description: z.string(), recruiting: z.boolean() });
export const clanAidPolicySchema = z.object({ enabled: z.boolean(), changedAt: z.coerce.date() });
export const clanLeaveSchema = z.object({ left: z.literal(true), lockedUntil: z.coerce.date() });
export const clanKickSchema = z.object({ kickedPlayerId: z.string(), lockedUntil: z.coerce.date() });
export const clanLeadershipSchema = z.object({ leaderPlayerId: z.string() });
export const clanDisbandSchema = z.object({ disbanded: z.literal(true), lockedUntil: z.coerce.date() });
export const clanSeenSchema = z.object({ readAt: z.coerce.date() });

const chatMessageSchema = z.object({
  id: z.string(),
  authorPlayerId: z.string(),
  planetId: z.string().optional(),
  username: z.string(),
  content: z.string(),
  createdAt: z.coerce.date(),
  self: z.boolean(),
});

export const chatPageSchema = z.object({
  messages: z.array(chatMessageSchema),
  nextBefore: z.string().nullable(),
});
export const chatPostSchema = z.object({ message: chatMessageSchema });
export const chatUnreadSchema = z.object({ count: z.number().int().nonnegative() });
export const chatReadSchema = z.object({ ok: z.literal(true), readAt: z.coerce.date() });

/**
 * WHAT A PUBLIC EVENT'S START AND END ROW CARRIES. D149 · D156.
 *
 * ONE SHAPE PER KIND, DISCRIMINATED, so a reader that has only been taught the
 * shower cannot silently read a merchant's row as one — which is exactly what the
 * flat `z.literal('ASTEROID_SHOWER')` here used to guarantee it never had to,
 * because it dropped the merchant on the floor instead. The server's own
 * `GalaxyEventLifecyclePayload` is this union; this is its parse.
 *
 * The merchant's row carries the RATE and never the orbit: the Chronicle is a
 * permanent public record and an occurrence that has ended is precisely the
 * pre-decision knowledge D149 keeps back. The rate is what the moment MEANT.
 */
const galaxyLifecyclePayloadSchema = z.discriminatedUnion('eventKind', [
  z.object({
    eventKind: z.literal('ASTEROID_SHOWER'),
    startsAt: z.string(),
    endsAt: z.string(),
    asteroidSpawnMultiplier: z.number().gt(1),
  }),
  z.object({
    eventKind: z.literal('TRADE_SHIP'),
    startsAt: z.string(),
    endsAt: z.string(),
    rate: tradeRateSchema,
  }),
]);

/** Every lifecycle kind this build can render. See the drop rule below. */
const knownLifecycleKinds: ReadonlySet<string> = new Set(
  galaxyLifecyclePayloadSchema.options.map((option) => option.shape.eventKind.value),
);

const galaxyEventSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string(),
    kind: z.literal('bombardment'),
    subjectPlanetId: z.string().nullable(),
    payload: z.object({ planetName: z.string(), commanderName: z.string() }),
    occurredAt: z.coerce.date(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('core_tier'),
    subjectPlanetId: z.string().nullable(),
    payload: z.object({ planetName: z.string(), commanderName: z.string(), tier: z.number() }),
    occurredAt: z.coerce.date(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('isotope_exhausted'),
    subjectPlanetId: z.null(),
    payload: z.object({}).strict(),
    occurredAt: z.coerce.date(),
  }),
  ...(['wreck_formed', 'wreck_exhausted', 'dominion_leader'] as const).map((kind) =>
    z.object({
      id: z.string(),
      kind: z.literal(kind),
      subjectPlanetId: z.string(),
      payload: z.object({ planetName: z.string(), commanderName: z.string() }),
      occurredAt: z.coerce.date(),
    })),
  z.object({
    id: z.string(),
    kind: z.literal('season_act'),
    subjectPlanetId: z.null(),
    payload: z.object({ act: z.enum(['war', 'consolidation', 'sunset']) }),
    occurredAt: z.coerce.date(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('neutral_claim'),
    subjectPlanetId: z.string(),
    payload: z.object({
      planetName: z.string(),
      tier: z.number().int().min(1).max(3),
      claimUntil: z.string(),
    }),
    occurredAt: z.coerce.date(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('death_star_impact'),
    subjectPlanetId: z.string(),
    payload: z.object({
      planetName: z.string(),
      outcome: z.enum(['FIRST_STRIKE', 'CAPTURED', 'INEFFECTIVE']),
      // Events written before D98 could only name non-capitals, so `true` is the
      // exact compatibility value rather than a guess.
      capturable: z.boolean().optional().default(true),
    }),
    occurredAt: z.coerce.date(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('control_transfer'),
    subjectPlanetId: z.string(),
    payload: z.object({ planetName: z.string(), commanderName: z.string() }),
    occurredAt: z.coerce.date(),
  }),
  ...(['galaxy_event_started', 'galaxy_event_ended'] as const).map((kind) =>
    z.object({
      id: z.string(),
      kind: z.literal(kind),
      subjectPlanetId: z.null(),
      payload: galaxyLifecyclePayloadSchema,
      occurredAt: z.coerce.date(),
    })),
]);

const knownChronicleKinds: ReadonlySet<string> = new Set(
  galaxyEventSchema.options.map((option) => option.shape.kind.value),
);

export const chroniclePageSchema = z.object({
  events: z.array(z.unknown()).transform((rows, context) => rows.flatMap((row, index) => {
    const identity = z.object({ kind: z.string() }).passthrough().safeParse(row);
    if (!identity.success || !knownChronicleKinds.has(identity.data.kind)) return [];
    if (identity.data.kind === 'galaxy_event_started' || identity.data.kind === 'galaxy_event_ended') {
      const lifecycle = z.object({
        payload: z.object({ eventKind: z.string() }).passthrough(),
      }).passthrough().safeParse(row);
      /*
        A lifecycle kind this build has never been taught is dropped rather than
        raised, for the reason the outer flatMap gives — a server one deploy ahead
        must not blank the whole page. It is the one drop this file makes on
        purpose, and `trade-wiring.test.ts` pins both halves: the merchant is kept,
        and a third kind nobody has written a sentence for is still skipped.
      */
      if (!lifecycle.success || !knownLifecycleKinds.has(lifecycle.data.payload.eventKind)) {
        return [];
      }
    }
    const parsed = galaxyEventSchema.safeParse(row);
    if (parsed.success) return [parsed.data];
    for (const issue of parsed.error.issues) {
      context.addIssue({ ...issue, path: [index, ...issue.path] });
    }
    return [];
  })),
  nextBefore: z.string().nullable(),
});

/* ── intel ──────────────────────────────────────────────────── */

export const intelSchema = z.object({
  watching: z.array(
    z.object({
      observerPlanetId: z.string().optional(),
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
      cooldownUntil: z.coerce.date().nullable(),
    }),
  ),
  radarLog: z.array(
    z.object({
      at: z.coerce.date(),
      /**
       * WHICH OF YOUR WORLDS WAS SCANNED.
       *
       * The log used to be the capital's alone, so there was nothing to name. It
       * covers every world a commander holds now, and a list of scans that does
       * not say WHERE is unusable the moment there is more than one world.
       *
       * Optional so a client one deploy ahead of its server still parses.
       */
      planetId: z.string().optional(),
      planetName: z.string().optional(),
      bearing: z.string().nullable(),
      originPlanetName: z.string().nullable(),
    }),
  ),
  probeReports: z.array(
    z.object({
      targetPlanetId: z.string(),
      targetName: z.string(),
      targetUsername: z.string(),
      at: z.coerce.date(),
      accuracy: z.number(),
      stock: band,
      deuteriumStock: band.nullable(),
      defence: band,
      fleetSize: band,
      fleetHome: z.boolean(),
      deathStar: z.enum(['READY', 'BUILDING', 'NONE', 'UNKNOWN']).optional(),
      /**
       * WHAT THIS COMMANDER HAS RESEARCHED INTO THEIR HULLS. T9 · D137.
       *
       * Up to a 25% combat multiplier, and the invariant is explicit: doctrine
       * that decides a battle must be probe-visible. Absent on a caretaker world
       * and on reports written before it existed — absent means "this reading was
       * never taken", never "they have researched nothing".
       */
      doctrines: z.record(z.string(), z.number()).optional(),
      /**
       * WHETHER THAT WORLD CAN SHOOT A STRATEGIC WEAPON DOWN. T10.
       *
       * The single most valuable thing a probe brings home once the war act opens:
       * it is what turns a Death Star from a purchase into an intelligence
       * decision. Never public — the only way to hold it is to have flown there.
       */
      interceptor: z.boolean().optional(),
      detected: z.boolean(),
    }),
  ),
  /**
   * Worlds this commander may not probe again yet, with the instant each reopens.
   *
   * Only worlds still inside the window are listed, so an absent entry means the
   * control is free. `.default([])` keeps a client one deploy ahead of its server
   * from failing the whole intel read over a field that is not there yet.
   */
  probeCooldowns: z
    .array(z.object({ targetPlanetId: z.string(), readyAt: z.coerce.date() }))
    .default([]),
  probeCost: resources,
});

export const collectSchema = z.object({
  moved: resources,
  /** Would not fit; still sitting in the works rather than destroyed. */
  blocked: resources,
  alloy: z.number(),
  crystal: z.number(),
  deuterium: z.number(),
  bufferAlloy: z.number(),
  bufferCrystal: z.number(),
  bufferDeuterium: z.number(),
  ...withPlanet,
});

export const watchSchema = z.object({
  slot: z.number(),
  targetPlanetId: z.string(),
  /** When this slot may be re-pointed. Null means now. D18. */
  cooldownUntil: z.coerce.date().nullable(),
});

export const probeSchema = z.object({
  missionId: z.string(),
  arriveAt: z.coerce.date(),
  flightMinutes: z.number(),
});

/* ── the return moment ──────────────────────────────────────── */

export const unlockable = z.enum(['TELESCOPE', 'RADAR', 'EXPLORER', 'VEIL']);

const pendingThread = z.object({
  /**
   * The mission's own id. YOUR OWN CRAFT ONLY — an inbound thread has none.
   *
   * It is the volley's seed, and it is the same string `/api/galaxy/traffic`
   * publishes as a contact's key — which is what makes the attacker and every
   * bystander watch the identical bombardment rather than each generating their
   * own (D52).
   */
  id: z.string().optional(),
  /**
   * `trade` IS A CONVOY OUT AT THE MERCHANT. D156.
   *
   * Not optional and not forward-compatible by accident: this schema is strict
   * about `kind`, so the moment one convoy exists in the galaxy EVERY pending read
   * for that commander fails to parse and the whole mission strip goes blank —
   * their raids included. Its `targetName` is the event-kind identifier
   * `TRADE_SHIP` rather than a sentence; the locale files own the name.
   */
  kind: z.enum([
    'fleet', 'probe', 'incoming', 'transfer', 'settlement', 'death_star', 'pirate', 'trade',
  ]),
  targetName: z.string(),
  /**
   * WHICH PIRATE A `pirate` THREAD IS AT. D150.
   *
   * There is no world on the far end, so `targetPlanetId` is absent and
   * `targetName` carries the callsign. The level and callsign arrive structured
   * because the sentence that names a pirate belongs in the locale files, not in
   * a server response.
   */
  pirate: z
    .object({ level: z.number().int().min(1).max(4), callsign: z.string() })
    .optional(),
  minutesRemaining: z.number(),
  /** The exact landing instant, on your own craft and on an inbound one alike. */
  arriveAt: z.coerce.date(),
  leg: z.enum(['outbound', 'return']).optional(),
  /**
   * What is in it — your own craft, or an inbound attack at RADAR L5. D123.
   *
   * COMPOSITION USED TO BE FREE AND IS NOT ANY MORE. Since D24 every craft in the
   * galaxy was readable down to the hull on `/api/galaxy/traffic`, so the top two
   * rungs of the Radar ladder sold facts a logged-in player already had. A public
   * Radar contact now carries a `mass` silhouette and no roster. Telescope sight
   * can resolve a transit manifest separately; this field is also the attributed
   * inbound-warning channel that Radar L5 earns when a fleet is coming for you.
   */
  fleet: fleet.optional(),
  /** How big the inbound force looks. RADAR L4. D123. */
  mass: massClass.optional(),
  /** Which world it left. RADAR L5, the top of the ladder. D123. */
  originName: z.string().optional(),
  /**
   * THE WORLD THIS THREAD IS HEADING TOWARD.
   *
   * Not a radar product and never was: it is the defender's own world. It was
   * simply missing, so a commander with four worlds was told "incoming, six
   * minutes" and could not work out where to move the fleet. On your own craft it
   * is the mission destination, so an action can recognise an irreversible launch
   * even when the world has no visible name. Optional for rolling deploys.
   */
  targetPlanetId: z.string().optional(),
  /**
   * THE CONTACT ON THE DISC THIS WARNING IS ABOUT. `incoming` ONLY. D162.
   *
   * An inbound warning has no `path` and never will — the attacker's route is not
   * sold at any radar level — so the strip had nothing to focus with, and the one
   * row a defender most wants to look at did nothing when pressed. This is the key
   * the SAME craft carries on `/api/galaxy/traffic`, which already flags which
   * contact is coming for you, so it discloses no new fact: it joins two rows the
   * client was handed separately.
   *
   * Where no circle covers the craft there is no contact carrying this id, and the
   * row simply offers no focus — the fog stays in the contact query.
   */
  contactId: z.string().optional(),
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

/**
 * A LAUNCH ANSWERS WITH THE FLEET IT JUST CREATED. D53.
 *
 * The most committed act in the game — there is no recall — used to be followed by
 * the disc doing nothing at all for a round trip, because the squadron only exists
 * on screen once `/api/session/pending` has been fetched again. Both lists come
 * back with the launch now, built inside the same transaction and in exactly the
 * shape of the payloads they replace, so the craft is drawn on the frame the
 * answer lands.
 *
 * Declared here rather than up with the other mutations because it needs
 * `pendingThread`, and a schema that referenced it earlier would read `undefined`
 * at module-evaluation time.
 */
export const launchSchema = z.object({
  missionId: z.string(),
  arriveAt: z.coerce.date(),
  exposureMinutes: z.number(),
  homeDefenceAfter: z.number(),
  pending: z.array(pendingThread),
  ...withPlanet,
});

export const movementLaunchSchema = z.object({
  missionId: z.string(),
  arriveAt: z.coerce.date(),
  pending: z.array(pendingThread),
  ...withPlanet,
});

export const deathStarBuildSchema = z.object({
  assetId: z.string(),
  readyAt: z.coerce.date(),
  ...withPlanet,
});

/**
 * The charge answers with exactly the weapon's shape, because it IS the same asset
 * lifecycle — one row, one completion event, one planet view back (D53).
 */
export const interceptorBuildSchema = deathStarBuildSchema;

export const deathStarLaunchSchema = z.object({
  missionId: z.string(),
  arriveAt: z.coerce.date(),
  pending: z.array(pendingThread),
  ...withPlanet,
});

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

/**
 * A battle report: ground truth about what was BROUGHT, never about what remains.
 *
 * Both participants get the same facts because both were there. The OPPONENT's
 * survivors are not in the payload at all — a report tells you what someone
 * fielded, not what they kept.
 *
 * `yourFleet` is the CALLER's own board when the shooting started, which is what
 * gives their own losses a denominator. `theirFleet` is the exception D164 made and
 * the only one: the force that ARRIVED, to the commander it arrived at — they stood
 * under it, so naming it reports what they saw. The server decides which row each
 * comes from and empties the one that is not owed; nothing on this side chooses.
 */
const ordinaryBattleReport = z.object({
      /** Absent only on battle reports cached before strategic reports existed. */
      kind: z.literal('BATTLE').optional(),
      id: z.string(),
      /**
       * Present on current servers; optional so an old cached report still opens
       * normally — and NULLABLE since D150, because a pirate battle has no mission.
       */
      missionId: z.string().nullish(),
      /**
       * THE OTHER BINDER. D150.
       *
       * A pirate raid is not a `missions` row, so its report is addressed by the
       * raid instead. Signals matches a notification's `refId` against BOTH, which
       * is what makes a pirate notification open its own report.
       */
      pirateRaidId: z.string().nullish(),
      /**
       * What was on the other side, when it was not a commander. IDENTIFIED sight.
       *
       * `damageMult` is the fight's only combat modifier and `capturedHull` is its
       * only prize — both were decided by the server and thrown away on the way to
       * the screen, which is the most expensive kind of bug this project ships.
       * Optional so a cached report from before them still opens.
       */
      pirate: z
        .object({
          level: z.number().int().min(1).max(4),
          callsign: z.string(),
          damageMult: z.number().default(1),
          capturedHull: hullId.nullish(),
        })
        .nullish(),
      at: z.coerce.date(),
      grade,
      rounds: z.array(
        z.object({
          round: z.number(),
          /** Null means the immutable report predates detailed calculation telemetry. */
          attackerRoll: z.number().nullable().optional(),
          defenderRoll: z.number().nullable().optional(),
          attackerDamage: z.number(),
          defenderDamage: z.number(),
          shieldBefore: z.number().nullable().optional(),
          shieldAfter: z.number().nullable().optional(),
          shieldAbsorbed: z.number(),
          shieldBreakerDamage: z.number(),
          attackerHullDamage: z.number().nullable().optional(),
          attackerLosses: fleet,
          defenderLosses: fleet,
        }),
      ),
      attacking: z.boolean(),
      opponentName: z.string(),
      opponentPlanet: z.string(),
      opponentPlanetId: z.string().nullable(),
      /** The other side was an unclaimed world, so there is no commander to name. */
      neutral: z.boolean().default(false),
      /** The caller's own world in this battle: launched from, or hit. D121a. */
      yourPlanet: z.string().default(''),
      yourLosses: fleet,
      theirLosses: fleet,
      /** The caller's own board at contact. Empty on reports written before D121. */
      yourFleet: fleet.default({}),
      /**
       * THE FORCE THAT FLEW AT THE READER. Defender's copy only. D164.
       *
       * The second roster in this payload, and the only one that is not the
       * caller's own — because it is the one the caller watched arrive over their
       * own world. Empty for an attacker (what was standing at the target is a
       * probe's product, never a report's) and empty on any report written before
       * the attacker's roster was stored, which is what makes the fallback on the
       * sheet a real branch rather than a defensive one.
       */
      theirFleet: fleet.default({}),
      lootAlloy: z.number(),
      lootCrystal: z.number(),
      lootDeuterium: z.number(),
      /** Null on reports written before the swing was recorded. */
      dominion: z.number().nullable(),
      /** What the defender's Aegis soaked before anything reached a hull. */
      shieldAbsorbed: z.number().default(0),
      /** Immutable battle-time Aegis state; null on reports that predate telemetry. */
      shieldBefore: z.number().nullable().optional(),
      shieldAfter: z.number().nullable().optional(),
      /** Attacker only: the holds were full, so stock was left on the ground. */
      cargoLimited: z.boolean().default(false),
      /** Defender only: ground guns that walked back out of their own wreckage. */
      defenceSalvage: fleet.default({}),
      /** Minutes the defender's works were knocked offline by this battle. */
      disruptedMinutes: z.number().default(0),
      /** What the fight left in orbit for whoever gets there first. */
      wreckValue: z.number().default(0),
      /** Launch-time clan identities; they do not rewrite when somebody later leaves. */
      attackerClan: z.object({ id: z.string(), name: z.string(), tag: z.string() }).nullable().optional(),
      defenderClan: z.object({ id: z.string(), name: z.string(), tag: z.string() }).nullable().optional(),
    });

const strategicBattleReport = z.object({
  kind: z.literal('STRATEGIC'),
  id: z.string(),
  missionId: z.string(),
  at: z.coerce.date(),
  attacking: z.boolean(),
  opponentName: z.string(),
  opponentPlanet: z.string(),
  opponentPlanetId: z.string().nullable(),
  yourPlanet: z.string(),
  outcome: z.enum(['FIRST_STRIKE', 'CAPTURED', 'INEFFECTIVE', 'INTERCEPTED']),
  damage: z.number(),
  destroyedFleet: fleet,
  destroyedResources: resources,
  levelChanges: z.array(z.object({
    kind: z.enum(['BUILDING', 'INSTRUMENT']),
    id: z.string(),
    before: z.number().int().nonnegative(),
    after: z.number().int().nonnegative(),
  })),
  destroyedOrders: z.array(z.object({
    kind: z.enum(['BUILDING', 'HULL', 'INSTRUMENT', 'SATELLITE']),
    subject: z.string(),
    count: z.number().int().positive(),
    cost: resources,
  })),
  shieldDestroyed: z.number().nonnegative(),
  trigger: z.enum(['RADAR', 'TELESCOPE']).nullable(),
  attackerClan: z.null().optional(),
  defenderClan: z.null().optional(),
});

export const reportsSchema = z.object({
  reports: z.array(z.union([ordinaryBattleReport, strategicBattleReport])),
  rivals: z.array(z.object({
    planetId: z.string(),
    playerId: z.string(),
    battles: z.number().int().nonnegative(),
    attacks: z.number().int().nonnegative(),
    defences: z.number().int().nonnegative(),
    dominionGained: z.number().nonnegative(),
    dominionLost: z.number().nonnegative(),
    lastInteractionAt: z.coerce.date(),
    lastKnownFleet: fleet.nullable(),
    lastKnownAt: z.coerce.date().nullable(),
  })),
});
/** Kept as the ordinary report type for existing callers and cached fixtures. */
export type BattleReport = z.infer<typeof ordinaryBattleReport>;
export type StrategicBattleReport = z.infer<typeof strategicBattleReport>;
export type Report = z.infer<typeof reportsSchema>['reports'][number];
export type RivalSummary = z.infer<typeof reportsSchema>['rivals'][number];

/**
 * `kind` IS A STRING, NOT AN ENUM, AND THAT IS DELIBERATE. D45.
 *
 * It was `z.enum([...])`, which meant the day the server learned a fifth kind
 * every older client stopped being able to parse the list AT ALL — one unknown
 * value fails the array, the query errors, `data` is undefined, and Signals
 * renders its empty state. The player is not shown a broken row; they are shown
 * "Nothing yet. The galaxy tells you when a fleet moves against you", which is a
 * lie about their entire history.
 *
 * Parsed as a string, an unrecognised kind is one row this build cannot describe.
 * `describeNotification` returns null for it and Signals leaves it out of both the
 * list and the count, so the surface degrades by exactly one line instead of all
 * of them. The payload was already `unknown` for the same reason.
 */
export const notificationsSchema = z.object({
  notifications: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      /** The mission/run that produced this news; null for player-level unlocks. */
      refId: z.string().nullable().optional(),
      payload: z.unknown(),
      seen: z.boolean(),
      at: z.coerce.date(),
    }),
  ),
});

export const markedSchema = z.object({ marked: z.number() });

/* ── mining · D19 ───────────────────────────────────────────── */

/**
 * A rock crossing the disc.
 *
 * The whole trajectory arrives, not a position: the client animates it from its
 * own clock exactly as it does fleets, so a field of forty moving rocks costs one
 * request rather than a stream (A4, A5). The endpoint projects this shape only for
 * rocks already earned by the caller's sensor history; the opaque id and private
 * schedule prevent clients from enumerating unseen targets.
 */
export const asteroidSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
  level: z.number(),
  ore: z.number(),
  oreRemaining: z.number(),
  /** Share of the haul that comes back as crystal. */
  crystalShare: z.number(),
  radius: z.number(),
  period: z.number(),
  phase: z.number(),
  inclination: z.number(),
  ascendingNode: z.number(),
  speed: z.number(),
  appearsAt: z.number(),
  expiresAt: z.number(),
  active: z.boolean(),
  isotopeRich: z.boolean(),
  deuteriumShare: z.number().nullable(),
}).strict();

export const miningSchema = z.object({
  /**
   * Is a Derrick in orbit. D25 — a satellite you have or do not, never a level.
   *
   * This field was `drill: number` and the mismatch was invisible in every way
   * that matters: the endpoint still answered 200, the client still compiled, and
   * Zod rejected the body at the boundary — so the query failed, `data` stayed
   * undefined, and the entire asteroid field vanished from the disc with no error
   * anywhere. `test/api-contract.test.ts` exists because of this.
   */
  derrick: z.boolean(),
  craftSpeed: z.number(),
  craftHold: z.number(),
  /** What a Derrick would make of the hold, so the interface can sell one. */
  derrickHold: z.number(),
  asteroids: z.array(asteroidSchema),
  nextFieldChangeAt: z.coerce.date().nullable(),
  /** Wreck fields left by battles. Public in full — size, place and clock. D32. */
  debris: z.array(
    z.object({
      id: z.string(),
      /**
       * The world this wreckage orbits, or NULL when there is none. D150.
       *
       * A pirate battle happens at a rendezvous in open space, so the position
       * moved onto `at` and this became the answer to a narrower question: which
       * world's ring is this drawn against.
       */
      planetId: z.string().nullable(),
      at: vec3,
      alloy: z.number(),
      crystal: z.number(),
      deuterium: z.number(),
      minutesLeft: z.number(),
    }),
  ),
  runs: z.array(
    z.object({
      id: z.string(),
      /** Origin world. Optional only for rolling compatibility with older servers. */
      planetId: z.string().uuid().optional(),
      targetKind: z.enum(['asteroid', 'debris']),
      asteroidId: z.string().regex(/^[A-Za-z0-9_-]{22}$/).nullable(),
      debrisFieldId: z.string().nullable(),
      status: z.enum(['outbound', 'returning', 'done']),
      craft: z.number(),
      departAt: z.coerce.date(),
      arriveAt: z.coerce.date(),
      homeAt: z.coerce.date().nullable(),
      /** The point the craft was aimed at — where it and the rock meet. */
      intercept: vec3,
      minedAlloy: z.number(),
      minedCrystal: z.number(),
      minedDeuterium: z.number(),
    }),
  ),
});

/** Caller-filtered field plus public debris, invalidated by shard-wide mining events. */
export const miningFieldSchema = miningSchema
  .pick({ asteroids: true, debris: true, nextFieldChangeAt: true });

/** Private half fetched only for this commander's selected world. */
export const miningStatusSchema = miningSchema
  .pick({
    derrick: true,
    craftSpeed: true,
    craftHold: true,
    derrickHold: true,
    runs: true,
  })
  .extend({
    /** Active isotope rocks this world has earned the right to recognise. */
    isotopes: z.array(z.object({
      id: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
      deuteriumShare: z.number(),
    })),
  });

const miningLaunchBaseSchema = z.object({
  runId: z.string(),
  /**
   * ABSENT ON A HARVEST. D32.
   *
   * The two launches share this shape because a haul IS a mining run, but a wreck
   * field is not in the generated asteroid field and has no index. Required, this
   * rejected every successful harvest the server ever answered.
   */
  asteroidId: z.string().regex(/^[A-Za-z0-9_-]{22}$/).optional(),
  craft: z.number(),
  arriveAt: z.coerce.date(),
  flightMinutes: z.number(),
  intercept: vec3,
  capacity: z.number(),
});

/**
 * A MINING OR SALVAGE LAUNCH CLOSES EVERY READ IT MOVES. D120.
 *
 * The run used to appear only after `/api/mining/status` returned, while the
 * departed craft and occupied bay needed `/api/planet` and older pending reads
 * could still land afterwards. All three authoritative views now come from the
 * launch transaction, so one POST response is enough to draw the craft.
 */
export const miningLaunchSchema = miningLaunchBaseSchema.extend({
  mining: miningStatusSchema,
  pending: z.array(pendingThread),
  ...withPlanet,
});

const vec = z.object({ x: z.number(), y: z.number(), z: z.number() });

/**
 * THE PIRATES THIS COMMANDER CAN SEE OR REMEMBERS. D150 · D158 · D160.
 *
 * A pirate is remembered exactly as an asteroid is (D143): once it has been inside
 * a Telescope circle it stays on this list, and stays raidable, until it dies or
 * the season takes it. So the list no longer shrinks when a target flies out of
 * reach — an opportunity that expires while the fleet is being packed is not a
 * decision (D124).
 *
 * `remembered` SAYS WHICH ENTRIES NO CIRCLE IS COVERING RIGHT NOW — a statement
 * about SIGHT, not about age. The figures are current either way: an orbit is a
 * solved function of time and the crew is the lane's live state, exactly as a
 * discovered rock keeps reporting its remaining ore to a commander with no eyes on
 * it. What the flag buys is the disc drawing such a craft faded, so a player can
 * tell what they are looking at from what they are only tracking.
 *
 * THE LADDER IS IN THE OPTIONALITY. `zone` says which of the three states this
 * reading is; `level`, `fleet` and `damageMult` arrive with IDENTIFIED — live or
 * remembered — `mass` at Radar L4 and `silhouette` at L5. Nothing here carries an
 * orbit: radius, period and phase ARE the route, and a route is what the fog
 * refuses.
 */
export const piratesSchema = z.object({
  originPlanetId: z.string(),
  pirates: z.array(z.object({
    id: z.string(),
    /** Four characters off the opaque handle. Season-unique, and leaks no index. */
    callsign: z.string(),
    zone: z.enum(['CONTACT', 'IDENTIFIED']),
    /**
     * NO CIRCLE COVERS THIS ONE RIGHT NOW. D160.
     *
     * It is on the list because the commander identified it once. The figures below
     * are still current — the rock lane's own terms — so this marks a craft that
     * cannot be SEEN, not one whose numbers are stale. Optional so a client ahead of
     * its server still parses, and absent rather than `false` for the same reason
     * every other flag on this wire is.
     */
    remembered: z.literal(true).optional(),
    at: vec,
    /** Minutes until it leaves the disc for good. A deadline, so it is public. */
    expiresInMinutes: z.number(),
    /**
     * The soonest rendezvous this world's FASTEST hull could keep, or null.
     *
     * A best case, and labelled as one: a fleet flies at its slowest ship, so the
     * launch itself is the authority on the actual squadron. Solved on the server
     * because a second implementation of a numerical intercept would put a
     * different minute on the screen than the one the launch used.
     */
    reachMinutes: z.number().nullable(),
    /**
     * THE EXACT FLIGHT TIME FOR EVERY SPEED THIS WORLD CAN FIELD.
     *
     * A fleet flies at its slowest hull, so these are not samples of a curve —
     * they are the complete set of answers. The launch sheet reads the entry for
     * the slowest ship the player has picked and quotes the minute the server will
     * actually use, without a second request and without a client-side solver.
     */
    /**
     * One entry per hull standing at the caller's world, with the rendezvous the
     * launch will actually use. Keyed by HULL, never by speed: the published
     * figures carry the world's Beacon and the commander's Propulsion, and the
     * client only knows the catalogue — matching those two scales quoted the wrong
     * ship's flight time and offered launches the server then refused. A hull that
     * is absent cannot reach this pirate.
     */
    reach: z.array(z.object({
      hull: hullId,
      minutes: z.number(),
      distance: z.number(),
      /**
       * WHERE THE MEETING HAPPENS, so the disc can draw it before the fleet is
       * committed. D155.
       *
       * A pirate flies a closed orbit, so the aim point is ahead of it and — for
       * the heaviest wings — can be most of a lap ahead. Written but not drawn,
       * that read as the squadron setting off in an unrelated direction; the
       * mining lane solved the same complaint by marking the point (D40).
       */
      at: vec,
    })),
    /** IDENTIFIED only: what it is, what it flies, and how hard it hits. */
    level: z.number().int().min(1).max(4).optional(),
    fleet: fleet.optional(),
    damageMult: z.number().optional(),
    mass: massClass.optional(),
    silhouette: z.literal('pirate').optional(),
  })),
});

/**
 * A LAUNCHED RAID, with the strip and the world it left. D53 · D150.
 *
 * The same three-view answer a mining launch gives, and for the same reason: the
 * craft is drawn on the frame the response lands, and an older read already in
 * flight cannot land afterwards and erase it.
 */
export const pirateRaidSchema = z.object({
  raidId: z.string(),
  pirateId: z.string(),
  level: z.number().int().min(1).max(4),
  callsign: z.string(),
  fleet,
  departAt: z.coerce.date(),
  arriveAt: z.coerce.date(),
  flightMinutes: z.number(),
  intercept: vec,
  /** Deuterium taken for BOTH legs at launch, and never refunded. D136. */
  fuel: z.number(),
  pending: z.array(pendingThread),
  ...withPlanet,
});

/**
 * A LAUNCHED CONVOY, with the strip and the world it left. D53 · D156.
 *
 * The same three-view answer the mining and pirate launches give, and for the same
 * reason: the convoy is drawn on the frame the response lands, and an older read
 * already in flight cannot land afterwards and erase it.
 *
 * `rate` COMES BACK FROM THE SERVER rather than being read off the merchant chip.
 * It is frozen on the run at launch, so the figure the return leg will actually
 * pay is the figure the answer states — the client never has to assume that the
 * ship it quoted against is the ship the server priced against.
 */
export const tradeLaunchSchema = z.object({
  runId: z.string(),
  occurrenceId: z.string(),
  fleet,
  give: resources,
  want: resources,
  rate: tradeRateSchema,
  departAt: z.coerce.date(),
  arriveAt: z.coerce.date(),
  flightMinutes: z.number(),
  /** Where the convoy meets the merchant. Solved once, frozen, and drawn (D155). */
  intercept: vec,
  /** Deuterium taken for BOTH legs at launch, and never refunded. D136. */
  fuel: z.number(),
  pending: z.array(pendingThread),
  ...withPlanet,
});


/**
 * Other players' fleets, deliberately unattributable.
 *
 * No id, owner, kind or destination — and `from`/`to` are points on the middle of
 * a flight, not the planets at either end. See the server's `services/traffic.ts`
 * for why each of those is load-bearing.
 */
/**
 * OTHER PEOPLE'S CRAFT. D24.
 *
 * Position is public; intent is not. `from`/`to` are a BEARING WINDOW — where a
 * contact is now and where it will be a few minutes from now — so the disc can
 * animate it smoothly without ever carrying the world it left or the world it is
 * about to reach. There is no field here for a modified client to turn into a
 * route.
 *
 * `route` and `minutesRemaining` are the single exception, and they are only ever
 * populated for an authorised `mining` contact: once this commander has discovered
 * the rock, its line and clock make the contested race visible.
 *
 * Radar is a silhouette, Telescope is sight, and cargo is never public. `mass`
 * says roughly how much is crossing in the Radar band. `fleet` is present only
 * once an actual fleet is inside Telescope sight and carries the exact hull tally.
 * There is no field for ore or loot: cargo belongs to the commander who sent it.
 */
export const trafficSchema = z.object({
  contacts: z.array(
    z.object({
      /** Stable for the flight, so focus survives a refetch. Maps to nothing else. */
      id: z.string(),
      /**
       * `unknown` IS A CRAFT YOU CAN SEE AND CANNOT IDENTIFY. D125.
       *
       * Outside your Telescope's reach a contact keeps its position and loses
       * everything the instrument sells: no kind, so the neon cannot say whether
       * it is a warship, a scout or a drill, and no mass. It exists so the disc can
       * say THERE IS SOMETHING OUT THERE AND YOU CANNOT SEE WHAT IT IS — which is
       * an advertisement for the Telescope written in the picture rather than in a
       * tooltip (D124).
       */
      kind: z.enum(['unknown', 'fleet', 'probe', 'death_star', 'mining', 'harvest', 'pirate']),
      /**
       * WHAT KIND OF CRAFT A QUESTION MARK IS, WHEN RADAR L5 HAS EARNED IT.
       *
       * Only ever present on an `unknown` contact — inside telescope reach `kind`
       * already says it. The top of the radar ladder, paying out on ordinary
       * traffic rather than only on a raid aimed at you. A kind, never a roster.
       */
      silhouette: z
        .enum(['unknown', 'fleet', 'probe', 'death_star', 'mining', 'harvest', 'pirate'])
        .optional(),
      from: vec,
      to: vec,
      startAt: z.coerce.date(),
      endAt: z.coerce.date(),
      /**
       * THE WINDOW ENDS WHERE THE CRAFT DOES. See `Contact.landing` on the server.
       *
       * Absent means the far end is a HEADING, and the client may coast a little
       * past it when a read is late. Present means it is the craft's stopping point
       * and coasting would fly it through the world it is landing on.
       *
       * Optional so a client ahead of its server still parses: an older payload
       * carries no flag, the coast behaves exactly as it did before, and nothing
       * breaks — the failure it prevents is cosmetic and rare, and a hard schema
       * would turn it into a disc that does not render at all.
       */
      landing: z.boolean().optional(),
      /**
       * How big it looks. Three steps, off the whole fleet's value. D123.
       *
       * Optional because an identified `mining` or `harvest` contact carries exact
       * `craft` instead, and because an older payload has none.
       */
      mass: massClass.optional(),
      /** Exact hull tally, only for an identified fleet inside Telescope sight. */
      fleet: fleet.optional(),
      /**
       * HOW HARD A PIRATE HITS. IDENTIFIED PIRATES ONLY. D150.
       *
       * The level is the price tag — it sets the damage handicap, the roster's
       * tier ceiling and the odds of towing a hull home — so it is the Telescope's
       * product, exactly like a fleet's manifest. A Radar contact gets a question
       * mark, a mass and a silhouette, and never this.
       */
      level: z.number().int().min(1).max(4).optional(),
      /**
       * THIS ONE IS COMING FOR YOU, AND THAT IS ALL IT SAYS. D126.
       *
       * The radar's long tier, which reaches two to four times further than the
       * timed ladder and deliberately carries no clock — raising the timed ladder
       * that far was measured and refused, because notice saturates inside a
       * neighbourhood and every raid would hand over its whole flight (D9, D13).
       * It can sit on an `unknown` contact, which is the intended picture:
       * something you cannot identify, bearing down on a world you own.
       */
      inbound: z.literal(true).optional(),
      /**
       * OUT OF SIGHT, STILL TRACKED. PIRATES ONLY. D160.
       *
       * Present when nothing of this commander's covers the craft right now and it
       * is on the disc because they identified it once. The point and the manifest
       * are both current — an orbit is solvable and the crew is the lane's live
       * state — so the renderer fades this craft to say the commander cannot SEE it,
       * never to imply the numbers are old.
       */
      remembered: z.literal(true).optional(),
      craft: z.number().optional(),
      route: z
        .object({
          from: vec,
          to: vec,
          departAt: z.coerce.date(),
          arriveAt: z.coerce.date(),
        })
        .optional(),
      minutesRemaining: z.number().optional(),
      /**
       * A PUBLIC BOMBARDMENT WITH NO SENSOR CONTACT. D52/D123.
       *
       * The event remains visible galaxy-wide, but this payload carries no real
       * craft position, bearing, silhouette or mass. The renderer must draw only
       * the volley/effects. Radar or Telescope sight removes this flag and earns
       * the ordinary contact representation instead.
       */
      effectOnly: z.literal(true).optional(),
      /**
       * THE RAID IS LANDING, AND EVERYBODY WATCHES IT. D52.
       *
       * Present only on an attack, only between `arriveAt` and `endsAt`, and only
       * ever carrying the TARGET's coordinates — which are public on every world in
       * the disc. It lets every client fire the same deterministic volley. The
       * squadron itself is a separate disclosure: `effectOnly` means no sensor saw
       * it; otherwise the contact's ordinary Radar/Telescope fields describe it.
       */
      engagement: z
        .object({ arriveAt: z.coerce.date(), endsAt: z.coerce.date(), target: vec })
        .optional(),
      /**
       * A STRIKE LANDED HERE, AT THIS INSTANT. D106.
       *
       * The same shape as `engagement` and there for the same reason: an effect
       * everybody is supposed to watch together is PUBLISHED as a moment and a
       * place, never re-derived from a flight by each renderer that draws it. A
       * Death Star's detonation used to exist only on the attacker's own client,
       * because only the attacker held a payload it could be worked out from.
       *
       * Optional, so a client ahead of its server still parses and simply draws no
       * explosion — the same rule `landing` follows.
       */
      impact: z
        .object({ at: z.coerce.date(), target: vec })
        .optional(),
    }),
  ),
  /** An eight-second anti-strategic collision, visible only to participants or Telescope sight. */
  interceptions: z.array(z.object({
    id: z.string(),
    targetPlanetId: z.string(),
    trigger: z.enum(['RADAR', 'TELESCOPE']),
    launchAt: z.coerce.date(),
    impactAt: z.coerce.date(),
    launch: vec3,
    deathStarFrom: vec3,
    collision: vec3,
  })).optional(),
  /** Public effect-only aftermath of an anti-strategic collision. */
  interceptionImpacts: z.array(z.object({
    id: z.string(),
    at: z.coerce.date(),
    collision: vec3,
    effectOnly: z.boolean(),
    focusEligible: z.boolean(),
  })).optional(),
});
export type Contact = z.infer<typeof trafficSchema>['contacts'][number];
export type StrategicInterception = NonNullable<z.infer<typeof trafficSchema>['interceptions']>[number];
export type StrategicInterceptionImpact = NonNullable<
  z.infer<typeof trafficSchema>['interceptionImpacts']
>[number];

/* ── the rehearsal, and claiming what it built ──────────────── */

/**
 * THE GALAXY BEFORE YOU HAVE AN ACCOUNT. D56.
 *
 * ONE PUBLIC REQUEST, SHAPED AS THE THREE PAYLOADS THE CLIENT ALREADY PARSES.
 * `season`, `galaxy` and `traffic` are the production schemas, reused rather than
 * mirrored — which is what lets the rehearsal answer those three routes from local
 * state without a second set of types, and what makes the contract test cover the
 * preview and the live game with the same assertions.
 *
 * `reserved` is the world the server would give this visitor: real slot, real
 * position, real name. It is a preview and not a reservation — two people looking
 * at once are shown the same slot, and whoever claims second lands on the next one.
 */
export const previewSchema = z.object({
  season: seasonSchema,
  galaxy: galaxySchema,
  traffic: trafficSchema,
  reserved: z.object({
    id: z.string(),
    name: z.string(),
    slotIndex: z.number(),
    position: vec3,
  }),
  shard: z.object({
    code: z.string(),
    name: z.string(),
    planets: z.number(),
    capacity: z.number(),
    online: z.number(),
  }),
});

/**
 * ONE DECISION THE VISITOR MADE, ON ITS WAY TO THE SERVER.
 *
 * INTENTS, NOT OUTCOMES. The rehearsal ran the same `@astera/rules` the server
 * validates with, so the screen could keep up with a finger — but what travels is
 * only ever what was PRESSED. Principle 1: the client renders and sends intent.
 *
 * A request schema rather than a response one, so the shape the client builds is
 * checked by the same tool that checks what comes back, and the server's own
 * `z.discriminatedUnion` has something to be compared against.
 */
export const claimIntent = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('upgrade'), building: buildingId }),
  z.object({ kind: z.literal('build'), hull: hullId, count: z.number().int().min(1) }),
  z.object({
    kind: z.literal('launch'),
    targetPlanetId: z.string(),
    fleet: z.record(hullId, z.number().int().min(0)),
  }),
]);

/**
 * What became of one decision the rehearsal recorded, once the server ran it.
 *
 * A refusal is a CODE and its figures, never a finished sentence (D55): the target
 * that crossed out of the tier band while somebody typed a password has to be
 * sayable in both languages.
 */
export const appliedSchema = z.object({
  kind: z.enum(['upgrade', 'build', 'launch']),
  ok: z.boolean(),
  error: z.string().optional(),
  params: z.record(z.union([z.string(), z.number()])).optional(),
});

/**
 * The claim: an account, a seat and the whole opening, in one answer.
 *
 * It carries the planet view for the same reason every mutation does (D53) — the
 * interface must never have to ask a second time for the consequence of a tap, and
 * the one call that CREATES a planet is the last place to make an exception.
 */
export const claimSchema = sessionSchema.extend({
  placement: z.object({
    shard: z.string(),
    shardName: z.string(),
    planetId: z.string(),
    planetName: z.string(),
  }),
  applied: z.array(appliedSchema),
  planet: planetSchema,
});

/* ── operator announcements and player feedback ───────────── */

export const announcementSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  bodyHtml: z.string(),
  publishedAt: z.coerce.date(),
  seen: z.boolean(),
});
export const announcementsPageSchema = z.object({
  announcements: z.array(announcementSchema),
});
export const announcementPublishedSchema = z.object({ announcement: announcementSchema });
export const feedbackKindSchema = z.enum(['BUG', 'SUGGESTION', 'PRAISE']);
export const feedbackSubmittedSchema = z.object({
  feedback: z.object({ id: z.string().uuid(), createdAt: z.coerce.date() }),
});
export const adminFeedbackPageSchema = z.object({
  feedback: z.array(z.object({
    id: z.string().uuid(),
    kind: feedbackKindSchema,
    message: z.string(),
    createdAt: z.coerce.date(),
    accountId: z.string().uuid(),
    username: z.string(),
    displayName: z.string(),
  })),
});

export type Session = z.infer<typeof sessionSchema>;
export type Me = z.infer<typeof meSchema>;
export type ServerRow = z.infer<typeof serverSchema>;
export type ServerStatus = z.infer<typeof serverStatus>;
export type ServerList = z.infer<typeof serverListSchema>;
export type Placement = z.infer<typeof placementSchema>;
export type SeasonInfo = z.infer<typeof seasonSchema>;
export type ActiveGalaxyEvent = z.infer<typeof activeGalaxyEventsSchema>['events'][number];
export type HistoricalSeasonResult = z.infer<typeof historicalSeasonResultSchema>;
type ParsedPlanetView = z.infer<typeof planetSchema>;
type ParsedQueues = NonNullable<ParsedPlanetView['queues']>;
export type ServerBuildOrderView = ParsedQueues[keyof ParsedQueues][number];
export type ResearchOrderView = NonNullable<ParsedPlanetView['researchQueue']>[number];

export interface OptimisticResearchOrderView {
  id: string;
  slot: number;
  projectId: ResearchProjectId;
  level: number;
  cost: Resources;
  optimistic: true;
  startedAt?: undefined;
  finishesAt?: undefined;
}

export type ResearchQueueOrderView = ResearchOrderView | OptimisticResearchOrderView;

/** A tap acknowledged locally while the authoritative mutation is in flight. */
export interface OptimisticBuildOrderView {
  id: string;
  queue: BuildQueueId;
  slot: number;
  kind: ServerBuildOrderView['kind'];
  subject: string;
  count: number;
  cost: Resources;
  optimistic: true;
  startedAt?: undefined;
  finishesAt?: undefined;
}

export type BuildOrderView = ServerBuildOrderView | OptimisticBuildOrderView;
export type PlanetView = Omit<ParsedPlanetView, 'queues' | 'researchQueue'> & {
  queues?: {
    CONSTRUCTION: BuildOrderView[];
    YARD: BuildOrderView[];
  };
  researchQueue?: ResearchQueueOrderView[];
};
type ParsedPlanetsView = z.infer<typeof planetsSchema>;
export type PlanetsView = Omit<ParsedPlanetsView, 'planets'> & { planets: PlanetView[] };
export type RewardsView = z.infer<typeof rewardsSchema>;
export type RewardChainView = RewardsView['chains'][number];
export type RewardTierView = z.infer<typeof rewardTier>;
export type GalaxyView = z.infer<typeof galaxySchema>;
export type GalaxyPlanet = GalaxyView['planets'][number];
export type Leaderboard = z.infer<typeof leaderboardSchema>;
export type PublicClan = z.infer<typeof publicClanSchema>;
export type ClanDirectory = z.infer<typeof clanDirectorySchema>;
export type ClanBadge = z.infer<typeof clanBadgeSchema>;
export type ClanHome = z.infer<typeof clanHomeSchema>;
export type ClanMemberHome = Extract<ClanHome, { state: 'MEMBER' }>;
export type ClanOutsideHome = Extract<ClanHome, { state: 'OUTSIDE' }>;
export type ClanDepot = z.infer<typeof clanDepotSchema>;
export type ClanAid = z.infer<typeof clanAidSchema>;
export type ClanAidQuote = z.infer<typeof clanAidQuoteSchema>;
export type ClanChatPage = z.infer<typeof clanChatPageSchema>;
export type ClanMessage = ClanChatPage['messages'][number];
export type ClanStrength = z.infer<typeof clanStrengthSchema>;
export type ClanEventsPage = z.infer<typeof clanEventsPageSchema>;
export type ClanEvent = ClanEventsPage['events'][number];
export type ChatPage = z.infer<typeof chatPageSchema>;
export type ChatMessage = ChatPage['messages'][number];
export type ChroniclePage = z.infer<typeof chroniclePageSchema>;
export type GalaxyEvent = ChroniclePage['events'][number];
export type IntelView = z.infer<typeof intelSchema>;
export type WatchView = IntelView['watching'][number];
export type ProbeReport = IntelView['probeReports'][number];
export type ScanRow = IntelView['radarLog'][number];
export type ReturnPayload = z.infer<typeof returnSchema>;
export type ReturnEntry = ReturnPayload['entries'][number];
export type PendingThread = z.infer<typeof pendingThread>;
export type PiratesView = z.infer<typeof piratesSchema>;
export type PirateContact = PiratesView['pirates'][number];
export type PirateRaidResult = z.infer<typeof pirateRaidSchema>;
export type Unlockable = z.infer<typeof unlockable>;
export type LaunchResult = z.infer<typeof launchSchema>;
export type MiningLaunchResult = z.infer<typeof miningLaunchSchema>;
export type MiningView = z.infer<typeof miningSchema>;
export type MiningFieldView = z.infer<typeof miningFieldSchema>;
export type MiningStatusView = z.infer<typeof miningStatusSchema>;
export type AsteroidView = z.infer<typeof asteroidSchema>;
export type MiningRun = MiningView['runs'][number];
export type CollectResult = z.infer<typeof collectSchema>;
export type NotificationView = z.infer<typeof notificationsSchema>['notifications'][number];
export type Preview = z.infer<typeof previewSchema>;
export type Applied = z.infer<typeof appliedSchema>;
export type ClaimResult = z.infer<typeof claimSchema>;
export type ClaimIntent = z.infer<typeof claimIntent>;
export type Announcement = z.infer<typeof announcementSchema>;
export type AnnouncementsPage = z.infer<typeof announcementsPageSchema>;
export type FeedbackKind = z.infer<typeof feedbackKindSchema>;
export type AdminFeedbackPage = z.infer<typeof adminFeedbackPageSchema>;
