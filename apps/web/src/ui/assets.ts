import type {
  BuildingId,
  GroundHullId,
  HullId,
  InstrumentId,
  ResearchProjectId,
  SatelliteId,
} from '@astera/rules';
import { noseVector, type CraftPose, type Facing } from '../galaxy/model.js';
import { FLEET_V2_ASSET_MANIFEST } from './fleet-v2-assets.js';
export { FLEET_V2_ASSET_MANIFEST, FLEET_V2_LANDING_MODELS } from './fleet-v2-assets.js';

/**
 * The art, mapped to the game.
 *
 * Two rules govern this file.
 *
 * ONE: installations come in tiers, and the tier is chosen by LEVEL — so raising a
 * Telescope visibly replaces the dish with a bigger one. A player should be able to
 * see their planet get stronger without reading a number, and should be able to see
 * what the NEXT level looks like before paying for it.
 *
 * TWO: nothing is ever borrowed. A render that means one thing must not be used to
 * stand for another, however convenient — a Bastion drawn as a ship would state the
 * one thing about it that is false.
 */

const BASE = '/assets/images';

/** L1–2 → tier 1, L3–4 → tier 2, L5+ → tier 3. */
export const tierOf = (level: number): 1 | 2 | 3 => (level >= 5 ? 3 : level >= 3 ? 2 : 1);

export const RESOURCE_ART = {
  alloy: `${BASE}/resources/alloy.png`,
  crystal: `${BASE}/resources/crystal.png`,
  deuterium: `${BASE}/resources/deuterium.png`,
} as const;

/** Owner-supplied renders for the two strategic decisions. */
export const STRATEGIC_ART = {
  interceptor: `${BASE}/general/anti-strategic-battery.png`,
} as const;

/**
 * The identity, in the two forms it is ever used in.
 *
 * `lockup` is the full ASTERA ONLINE mark and `mark` is the same artwork with the
 * words taken off, for anywhere too small to read them.
 *
 * BOTH ARE DERIVED FILES, and the derivation matters. The supplied art is a glow
 * painted on a solid black plate; dropped straight onto the app it draws a black
 * rectangle over the void, which is a shade lighter than the plate and lit by two
 * radial gradients — so the box shows. These carry an alpha channel instead, lifted
 * so that compositing over black reproduces the original pixel for pixel. The
 * originals stay beside them untouched as the source of any future crop.
 */
export const LOGO = {
  lockup: `${BASE}/logos/logo-lockup.png`,
  mark: `${BASE}/logos/logo-mark.png`,
} as const;

/* ── planets ────────────────────────────────────────────────── */

const PLANET_COUNT = 16;

const hash = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

/**
 * Which world a planet is, forever.
 *
 * Derived from the id, so a planet looks the same to its owner and to everyone
 * watching it — a planet whose appearance drifted between screens would be a
 * different planet as far as the player's memory is concerned, and this game is
 * built on remembering who is who.
 */
export const planetArt = (planetId: string): string =>
  `${BASE}/planets/planet_${String((hash(planetId) % PLANET_COUNT) + 1)}.png`;

/**
 * Every world render there is.
 *
 * Which planet gets which is decided from its id, so a 351-world galaxy reuses
 * all of these and there is no way to know which until the payload arrives.
 * Derived from `PLANET_COUNT` rather than listed, so a seventeenth render is
 * picked up by whatever preloads them.
 */
export const PLANET_ART: readonly string[] = Array.from(
  { length: PLANET_COUNT },
  (_, i) => `${BASE}/planets/planet_${String(i + 1)}.png`,
);

/* ── hulls ──────────────────────────────────────────────────── */

