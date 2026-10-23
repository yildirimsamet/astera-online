import type { Capsule } from './hull.js';

/** Provisional values: docs/komutan-gemisi/04-savas-mekanikleri.md §13. */
const NUMBERS = Object.freeze({
  tickRate: 30,
  snapshotRate: 15,
  // A flat disc, not a sphere: a level reference plane keeps the field readable while
  // the slab is still deep enough to lose someone in a dense belt.
  // Owner 2026-10-22: 30–50 pilots need room to farm alone; the Rift grows to 13 km
  // (16-yarik-v6-plani §3).
  arenaRadius: 13000,
  arenaHalfHeight: 2000,
  spawnJitter: 60,
  spawnClear: 160,
  exitRadius: 120,
  exitHold: 3,
  spawnShield: 15,
  // Owner 2026-10-23: 120 / 216 was too fast to hit; at most 80, 160 in turbo (KG-X25).
  speedMax: 80,
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
  turboSpeedMul: 2,
  turboAccelMul: 7,
  turboTurnMul: 0.6,
  // v6: rim → heart → exit at full throttle leaves a third of the tank to farm (§3).
  fuelTank: 250,
  idleBurn: 0.02,
  throttleBurn: 0.25,
  turboBurn: 0.25,
  // Owner 2026-10-21: ammunition is its own magazine, not fuel. Full at the start of a
  // flight (60 s of continuous fire at fireRate), never refilled in flight.
  ammoCapacity: 480,
  hull: 400,
  /** Nominal ship size: the arena wall, bot sight lines and layout clearances. */
  shipHitRadius: 6,
  /**
   * The generic hull (Y2): a fuselage capsule along the nose and a wing capsule across it, in
   * metres. Every class flies its own capsules fitted to its model instead (classes.ts). Rock,
   * buildings and shots all meet the capsules, not a ball. A shot counts within hitPad of them:
   * the arcade allowance that keeps a crossing target hittable.
   */
  bodyLength: 15,
  bodyRadius: 2.2,
  wingSpan: 9,
  wingRadius: 1,
  wingZ: -2,
  hitPad: 1.5,
  boundaryWarn: 200,
  // Touching a surface at or below this speed is a landing, above it a scrape.
  landSpeed: 24,
  landSettle: 0.35,
  landedYawRate: 1.2,
  liftSpeed: 14,
  liftTicks: 12,
  landedTurboRegenMul: 2,
  // Bounce (owner 2026-10-21): the speed into the surface springs back by a restitution that
  // rises from bounceMin towards bounceMax, half way at bounceHalf m/s. Friction takes
  // scrapeFriction × the normal impulse off the sliding speed.
  bounceMin: 0.15,
  bounceMax: 0.4,
  bounceHalf: 50,
  scrapeFriction: 0.25,
  knockDecay: 1.6,
  mineRate: 4,
  crystalReserve: 40,
  crystalRegen: 0.35,
  damage: 10,
  fireRate: 8,
  // Owner 2026-10-21: twice as fast (600 m/s before) so the lead mark sits near the hull;
  // the life is halved with it, so the range stays 900 m.
  muzzleSpeed: 1200,
  projectileLife: 0.75,
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
  // Player aim circle (owner 2026-10-21): the heading stays the pilot's; the guns follow the
  // lead inside the circle and go straight again once the target leaves it. The circle is drawn
  // round the nose at convergeDist, 8.5° wide (cosine below; 7° before), and the rule is the cone
  // from the chase camera's eye through it: up close a cone from the nose missed targets that
  // sat inside the drawn circle. The eye mirrors the camera arm at cruise (render/camera.ts).
  // Bots keep the narrow gimbal above and the steering magnet.
  aimCircleCos: 0.9890158633619168,
  aimRange: 900,
  aimEyeBack: 34,
  aimEyeUp: 7.2,
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
  // V6f: a line deeper than this through one dust cloud is blind (sight inside a cloud).
  dustSight: 350,
  cloakDuration: 4,
  cloakCooldown: 25,
  // Y4c signatures (plan 14 §4, owner 2026-10-23). The Akıncı's lock builds by itself while a
  // ship sits in the aim circle within aimRange for lockTime; the missile flies at missileSpeed,
  // turns at most missileTurn (rad/s), hits for missileDamage and burns out after missileLife.
  lockTime: 1,
  missileSpeed: 260,
  missileTurn: 1.0471975511965976,
  // cos(missileTurn / tickRate): the most a missile turns in one tick (no trigonometry in the shared simulation).
  missileTurnCos: 0.9993908270190958,
  missileDamage: 80,
  missileLife: 6,
  // The Muhafız's shield absorbs wardHp for wardDuration; the hit that breaks it stops there.
  wardHp: 80,
  wardDuration: 20,
  // The Kılavuz's repair: mendHp over mendDuration, times mendHurtFactor while hit in the last mendHurtWindow s.
  mendHp: 120,
  mendDuration: 4,
  mendHurtWindow: 1,
  mendHurtFactor: 0.5,
  // Y4d, B slot (plan 14 §4, ÖNERİ): illusion. A copy flies the mirror of its pilot for
  // illusionDuration s and breaks once it has taken decoyHullShare of its class hull.
  illusionDuration: 6,
  illusionCooldown: 20,
  decoyHullShare: 0.25,
  // Radar sweep: every enemy in the arena marked for radarDuration s, the scanned told from where.
  radarDuration: 3,
  radarCooldown: 30,
  fuelOutRescueDelay: 10,
  testCargo: 60,
  cargoCapacity: 100,
  // Owner 2026-10-22: loose pieces are pulled in like a magnet by the first ship this close
  // that can hold them whole, homing at the puller's own speed plus magnetPull (m/s).
  magnetRadius: 50,
  magnetPull: 90,
  /** Wreck pieces (a destroyed hold) vanish after this; field farms never do. */
  dropLife: 300,
  wreckDrops: 48,
  dropChunk: 10,
  scatterRadius: 16,
  farmSpots: 150,
  /** Field ore groups (a lone piece or a cluster); a fully taken group regrows elsewhere. */
  fieldGroups: 12,
  fieldFarmRespawn: 20,
  // Inside magnetRadius from the middle: one pass through a cluster pulls all of it.
  clusterRadius: 30,
  /** Landable rocks veined with alloy or deuterium, besides the crystal formations. */
  alloyDeposits: 30,
  deuteriumDeposits: 12,
  botRespawn: 8,
  /**
   * Bot temper (owner 2026-10-21: a little less sharp, accurate and stubborn — not simple).
   * Sight per role in metres; a chase holds to sight × botChaseHold. The aim wobbles by
   * botAimWobble metres and tracks at botTurnGain; the trigger is held botBurstOn of every
   * botBurstCycle seconds, inside botFireRange. Hurt below botFleeHull under fire, it breaks off.
   */
  botSightHunter: 1300,
  botSightPatrol: 650,
  botChaseHold: 1.1,
  botAimWobble: 12,
  // 2.7 → 1.8 with 80 m/s (KG-X25): a weave moves a slower hull less, so the bot tracks a
  // little slower to stay beatable; bot ↔ bot fights keep their old volume.
  botTurnGain: 1.8,
  botBurstOn: 0.8,
  botBurstCycle: 2,
  botFireRange: 560,
  botFleeHull: 0.45,
  /** Fires while the lead is within this many hull radii of the nose line (bot ↔ bot tangles). */
  botHullAim: 2.7,
  /** Closer than botTangleRange with no firing line for botTangle seconds: extend for botExtend. */
  botTangleRange: 120,
  botTangle: 4,
  botExtend: 3,
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

const fuselage = Math.max(0, NUMBERS.bodyLength / 2 - NUMBERS.bodyRadius);
const wing = Math.max(0, NUMBERS.wingSpan / 2 - NUMBERS.wingRadius);
export const ARENA_TUNING = Object.freeze({
  ...NUMBERS,
  /** The hull in the ship's own frame (nose +Z, up +Y), in metres. */
  capsules: Object.freeze([
    Object.freeze({ ax: 0, ay: 0, az: -fuselage, bx: 0, by: 0, bz: fuselage, r: NUMBERS.bodyRadius }),
    Object.freeze({ ax: -wing, ay: 0, az: NUMBERS.wingZ, bx: wing, by: 0, bz: NUMBERS.wingZ, r: NUMBERS.wingRadius }),
  ]),
});

export type FlightTuning = { [K in keyof typeof NUMBERS]: number } & { readonly capsules: readonly Readonly<Capsule>[] };
