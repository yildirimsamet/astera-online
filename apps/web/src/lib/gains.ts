import {
  HULLS,
  SATELLITES,
  alloyRate,
  crystalRate,
  instrumentMaxed,
  probeAccuracy,
  radarRange,
  telescopeCooldownHours,
  telescopeRange,
  telescopeSlots,
  shieldHp,
  storageCap,
  vaultProtects,
  wealth,
  type BuildingId,
  type BuildingLevels,
  type InstrumentId,
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
  };
  return wealth({
    buildings,
    instruments: planet.instruments,
    satellites: planet.orbit,
    fleet: planet.fleet,
    ground: planet.ground,
    alloy: planet.planet.alloy,
    crystal: planet.planet.crystal,
  });
}

/** Range in words. "Infinite" is not a distance a player can picture. */
const rangeWord = (units: number): string =>
  Number.isFinite(units) ? `${String(Math.round(units))} units` : 'the whole disc';

export interface Gain {
  /** The quantity being bought, named as the player feels it. */
  label: string;
  now: string;
  next: string;
  /** Something new becomes possible — stated as a capability, not a rule. */
  unlocks?: string;
  /**
   * There is no next level. D36.
   *
   * Set only where the instrument's own tables are exhausted, and it is the row's
   * job to stop offering a purchase rather than to show an unchanged pair. A
   * control that says "12 min -> 12 min" and still takes an exponential price is
   * the single worst thing an upgrade screen can do.
   */
  maxed?: true;
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

      /**
       * TWO THINGS, AND THE SECOND ONE IS WHAT KEEPS SELLING.
       *
       * `probeAccuracy` is clamped at 1.0, which an unveiled target hits at L4 —
       * so from there the row read "100% -> 100%" for every level after. A Shipyard
       * has not stopped buying anything: accuracy is `shipyard - veil`, so each
       * level sees through a better Veil, and the same figure is what makes a probe
       * hard to detect. Once the headline flattens, the row switches to the number
       * that is still moving.
       *
       * `seesThrough` is the highest Veil a probe still beats the accuracy floor
       * against: accuracy stays above its minimum while `shipyard - veil > -2.08`.
       */
      const seesThrough = (l: number): number => l + 2;
      const flat = probeAccuracy(next, 0) === probeAccuracy(level, 0);
      if (flat) {
        return {
          label: 'Sees through a Veil up to',
          now: `L${String(seesThrough(level))}`,
          next: `L${String(seesThrough(next))}`,
          unlocks: unlocked
            ? `Unlocks the ${HULLS[unlocked].name}`
            : 'And makes your own probes harder to detect',
        };
      }
      return {
        label: 'Probe accuracy',
        now: percent(probeAccuracy(level, 0)),
        next: percent(probeAccuracy(next, 0)),
        ...(unlocked ? { unlocks: `Unlocks the ${HULLS[unlocked].name}` } : {}),
      };
    }
  }
}

