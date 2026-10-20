/** Provisional values: docs/komutan-gemisi/04-savas-mekanikleri.md §13. */
export const ARENA_TUNING = Object.freeze({
  tickRate: 30,
  snapshotRate: 15,
  // A flat disc, not a sphere: a level reference plane keeps the field readable while
  // the slab is still deep enough to lose someone in a dense belt.
  arenaRadius: 2600,
  arenaHalfHeight: 650,
  ringRadius: 2050,
  centerSplit: 380,
  spawnJitter: 60,
  spawnClear: 160,
  exitRadius: 120,
  exitHold: 3,
  spawnShield: 60,
  speedMax: 120,
  accel: 34,
  decel: 20,
  stopEpsilon: 0.5,
  turnRateMax: 1.25,
  // Slower ships turn tighter: speed is the thing a pilot manages, not only fuel.
  slowTurnBonus: 0.3,
  turnResponse: 0.06,
  turnStopRatio: 0.05,
  stickLinear: 0.15,
  deadzone: 0.06,
  rollLevelRate: 1.5,
  turboSpeedMul: 1.8,
  turboAccelMul: 7,
  turboTurnMul: 0.6,
  fuelTank: 100,
  idleBurn: 0.02,
  throttleBurn: 0.25,
  turboBurn: 0.25,
  shotFuelCost: 0.02,
  hull: 400,
  shipHitRadius: 6,
  boundaryWarn: 200,
  // Touching a surface at or below this speed is a landing, above it a scrape.
  landSpeed: 24,
  landSettle: 0.35,
  landedYawRate: 1.2,
  liftSpeed: 14,
  liftTicks: 12,
  landedTurboRegenMul: 2,
  // Bounce: knock-back = approach speed × bounce; head-on keeps (1 − bounceLoss) of speed.
  bounce: 0.6,
  bounceLoss: 0.85,
  knockDecay: 1.6,
  mineRate: 4,
  crystalReserve: 40,
  crystalRegen: 0.35,
  damage: 10,
  fireRate: 8,
  muzzleSpeed: 600,
  projectileLife: 1.5,
  convergeDist: 350,
  spreadBase: 0.02617993877991494,
  // Metalstorm-style help, deliberately mild. Gimbal: the guns bend at most this far
  // (cosine of 3.5°) towards a visible target's lead point inside gimbalRange.
  gimbalCos: 0.9981347984218669,
  gimbalRange: 700,
  // Steering magnet sent as part of the pilot's own input; the server clamps it.
  assistMax: 0.32,
  assistCos: 0.9876883405951378,
  assistRange: 900,
  turboCharge: 6,
  turboRegen: 0.8,
  turboRegenDelay: 1,
  turboMinStart: 0.3,
  turboTapBurst: 0.35,
  smokeEmitDuration: 1.5,
  smokePuffInterval: 0.15,
  // Owner 2026-10-21: half again as long, 30 % wider (35 m / 7 s before).
  smokeRadius: 45.5,
  smokeGrow: 0.6,
  // Owner 2026-10-21: dispersal takes 2 s longer (1.2 → 3.2 s); the dense phase is unchanged.
  smokeLife: 12.5,
  smokeFade: 3.2,
  smokeCooldown: 18,
  cloakDuration: 4,
  cloakCooldown: 25,
  fuelOutRescueDelay: 10,
  testCargo: 60,
  cargoCapacity: 100,
  pickupRadius: 25,
  /** Wreck pieces (a destroyed hold) vanish after this; field farms never do. */
  dropLife: 300,
  wreckDrops: 48,
  dropChunk: 10,
  scatterRadius: 16,
  farmSpots: 120,
  /** Field ore groups (a lone piece or a cluster); a fully taken group regrows elsewhere. */
  fieldGroups: 12,
  fieldFarmRespawn: 20,
  // Wider than pickupRadius: each piece of a cluster is its own pass, a short run of grabs.
  clusterRadius: 30,
  /** Landable rocks veined with alloy or deuterium, besides the crystal formations. */
  alloyDeposits: 14,
  deuteriumDeposits: 6,
  botRespawn: 8,
  /**
   * Input playout (owner 2026-10-20: not a twitch shooter, the buffer may be loose).
   * 100 ms first wait; a Wi-Fi stall keeps the last input for 300 ms instead of
   * going neutral after 100; the buffer may grow to 400 ms after stalls.
   */
  inputBuffer: 3,
  inputQueueMax: 12,
  inputRepeatMax: 9,
  linkLostAfter: 1,
  linkLostGrace: 30,
  interpDelay: 0.133,
  extrapolationCap: 0.2,
  aoiRadius: 1600,
});

export type FlightTuning = { [K in keyof typeof ARENA_TUNING]: number };
