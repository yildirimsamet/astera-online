import { STARTER, VESSEL_SYSTEMS, VIEW, starterGalaxyCentre, systemProgress, toWorld, vesselHull, type Vec3, type Vec3Tuple, type VesselHull, type VesselLook, type VesselProgress, type VesselSystem } from '@astera/rules';
import type { MainSky } from '../api/starterSchemas.js';
import { galaxySchema, type GalaxyPlanet, type HpRadiationSourceView, type PublicMonument } from '../api/schemas.js';
import { planetNodes, type PlanetNode } from './scene.js';

const WORLD_ID = 'main-world-';

/** A point over there, which can be drawn and can be told from a ship, and which nothing can aim at. */
export const isMainWorld = (id: string): boolean => id.startsWith(WORLD_ID);

const placed = (point: Vec3, offset: Vec3): Vec3 => ({ x: point.x + offset.x, y: point.y + offset.y, z: point.z + offset.z });

/**
 * THE MAIN GALAXY'S WORLDS AS WORLDS, for the same renderer the main game draws them with. Each is a
 * world nobody here has found: the schema fills the gaps exactly as it does for one in the main game,
 * and the ids are made up here, since the server sends none (K1).
 */
export function mainSkyNodes(points: readonly Vec3[], offset: Vec3): PlanetNode[] {
  return planetNodes(points.map((point, index) => galaxySchema.shape.planets.element.parse({
    id: `${WORLD_ID}${String(index)}`,
    position: placed(point, offset),
    intel: 'UNKNOWN',
    isSelf: false,
    isOwned: false,
    state: { kind: 'NORMAL' },
  })));
}

/** The main galaxy's monuments, placed and still moving around its centre. No holder is known here. */
export function mainSkyMonuments(monuments: MainSky['monuments'], offset: Vec3): PublicMonument[] {
  return monuments.map(({ position, difficulty, ordinal, motion }) => ({
    id: `main-monument-${String(ordinal)}`,
    ordinal,
    difficulty,
    position: placed(position, offset),
    ...(motion ? { motion: { ...motion, pivot: offset } } : {}),
    controller: { kind: 'NEUTRAL' as const },
    capacity: 0,
    used: 0,
    productionPerMinute: 0,
    radiationHpPerMinute: 0,
    emptySince: null,
    respawnAt: null,
  }));
}

/** The wire's flat array back into positions, in the order the buffer above writes them. */
export function mainSkyPoints(flat: readonly number[]): Vec3[] {
  const points: Vec3[] = [];
  for (let i = 0; i + 2 < flat.length; i += 3) points.push({ x: flat[i]!, y: flat[i + 1]!, z: flat[i + 2]! });
  return points;
}

const CAMERA_BACK = 4.2;
const CAMERA_LIFT = 1.2;

/** The opening frame: behind the ship, along the line to where it is trying to go. */
export function starterOpeningCamera(ship: readonly [number, number, number], offset: Vec3): [number, number, number] {
  const main = toWorld(offset);
  const dx = main[0] - ship[0], dy = main[1] - ship[1], dz = main[2] - ship[2];
  const length = Math.hypot(dx, dy, dz);
  return [ship[0] - (dx / length) * CAMERA_BACK, ship[1] - (dy / length) * CAMERA_BACK + CAMERA_LIFT, ship[2] - (dz / length) * CAMERA_BACK];
}

/**
 * The first frame: the ship in the middle of the screen, seen from behind along its way, and the main
 * galaxy ahead of it, above (owner 2026-11-06: the ship had sat low, behind the bottom card). It turns
 * about the ship itself, so a drag keeps it in view.
 */
export function starterOpeningPose(ship: Vec3Tuple, offset: Vec3): { camera: Vec3Tuple; target: Vec3Tuple } {
  return { camera: starterOpeningCamera(ship, offset), target: [ship[0], ship[1], ship[2]] };
}

/**
 * Past the far edge of the main galaxy, and never inside the sky. The sky is a sphere around the
 * camera, and a flat far plane nearer than it clips its middle and leaves round corners on the screen.
 */
export const starterCameraFar = (offset: Vec3): number => Math.max(600, Math.hypot(...toWorld(offset)) * 2);

/** The camera stays around this galaxy; the main galaxy is scenery, reached only by the jump. */
export const STARTER_NAVIGATION_RADIUS = (STARTER.radius / VIEW.scale) * 1.15;

export type VesselLights = Record<VesselSystem, number>;

/** How bright each system burns, from dark to full, as far as it is repaired. */
export function vesselLights(progress: VesselProgress): VesselLights {
  const lit = (system: VesselSystem): number => {
    const { done, total } = systemProgress(progress, system);
    return done / total;
  };
  return { REFINERY: lit('REFINERY'), SURVEY: lit('SURVEY'), DEFENCE: lit('DEFENCE'), CARGO: lit('CARGO'), DRIVE: lit('DRIVE') };
}

export interface DamageSpot { at: VesselSystem; kind: 'fire' | 'ember' | 'sparks'; strength: number }

/** What each system does while it is wrecked: engines, works and shield burn; wiring throws sparks. */
const WRECK: Record<VesselSystem, { kind: 'fire' | 'sparks'; strength: number }> = {
  DRIVE: { kind: 'fire', strength: 1 },
  REFINERY: { kind: 'fire', strength: 0.7 },
  DEFENCE: { kind: 'fire', strength: 0.55 },
  CARGO: { kind: 'sparks', strength: 1 },
  SURVEY: { kind: 'sparks', strength: 0.7 },
};

/** The ship before anything aboard is mended. */
export const NO_LIGHTS: VesselLights = { REFINERY: 0, SURVEY: 0, DEFENCE: 0, CARGO: 0, DRIVE: 0 };

