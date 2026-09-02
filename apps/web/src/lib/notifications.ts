import { z } from 'zod';
import type { NotificationView } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { hullName, unlockCopy } from '../i18n/names.js';
import { compact } from './format.js';
import { commanderLabel } from './identity.js';
import { duration } from './time.js';

/**
 * THE SEVEN KINDS OF NEWS, TURNED INTO THE SENTENCES A PLAYER READS. D45.
 *
 * There were four, and there were four because the "while you were gone" overlay
 * carried the rest. D23 deleted the overlay and the rest went with it: a player
 * was told when they were raided and never told what their own raid did, told
 * when a probe was caught and never told when their own came home.
 *
 * What is still excluded, permanently: "your storage is full", "we miss you",
 * streaks, login bonuses. Every one of those exists to manufacture a reason to
 * open the app rather than to report something that happened. A full works is a
 * STATUS — true until you act — and lives in the "Right now" section of Signals,
 * where it never enters the unread count.
 *
 * PAYLOADS ARE PARSED, NEVER TRUSTED, and the parse failing is not a hypothetical:
 * every mining return in the game read "Your fleet is home." for exactly that
 * reason. `contract.test.ts` now runs these parsers against payloads a real worker
 * wrote, which is the only test that could have caught it.
 */

/* ── payload shapes ─────────────────────────────────────────── */

const fleet = z.record(z.string(), z.number());

const incoming = z.object({
  /** ISO instant. Absent on rows written before D45; `etaMinutes` covers those. */
  arriveAt: z.coerce.date().optional(),
  etaMinutes: z.number(),
  /** Historical Radar L4 payload; retained only so old notification rows render. */
  estimatedShips: z.number().optional(),
  /** Radar L4. */
  mass: z.enum(['LIGHT', 'MEDIUM', 'HEAVY']).optional(),
  /** Radar L5, both of them. */
  fleet: fleet.optional(),
  originPlanetId: z.string().optional(),
  originUsername: z.string().optional(),
  originClanTag: z.string().optional(),
  originPlanetName: z.string().optional(),
  /** Historical payload fallback. */
  originName: z.string().optional(),
  /**
   * WHICH OF YOUR OWN WORLDS IT IS AIMED AT.
   *
   * Never a radar product: the ladder sells the attacker's side. Optional because
   * rows written before this existed do not carry it.
   */
  targetPlanetName: z.string().optional(),
});

/** Both halves of one interception: who is reading it, and how far out it died. */
const intercepted = z.object({
  planetId: z.string().optional(),
  defended: z.boolean(),
  range: z.number(),
});

const raided = z.object({
  originPlanetId: z.string().optional(),
  originUsername: z.string().optional(),
  originClanTag: z.string().optional(),
  originPlanetName: z.string().optional(),
  grade: z.string(),
  lootAlloy: z.number(),
  lootCrystal: z.number(),
  lootDeuterium: z.number().default(0),
  unitsLost: z.number(),
  theirLosses: z.number().optional(),
  /** Optional: rows written before the works were reported are still readable. */
  disruptedMinutes: z.number().optional(),
});

const raidResult = z.object({
  grade: z.string(),
  /**
   * WHAT WAS ON THE OTHER SIDE. D150.
   *
   * Absent on every row written before pirates existed, and absent on every
   * ordinary raid since — a raid at a commander is the default and says nothing.
   * `'PIRATE'` is the one value that changes how this notification reads, because
   * there is no world and no commander to name in it.
   */
  targetKind: z.literal('PIRATE').optional(),
  pirateLevel: z.number().optional(),
  pirateCallsign: z.string().optional(),
  /** The hull towed home from a decisive win, if the roll paid out. */
  capturedHull: z.string().optional(),
  targetPlanetId: z.string().optional(),
  targetUsername: z.string().optional(),
  targetClanTag: z.string().optional(),
  targetPlanetName: z.string().optional(),
  /** Historical payload fallback. */
  targetName: z.string().optional(),
  lootAlloy: z.number(),
  lootCrystal: z.number(),
  lootDeuterium: z.number().default(0),
  unitsLost: z.number(),
  shipsHome: z.number(),
  dominion: z.number().optional(),
});