export const HULL_ART: Record<HullId, string | null> = {
  ...Object.fromEntries(
    Object.entries(FLEET_V2_ASSET_MANIFEST).map(([id, entry]) => [id, entry.card]),
  ) as Pick<Record<HullId, string>, keyof typeof FLEET_V2_ASSET_MANIFEST>,
  /**
   * THE TURRET ITSELF, AT ITS FIRST TIER. No longer a borrow and no longer blank.
   *
   * Both guns were `null` because the only art in the repo was a ship, and a
   * Bastion drawn as a ship states the one thing about it that is false: that it
   * can leave. The owner has now supplied a gun on a base plate for each of them,
   * so the reason has gone and the render is the honest picture.
   *
   * This entry is the tier-1 render, for callers that know a hull and not a count.
   * A surface that knows how many are STANDING should use `groundArt` instead —
   * a battery's only ladder is how many guns are in it.
   */
  BASTION: `${BASE}/general/bastion_1.png`,
  THORN: `${BASE}/general/thorn_1.png`,
  /**
   * The craft's own render, at its first tier.
   *
   * A hull card shows what you are buying, and what you are buying is the craft
   * rather than a level of it — the ladder of three lives on the Drill's own detail
   * sheet, where the level is the thing being sold.
   */
  PROSPECTOR: `${BASE}/drills/drill_1.png`,
};

/** Owner-supplied Frontier menu art. The source filename keeps its original spelling. */
/**
 * ONE COMMISSIONED RENDER PER PROJECT. Owner's art drop.
 *
 * EVERY ROW USED TO BORROW. Nine of the fifteen wore something else's picture —
 * a doctrine wore the hull it teaches, the economy ladders wore the building or
 * resource they lift, and three separate rows all wore the Death Star. That was
 * the honest answer while no lab render existed, and it made the screen read as a
 * list of other screens: two rows with the same picture are two rows the eye has
 * to disambiguate by reading, which is the opposite of what art on a decision
 * surface is for.
 *
 * The filenames are the owner's and are used verbatim, spelling and all —
 * `bullwark`, `syntesis`, `grind` and the older `iotope` are how the files are
 * actually named on disk, and a map that quietly "corrects" them resolves to
 * nothing. `art.test.ts` resolves every path below against `public/`, so a
 * mistyped entry is a failing test rather than a missing picture in the game.
 */
export const RESEARCH_ART: Record<ResearchProjectId, string> = {
  ISOTOPE_SPECTROMETRY: `${BASE}/lab/iotope_spectrometry.png`,
  DENSE_FUEL_CELLS: `${BASE}/lab/dense_fuel_cells.png`,
  GRAVITIC_CHARGES: `${BASE}/lab/gravitational_charges.png`,
  DEUTERIUM_SYNTHESIS: `${BASE}/lab/deuterium_syntesis.png`,
  /* The three economy ladders. */
  YARD_AUTOMATION: `${BASE}/lab/yard_automation.png`,
  PROSPECTOR_HOLDS: `${BASE}/lab/prospector_holds.png`,
  CARGO_HOLDS: `${BASE}/lab/cargo_holds.png`,
  /* Fleet V2's permission root and its three bounded stat ladders. D148. */
  STARSHIP_ENGINEERING: `${BASE}/lab/starship_engineering.png`,
  SHIP_POWER: `${BASE}/lab/ship_power.png`,
  SHIP_ARMOR: `${BASE}/lab/ship_armor.png`,
  SHIP_PROPULSION: `${BASE}/lab/ship_propulsion.png`,
  EMPLACEMENT_DOCTRINE: `${BASE}/lab/emplacement_doctrine.png`,
  /* The strategic act. */
  INTERCEPTION_GRID: `${BASE}/lab/interception_grind.png`,
  STRATEGIC_STOCKPILE: `${BASE}/lab/strategic_stockpile.png`,
  /**
   * THE ONE ROW STILL WEARING SOMETHING ELSE, and it is the right one to leave.
   *
   * No lab render was commissioned for the protocol, and what it authorises IS the
   * Death Star — the picture is the subject rather than a stand-in. It is also the
   * only Death Star on the screen now that the grid and the stockpile have their
   * own, so it no longer collides with anything.
   */
  DEATH_STAR_PROTOCOL: `${BASE}/ships/death_star.png`,
};

export const PROBE_ART = `${BASE}/ships/explorer_ship.png`;

/**
 * A GROUND BATTERY, TIERED BY HOW MANY GUNS ARE STANDING.
 *
 * The two ground guns are the only hardware in the game with three renders and no
 * level, so rule ONE at the top of this file needed one restatement to apply: a
 * battery's ladder is its COUNT. One gun is a gun; six is an emplacement, and the
 * renders say exactly that — a single barrel, then a heavier one, then a bank of
 * three on the same plate.
 *
 * The thresholds are `tierOf`'s, read off the number standing rather than off a
 * level, so there is one ladder rule in this file and not two. `Math.max(1, …)` at
 * the call site keeps a planet with nothing on the ground showing what it would be
 * buying instead of an empty well.
 */
