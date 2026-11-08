/**
 * THE STARTER GALAXY'S NUMBERS, in one place. See docs/baslangic-galaksisi-plani-2026-11-04.md §4.
 *
 * A new commander plays here for days on a broken colony ship before the jump to the main
 * galaxy. Everything is a first value to be tuned by play; nothing here changes the main game.
 *
 * COORDINATES ARE LOCAL: a galaxy's centre is its origin, and the main galaxy is drawn
 * `mainOffsetOf(ordinal)` away. Orbits, the camera leash and the ambient layers all assume the origin.
 */
export const STARTER = {
  /** Sized to `capacity` by measure: the first telescope finds about 3 neighbours, the third about 22 of 29. */
  radius: 900,
  minSeparation: 250,
  capacity: 30,
  /** No progress for this long and a ship gives up its place. The main game's is 30 hours. Owner, 2026-11-05. */
  idleMs: 48 * 60 * 60 * 1000,
  /**
   * `works`: the prologue's first batch, still in the refinery (about an hour of Refinery 1), so the
   * first "collect" a new player is told to do works at once. Owner, 2026-11-06.
   * `alloy` 930 (was 650): after the first session the next required repair can be paid in about an
   * hour, not three (owner, 2026-11-06). Only this stock moved; prices and production are the main game's.
   */
  opening: { alloy: 930, crystal: 300, deuterium: 0, modules: { REFINERY: 1 }, works: { alloy: 60 } },
  /** Reach with no telescope at all: short of `minSeparation`, so no neighbour shows. */
  nakedEye: 150,
  /** By repair stage. The main game's Telescope 1 would see nearly this whole galaxy. */
  telescope: [0, 450, 750, 1100],
  radar: [0, 600, 1000, 1500],
  /** At the main game's 2369 a 300-unit flight lasts 9 seconds and cannot be watched. */
  probeSpeed: 790,
  /** Doubled by the owner 2026-11-08: the first haul is a thing to watch, not to wait for. */
  prospectorSpeed: 600,
  hulls: ['DART', 'PIKE', 'WARDEN', 'COURIER', 'PROSPECTOR'],
  hangarRoom: [20, 32, 50],
  attackBays: [1, 2, 3],
  queues: { construction: 3, yard: 3, dock: 1, research: 1 },
  pvp: {
    lootDecisive: 0.10,
    lootPartial: 0.05,
    lootBufferShare: 0.5,
    shieldHours: 12,
    recoveryShieldHours: 3,
    bashLimit: 2,
    bashWindowMinutes: 720,
    dailyRaidCap: 3,
    lockAfterDays: 14,
  },
  /** The main game fights at 0.20. Aegis scales with the same ratio; see `vesselAegisHp`. */
  combat: { tempo: 0.10, aegisMax: 2 },
  repair: { pct: 25, dockTimeMult: 12 },
  battleDebris: { share: 0.10, minimum: 100, decayMinutes: 40 },
  sites: {
    asteroidsPerActivePerHour: 0.5,
    /** About a hold each (owner 2026-11-08): few rocks in sight, so each is worth the flight and nobody farms all night. */
    asteroidOre: [800, 1200],
    /** How many rocks a telescope shows, by stage: the nearest few inside its ring (owner 2026-11-08). */
    rocksInSight: [0, 3, 4, 6],
    wrecks: { count: 6, stock: [300, 600], respawnMinutes: 120 },
    outposts: { count: 8, guards: [2, 3, 6], stock: [250, 450, 900], respawnMinutes: 360 },
  },
  parts: { needed: 3, respawnMinutes: 120, minOpen: 2 },
  /**
   * The first Prospector's rock (retention plan §6.3): a finished Shipyard with no rock this close is
   * given one passing between `near` and `far` units away, about a minute's flight.
   */
  firstRock: { near: 150, far: 300 },
  /**
   * The first hunt (owner 2026-11-08, N6–N7): a finished Shipyard is shown a Sur-held first-level
   * outpost and an Akıncı- or Mızrak-held second-level one, between `near` and `far` (a Dart pair's
   * three to five minutes). They are shared, kept by nobody. Each yard is given two at most, once, so
   * `extraMax` is two a seat: a smaller cap left a third of a full galaxy with no first hunt (2026-11-08).
   */
  firstOutposts: { near: 300, far: 450, extraMax: 60 },
  /** The main game's own projects at its own prices, two levels at most. They end with the ship. */
  research: { projects: ['SHIP_POWER', 'SHIP_ARMOR', 'SHIP_PROPULSION', 'PROSPECTOR_HOLDS'], maxLevel: 2 },
  fuelForJump: 90,
  deuteriumGrant: 20,
  carry: { alloy: 2000, crystal: 1000, deuterium: 50, ships: 6 },
  retentionDays: 30,
  migrationCutoffDays: 5,
  bots: { base: 8, perActive: 4, min: 12, max: 60 },
} as const;