/**
 * Three different journeys end under one kind, so the payload carries a
 * discriminant and the client reads it BEFORE any other field.
 *
 * The raid variant tolerates a missing `trip` because that is what rows written
 * before D45 look like — every field it needs is present in them.
 */
const returned = z.discriminatedUnion('trip', [
  z.object({
    trip: z.literal('raid'),
    ships: z.number(),
    fromPlanetId: z.string().optional(),
    fromUsername: z.string().nullable().optional(),
    fromClanTag: z.string().optional(),
    fromPlanetName: z.string().nullable().optional(),
    /** Historical payload fallback. */
    fromName: z.string().nullable().optional(),
    lootAlloy: z.number(),
    lootCrystal: z.number(),
    lootDeuterium: z.number().default(0),
  }),
  z.object({
    trip: z.enum(['mining', 'harvest']),
    craft: z.number(),
    alloy: z.number(),
    crystal: z.number(),
    deuterium: z.number().default(0),
    wastedAlloy: z.number(),
    wastedCrystal: z.number(),
    wastedDeuterium: z.number().default(0),
  }),
  /**
   * A flight the server gave up on. `craftKind` says what was lost, because the
   * COUNT cannot: a probe has no unit rows, so `craft` is zero and the sentence
   * read "0 craft returned" — a recall notice reporting the loss of nothing.
   * Optional, so a notification written before D52a still parses.
   */
  z.object({
    trip: z.literal('recalled'),
    craft: z.number(),
    craftKind: z.enum(['fleet', 'probe']).optional(),
  }),
  z.object({
    trip: z.literal('transfer_rerouted'),
    reason: z.enum(['CAPACITY', 'OWNERSHIP']),
    craft: z.number(),
    targetPlanetId: z.string(),
    targetPlanetName: z.string(),
  }),
]);

const transferWasRerouted = (notification: NotificationView): boolean => {
  if (notification.kind !== 'fleet_returned') return false;
  const parsed = returned.safeParse(notification.payload);
  return parsed.success && parsed.data.trip === 'transfer_rerouted';
};

const legacyRaidReturn = z.object({
  ships: z.number(),
  lootAlloy: z.number(),
  lootCrystal: z.number(),
  lootDeuterium: z.number().default(0),
});

const scanned = z.object({ bearing: z.string().optional() });

const probeHome = z.object({
  targetPlanetId: z.string().optional(),
  targetUsername: z.string().optional(),
  targetClanTag: z.string().optional(),
  targetPlanetName: z.string().optional(),
  /** Historical payload fallback. */
  targetName: z.string().optional(),
  detected: z.boolean().optional(),
});

/**
 * `unlock` is the ID and is what the client localises off; `title` and `body` are
 * the server's own English, kept as the fallback for a fifth unlock this build
 * has never heard of. Optional because rows written before this existed carry
 * only the pair.
 */
const unlocked = z.object({
  unlock: z.string().optional(),
  title: z.string(),
  body: z.string(),
});

const strategicResult = z.object({
  outcome: z.enum(['FIRST_STRIKE', 'CAPTURED', 'INEFFECTIVE']),
  targetPlanetId: z.string(),
});

const colonyEvent = z.object({ targetPlanetId: z.string() });

const galaxyLifecycle = z.object({
  eventKind: z.literal('ASTEROID_SHOWER'),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  asteroidSpawnMultiplier: z.number().gt(1),
});

/* ── the sentences ──────────────────────────────────────────── */

/** A hull id off the wire, in the player's language. Unknown ids pass through. */
const named = (hull: string): string => hullName(hull) ?? hull;

/** "30 Wasp · 10 Lance". What Radar L5 is actually sold for. */
const composition = (ships: Record<string, number>): string =>
  Object.entries(ships)
    .filter(([, n]) => n > 0)
    .map(([hull, n]) => i18n.t('notifications.composition', { count: n, hull: named(hull) }))
    .join(i18n.t('notifications.join'));

