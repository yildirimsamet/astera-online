import { z } from 'zod';
import type { NotificationView } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { hullName, unlockCopy } from '../i18n/names.js';
import { compact } from './format.js';
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
  /** Radar L4. */
  estimatedShips: z.number().optional(),
  /** Radar L5, both of them. */
  fleet: fleet.optional(),
  originName: z.string().optional(),
});

const raided = z.object({
  grade: z.string(),
  lootAlloy: z.number(),
  lootCrystal: z.number(),
  unitsLost: z.number(),
  theirLosses: z.number().optional(),
});

const raidResult = z.object({
  grade: z.string(),
  targetName: z.string(),
  lootAlloy: z.number(),
  lootCrystal: z.number(),
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
    fromName: z.string().nullable().optional(),
    lootAlloy: z.number(),
    lootCrystal: z.number(),
  }),
  z.object({
    trip: z.enum(['mining', 'harvest']),
    craft: z.number(),
    alloy: z.number(),
    crystal: z.number(),
    wastedAlloy: z.number(),
    wastedCrystal: z.number(),
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
]);

const legacyRaidReturn = z.object({
  ships: z.number(),
  lootAlloy: z.number(),
  lootCrystal: z.number(),
});

const scanned = z.object({ bearing: z.string().optional() });

const probeHome = z.object({
  targetName: z.string(),
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

/* ── the sentences ──────────────────────────────────────────── */

/** A hull id off the wire, in the player's language. Unknown ids pass through. */
const named = (hull: string): string => hullName(hull) ?? hull;

/** "30 Wasp · 10 Lance". What Radar L5 is actually sold for. */
const composition = (ships: Record<string, number>): string =>
  Object.entries(ships)
    .filter(([, n]) => n > 0)
    .map(([hull, n]) => i18n.t('notifications.composition', { count: n, hull: named(hull) }))
    .join(i18n.t('notifications.join'));

const spoils = (alloy: number, crystal: number): string[] => {
  const out: string[] = [];
  if (alloy >= 1) out.push(i18n.t('notifications.spoilAlloy', { amount: compact(alloy) }));
  if (crystal >= 1) out.push(i18n.t('notifications.spoilCrystal', { amount: compact(crystal) }));
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

/**
 * @param now the client's clock, so a countdown can go into the past tense.
 * Passing it rather than reading `Date.now()` in here keeps this pure and lets a
 * test place a notification either side of its own arrival.
 */
export function describeNotification(notification: NotificationView, now: number): string | null {
  switch (notification.kind) {
    case 'incoming_fleet': {
      const parsed = incoming.safeParse(notification.payload);
      if (!parsed.success) return i18n.t('notifications.incomingFallback');
      const { arriveAt, etaMinutes, estimatedShips, fleet: ships, originName } = parsed.data;

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

      const parts = [i18n.t('notifications.incomingHead', { clock })];
      // Composition is the better line when radar has bought it — it says what
      // to build against, which a count cannot.
      if (ships && Object.keys(ships).length > 0) parts.push(composition(ships));
      else if (estimatedShips !== undefined) {
        parts.push(i18n.t('notifications.incomingEstimate', { count: estimatedShips }));
      }
      if (originName !== undefined) {
        parts.push(i18n.t('notifications.incomingFrom', { origin: originName }));
      }
      return parts.join(JOIN());
    }

    case 'raided': {
      const parsed = raided.safeParse(notification.payload);
      if (!parsed.success) return i18n.t('notifications.raidedFallback');
      const { grade, lootAlloy, lootCrystal, unitsLost, theirLosses } = parsed.data;
      if (grade === 'REPELLED') {
        // What it cost to hold, on both sides. "You repelled a raid" on its own
        // reads as a free win, and a defence that looks free is not one anybody
        // maintains.
        const cost = [i18n.t('notifications.repelledLost', { count: unitsLost })];
        if (theirLosses !== undefined && theirLosses > 0) {
          cost.push(i18n.t('notifications.repelledTheirs', { count: theirLosses }));
        }
        return i18n.t('notifications.repelledHead', { cost: cost.join(JOIN()) });
      }
      const loot = lootAlloy + lootCrystal;
      return i18n.t('notifications.raided', { amount: compact(loot), count: unitsLost });
    }

    case 'raid_result': {
      const parsed = raidResult.safeParse(notification.payload);
      if (!parsed.success) return i18n.t('notifications.raidResultFallback');
      const { grade, targetName, lootAlloy, lootCrystal, unitsLost, shipsHome } = parsed.data;
      // The fleet is gone. This is the line the whole notification exists for —
      // before it, nothing in the game told a player their raid had been wiped out.
      if (shipsHome === 0) {
        return i18n.t('notifications.raidWiped', { target: targetName, count: unitsLost });
      }
      const took = spoils(lootAlloy, lootCrystal);
      const detail = took.length > 0 ? took.join(JOIN()) : i18n.t('notifications.raidNothing');
      return i18n.t('notifications.raidResult', {
        grade: gradeWord(grade),
        target: targetName,
        detail,
        count: unitsLost,
      });
    }

    case 'fleet_returned': {
      const parsed = returned.safeParse(notification.payload);
      if (!parsed.success) {
        const legacy = legacyRaidReturn.safeParse(notification.payload);
        if (!legacy.success) return i18n.t('notifications.fleetFallback');
        const loot = legacy.data.lootAlloy + legacy.data.lootCrystal;
        return i18n.t(
          loot > 0 ? 'notifications.fleetHomeLooted' : 'notifications.fleetHomeEmpty',
          { where: '', count: legacy.data.ships, amount: compact(loot) },
        );
      }
      const trip = parsed.data;
      if (trip.trip === 'recalled') {
        if (trip.craftKind === 'probe') return i18n.t('notifications.probeLost');
        return i18n.t('notifications.recalled', { count: trip.craft });
      }
      if (trip.trip === 'raid') {
        const where = trip.fromName
          ? i18n.t('notifications.fleetFrom', { origin: trip.fromName })
          : '';
        const loot = trip.lootAlloy + trip.lootCrystal;
        return i18n.t(
          loot > 0 ? 'notifications.fleetHomeLooted' : 'notifications.fleetHomeEmpty',
          { where, count: trip.ships, amount: compact(loot) },
        );
      }
      const what = i18n.t(
        trip.trip === 'harvest' ? 'notifications.salvageWord' : 'notifications.oreWord',
      );
      const landed = spoils(trip.alloy, trip.crystal);
      const wasted = trip.wastedAlloy + trip.wastedCrystal;
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
      return i18n.t('notifications.probeHome', { target: parsed.data.targetName, caught });
    }

    case 'unlock': {
      const parsed = unlocked.safeParse(notification.payload);
      if (!parsed.success) return null;
      const copy = unlockCopy(parsed.data.unlock, parsed.data);
      return i18n.t('notifications.unlock', { title: copy.title, body: copy.body });
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
  notification.kind === 'raided' ||
  notification.kind === 'raid_result';

/**
 * Bad news, which is a different question from urgent news.
 *
 * A raid of your own resolving is urgent either way; it is only ALARMING if the
 * fleet did not come back. Colouring a decisive win in threat red would teach the
 * player to read red as "something happened" rather than as "something is wrong".
 */
export const isAlarming = (notification: NotificationView): boolean => {
  if (notification.kind === 'incoming_fleet' || notification.kind === 'raided') return true;
  if (notification.kind !== 'raid_result') return false;
  const parsed = raidResult.safeParse(notification.payload);
  return parsed.success && parsed.data.shipsHome === 0;
};
