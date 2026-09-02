import {
  yardSpeedMult,
  strategicStockpile,
  prospectorHoldMult,
  plantCeiling,
  hullTech,
  cargoMult,
  RESEARCH_MAX_LEVEL,
  SHIELD,
  HULLS,
  SATELLITES,
  alloyRate,
  crystalRate,
  deuteriumRate,
  deuteriumStorageCap,
  hangarCapacity,
  instrumentMaxed,
  probeAccuracy,
  radarRange,
  sensorSphere,
  telescopeCooldownHours,
  telescopeSlots,
  shieldHp,
  storageCap,
  vaultProtects,
  wealth,
  type BuildingId,
  type BuildingLevels,
  type InstrumentId,
  type SatelliteId,
  storageHours,
  type HullId,
  type ResearchProjectId,
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
/** Every building level, defaulted — the shape `buildingGain` and `powerOf` need. */
export const levelsOf = (planet: PlanetView): BuildingLevels => ({
  CORE: planet.buildings.CORE ?? 0,
  REFINERY: planet.buildings.REFINERY ?? 0,
  EXTRACTOR: planet.buildings.EXTRACTOR ?? 0,
  VAULT: planet.buildings.VAULT ?? 0,
  SHIPYARD: planet.buildings.SHIPYARD ?? 0,
  HANGAR: planet.buildings.HANGAR ?? 0,
  DEUTERIUM_PLANT: planet.buildings.DEUTERIUM_PLANT ?? 0,
});

export function powerOf(planet: PlanetView): number {
  const buildings: BuildingLevels = {
    CORE: planet.buildings.CORE ?? 0,
    REFINERY: planet.buildings.REFINERY ?? 0,
    EXTRACTOR: planet.buildings.EXTRACTOR ?? 0,
    VAULT: planet.buildings.VAULT ?? 0,
    SHIPYARD: planet.buildings.SHIPYARD ?? 0,
    HANGAR: planet.buildings.HANGAR ?? 0,
    DEUTERIUM_PLANT: planet.buildings.DEUTERIUM_PLANT ?? 0,
  };
  return wealth({
    buildings,
    instruments: planet.instruments,
    satellites: planet.orbit,
    fleet: planet.fleet,
    ground: planet.ground,
    alloy: planet.planet.alloy,
    crystal: planet.planet.crystal,
    deuterium: planet.planet.deuterium,
  });
}

/** Every player-facing sensor reach is the finite, server-enforced value. */
const rangeWord = (units: number): string =>
  i18n.t('gains.rangeUnits', { count: Math.round(units) });

const sensorReachAt = (telescope: number, radar: number) =>
  sensorSphere({ x: 0, y: 0, z: 0 }, telescope, radar);

/** Radar contact/warning exists from L1; anti-strategic engagement begins at L3. */
const radarReachWord = (level: number): string => {
  const sense = sensorReachAt(0, level).detect;
  const warn = radarRange(level);
  if (sense <= 0 || warn <= 0) return i18n.t('gains.radar.sweepNone');
  return i18n.t('gains.radar.reaches', {
    sense: Math.round(sense),
    warn: Math.round(warn),
  });
};

export interface Gain {
  /** The quantity being bought, named as the player feels it. */
  label: string;
  now: string;
  next: string;
  /** Resource-shaped values use the game's learnt resource art, never initials. */
  resourcePair?: {
    now: { alloy: number; crystal: number; deuterium?: number };
    next: { alloy: number; crystal: number; deuterium?: number };
  };
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

/**
 * WHAT ONE MORE LEVEL ACTUALLY BUYS.
 *
 * `levels` is the whole building record and not just the one being raised, because
 * two of the rows cannot be priced without its siblings: the STORE's ceiling now
 * scales with the Vault, and the Vault's own floor is denominated in hours of the
 * Refinery's and the Extractor's production. Passing only the level being raised
 * gave `NaN` on both rows — a screen that offered a purchase and could not say
 * what it did.
 */
export function buildingGain(
  id: BuildingId,
  level: number,
  cappedCount: number,
  levels: BuildingLevels,
  production = 1,
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
        now: i18n.t('gains.refinery.rate', { amount: compact(alloyRate(level) * production) }),
        next: i18n.t('gains.refinery.rate', { amount: compact(alloyRate(next) * production) }),
        unlocks: i18n.t('gains.refinery.storage', {
          now: compact(storageCap(alloyRate(level) * production, levels.VAULT)),
          next: compact(storageCap(alloyRate(next) * production, levels.VAULT)),
        }),
      };
    case 'EXTRACTOR':
      return {
        label: i18n.t('gains.extractor.label'),
        now: i18n.t('gains.extractor.rate', { amount: compact(crystalRate(level) * production) }),
        next: i18n.t('gains.extractor.rate', { amount: compact(crystalRate(next) * production) }),
        unlocks: i18n.t('gains.extractor.storage', {
          now: compact(storageCap(crystalRate(level) * production, levels.VAULT)),
          next: compact(storageCap(crystalRate(next) * production, levels.VAULT)),
        }),
      };
    case 'VAULT': {
      const current = vaultProtects(level, levels.REFINERY, levels.EXTRACTOR, levels.DEUTERIUM_PLANT);
      const raised = vaultProtects(next, levels.REFINERY, levels.EXTRACTOR, levels.DEUTERIUM_PLANT);

      /**
       * TWO METRICS, AND THE SECOND ONE IS WHAT KEEPS THE ROW HONEST.
       *
       * The Vault does two jobs: it sets the floor a raid cannot reach, and it
       * sets how tall the STORE is. On a very young world the floor is held up by
       * `ECON.openingFloorAlloy` — a flat grant that outgrows two hours of a
       * Refinery-1 planet's output — so the protected pair does not move for the
       * first level or two while the capacity does.
       *
       * Quoting an unchanged pair and still charging an exponential price is the
       * single worst thing an upgrade screen can do. So when protection has not
       * moved, the row states the ceiling instead, exactly as the Shipyard row
       * switches to Veils once its accuracy figure flattens.
       */
      if (
        current.alloy === raised.alloy
        && current.crystal === raised.crystal
        && current.deuterium === raised.deuterium
      ) {
        return {
          label: i18n.t('gains.vault.storeLabel'),
          now: i18n.t('gains.vault.storeValue', { hours: storageHours(level).toFixed(1) }),
          next: i18n.t('gains.vault.storeValue', { hours: storageHours(next).toFixed(1) }),
        };
      }

      return {
        label: i18n.t('gains.vault.label'),
        // The resources stay separate. Adding them into one number erases the
        // rule the player is deciding against: each has its own protected floor.
        now: i18n.t('gains.vault.value', {
          alloy: full(current.alloy),
          crystal: full(current.crystal),
          deuterium: full(current.deuterium),
        }),
        next: i18n.t('gains.vault.value', {
          alloy: full(raised.alloy),
          crystal: full(raised.crystal),
          deuterium: full(raised.deuterium),
        }),
        resourcePair: {
          now: current,
          next: raised,
        },
      };
    }
    case 'SHIPYARD': {
      const unlocked = (['PIKE', 'COURIER', 'RAMPART'] as const).find(
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
    /**
     * ROOM, IN THE UNIT THE PLAYER READS EVERYWHERE ELSE. T4.
     *
     * The figure is deliberately the same one the ship rows and the order refusal
     * use, so "84 / 200" on the fleet readout and "200 → 360" here are visibly the
     * same quantity. A capacity sold in a different unit from the one it is spent
     * in is a capacity nobody can plan against.
     */
    case 'HANGAR':
      return {
        label: i18n.t('gains.hangar.label'),
        now: i18n.t('gains.hangar.value', { room: hangarCapacity(level) }),
        next: i18n.t('gains.hangar.value', { room: hangarCapacity(next) }),
      };
    /** An hourly rate, in the same shape the other two producers are sold in. T5. */
    case 'DEUTERIUM_PLANT':
      return {
        label: i18n.t('gains.plant.label'),
        now: i18n.t('gains.plant.value', {
          rate: full(Math.round(deuteriumRate(level) * production)),
        }),
        next: i18n.t('gains.plant.value', {
          rate: full(Math.round(deuteriumRate(next) * production)),
        }),
        unlocks: i18n.t('gains.plant.storage', {
          now: compact(deuteriumStorageCap(
            deuteriumRate(level) * production,
            crystalRate(levels.EXTRACTOR) * production,
            levels.VAULT,
          )),
          next: compact(deuteriumStorageCap(
            deuteriumRate(next) * production,
            crystalRate(levels.EXTRACTOR) * production,
            levels.VAULT,
          )),
        }),
      };
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
          unlocks: i18n.t('gains.telescope.maxed', {
            slots: telescopeSlots(level),
            range: Math.round(sensorReachAt(level, 0).identify),
          }),
          maxed: true,
        };
      }
      const slots = telescopeSlots(level);
      const nextSlots = telescopeSlots(next);
      const reach = sensorReachAt(next, 0).identify;
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
        now: rangeWord(sensorReachAt(level, 0).identify),
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
          now: radarReachWord(level),
          next: radarReachWord(level),
          unlocks: i18n.t('gains.radar.maxed'),
          maxed: true,
        };
      }
      if (next <= 2) {
        return {
          label: i18n.t('gains.radar.sweepLabel'),
          now: radarReachWord(level),
          next: radarReachWord(next),
          unlocks: i18n.t(next === 1 ? 'gains.radar.l1' : 'gains.radar.bearing'),
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
      return {
        label: i18n.t('gains.radar.sweepLabel'),
        now: radarReachWord(level),
        next: radarReachWord(next),
        ...(next === 3
          ? { unlocks: i18n.t('gains.radar.interception') }
          : next === 4
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
        unlocks: i18n.t('gains.aegis.unlocks', {
          percent: Math.round(SHIELD.regenPerHour * 100),
        }),
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

/**
 * WHAT ONE MORE RUNG OF RESEARCH ACTUALLY BUYS. T9 · T8 · D124.
 *
 * RESEARCH WAS THE ONLY LADDER IN THE GAME WITH NO FIGURE ON IT. Every other
 * buyable — a building, an instrument, a satellite — reaches `UpgradeRow` with a
 * `gain`, the "now → next" pair that says what the price is for. The research
 * panel built the same row and passed no gain at all, so fifteen projects were
 * sold on prose alone: "Builds ships faster", "Better attack and armour", "Mining
 * craft carry more". How much faster, how much better, how much more — nowhere,
 * on any surface, at any rung.
 *
 * Fleet V2 makes the distinctions explicit: Engineering opens tiers without
 * changing combat, Power changes attack, Armor changes HP and Propulsion changes
 * speed. Those boundaries are the decision, so each row names its own scope.
 *
 * EVERY FIGURE HERE IS COMPUTED FROM THE RULES, never restated. The percentages
 * come out of `hullTech`, `yardSpeedMult`, `prospectorHoldMult` and `cargoMult`,
 * so a change to `RESEARCH_TECH` moves this display with it and cannot leave a
 * stale number on a decision surface.
 */
export function researchGain(id: ResearchProjectId, level: number): Gain {
  const max = RESEARCH_MAX_LEVEL[id];
  const next = level + 1;
  const maxed = level >= max;
  /** The rung whose value is worth showing: the one on offer, or the last held. */
  const show = maxed ? level : next;

  /**
   * A PERMISSION IS NOT A LADDER, and it must not be drawn as one. D36's rule in
   * its second form: five of these projects have exactly one rung and buy a door
   * rather than a quantity. "0 → 1" on a door is a number nobody can use.
   */
  const permission = (unlocks: string): Gain => ({
    label: i18n.t('gains.research.opensLabel'),
    now: i18n.t(maxed ? 'gains.research.open' : 'gains.research.shut'),
    next: i18n.t('gains.research.open'),
    unlocks,
    ...(maxed ? { maxed: true as const } : {}),
  });

  /** A rung on a real ladder, as the percentage the player will feel. */
  const step = (label: string, at: (rung: number) => number, unlocks?: string): Gain => ({
    label,
    now: percent(at(level)),
    next: percent(at(show)),
    ...(unlocks === undefined ? {} : { unlocks }),
    ...(maxed ? { maxed: true as const } : {}),
  });

  /** Ground doctrine reads the same pure multiplier used by combat. */
  const combat = (hull: HullId, project: ResearchProjectId) =>
    (rung: number) => hullTech({ [project]: rung }, hull).atk - 1;

  switch (id) {
    /* ── the three Fleet V2 stat ladders ───────────────────── */
    case 'SHIP_POWER':
      return step(
        i18n.t('gains.research.powerLabel'),
        combat('DART', 'SHIP_POWER'),
        i18n.t('gains.research.powerScope'),
      );
    case 'SHIP_ARMOR':
      return step(
        i18n.t('gains.research.armorLabel'),
        (rung) => hullTech({ SHIP_ARMOR: rung }, 'DART').hp - 1,
        i18n.t('gains.research.armorScope'),
      );
    case 'SHIP_PROPULSION':
      return step(
        i18n.t('gains.research.speedLabel'),
        (rung) => hullTech({ SHIP_PROPULSION: rung }, 'DART').speed - 1,
        i18n.t('gains.research.speedScope'),
      );
    case 'EMPLACEMENT_DOCTRINE':
      return step(
        i18n.t('gains.research.groundLabel'),
        combat('BASTION', 'EMPLACEMENT_DOCTRINE'),
        i18n.t('gains.research.groundScope', {
          bastion: hullLabel('BASTION'),
          thorn: hullLabel('THORN'),
        }),
      );

    /** Engineering buys tier permission, not a statistic. */
    case 'STARSHIP_ENGINEERING':
      return {
        label: i18n.t('gains.research.engineeringLabel'),
        now: i18n.t('gains.research.engineeringTier', { tier: Math.min(4, level + 2) }),
        next: i18n.t('gains.research.engineeringTier', { tier: Math.min(4, show + 2) }),
        unlocks: i18n.t('gains.research.engineeringScope'),
        ...(maxed ? { maxed: true as const } : {}),
      };

    /* ── the three economy ladders ──────────────────────────── */
    case 'YARD_AUTOMATION':
      return step(
        i18n.t('gains.research.yardLabel'),
        // A shorter build is a NEGATIVE multiplier; the player feels a saving.
        (rung) => 1 - yardSpeedMult({ YARD_AUTOMATION: rung }),
      );
    case 'PROSPECTOR_HOLDS':
      return step(
        i18n.t('gains.research.holdsLabel'),
        (rung) => prospectorHoldMult({ PROSPECTOR_HOLDS: rung }) - 1,
        i18n.t('gains.research.holdsScope'),
      );
    case 'CARGO_HOLDS':
      return step(
        i18n.t('gains.research.cargoLabel'),
        (rung) => cargoMult({ CARGO_HOLDS: rung }) - 1,
        i18n.t('gains.research.cargoScope'),
      );

    /**
     * A LADDER THAT RAISES A CEILING ELSEWHERE, so the figure is that ceiling in
     * the unit the player builds in — levels of Refinery — rather than a percentage.
     */
    case 'DEUTERIUM_SYNTHESIS':
      return {
        label: i18n.t('gains.research.refineryLabel'),
        now: String(plantCeiling(level)),
        next: String(plantCeiling(show)),
        ...(maxed ? { maxed: true as const } : {}),
      };

    /** How many strategic weapons may stand ready at once. T11. */
    case 'STRATEGIC_STOCKPILE':
      return {
        label: i18n.t('gains.research.stockpileLabel'),
        now: String(strategicStockpile(level)),
        next: String(strategicStockpile(show)),
        ...(maxed ? { maxed: true as const } : {}),
      };

    /* ── the five permissions ───────────────────────────────── */
    case 'ISOTOPE_SPECTROMETRY':
      return permission(i18n.t('gains.research.isotopeOpens'));
    case 'DENSE_FUEL_CELLS':
      return permission(i18n.t('gains.research.denseOpens'));
    case 'GRAVITIC_CHARGES':
      return permission(i18n.t('gains.research.graviticOpens'));
    case 'DEATH_STAR_PROTOCOL':
      return permission(i18n.t('gains.research.protocolOpens'));
    case 'INTERCEPTION_GRID':
      return permission(i18n.t('gains.research.gridOpens'));
  }
}