const spoils = (alloy: number, crystal: number, deuterium = 0): string[] => {
  const out: string[] = [];
  if (alloy >= 1) out.push(i18n.t('notifications.spoilAlloy', { amount: compact(alloy) }));
  if (crystal >= 1) out.push(i18n.t('notifications.spoilCrystal', { amount: compact(crystal) }));
  if (deuterium >= 1) {
    out.push(i18n.t('notifications.spoilDeuterium', { amount: compact(deuterium) }));
  }
  return out;
};

/** The separator between clauses of one notification. One place, one decision. */
const JOIN = (): string => i18n.t('notifications.join');

/**
 * DECISIVE, PARTIAL or REPELLED, in the player's language.
 *
 * The payload carries the enum, not a word, so an unrecognised value from a newer
 * server passes through as itself rather than disappearing — the same fallback
 * rule as every other id that arrives over the wire.
 */
const GRADE_KEY = {
  DECISIVE: 'reports.gradeDecisive',
  PARTIAL: 'reports.gradePartial',
  REPELLED: 'reports.gradeRepelled',
} as const;

const gradeWord = (grade: string): string =>
  grade in GRADE_KEY ? i18n.t(GRADE_KEY[grade as keyof typeof GRADE_KEY]) : grade;

const identity = (
  username: string | null | undefined,
  planetName: string | null | undefined,
  legacy: string | null | undefined,
  clanTag?: string | null,
): string => {
  if (username && planetName) {
    return i18n.t('notifications.commanderAt', {
      username: commanderLabel(username, clanTag),
      planet: planetName,
    });
  }
  return (username ? commanderLabel(username, clanTag) : undefined)
    ?? planetName
    ?? legacy
    ?? i18n.t('notifications.unknownCommander');
};

export interface NotificationIdentity {
  label: string;
  planetId?: string;
}

/** The identity already printed in a notification, plus its safe Galaxy route. */
export function notificationIdentity(notification: NotificationView): NotificationIdentity | null {
  switch (notification.kind) {
    case 'incoming_fleet':
    case 'strategic_incoming': {
      const parsed = incoming.safeParse(notification.payload);
      if (!parsed.success) return null;
      const { originPlanetId, originUsername, originClanTag, originPlanetName, originName } = parsed.data;
      if (!originUsername && !originPlanetName && !originName) return null;
      return {
        label: identity(originUsername, originPlanetName, originName, originClanTag),
        ...(originPlanetId ? { planetId: originPlanetId } : {}),
      };
    }
    case 'raided': {
      const parsed = raided.safeParse(notification.payload);
      if (!parsed.success || !parsed.data.originUsername) return null;
      return {
        label: identity(
          parsed.data.originUsername,
          parsed.data.originPlanetName,
          undefined,
          parsed.data.originClanTag,
        ),
        ...(parsed.data.originPlanetId ? { planetId: parsed.data.originPlanetId } : {}),
      };
    }
    case 'raid_result': {
      const parsed = raidResult.safeParse(notification.payload);
      if (!parsed.success) return null;
      /*
        A PIRATE IS NOT A COMMANDER AND HAS NO WORLD. D150.

        `identity()` builds a label out of a username, a world and a clan tag, and
        a pirate has none of the three — left to it, the row would have read
        "someone at an unknown world". There is also nothing to deep-link to: the
        dossier matches worlds, and this fight happened in empty space.
      */
      if (parsed.data.targetKind === 'PIRATE') {
        return {
          label: parsed.data.pirateLevel === undefined
            ? i18n.t('pirate.title')
            : i18n.t('pirate.name', {
                level: parsed.data.pirateLevel,
                callsign: parsed.data.pirateCallsign ?? '',
              }),
        };
      }
      return {
        label: identity(
          parsed.data.targetUsername,
          parsed.data.targetPlanetName,
          parsed.data.targetName,
          parsed.data.targetClanTag,
        ),
        ...(parsed.data.targetPlanetId ? { planetId: parsed.data.targetPlanetId } : {}),
      };
    }
    case 'fleet_returned': {
      const parsed = returned.safeParse(notification.payload);
      if (!parsed.success) return null;
      if (parsed.data.trip === 'transfer_rerouted') {
        return {
          label: parsed.data.targetPlanetName,
          planetId: parsed.data.targetPlanetId,
        };
      }
      if (parsed.data.trip !== 'raid') return null;
      if (!parsed.data.fromUsername && !parsed.data.fromPlanetName && !parsed.data.fromName) return null;
      return {
        label: identity(
          parsed.data.fromUsername,
          parsed.data.fromPlanetName,
          parsed.data.fromName,
          parsed.data.fromClanTag,
        ),
        ...(parsed.data.fromPlanetId ? { planetId: parsed.data.fromPlanetId } : {}),
      };
    }
    case 'probe_report': {
      const parsed = probeHome.safeParse(notification.payload);
      if (!parsed.success) return null;
      return {
        label: identity(
          parsed.data.targetUsername,
          parsed.data.targetPlanetName,
          parsed.data.targetName,
          parsed.data.targetClanTag,
        ),
        ...(parsed.data.targetPlanetId ? { planetId: parsed.data.targetPlanetId } : {}),
      };
    }
    default:
      return null;
  }
}

