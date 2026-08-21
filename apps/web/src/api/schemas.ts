import { z } from 'zod';
import type {
  BuildingId,
  ClarityState,
  FleetStatus,
  Grade,
  HullId,
  InstrumentId,
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
  'WASP', 'LANCE', 'BULWARK', 'HAULER', 'BASTION', 'THORN', 'PROSPECTOR',
]);
export const buildingId = z.enum(['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD']);
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
export const clarityState = z.enum(['FULL', 'CLEAR', 'INTERMITTENT', 'DEGRADED', 'BLIND']);
export const grade = z.enum(['DECISIVE', 'PARTIAL', 'REPELLED']);

// If any of these stop compiling, the rules changed and this file has not.
const _hull: Exact<z.infer<typeof hullId>, HullId> = true;
const _building: Exact<z.infer<typeof buildingId>, BuildingId> = true;
const _instrument: Exact<z.infer<typeof instrumentId>, InstrumentId> = true;
const _satellite: Exact<z.infer<typeof satelliteId>, SatelliteId> = true;
const _status: Exact<z.infer<typeof fleetStatus>, FleetStatus> = true;
const _clarity: Exact<z.infer<typeof clarityState>, ClarityState> = true;
const _grade: Exact<z.infer<typeof grade>, Grade> = true;
void [_hull, _building, _instrument, _satellite, _status, _clarity, _grade];

const fleet = z.record(hullId, z.number());
const vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() });
const resources = z.object({ alloy: z.number(), crystal: z.number() });
const band = z.object({ low: z.number(), high: z.number() });

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
export const meSchema = z.object({
  accountId: z.string(),
  username: z.string(),
  displayName: z.string(),
  placement: z
    .object({ shard: z.string(), shardName: z.string(), planetName: z.string() })
    .nullable(),
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
  shardName: z.string(),
  /** The galaxy layout and every asteroid orbit are rebuilt from this locally. */
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
    /**
     * The works: uncollected production, and the ceiling it stops at. D16.
     *
     * Both are needed here, not just the amount, because the interface has to say
     * "full in 3h 20m" before it can say "FULL — you are throwing away 160/h", and
     * only the second of those is a reason to open the game right now.
     */
    bufferAlloy: z.number(),
    bufferCrystal: z.number(),
    bufferAlloyCap: z.number(),
    bufferCrystalCap: z.number(),
    vaultFloor: z.number(),
    shield: z.number(),
    disruptedUntil: z.coerce.date().nullable(),
  }),
  buildings: z.record(buildingId, z.number()),
  nextCosts: z.record(buildingId, resources),
  /** The four on the ground, with their levels. D25. */
  instruments: z.record(instrumentId, z.number()),
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
  orbitSlots: z.number(),
  /** Flat, because a satellite is bought once and never raised. */
  satelliteCosts: z.record(satelliteId, resources),
  fleet,
  ground: fleet,
  /** Your own craft that are off the planet right now. Ownership, not readiness. */
  fleetAway: fleet,
  /** Craft in the air, and how many bays the Command Core has opened. D28. */
  flight: z.object({ used: z.number(), total: z.number() }),
  score: z.object({ wealth: z.number(), dominion: z.number() }),
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
  you: z.object({ planetId: z.string(), playerId: z.string() }),
  planets: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      owner: z.string(),
      position: vec3,
      coreTier: z.number(),
      /**
       * The instruments in orbit, types only and never levels (D15). Hardware is
       * public — it is a physical object anyone can see — while what it can DO
       * stays behind a probe.
       */
      satellites: z.array(satelliteId),
      /**
       * Is there a dome around this world. D25.
       *
       * The Aegis is a ground instrument now and so is not in `satellites`, but a
       * shield shell is a physical object anyone can see and deterrence only works
       * if it is legible. A boolean, never a level: how strong the dome is stays
       * behind a probe, and that is the number that decides the raid.
       */
      shielded: z.boolean(),
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
      cooldownUntil: z.coerce.date().nullable(),
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