export const groundArt = (id: GroundHullId, standing: number): string =>
  `${BASE}/general/${id === 'BASTION' ? 'bastion' : 'thorn'}_${String(tierOf(standing))}.png`;

/**
 * What the battery becomes with one more gun — or null when it looks the same.
 *
 * The anticipation hook, in the one place a player can act on it: the row that
 * sells the gun. "Build one more and the plate carries three barrels."
 */
export function nextGroundArt(id: GroundHullId, standing: number): string | null {
  if (tierOf(standing) === tierOf(standing + 1)) return null;
  return groundArt(id, standing + 1);
}

/**
 * Real geometry, where it exists.
 *
 * The 2D renders stay: they are what the shipyard and the panels use, and they are
 * better at panel size than a model would be. This is only for the galaxy, where a
 * craft is seen from every angle as the camera moves and a billboard starts to
 * give itself away.
 */
export const MODEL = {
  probe: '/assets/models/ships/explorer_ship.glb',
  /** Preserved ground batteries retain their existing geometry. They never travel. */
  bastion: '/assets/models/ships/ship_3.glb',
  thorn: '/assets/models/ships/ship_1.glb',
  dart: FLEET_V2_ASSET_MANIFEST.DART.model,
  pike: FLEET_V2_ASSET_MANIFEST.PIKE.model,
  rampart: FLEET_V2_ASSET_MANIFEST.RAMPART.model,
  warden: FLEET_V2_ASSET_MANIFEST.WARDEN.model,
  courier: FLEET_V2_ASSET_MANIFEST.COURIER.model,
  viper: FLEET_V2_ASSET_MANIFEST.VIPER.model,
  talon: FLEET_V2_ASSET_MANIFEST.TALON.model,
  stronghold: FLEET_V2_ASSET_MANIFEST.STRONGHOLD.model,
  sentinel: FLEET_V2_ASSET_MANIFEST.SENTINEL.model,
  wayfarer: FLEET_V2_ASSET_MANIFEST.WAYFARER.model,
  tempest: FLEET_V2_ASSET_MANIFEST.TEMPEST.model,
  ballista: FLEET_V2_ASSET_MANIFEST.BALLISTA.model,
  leviathan: FLEET_V2_ASSET_MANIFEST.LEVIATHAN.model,
  praetorian: FLEET_V2_ASSET_MANIFEST.PRAETORIAN.model,
  atlas: FLEET_V2_ASSET_MANIFEST.ATLAS.model,
  nullifier: FLEET_V2_ASSET_MANIFEST.NULLIFIER.model,
  cataclysm: FLEET_V2_ASSET_MANIFEST.CATACLYSM.model,
  citadel: FLEET_V2_ASSET_MANIFEST.CITADEL.model,
  deathStar: '/assets/models/ships/death_star.glb',
  /** The mining craft, and the Drill's own body. Owner-supplied; no longer a borrow. */
  drill: '/assets/models/drills/drill.glb',
  /**
   * WHAT A RAID LOOKS LIKE FROM ORBIT. D44.
   *
   * Fired by the squadron over the ten seconds a landing takes, at a quarter to a
   * half the size of the ship that launched it. It is a craft rather than a prop —
   * it is aimed, it flies nose-first, and it has a facing like anything else that
   * is pointed somewhere.
   */
  missile: '/assets/models/missiles/ship_missile.glb',
  /**
   * One chunk of wreckage. D32.
   *
   * Not a craft: it is never oriented, so it has no `MODEL_FACING` entry and wants
   * none. It is drawn instanced and tumbling in a ring around a planet that has
   * just been fought over.
   */
  debris: '/assets/models/debris/debris.glb',
} as const;

/**
 * Which way each hull's nose points inside its own file.
 *
 * Measured, not guessed — every model was rendered from six sides and read off
 * the engine bells. `orientedCraft` turns each onto +Z so `lookAt` aims the nose
 * and not the exhaust. A new hull MUST get an entry here: without one it will fly
 * backwards or sideways, and that is the sort of thing nobody notices in review
 * and everybody notices in play.
 */