/**
 * WHERE THE SHIP STILL BURNS (plan F8): each system by its own repairs. A wrecked one burns, one under
 * repair smoulders less as it mends, and a mended one goes out.
 */
export function damageSpots(lights: VesselLights): DamageSpot[] {
  return VESSEL_SYSTEMS.flatMap((at): DamageSpot[] => {
    const share = lights[at];
    if (share >= 1) return [];
    const { kind, strength } = WRECK[at];
    if (share <= 0) return [{ at, kind, strength }];
    return [{ at, kind: kind === 'fire' ? 'ember' : 'sparks', strength: strength * (1 - share) }];
  });
}

/** One file per hull and state, sharing an outline and base, so a swap never moves the ship. */
export const vesselModelFile = (hull: VesselHull, look: VesselLook): string =>
  `/assets/models/vessels/${hull.toLowerCase()}-${look.toLowerCase()}.glb`;

/** The colony models are built nose along +X; the yaw below points +Z. */
export const VESSEL_NOSE_TURN = -Math.PI / 2;

/** Where each system stands on each hull, in the model's own units (`bays.json` from the build). */
export const VESSEL_BAYS: Record<VesselHull, Record<VesselSystem, Vec3Tuple>> = {
  SPINE: { REFINERY: [0.19, 0.009, 0.057], SURVEY: [-0.015, 0.069, 0], DEFENCE: [-0.015, -0.001, 0.074], CARGO: [0.09, -0.069, 0.025], DRIVE: [-0.485, -0.039, 0] },
  WEDGE: { REFINERY: [-0.078, 0.026, 0.157], SURVEY: [-0.117, 0.102, 0], DEFENCE: [-0.228, 0.012, 0.245], CARGO: [-0.105, -0.081, 0.278], DRIVE: [-0.499, -0.078, 0.267] },
  SEED: { REFINERY: [-0.115, 0.086, 0.125], SURVEY: [-0.07, 0.167, 0], DEFENCE: [0.064, -0.065, 0.185], CARGO: [-0.055, -0.161, 0.138], DRIVE: [-0.485, -0.08, 0] },
};

/** The ship to the touch (owner 2026-11-08): the hull as the model lies, a hair past its bays and no further. */
export function vesselHitBox(hull: VesselHull): Vec3Tuple {
  const bays = Object.values(VESSEL_BAYS[hull]);
  const across = (axis: 1 | 2): number => 2 * Math.max(...bays.map(bay => Math.abs(bay[axis]))) + 0.08;
  return [1, across(1), across(2)];
}

/** The turn about Y that points a model's nose (+Z) at the main galaxy. */
export function starterShipYaw(ship: Vec3Tuple, offset: Vec3): number {
  const main = toWorld(offset);
  return Math.atan2(main[0] - ship[0], main[2] - ship[2]);
}

/** The main galaxy's clouds in this galaxy's coordinates, in the form the haze draws. */
export function mainSkyClouds(clouds: MainSky['clouds'], now: Date, offset: Vec3): HpRadiationSourceView[] {
  return clouds.map(({ motion, ...cloud }, index) => ({
    ...cloud,
    id: `main-sky-${String(index)}`,
    origin: 'ENVIRONMENT' as const,
    center: placed(cloud.center, offset),
    ...(motion ? { motion: { ...motion, pivot: offset } } : {}),
    activeFrom: now,
    activeUntil: null,
  }));
}

export interface NeighbourShip { id: string; hull: VesselHull; look: VesselLook; position: Vec3Tuple }

/** Everyone else aboard a ship here. A hull nobody has read is a wreck, whatever it really is (§3.11). */
export const neighbourShips = (planets: readonly Pick<GalaxyPlanet, 'id' | 'body' | 'isSelf' | 'look' | 'position'>[]): NeighbourShip[] =>
  planets.flatMap(planet => planet.body === 'VESSEL' && !planet.isSelf
    ? [{ id: planet.id, hull: vesselHull(planet.id), look: planet.look ?? 'WRECKED', position: toWorld(planet.position) }]
    : []);

export interface VesselGroup { file: string; ships: NeighbourShip[] }

/** One model is one instanced draw per mesh, however many ships wear it. */
export function vesselGroups(ships: readonly NeighbourShip[]): VesselGroup[] {
  const groups = new Map<string, NeighbourShip[]>();
  for (const ship of ships) {
    const file = vesselModelFile(ship.hull, ship.look);
    groups.set(file, [...groups.get(file) ?? [], ship]);
  }
  return [...groups].map(([file, members]) => ({ file, ships: members }));
}

const BEAM_MINUTES = 10;

export interface DepartureBeam { name: string; at: readonly [number, number, number]; strength: number }

/** A leaving ship leaves a streak the neighbours can see for ten minutes (§3.10). Nothing else of it. */
export function beamsNow(departures: readonly { name: string; at: Date; x: number; y: number; z: number }[], now: number): DepartureBeam[] {
  return departures.flatMap(row => {
    const age = (now - row.at.getTime()) / 60_000;
    if (age < 0 || age >= BEAM_MINUTES) return [];
    const { x, y, z } = row;
    return [{ name: row.name, at: toWorld({ x, y, z }), strength: 1 - age / BEAM_MINUTES }];
  });
}

const GLOWS = 6;

/**
 * THE FIRST GALAXIES, as seen from the main one: directions and nothing else. It reads no data on
 * purpose (A18): it is a lit corner of the sky that says where you came from.
 */
export function starterGlowDirections(): (readonly [number, number, number])[] {
  return Array.from({ length: GLOWS }, (_, index) => {
    const { x, y, z } = starterGalaxyCentre(index + 1);
    const size = Math.hypot(x, y, z);
    return [x / size, y / size, z / size] as const;
  });
}