export const collectSchema = z.object({
  moved: resources,
  /** Would not fit; still sitting in the works rather than destroyed. */
  blocked: resources,
  alloy: z.number(),
  crystal: z.number(),
  bufferAlloy: z.number(),
  bufferCrystal: z.number(),
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
  kind: z.enum(['fleet', 'probe', 'incoming']),
  targetName: z.string(),
  minutesRemaining: z.number(),
  /** The exact landing instant, on your own craft and on an inbound one alike. */
  arriveAt: z.coerce.date(),
  leg: z.enum(['outbound', 'return']).optional(),
  /**
   * What is in it — YOUR OWN CRAFT ONLY.
   *
   * NOT BECAUSE COMPOSITION IS SECRET. It is not, and has not been since D24: every
   * craft in the galaxy is readable down to the hull on `/api/galaxy/traffic`, and a
   * defender reads a fleet coming at them exactly as any stranger does. What the
   * Radar sells is ATTRIBUTION — that it is coming for YOU, and how long you have.
   *
   * It is absent here because THIS payload is the attributed one: everything on it
   * is already known to be aimed at you, so a composition here would hand over the
   * radar's answer along with its question. See `services/session.ts`.
   */
  fleet: fleet.optional(),
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
 * Both participants get the same facts because both were there. Survivors are not
 * in the payload at all — a report tells you what someone fielded, not what they
 * kept.
 */
export const reportsSchema = z.object({
  reports: z.array(
    z.object({
      id: z.string(),
      at: z.coerce.date(),
      grade,
      rounds: z.array(
        z.object({
          round: z.number(),
          attackerDamage: z.number(),
          defenderDamage: z.number(),
          shieldAbsorbed: z.number(),
          attackerLosses: fleet,
          defenderLosses: fleet,
        }),
      ),
      attacking: z.boolean(),
      opponentName: z.string(),
      opponentPlanet: z.string(),
      yourLosses: fleet,
      theirLosses: fleet,
      lootAlloy: z.number(),
      lootCrystal: z.number(),
      /** Null on reports written before the swing was recorded. */
      dominion: z.number().nullable(),
    }),
  ),
});
export type BattleReport = z.infer<typeof reportsSchema>['reports'][number];

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
 * request rather than a stream (A4, A5). Public by design — everyone races for the
 * same prize, and none of this reveals anything about a player.
 */
export const asteroidSchema = z.object({
  index: z.number(),
  level: z.number(),
  ore: z.number(),
  oreRemaining: z.number(),
  /** Share of the haul that comes back as crystal. */
  crystalShare: z.number(),
  radius: z.number(),
  period: z.number(),
  phase: z.number(),
  y: z.number(),
  speed: z.number(),
  appearsAt: z.number(),
  expiresAt: z.number(),
});

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
  /** Wreck fields left by battles. Public in full — size, place and clock. D32. */
  debris: z.array(
    z.object({
      id: z.string(),
      planetId: z.string(),
      alloy: z.number(),
      crystal: z.number(),
      minutesLeft: z.number(),
    }),
  ),
  runs: z.array(
    z.object({
      id: z.string(),
      targetKind: z.enum(['asteroid', 'debris']),
      asteroidIndex: z.number().nullable(),
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
    }),
  ),
});

export const miningLaunchSchema = z.object({
  runId: z.string(),
  /**
   * ABSENT ON A HARVEST. D32.
   *
   * The two launches share this shape because a haul IS a mining run, but a wreck
   * field is not in the generated asteroid field and has no index. Required, this
   * rejected every successful harvest the server ever answered.
   */
  asteroidIndex: z.number().optional(),
  craft: z.number(),
  arriveAt: z.coerce.date(),
  flightMinutes: z.number(),
  intercept: vec3,
  capacity: z.number(),
});

const vec = z.object({ x: z.number(), y: z.number(), z: z.number() });

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
 * populated for `mining`: a Prospector's run is a public race for a rock everybody
 * can already see, so its line and its clock belong to everybody.
 *
 * COMPOSITION IS PUBLIC AND CARGO IS NOT. `fleet` says which hulls are in a
 * squadron and how many; there is no field for ore or loot, because what a craft
 * is carrying belongs to the commander who sent it.
 */
export const trafficSchema = z.object({
  contacts: z.array(
    z.object({
      /** Stable for the flight, so focus survives a refetch. Maps to nothing else. */
      id: z.string(),
      kind: z.enum(['fleet', 'probe', 'mining', 'harvest']),
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
      fleet: fleet.optional(),
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
       * THE RAID IS LANDING, AND EVERYBODY WATCHES IT. D52.
       *
       * Present only on an attack, only between `arriveAt` and `endsAt`, and only
       * ever carrying the TARGET's coordinates — which are public on every world in
       * the disc. It is what lets a bystander's client hold the squadron off the
       * world and fire the same volley the attacker sees, from the same mission id.
       */
      engagement: z
        .object({ arriveAt: z.coerce.date(), endsAt: z.coerce.date(), target: vec })
        .optional(),
    }),
  ),
});
export type Contact = z.infer<typeof trafficSchema>['contacts'][number];

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

export type Session = z.infer<typeof sessionSchema>;
export type Me = z.infer<typeof meSchema>;
export type ServerRow = z.infer<typeof serverSchema>;
export type ServerStatus = z.infer<typeof serverStatus>;
export type ServerList = z.infer<typeof serverListSchema>;
export type Placement = z.infer<typeof placementSchema>;
export type SeasonInfo = z.infer<typeof seasonSchema>;
export type PlanetView = z.infer<typeof planetSchema>;
export type RewardsView = z.infer<typeof rewardsSchema>;
export type RewardChainView = RewardsView['chains'][number];
export type RewardTierView = z.infer<typeof rewardTier>;
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
export type MiningView = z.infer<typeof miningSchema>;
export type AsteroidView = z.infer<typeof asteroidSchema>;
export type MiningRun = MiningView['runs'][number];
export type CollectResult = z.infer<typeof collectSchema>;
export type NotificationView = z.infer<typeof notificationsSchema>['notifications'][number];
export type Preview = z.infer<typeof previewSchema>;
export type Applied = z.infer<typeof appliedSchema>;
export type ClaimResult = z.infer<typeof claimSchema>;
export type ClaimIntent = z.infer<typeof claimIntent>;