export const MODEL_FACING: Record<string, Facing> = {
  ...Object.fromEntries(
    Object.values(FLEET_V2_ASSET_MANIFEST).map(({ model, facing }) => [model, facing]),
  ),
  [MODEL.probe]: '-x',
  [MODEL.bastion]: '-x',
  [MODEL.thorn]: '+z',
  /**
   * The drill bit leads, but its authored body is pitched rather than lying on X.
   * A principal-component fit over all 2,189 vertices gives the body axis below;
   * the positive end is the bit (the six-side view settles the sign). Declaring
   * only `+x` preserved the native −30° pitch, so a horizontal route visibly had
   * the bit pointing below its destination. The full vector lets `orientedCraft`
   * level that pitch before the parent aims its canonical +Z at the route.
   */
  [MODEL.drill]: noseVector(0.8652, -0.5010, 0.0208),
  /**
   * THE ONE NOSE IN THE GAME THAT IS NOT ON AN AXIS. D44.
   *
   * Measured rather than eyeballed, and it had to be: the body lies at 56.5° in
   * its own XZ plane, so the six-sided render shows a missile in EVERY horizontal
   * view and none of the four compass answers is right. A principal-component fit
   * over all 4,103 vertices gives an axis of (0.833, −0.044, 0.551) and settles
   * which end is the nose by cross-section — the +axis end closes to a radius of
   * 0.05 where the other flares to 0.14 for the fins and the nozzle.
   *
   * The small −Y component is part of the source geometry and must be corrected;
   * otherwise a route may be straight while the visible missile climbs through it.
   */
  [MODEL.missile]: noseVector(0.8332, -0.044, 0.5512),
  /**
   * The strategic hull is diagonal too. A fit over its 12,490 vertices gives the
   * long axis (0.710, 0.408, -0.574); the pointed end in the six-side render is
   * the positive-X/positive-Y/negative-Z end. Keeping only its XZ projection
   * corrected the sideways crab but left the 24° source pitch intact, so the
   * weapon visibly travelled nose-up. The full vector is levelled onto +Z.
   */
  [MODEL.deathStar]: noseVector(0.7101, 0.408, -0.5736),
};

/**
 * Fine owner-reviewed Fleet V2 pose after `MODEL_FACING` establishes +Z.
 * Height was calibrated at the manifest's authored preview scale, so divide it
 * back to normalised model space before the live `Hull` group reapplies that scale.
 */
export const MODEL_POSE: Record<string, CraftPose> = Object.fromEntries(
  Object.values(FLEET_V2_ASSET_MANIFEST).map(({ model, pose, scale }) => [
    model,
    { rotation: pose.rotation, height: pose.height / scale },
  ]),
);

/**
 * The hull a squadron is drawn as, in the galaxy.
 *
 * The Prospector's borrow is over: it flew as a Hauler for three phases because no
 * mining craft existed, and the owner has now supplied one. A drill bit leading a
 * hull says what the craft is before any label does, which is the whole reason this
 * file forbids borrowing in the first place.
 */
export const HULL_MODEL: Record<HullId, string> = {
  ...Object.fromEntries(
    Object.entries(FLEET_V2_ASSET_MANIFEST).map(([id, entry]) => [id, entry.model]),
  ) as Pick<Record<HullId, string>, keyof typeof FLEET_V2_ASSET_MANIFEST>,
  // Ground defence never travels, so it is never drawn in transit. Present only
  // so the map is total and nothing has to guard against a missing key.
  BASTION: MODEL.bastion,
  THORN: MODEL.thorn,
  PROSPECTOR: MODEL.drill,
};

/**
 * WHICH MODELS FLY.
 *
 * `MODEL` used to hold craft and nothing else, so "every model declares a facing"
 * was a safe rule. D32 put a piece of wreckage in it — a prop, which tumbles, has
 * no nose, and would be actively wrong to orient. The distinction is stated here
 * rather than left implicit, because the rule that matters is not "everything has
 * a facing" but "everything that is AIMED has one", and a rule nobody can see is a
 * rule the next model quietly breaks.
 *
 * A new entry in `MODEL` belongs on one of these two lists. The tests check both
 * directions: a craft without a facing flies backwards, and a facing on a prop is
 * a claim about geometry that nothing honours.
 */