export function instrumentGain(id: InstrumentId, level: number): Gain {
  const next = level + 1;
  switch (id) {
    /**
     * A telescope buys THREE things now (D18), and which one is worth selling
     * depends on the step. Slots come slowly — L1 and L2 watch one planet, L3 and
     * L4 watch two — so on the levels where the slot count does not move, showing
     * "1 → 1" would read as an upgrade that does nothing. Range is the honest
     * headline on those steps, because it is what actually changed.
     */
    case 'TELESCOPE': {
      if (instrumentMaxed('TELESCOPE', level)) {
        return {
          label: 'Planets you can watch',
          now: String(telescopeSlots(level)),
          next: String(telescopeSlots(level)),
          unlocks: 'At its highest level — it already reaches the whole disc',
          maxed: true,
        };
      }
      const slots = telescopeSlots(level);
      const nextSlots = telescopeSlots(next);
      const reach = telescopeRange(next);
      const cooldown = telescopeCooldownHours(next);

      if (nextSlots > slots) {
        return {
          label: 'Planets you can watch',
          now: String(slots),
          next: String(nextSlots),
          unlocks: `Reaches ${rangeWord(reach)} · a slot realigns in ${String(cooldown)}h`,
        };
      }
      return {
        label: 'How far you can see',
        now: rangeWord(telescopeRange(level)),
        next: rangeWord(reach),
        unlocks:
          telescopeSlots(next + 1) > nextSlots
            ? `Next level adds a ${String(nextSlots + 1)}${nextSlots === 1 ? 'nd' : 'rd'} slot`
            : `A slot realigns in ${String(cooldown)}h`,
      };
    }
    /**
     * Radar buys a different thing at every level, so a single fixed metric is
     * wrong for most of them. "Warning before impact: none → none" was the first
     * version's answer for L0→L1, which is both true and completely useless — the
     * level it is selling actually buys probe detection.
     */
    case 'RADAR': {
      if (instrumentMaxed('RADAR', level)) {
        return {
          label: 'How far it sweeps',
          now: rangeWord(radarRange(level)),
          next: rangeWord(radarRange(level)),
          unlocks: 'At its highest level — it already names where a scan came from',
          maxed: true,
        };
      }
      if (next < 3) {
        return {
          label: 'Detects scans',
          now: level === 0 ? 'no' : 'yes',
          next: next === 1 ? 'yes' : 'yes, with bearing',
          ...(next === 1 ? { unlocks: 'L2 adds the bearing · L3 warns about inbound fleets' } : {}),
        };
      }
      /**
       * A REACH, NOT A COUNTDOWN. D49.
       *
       * This row used to read "5 min -> 8 min", and that figure was never a
       * property of the radar: it was the same lead whatever was flying at you.
       * A radius is what the player actually buys, and it is directly comparable
       * to the Telescope's own range row two branches above — which is the point
       * of the two instruments finally being measured in the same unit.
       */
      const nowReach = radarRange(level);
      return {
        label: 'How far it sweeps',
        now: nowReach > 0 ? rangeWord(nowReach) : 'none',
        next: rangeWord(radarRange(next)),
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
    /**
     * A VEIL IS MEASURED AGAINST THE INSTRUMENTS POINTED AT IT.
     *
     * It used to read "Their clarity on you: BLIND -> BLIND" from level 4 upward,
     * because the display fixed the watcher's telescope at 2 and `clarityState`
     * bottoms out at BLIND. The Veil had not stopped working — clarity is
     * `telescope - veil`, so every level still blinds a better telescope than the
     * last. The row was measuring the wrong thing.
     *
     * Both figures here are monotonic in level and both are things a player can
     * act on: which telescopes you are dark to, and which probes still read you.
     */
    case 'VEIL': {
      const blinds = (v: number): number => Math.max(0, v - 2);
      return {
        label: 'Blinds a telescope up to',
        now: blinds(level) === 0 ? 'none' : `L${String(blinds(level))}`,
        next: `L${String(blinds(next))}`,
        unlocks: `Cuts a probe's accuracy to ${percent(probeAccuracy(next, next))} at equal Shipyard`,
      };
    }
  }
}

/**
 * WHAT A SATELLITE BUYS — one line, because there is only one purchase. D25.
 *
 * No `now`/`next` pair: a satellite has no levels, so there is no step to show.
 * The shape is kept for the panels that lay out buildings and instruments beside
 * satellites, and the caller reads `next` as "what you get".
 */
export function satelliteGain(id: SatelliteId): Gain {
  switch (id) {
    case 'FOUNDRY':
      return {
        label: 'Everything the works produce',
        // The pair is a STATE, not a step: a satellite is up or it is not, and an
        // em-dash in the "now" column reads as a number that failed to load.
        now: 'as built',
        next: `+${String(Math.round((SATELLITES.FOUNDRY.production - 1) * 100))}%`,
        unlocks: 'Alloy and crystal both, for the rest of the season',
      };
    case 'UPLINK':
      return {
        label: 'Telescope and Radar',
        now: 'locked',
        next: 'unlocked',
        unlocks: 'The only way to stop guessing about the people around you',
      };
    case 'DERRICK':
      return {
        label: 'Every Prospector carries',
        now: '1×',
        next: `${String(SATELLITES.DERRICK.hold)}×`,
        unlocks: `And flies ${String(SATELLITES.DERRICK.speed)}× faster — first to the rock takes the ore`,
      };
    case 'BEACON':
      return {
        label: 'Every fleet that leaves here',
        now: 'normal speed',
        next: `${String(SATELLITES.BEACON.speed)}× faster`,
        unlocks: 'Out and back — a shorter window with your defence away from home',
      };
  }
}
