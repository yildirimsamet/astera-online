import { STARTER, crateStates, openFeatures, openingProgress, repairProgress, type VesselProgress } from '@astera/rules';
import type { VesselView } from '../src/api/starterSchemas.js';

/** A ship as the server answers it: dates as strings, because this is what crosses the wire. */
export function wireVessel(over: Partial<Record<keyof VesselView, unknown>> & { progress?: VesselProgress } = {}) {
  const { progress: held, ...rest } = over;
  const progress = held ?? openingProgress();
  return {
    id: 'ship-1',
    name: 'Newcomer',
    status: 'ACTIVE',
    galaxy: { id: 'galaxy-1', epoch: '2026-11-01T00:00:00.000Z', ordinal: 1 },
    quietAt: '2099-11-01T00:00:00.000Z',
    position: { x: 120, y: -40, z: 8 },
    alloy: 650,
    crystal: 300,
    deuterium: 0,
    bufferAlloy: 12.5,
    bufferCrystal: 0,
    bufferDeuterium: 0,
    shield: 0,
    lastTickMinutes: 100,
    modules: progress.modules,
    research: {},
    facts: progress.facts,
    parts: progress.parts,
    fuel: progress.fuel,
    pvpOpenAt: null,
    recoveryUntil: null,
    progress: repairProgress(progress),
    features: [...openFeatures(progress)],
    unlockToAnnounce: null,
    crates: crateStates(progress, []),
    queue: [],
    fleet: {},
    jumpFuel: STARTER.fuelForJump,
    ...rest,
  };
}

/** What a mocked `fetch` was asked for, whichever of its three shapes it came in. */
export const urlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