export const CRAFT_MODELS: readonly string[] = [
  ...Object.values(FLEET_V2_ASSET_MANIFEST).map(({ model }) => model),
  MODEL.probe,
  MODEL.bastion,
  MODEL.thorn,
  MODEL.drill,
  MODEL.missile,
  MODEL.deathStar,
];

/** Drawn, never aimed. Scenery and wreckage. */
export const PROP_MODELS: readonly string[] = [MODEL.debris];

/** Three bodies, so a field of fifty rocks does not look stamped from one mould. */
export const ASTEROID_MODELS = [
  '/assets/models/asteroids/asteroid_1.glb',
  '/assets/models/asteroids/asteroid_2.glb',
  '/assets/models/asteroids/asteroid_3.glb',
] as const;

/**
 * THE FOUR SATELLITES, AS REAL GEOMETRY. D25.
 *
 * Only satellites are in this map now, because only satellites are in orbit. The
 * Telescope, Radar, Aegis and Veil moved to the ground where they always belonged,
 * and the Drill became a craft — this map used to carry all five and had to keep a
 * dead DRILL entry just to stay total. It is total by construction now.
 *
 * The pairing is by what each body plainly IS, not by file order: the dish is the
 * comms relay, the industrial hub is the works, the heavy rig is the mining
 * tender, the lens is the navigation mark. A player who has seen one in someone
 * else's orbit should be able to name it, because hardware is public (D15) and
 * that recognition is the only intel it hands over for free.
 */
export const SATELLITE_MODEL: Record<SatelliteId, string> = {
  FOUNDRY: '/assets/models/sattelites/sattelite_1.glb',
  BEACON: '/assets/models/sattelites/sattelite_2.glb',
  DERRICK: '/assets/models/sattelites/sattelite_3.glb',
  UPLINK: '/assets/models/sattelites/sattelite_4.glb',
};

/**
 * The rim light each satellite wears in the galaxy, at owner request.
 *
 * Bound to the BODY rather than to the job, and each one is the colour that body
 * already glows in its own render — blue hub, green lens, amber rig, violet dish.
 * A neon that fought its model would read as a bug rather than as a marker.
 */
export const SATELLITE_NEON: Record<SatelliteId, string> = {
  FOUNDRY: '#4ea8ff',
  BEACON: '#3ddc84',
  DERRICK: '#ff9c3d',
  UPLINK: '#a77bff',
};

/**
 * THE DYSON RING A DEVELOPED WORLD WEARS — ONE FILE, AND THE WHOLE LADDER.
 *
 * Owner decision: every stage of the structure is this same ring, drawn one, two,
 * three or four times at equal angles. One ring becoming two becoming three reads
 * as a project being EXTENDED, which is what raising a Core actually is; four
 * separate models read as the thing in a neighbour's orbit being replaced. It also
 * costs one download and one decode for the entire ladder.
 *
 * The composition, the colours and the sizes are rendering decisions and they live
 * with the renderer — see `galaxy/DysonShells`. Only the path belongs here.
 *
 * Three earlier exports — a woven cage, an open sphere and a spiked shell — were
 * tried as separate stages before the ring ladder replaced them, and have been
 * removed from the source tree so the pipeline no longer ships a megabyte of
 * geometry nothing references.
 */
export const DYSON_MODEL = ['/assets/models/dyson/dyson_1.glb'] as const;

export type DysonModel = (typeof DYSON_MODEL)[number];

/**
 * WHICH STAGE A WORLD IS AT — the ladder itself lives in `galaxy/DysonShells`.
 *
 * Only the file paths belong in this module. A stage is not a model: one of them
 * is the same ring drawn twice at right angles, so the composition, the colours
 * and the sizes are rendering decisions and they live with the renderer.
 */

/* ── satellites and buildings ───────────────────────────────── */

/**
 * INSTRUMENT ART, TIERED BY LEVEL. D25.
 *
 * All four now have three renders each, and raising one visibly replaces it — the
 * anticipation hook this file exists for. The Veil was the exception for two
 * phases: the render it used to wear became a real satellite under D25, and a Veil
 * drawn as somebody else's hardware would state the two things about it that are
 * false — that it is in orbit, and that it is the Beacon. It has its own dome now,
 * so the exception is over and every instrument shows the thing it actually is.
 *
 * The return type stays nullable because the callers are shared with `buildingArt`
 * and with `HULL_ART`, both of which still have honest nulls in them.
 */
