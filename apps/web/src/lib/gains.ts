import {
  HULLS,
  alloyRate,
  clarityState,
  crystalRate,
  probeAccuracy,
  radarLeadMinutes,
  satelliteSlots,
  shieldHp,
  storageCap,
  vaultProtects,
  wealth,
  type BuildingId,
  type BuildingLevels,
  type SatelliteId,
} from '@blindspace/rules';
import type { PlanetView } from '../api/schemas.js';
import { compact, full, percent } from './format.js';

/**
 * WHAT YOU GET IF YOU PRESS IT.
 *
 * The first client showed "Alloy Refinery L1 · 310 · RAISE" and expected the
 * player to infer the rest. Nobody infers a compounding curve. Every upgrade now
 * states the number that changes and what it changes to, because "+58/h → +84/h"
 * is a decision and "Alloy per hour, and alloy storage" is a definition.
 *
 * `unlocks` is the other half: the thing that becomes possible, which is what
 * actually pulls a player up a tech tree.
 */
/**
 * POWER — everything this planet is worth, at what it cost.
 *
 * Computed here rather than read from `score.wealth`, which the server only
 * refreshes when something is bought. A brand-new commander with twelve Wasps and
 * two working buildings would otherwise be shown a Power of zero, which is both
 * wrong and the single most discouraging number the interface could produce.
 */
export function powerOf(planet: PlanetView): number {
  const buildings: BuildingLevels = {
    CORE: planet.buildings.CORE ?? 0,
    REFINERY: planet.buildings.REFINERY ?? 0,
    EXTRACTOR: planet.buildings.EXTRACTOR ?? 0,
    VAULT: planet.buildings.VAULT ?? 0,
    SHIPYARD: planet.buildings.SHIPYARD ?? 0,
    RING: planet.buildings.RING ?? 0,
  };
  return wealth({
    buildings,
    satellites: planet.satellites,
    fleet: planet.fleet,
    ground: planet.ground,
    alloy: planet.planet.alloy,
    crystal: planet.planet.crystal,
  });
}

export interface Gain {
  /** The quantity being bought, named as the player feels it. */
  label: string;
  now: string;
  next: string;
  /** Something new becomes possible — stated as a capability, not a rule. */
  unlocks?: string;
}

export function buildingGain(
  id: BuildingId,
  level: number,
  cappedCount: number,
): Gain {
  const next = level + 1;
  switch (id) {
    case 'CORE':
      return {
        label: 'Build ceiling',
        now: `L${String(level)}`,
        next: `L${String(next)}`,
        unlocks:
          cappedCount > 0
            ? `Releases ${String(cappedCount)} blocked upgrade${cappedCount === 1 ? '' : 's'}`
            : 'Raises the cap on everything else',
      };
    case 'REFINERY':
      return {
        label: 'Alloy per hour',
        now: `${compact(alloyRate(level))}/h`,
        next: `${compact(alloyRate(next))}/h`,
        unlocks: `Storage ${compact(storageCap(alloyRate(level)))} → ${compact(storageCap(alloyRate(next)))}`,
      };
    case 'EXTRACTOR':
      return {
        label: 'Crystal per hour',
        now: `${compact(crystalRate(level))}/h`,
        next: `${compact(crystalRate(next))}/h`,
        unlocks: `Storage ${compact(storageCap(crystalRate(level)))} → ${compact(storageCap(crystalRate(next)))}`,
      };
    case 'VAULT':
      return {
        label: 'Safe from any raid',
        now: full(vaultProtects(level)),
        next: full(vaultProtects(next)),
      };
    case 'SHIPYARD': {
      const unlocked = (['LANCE', 'HAULER', 'BULWARK'] as const).find(
        (hull) => HULLS[hull].minShipyard === next,
      );
      return {
        label: 'Probe accuracy',
        now: percent(probeAccuracy(level, 0)),
        next: percent(probeAccuracy(next, 0)),
        ...(unlocked ? { unlocks: `Unlocks the ${HULLS[unlocked].name}` } : {}),
      };
    }
    case 'RING': {
      const nowSlots = satelliteSlots(level);
      const nextSlots = satelliteSlots(next);
      return {
        label: 'Satellite slots',
        now: String(nowSlots),
        next: String(nextSlots),
        ...(nextSlots === nowSlots
          ? { unlocks: `Next slot at L${String(next + 1)}` }
          : { unlocks: 'One more satellite you can run at once' }),
      };
    }
  }
}

export function satelliteGain(id: SatelliteId, level: number): Gain {
  const next = level + 1;
  switch (id) {
    case 'TELESCOPE':
      return {
        label: 'Planets you can watch',
        now: String(level),
        next: String(next),
        unlocks:
          next >= 3
            ? 'At clarity +2 you also see when their fleet gets back'
            : 'Tells you when a fleet leaves. Nobody is told you are watching',
      };
    /**
     * Radar buys a different thing at every level, so a single fixed metric is
     * wrong for most of them. "Warning before impact: none → none" was the first
     * version's answer for L0→L1, which is both true and completely useless — the
     * level it is selling actually buys probe detection.
     */
    case 'RADAR': {
      if (next < 3) {
        return {
          label: 'Detects scans',
          now: level === 0 ? 'no' : 'yes',
          next: next === 1 ? 'yes' : 'yes, with bearing',
          ...(next === 1 ? { unlocks: 'L2 adds the bearing · L3 warns about inbound fleets' } : {}),
        };
      }
      const nowLead = radarLeadMinutes(level);
      const nextLead = radarLeadMinutes(next);
      return {
        label: 'Warning before a fleet lands',
        now: nowLead > 0 ? `${String(nowLead)} min` : 'none',
        next: `${String(nextLead)} min`,
        ...(next === 4
          ? { unlocks: 'Adds an estimate of how many ships are coming' }
          : next === 5
            ? { unlocks: 'Names the planet it came from' }
            : {}),
      };
    }
    case 'AEGIS':
      return {
        label: 'Shield',
        now: full(shieldHp(level)),
        next: full(shieldHp(next)),
        unlocks: 'Absorbs damage before your units take any. Regenerates 5% an hour',
      };
    case 'VEIL':
      return {
        label: 'Their clarity on you',
        now: clarityState(2 - level),
        next: clarityState(2 - next),
      };
    case 'DRILL':
      return { label: 'Asteroid mining', now: '—', next: '—' };
  }
}
