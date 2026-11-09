import { starterGalaxyCentre, toWorld, type Vec3 } from '@astera/rules';
import { galaxySchema, type GalaxyPlanet } from '../api/schemas.js';
import { mainSkyNodes, neighbourShips, type NeighbourShip } from '../galaxy/mainSky.js';
import { VESSEL_LENGTH, planetNodes, type PlanetNode } from '../galaxy/scene.js';
import type { Point } from '../galaxy/jumpCamera.js';

/**
 * WHAT THE JUMP FLIES THROUGH, in the main galaxy's world units: the berth, the new world and its size,
 * the ship's length, the worlds of both galaxies and the neighbours left behind. The last frame is the
 * main game's first, so its frame is the main game's.
 */
export interface JumpWorld {
  from: Point;
  planet: Point;
  radius: number;
  ship: number;
  worlds: readonly PlanetNode[];
  ships: readonly NeighbourShip[];
  /** The new world alone: the galaxy view draws its own worlds and adds only this one. */
  destination: PlanetNode;
}

const moved = (p: Vec3, by: Vec3): Vec3 => ({ x: p.x + by.x, y: p.y + by.y, z: p.z + by.z });
/** Two addresses closer than this are one world. */
const SAME_PLACE = 1;

/** A world moved into another frame, whole, so it is drawn and sized where it stands. */
export const movedNode = (node: PlanetNode, by: Point): PlanetNode =>
  ({ ...node, position: [node.position[0] + by[0], node.position[1] + by[1], node.position[2] + by[2]] });

/** At the press: everything is on this client already. Coordinates as the server sends them. */
export function pressedWorld({ ordinal, berth, landing, planetId, starter, main }: {
  ordinal: number;
  berth: Vec3;
  landing: Vec3;
  planetId: string;
  starter: readonly GalaxyPlanet[];
  main: readonly Vec3[];
}): JumpWorld {
  // The first galaxy's frame into the main one's: its centre is where the main game puts it.
  const centre = starterGalaxyCentre(ordinal);
  const here = starter.map(planet => ({ ...planet, position: moved(planet.position, centre) }));
  const [destination] = planetNodes([galaxySchema.shape.planets.element.parse({
    id: planetId, position: landing, intel: 'UNKNOWN', isSelf: false, isOwned: false, state: { kind: 'NORMAL' },
  })]);
  const others = main.filter(point => Math.hypot(point.x - landing.x, point.y - landing.y, point.z - landing.z) >= SAME_PLACE);
  return {
    from: toWorld(moved(berth, centre)),
    planet: toWorld(landing),
    radius: destination!.radius,
    ship: VESSEL_LENGTH,
    worlds: [...planetNodes(here.filter(planet => planet.body !== 'VESSEL'), true), ...mainSkyNodes(others, { x: 0, y: 0, z: 0 }), destination!],
    ships: neighbourShips(here),
    destination: destination!,
  };
}

/** Watched again from the new world: it flies in from its berth in its first galaxy, or that galaxy's centre. */
export function landedWorld(planets: readonly GalaxyPlanet[], ordinal: number, berth: Vec3 | null = null): JumpWorld | null {
  const home = planets.find(planet => planet.isSelf);
  if (!home) return null;
  const worlds = planetNodes(planets);
  return {
    from: toWorld(moved(berth ?? { x: 0, y: 0, z: 0 }, starterGalaxyCentre(ordinal))),
    planet: toWorld(home.position),
    radius: worlds.find(node => node.id === home.id)!.radius,
    ship: VESSEL_LENGTH,
    worlds,
    ships: [],
    destination: worlds.find(node => node.id === home.id)!,
  };
}