/**
 * @param now the client's clock, so a countdown can go into the past tense.
 * Passing it rather than reading `Date.now()` in here keeps this pure and lets a
 * test place a notification either side of its own arrival.
 */
export function describeNotification(notification: NotificationView, now: number): string | null {
  switch (notification.kind) {
    case 'incoming_fleet':
    case 'strategic_incoming': {
      const parsed = incoming.safeParse(notification.payload);
      if (!parsed.success) return i18n.t('notifications.incomingFallback');
      const {
        arriveAt, etaMinutes, estimatedShips, mass, fleet: ships,
        originUsername, originClanTag, originPlanetName, originName,
        targetPlanetName,
      } = parsed.data;

      /**
       * THE COUNTDOWN IS AGAINST THE ARRIVAL INSTANT, NOT THE WRITTEN ETA.
       *
       * `etaMinutes` was measured when the row was written, so a warning read an
       * hour later still said "ETA 12 min" — beside a timestamp reading "1 h ago".
       * A live figure frozen at the moment it stopped being true is worse than no
       * figure: it is the interface disagreeing with itself in one line.
       */
      const landed = arriveAt !== undefined && arriveAt.getTime() <= now;
      const clock = landed
        ? i18n.t('notifications.incomingLanded')
        : arriveAt === undefined
          ? i18n.t('notifications.incomingEta', { minutes: etaMinutes })
          : i18n.t('notifications.incomingLandsIn', {
              duration: duration((arriveAt.getTime() - now) / 60_000),
            });

      const parts = [i18n.t(
        notification.kind === 'strategic_incoming'
          ? 'notifications.strategicIncomingHead'
          : 'notifications.incomingHead',
        { clock },
      )];
      // Composition is the better line when radar has bought it — it says what
      // to build against, which a count cannot.
      if (ships && Object.keys(ships).length > 0) parts.push(composition(ships));
      else if (mass !== undefined) {
        parts.push(i18n.t(
          mass === 'HEAVY'
            ? 'pendingStrip.massHeavy'
            : mass === 'MEDIUM'
              ? 'pendingStrip.massMedium'
              : 'pendingStrip.massLight',
        ));
      }
      else if (estimatedShips !== undefined) {
        parts.push(i18n.t('notifications.incomingEstimate', { count: estimatedShips }));
      }
      if (originUsername !== undefined || originPlanetName !== undefined || originName !== undefined) {
        parts.push(i18n.t('notifications.incomingFrom', {
          origin: identity(originUsername, originPlanetName, originName, originClanTag),
        }));
      }
      /**
       * AND WHICH OF YOUR WORLDS IT IS FOR, LAST.
       *
       * After the clock and the force, because those decide WHETHER to act and
       * this decides WHERE — and with four worlds a warning that does not say
       * where is a warning nobody can act on. It is the recipient's own world, so
       * it costs the fog nothing.
       */
      if (targetPlanetName !== undefined) {
        parts.push(i18n.t('notifications.incomingAt', { world: targetPlanetName }));
      }
      return parts.join(JOIN());
    }

    /**
     * A strategic weapon destroyed on a ring. T10.
     *
     * Two readings of one event, and the payload says which: the defender stopped
     * it, the attacker lost it. One kind rather than two, because it IS one event
     * — and a pair of kinds would let the two halves drift apart in wording.
     */
    case 'strategic_intercepted': {
      const parsed = intercepted.safeParse(notification.payload);
      if (!parsed.success) return i18n.t('notifications.interceptedFallback');
      return parsed.data.defended
        ? i18n.t('notifications.interceptedDefended', { range: Math.round(parsed.data.range) })
        : i18n.t('notifications.interceptedLost', { range: Math.round(parsed.data.range) });
    }
    case 'raided': {
      const parsed = raided.safeParse(notification.payload);
      if (!parsed.success) return i18n.t('notifications.raidedFallback');
      const {
        grade, lootAlloy, lootCrystal, lootDeuterium, unitsLost, theirLosses, disruptedMinutes,
        originUsername, originClanTag, originPlanetName,
      } =
        parsed.data;
      const raider = originUsername
        ? i18n.t('notifications.raidedBy', {
            origin: identity(originUsername, originPlanetName, undefined, originClanTag),
          })
        : '';
      if (grade === 'REPELLED') {
        // What it cost to hold, on both sides. "You repelled a raid" on its own
        // reads as a free win, and a defence that looks free is not one anybody
        // maintains.
        const cost = [i18n.t('notifications.repelledLost', { count: unitsLost })];
        if (theirLosses !== undefined && theirLosses > 0) {
          cost.push(i18n.t('notifications.repelledTheirs', { count: theirLosses }));
        }
        return `${raider}${i18n.t('notifications.repelledHead', { cost: cost.join(JOIN()) })}`;
      }
      /**
       * SAY WHAT HAPPENED, NOT WHAT DID NOT.
       *
       * This line was "Raided · −{loot} taken · {n} units lost" unconditionally,
       * and on a live shard it read "−0 taken · 0 units lost" over and over: the
       * vault floor makes a poor planet unlootable and an undefended one loses no
       * units, so both figures are zero precisely when a player is at their most
       * vulnerable. Six of those in an evening is a game telling somebody nothing
       * is happening to them while their production sits switched off.
       *
       * So the clauses are now the ones that are TRUE. What was taken, what was
       * lost, and how long the works are down — each stated only when it is not
       * zero, and the works stated first because it is the largest of the three.
       */
      const clauses: string[] = [];
      if (disruptedMinutes !== undefined && disruptedMinutes > 0) {
        clauses.push(i18n.t('notifications.raidedWorks', { time: duration(disruptedMinutes) }));
      }
      const loot = lootAlloy + lootCrystal + lootDeuterium;
      if (loot > 0) {
        clauses.push(i18n.t('notifications.raidedTaken', { amount: compact(loot) }));
      }
      if (unitsLost > 0) {
        clauses.push(i18n.t('notifications.raidedLost', { count: unitsLost }));
      }
      /**
       * A raid that genuinely cost nothing — repelled by the vault floor with no
       * defenders to lose and, on an older row, no works figure to report. Saying
       * so plainly is better than assembling an empty sentence.
       */
      if (clauses.length === 0) return `${raider}${i18n.t('notifications.raidedNothing')}`;
      return `${raider}${i18n.t('notifications.raided', { detail: clauses.join(JOIN()) })}`;
    }

    case 'raid_result': {
      const parsed = raidResult.safeParse(notification.payload);
      if (!parsed.success) return i18n.t('notifications.raidResultFallback');
      const {
        grade, targetUsername, targetClanTag, targetPlanetName, targetName,
        lootAlloy, lootCrystal, lootDeuterium, unitsLost, shipsHome,
        targetKind, pirateLevel, pirateCallsign, capturedHull,
      } = parsed.data;
      const target = targetKind === 'PIRATE'
        ? (pirateLevel === undefined
            ? i18n.t('pirate.title')
            : i18n.t('pirate.name', { level: pirateLevel, callsign: pirateCallsign ?? '' }))
        : identity(targetUsername, targetPlanetName, targetName, targetClanTag);
      // The fleet is gone. This is the line the whole notification exists for —
      // before it, nothing in the game told a player their raid had been wiped out.
      if (shipsHome === 0) {
        return i18n.t('notifications.raidWiped', { target, count: unitsLost });
      }
      const took = spoils(lootAlloy, lootCrystal, lootDeuterium);
      /*
        THE SHIP IS THE HEADLINE WHEN THERE IS ONE. D150.

        A captured hull is the only thing in the game that a risk pays in FLEET
        rather than in ore, and reporting it as one more clause after the alloy
        would bury the single most memorable outcome this feature can produce.
      */
      if (capturedHull !== undefined) {
        // `hullName` returns null for a hull this build does not know, which is
        // the honest answer during a rolling deploy — the clause is dropped rather
        // than printing a raw id at the player.
        const name = hullName(capturedHull);
        if (name !== null) took.unshift(i18n.t('pirate.captured', { hull: name }));
      }
      const detail = took.length > 0 ? took.join(JOIN()) : i18n.t('notifications.raidNothing');
      return i18n.t('notifications.raidResult', {
        grade: gradeWord(grade),
        target,
        detail,
        count: unitsLost,
      });
    }

    case 'fleet_returned': {
      const parsed = returned.safeParse(notification.payload);
      if (!parsed.success) {
        const legacy = legacyRaidReturn.safeParse(notification.payload);
        if (!legacy.success) return i18n.t('notifications.fleetFallback');
        const loot =
          legacy.data.lootAlloy + legacy.data.lootCrystal + legacy.data.lootDeuterium;
        return i18n.t(
          loot > 0 ? 'notifications.fleetHomeLooted' : 'notifications.fleetHomeEmpty',
          { where: '', count: legacy.data.ships, amount: compact(loot) },
        );
      }
      const trip = parsed.data;
      if (trip.trip === 'transfer_rerouted') {
        return i18n.t(
          trip.reason === 'CAPACITY'
            ? 'notifications.transferReturningCapacity'
            : 'notifications.transferReturningOwnership',
          { target: trip.targetPlanetName },
        );
      }
      if (trip.trip === 'recalled') {
        if (trip.craftKind === 'probe') return i18n.t('notifications.probeLost');
        return i18n.t('notifications.recalled', { count: trip.craft });
      }
      if (trip.trip === 'raid') {
        const origin = identity(
          trip.fromUsername,
          trip.fromPlanetName,
          trip.fromName,
          trip.fromClanTag,
        );
        const where = trip.fromUsername || trip.fromPlanetName || trip.fromName
          ? i18n.t('notifications.fleetFrom', { origin })
          : '';
        const loot = trip.lootAlloy + trip.lootCrystal + trip.lootDeuterium;
        return i18n.t(
          loot > 0 ? 'notifications.fleetHomeLooted' : 'notifications.fleetHomeEmpty',
          { where, count: trip.ships, amount: compact(loot) },
        );
      }
      const what = i18n.t(
        trip.trip === 'harvest' ? 'notifications.salvageWord' : 'notifications.oreWord',
      );
      const landed = spoils(trip.alloy, trip.crystal, trip.deuterium);
      const wasted = trip.wastedAlloy + trip.wastedCrystal + trip.wastedDeuterium;
      if (landed.length === 0) {
        return wasted > 0
          ? i18n.t('notifications.haulWasted', { what, amount: compact(wasted) })
          : i18n.t('notifications.haulNothing', { what });
      }
      // The waste is the lesson. Ore mined and then dumped because the works were
      // already full is what D31 charges a miner for, and it had never once been
      // shown anywhere in the client.
      return wasted > 0
        ? i18n.t('notifications.haulPartly', {
            what,
            landed: landed.join(JOIN()),
            amount: compact(wasted),
          })
        : i18n.t('notifications.haul', { what, landed: landed.join(JOIN()) });
    }

    case 'scan_detected': {
      const parsed = scanned.safeParse(notification.payload);
      // The bearing is in every payload, but only Radar L2 has earned the right to
      // read it — so the API's own radar-filtered log is the source for that, and
      // this line stays deliberately vague.
      void parsed;
      return i18n.t('notifications.scanDetected');
    }

    case 'probe_report': {
      const parsed = probeHome.safeParse(notification.payload);
      if (!parsed.success) return i18n.t('notifications.probeFallback');
      const caught = parsed.data.detected === true ? i18n.t('notifications.probeCaught') : '';
      return i18n.t('notifications.probeHome', {
        target: identity(
          parsed.data.targetUsername,
          parsed.data.targetPlanetName,
          parsed.data.targetName,
          parsed.data.targetClanTag,
        ),
        caught,
      });
    }

    case 'unlock': {
      const parsed = unlocked.safeParse(notification.payload);
      if (!parsed.success) return null;
      const copy = unlockCopy(parsed.data.unlock, parsed.data);
      return i18n.t('notifications.unlock', { title: copy.title, body: copy.body });
    }

    case 'death_star_result': {
      const parsed = strategicResult.safeParse(notification.payload);
      if (!parsed.success) return i18n.t('notifications.deathStarFallback');
      return i18n.t(`notifications.deathStar.${parsed.data.outcome}`);
    }

    case 'colony_captured':
    case 'settlement_success': {
      const parsed = colonyEvent.safeParse(notification.payload);
      void parsed;
      return i18n.t('notifications.colonyCaptured');
    }

    case 'colony_lost': {
      const parsed = colonyEvent.safeParse(notification.payload);
      void parsed;
      return i18n.t('notifications.colonyLost');
    }

    case 'settlement_lost': {
      const parsed = colonyEvent.safeParse(notification.payload);
      void parsed;
      return i18n.t('notifications.settlementLost');
    }

    case 'galaxy_event_started': {
      const parsed = galaxyLifecycle.safeParse(notification.payload);
      if (!parsed.success) return null;
      return i18n.t('notifications.asteroidShowerStarted');
    }

    case 'galaxy_event_ended': {
      const parsed = galaxyLifecycle.safeParse(notification.payload);
      if (!parsed.success) return null;
      return i18n.t('notifications.asteroidShowerEnded');
    }

    /**
     * A kind this build does not know.
     *
     * Reachable, now that the schema parses `kind` as a string: a server one
     * deploy ahead of a phone that has not reloaded sends news this code has never
     * heard of. One row is skipped; the rest of the history still renders.
     */
    default:
      return null;
  }
}

