import {
  advanceEconomy, alloyRate, collect, collectorCap, crystalRate, deuteriumCollectorCap, deuteriumRate, shieldHp,
  type Collection, type PlanetEconomyInput, type PlanetEconomyState,
} from '../economy.js';
import type { Resources } from '../types.js';
import { STARTER } from './constants.js';
import { vesselAegisHp } from './aegis.js';
import type { VesselModules } from './ladder.js';

type VesselEconomyInput = Pick<PlanetEconomyInput, 'refineryLevel' | 'extractorLevel' | 'plantLevel' | 'vaultLevel' | 'aegisLevel'>;

/**
 * THE SHIP'S WORKS ARE THE MAIN GAME'S WORKS. Modules are read as levels and the main rules run
 * untouched, so what a player learns about buffers, ceilings and collecting holds after landing.
 * A broken module is level 0, and level 0 makes nothing.
 */
export const vesselEconomyInput = (modules: VesselModules): VesselEconomyInput => ({
  refineryLevel: modules.REFINERY ?? 0,
  extractorLevel: modules.EXTRACTOR ?? 0,
  plantLevel: modules.DEUTERIUM_PLANT ?? 0,
  vaultLevel: modules.VAULT ?? 0,
  aegisLevel: Math.min(modules.AEGIS ?? 0, STARTER.combat.aegisMax),
});

export const openingEconomy = (nowMinutes: number): PlanetEconomyState => ({
  alloy: STARTER.opening.alloy,
  crystal: STARTER.opening.crystal,
  deuterium: STARTER.opening.deuterium,
  bufferAlloy: STARTER.opening.works.alloy,
  bufferCrystal: 0,
  bufferDeuterium: 0,
  shield: 0,
  lastTickMinutes: nowMinutes,
  disruptedUntilMinutes: 0,
});

/**
 * THE AEGIS IS STORED IN THIS GALAXY'S UNITS, the ones a battle here reads. The main rule regrows it
 * as a share of the main game's value, so it is carried across at this stage's scale: same refill
 * time, smaller wall.
 */
export function advanceVesselEconomy(state: PlanetEconomyState, modules: VesselModules, nowMinutes: number): PlanetEconomyState {
  if (nowMinutes <= state.lastTickMinutes) return state;
  const input = vesselEconomyInput(modules);
  const full = shieldHp(input.aegisLevel);
  const scale = full > 0 ? vesselAegisHp(input.aegisLevel) / full : 1;
  const advanced = advanceEconomy({ ...state, shield: state.shield / scale }, input, nowMinutes);
  return { ...advanced, shield: advanced.shield * scale };
}

export const collectVessel = (state: PlanetEconomyState, modules: VesselModules): Collection =>
  collect(state, vesselEconomyInput(modules));

type Works = Pick<PlanetEconomyState, 'bufferAlloy' | 'bufferCrystal' | 'bufferDeuterium'>;

/**
 * A HAUL LANDS IN THE WORKS, AS A WORLD'S DOES (owner K3, 2026-11-05; the main game's D31). Each
 * resource stops at its own collector ceiling, and only the pile with nowhere to go is lost.
 */
export function landHaulInWorks(works: Works, modules: VesselModules, haul: Resources): { buffer: Works; wasted: Resources } {
  const input = vesselEconomyInput(modules);
  const crystalPerHour = crystalRate(input.extractorLevel);
  const room = (cap: number, held: number) => Math.max(0, cap - held);
  const alloy = Math.min(haul.alloy, room(collectorCap(alloyRate(input.refineryLevel)), works.bufferAlloy));
  const crystal = Math.min(haul.crystal, room(collectorCap(crystalPerHour), works.bufferCrystal));
  const deuterium = Math.min(haul.deuterium,
    room(deuteriumCollectorCap(deuteriumRate(input.plantLevel), crystalPerHour), works.bufferDeuterium));
  return {
    buffer: { bufferAlloy: works.bufferAlloy + alloy, bufferCrystal: works.bufferCrystal + crystal, bufferDeuterium: works.bufferDeuterium + deuterium },
    wasted: { alloy: haul.alloy - alloy, crystal: haul.crystal - crystal, deuterium: haul.deuterium - deuterium },
  };
}
