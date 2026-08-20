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
} from '@astera/rules';
import type { PlanetView } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { hullLabel } from '../i18n/names.js';
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
  Number.isFinite(units)
    ? i18n.t('gains.rangeUnits', { count: Math.round(units) })
    : i18n.t('gains.rangeWhole');

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
        label: i18n.t('gains.core.label'),
        now: i18n.t('gains.core.level', { level }),
        next: i18n.t('gains.core.level', { level: next }),
        unlocks:
          cappedCount > 0
            ? i18n.t('gains.core.releases', { count: cappedCount })
            : i18n.t('gains.core.raisesCap'),
      };
    case 'REFINERY':
      return {
        label: i18n.t('gains.refinery.label'),
        now: i18n.t('gains.refinery.rate', { amount: compact(alloyRate(level)) }),
        next: i18n.t('gains.refinery.rate', { amount: compact(alloyRate(next)) }),
        unlocks: i18n.t('gains.refinery.storage', {
          now: compact(storageCap(alloyRate(level))),
          next: compact(storageCap(alloyRate(next))),
        }),
      };
    case 'EXTRACTOR':
      return {
        label: i18n.t('gains.extractor.label'),
        now: i18n.t('gains.extractor.rate', { amount: compact(crystalRate(level)) }),
        next: i18n.t('gains.extractor.rate', { amount: compact(crystalRate(next)) }),
        unlocks: i18n.t('gains.extractor.storage', {
          now: compact(storageCap(crystalRate(level))),
          next: compact(storageCap(crystalRate(next))),
        }),
      };
    case 'VAULT':
      return {
        label: i18n.t('gains.vault.label'),
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
          label: i18n.t('gains.shipyard.seesLabel'),
          now: i18n.t('gains.shipyard.seesValue', { level: seesThrough(level) }),
          next: i18n.t('gains.shipyard.seesValue', { level: seesThrough(next) }),
          unlocks: unlocked
            ? i18n.t('gains.shipyard.unlocksHull', { hull: hullLabel(unlocked) })
            : i18n.t('gains.shipyard.stealth'),
        };
      }
      return {
        label: i18n.t('gains.shipyard.accuracyLabel'),
        now: percent(probeAccuracy(level, 0)),
        next: percent(probeAccuracy(next, 0)),
        ...(unlocked
          ? { unlocks: i18n.t('gains.shipyard.unlocksHull', { hull: hullLabel(unlocked) }) }
          : {}),
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
          label: i18n.t('gains.telescope.slotsLabel'),
          now: String(telescopeSlots(level)),
          next: String(telescopeSlots(level)),
          unlocks: i18n.t('gains.telescope.maxed'),
          maxed: true,
        };
      }
      const slots = telescopeSlots(level);
      const nextSlots = telescopeSlots(next);
      const reach = telescopeRange(next);
      const cooldown = telescopeCooldownHours(next);

      if (nextSlots > slots) {
        return {
          label: i18n.t('gains.telescope.slotsLabel'),
          now: String(slots),
          next: String(nextSlots),
          unlocks: i18n.t('gains.telescope.reachAndCooldown', {
            range: rangeWord(reach),
            hours: cooldown,
          }),
        };
      }
      return {
        label: i18n.t('gains.telescope.rangeLabel'),
        now: rangeWord(telescopeRange(level)),
        next: rangeWord(reach),
        unlocks:
          telescopeSlots(next + 1) > nextSlots
            ? i18n.t('gains.telescope.nextSlot', {
                /**
                 * The ordinal is a translated token rather than an English
                 * suffix glued to a number. `2nd`/`3rd` is a rule about English
                 * spelling; Turkish writes `2.` and `3.` and has no suffix to
                 * append at all, so building the word here would have shipped
                 * "3rd yuvayı ekler".
                 */
                ordinal: i18n.t(
                  nextSlots === 1 ? 'gains.telescope.ordinalSecond' : 'gains.telescope.ordinalThird',
                ),
              })
            : i18n.t('gains.telescope.cooldown', { hours: cooldown }),
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
          label: i18n.t('gains.radar.sweepLabel'),
          now: rangeWord(radarRange(level)),
          next: rangeWord(radarRange(level)),
          unlocks: i18n.t('gains.radar.maxed'),
          maxed: true,
        };
      }
      if (next < 3) {
        return {
          label: i18n.t('gains.radar.scansLabel'),
          now: level === 0 ? i18n.t('gains.radar.scansNo') : i18n.t('gains.radar.scansYes'),
          next:
            next === 1 ? i18n.t('gains.radar.scansYes') : i18n.t('gains.radar.scansBearing'),
          ...(next === 1 ? { unlocks: i18n.t('gains.radar.l2l3') } : {}),
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
        label: i18n.t('gains.radar.sweepLabel'),
        now: nowReach > 0 ? rangeWord(nowReach) : i18n.t('gains.radar.sweepNone'),
        next: rangeWord(radarRange(next)),
        ...(next === 4
          ? { unlocks: i18n.t('gains.radar.estimate') }
          : next === 5
            ? { unlocks: i18n.t('gains.radar.origin') }
            : {}),
      };
    }
    case 'AEGIS':
      return {
        label: i18n.t('gains.aegis.label'),
        now: full(shieldHp(level)),
        next: full(shieldHp(next)),
        unlocks: i18n.t('gains.aegis.unlocks'),
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
        label: i18n.t('gains.veil.label'),
        now:
          blinds(level) === 0
            ? i18n.t('gains.veil.none')
            : i18n.t('gains.veil.level', { level: blinds(level) }),
        next: i18n.t('gains.veil.level', { level: blinds(next) }),
        unlocks: i18n.t('gains.veil.unlocks', {
          percent: Math.round(probeAccuracy(next, next) * 100),
        }),
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
        label: i18n.t('gains.foundry.label'),
        // The pair is a STATE, not a step: a satellite is up or it is not, and an
        // em-dash in the "now" column reads as a number that failed to load.
        now: i18n.t('gains.foundry.now'),
        next: i18n.t('gains.foundry.next', {
          percent: Math.round((SATELLITES.FOUNDRY.production - 1) * 100),
        }),
        unlocks: i18n.t('gains.foundry.unlocks'),
      };
    case 'UPLINK':
      return {
        label: i18n.t('gains.uplink.label'),
        now: i18n.t('gains.uplink.now'),
        next: i18n.t('gains.uplink.next'),
        unlocks: i18n.t('gains.uplink.unlocks'),
      };
    case 'DERRICK':
      return {
        label: i18n.t('gains.derrick.label'),
        now: i18n.t('gains.derrick.now'),
        next: i18n.t('gains.derrick.next', { factor: SATELLITES.DERRICK.hold }),
        unlocks: i18n.t('gains.derrick.unlocks', { factor: SATELLITES.DERRICK.speed }),
      };
    case 'BEACON':
      return {
        label: i18n.t('gains.beacon.label'),
        now: i18n.t('gains.beacon.now'),
        next: i18n.t('gains.beacon.next', { factor: SATELLITES.BEACON.speed }),
        unlocks: i18n.t('gains.beacon.unlocks'),
      };
  }
}
