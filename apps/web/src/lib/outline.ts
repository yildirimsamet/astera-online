import { fleetCount } from '@astera/rules';
import type { BuildOrderView, PendingThread, PlanetView } from '../api/schemas.js';
import { researchQueueOrders } from './orders.js';

export interface OutlineWorld {
  id: string;
  name: string;
  capital: boolean;
  /** The world the top bar is reading. */
  active: boolean;
  /** Ships standing at home, and how many of its craft are off it. */
  ships: number;
  away: number;
  /** Attacks on their way to it. */
  threats: number;
}

export type OutlineLaneId = 'research' | 'construction' | 'yard';

/** One lane of work. Research is the commander's, so it has no world. */
export interface OutlineQueue {
  worldId: string | null;
  world: string | null;
  lane: OutlineLaneId;
  orders: readonly BuildOrderView[];
}

/** Every world the commander holds, as the desk outline lists it (E11). */
export function outlineWorlds(
  worlds: readonly PlanetView[],
  at: { activePlanetId: string | null; capitalPlanetId: string | null },
  threads: readonly PendingThread[],
): OutlineWorld[] {
  return worlds.map((world) => ({
    id: world.planet.id,
    name: world.planet.name,
    capital: world.planet.id === at.capitalPlanetId,
    active: world.planet.id === at.activePlanetId,
    ships: fleetCount(world.fleet),
    away: fleetCount(world.fleetAway),
    threats: threads.filter((thread) => thread.kind === 'incoming' && thread.targetPlanetId === world.planet.id).length,
  }));
}

/**
 * The lanes of work: research first (the commander's), then each world's Construction
 * and Yard. The active world is read from `active`, its own view, which carries the
 * order a tap has just placed before the server has answered; the rest from the list.
 */
export function outlineQueues(
  worlds: readonly PlanetView[],
  active: PlanetView | undefined,
  activePlanetId: string | null,
): OutlineQueue[] {
  const research: OutlineQueue = {
    worldId: null,
    world: null,
    lane: 'research',
    orders: researchQueueOrders(active?.researchQueue ?? worlds[0]?.researchQueue ?? []),
  };
  return [
    research,
    ...worlds.flatMap((world): OutlineQueue[] => {
      const view = world.planet.id === activePlanetId && active ? active : world;
      const at = { worldId: world.planet.id, world: world.planet.name };
      return [
        { ...at, lane: 'construction', orders: view.queues?.CONSTRUCTION ?? [] },
        { ...at, lane: 'yard', orders: view.queues?.YARD ?? [] },
      ];
    }),
  ];
}