/**
 * Worth interrupting a session for, and therefore worth showing FIRST.
 *
 * One toast can be on screen at a time, so this is an ordering as much as a
 * filter: an inbound fleet must never be pushed off the screen by a mining run
 * that landed in the same second. It was exported and used by nothing — both
 * surfaces had copied the condition inline instead, and had already drifted.
 */
export const isUrgent = (notification: NotificationView): boolean =>
  notification.kind === 'incoming_fleet' ||
  notification.kind === 'strategic_incoming' ||
  notification.kind === 'colony_lost' ||
  notification.kind === 'raided' ||
  notification.kind === 'raid_result' ||
  notification.kind === 'galaxy_event_started' ||
  notification.kind === 'galaxy_event_ended' || transferWasRerouted(notification);

/**
 * Bad news, which is a different question from urgent news.
 *
 * A raid of your own resolving is urgent either way; it is only ALARMING if the
 * fleet did not come back. Colouring a decisive win in threat red would teach the
 * player to read red as "something happened" rather than as "something is wrong".
 */
export const isAlarming = (notification: NotificationView): boolean => {
  if (
    notification.kind === 'incoming_fleet'
    || notification.kind === 'strategic_incoming'
    || notification.kind === 'colony_lost'
    || notification.kind === 'raided'
  ) return true;
  if (notification.kind === 'fleet_returned') return transferWasRerouted(notification);
  if (notification.kind !== 'raid_result') return false;
  const parsed = raidResult.safeParse(notification.payload);
  return parsed.success && parsed.data.shipsHome === 0;
};