export function instrumentArt(type: InstrumentId, level: number): string | null {
  const tier = tierOf(level);
  switch (type) {
    case 'TELESCOPE':
      return `${BASE}/general/telescope_${String(tier)}.png`;
    case 'RADAR':
      return `${BASE}/general/radar_${String(tier)}.png`;
    case 'AEGIS':
      return `${BASE}/general/shield_${String(tier)}.png`;
    case 'VEIL':
      return `${BASE}/general/veil_${String(tier)}.png`;
  }
}

/**
 * The art one level from now — or null when nothing visibly changes.
 *
 * This is the anticipation hook: "at L3 your telescope becomes THAT". A tech tree
 * that only ever shows what you already own is a list of receipts.
 */
export function nextInstrumentArt(type: InstrumentId, level: number): string | null {
  if (tierOf(level) === tierOf(level + 1)) return null;
  return instrumentArt(type, level + 1);
}

/**
 * SATELLITE ART, UNTIERED, BECAUSE A SATELLITE HAS NO LEVELS. D25.
 *
 * One render each, and it is the same render everywhere: the panel that sells it,
 * the sheet that describes it, and the body drawn in somebody else's orbit. There
 * is no ladder to anticipate here — the choice is whether to own it at all, and
 * which slot it costs you.
 */
export const SATELLITE_ART: Record<SatelliteId, string> = {
  FOUNDRY: `${BASE}/sattelites/sattelite_type_1.png`,
  BEACON: `${BASE}/sattelites/sattelite_type_2.png`,
  DERRICK: `${BASE}/sattelites/sattelite_type_3.png`,
  UPLINK: `${BASE}/sattelites/sattelite_type_4.png`,
};

/**
 * Buildings, at the tier their level puts them in.
 *
 * The Command Core, the Vault and now the Shipyard ship with three renders each.
 * All three were once wired to `null` — the interface drew a line-art mark while
 * finished art of the exact thing sat unused in the repo. They tier by level, so
 * raising one visibly replaces the structure, which is the anticipation hook this
 * file exists for.
 *
 * The Refinery and Extractor stay on the resource they produce, which reads better
 * at row size than a building would — that is a choice, not a missing asset.
 */
export function buildingArt(id: BuildingId, level: number): string | null {
  const tier = tierOf(level);
  switch (id) {
    case 'CORE':
      return `${BASE}/general/command_core_${String(tier)}.png`;
    case 'VAULT':
      return `${BASE}/general/vault_${String(tier)}.png`;
    case 'REFINERY':
      return RESOURCE_ART.alloy;
    case 'EXTRACTOR':
      return RESOURCE_ART.crystal;
    case 'SHIPYARD':
      return `${BASE}/general/shipyard_${String(tier)}.png`;
    case 'HANGAR':
      return `${BASE}/general/hangar_${String(tier)}.png`;
    /** It makes deuterium, so it wears deuterium — the Refinery and Extractor idiom. */
    case 'DEUTERIUM_PLANT':
      return RESOURCE_ART.deuterium;
  }
}

/**
 * The art one level on, or null when nothing visibly changes.
 *
 * Compares the RENDERS rather than the tiers, which is not the same question here:
 * the Refinery and the Extractor wear the resource they produce at every level, so
 * a tier check said "new hardware at L3" and handed back the identical picture. No
 * caller passed it on, so nothing was ever drawn — but the promise this function
 * makes is "something changes", and it was only true for three of five buildings.
 */
export function nextBuildingArt(id: BuildingId, level: number): string | null {
  const next = buildingArt(id, level + 1);
  return next === buildingArt(id, level) ? null : next;
}

/** Kept for callers that do not know a level. Prefer `buildingArt`. */
export const BUILDING_ART: Record<BuildingId, string | null> = {
  CORE: `${BASE}/general/command_core_1.png`,
  REFINERY: RESOURCE_ART.alloy,
  EXTRACTOR: RESOURCE_ART.crystal,
  VAULT: `${BASE}/general/vault_1.png`,
  SHIPYARD: `${BASE}/general/shipyard_1.png`,
  HANGAR: `${BASE}/general/hangar_1.png`,
  DEUTERIUM_PLANT: RESOURCE_ART.deuterium,
};
