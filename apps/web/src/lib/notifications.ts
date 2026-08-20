import { z } from 'zod';
import { HULLS, type HullId } from '@blindspace/rules';
import type { NotificationView } from '../api/schemas.js';
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

const unlocked = z.object({ title: z.string(), body: z.string() });

/* ── the sentences ──────────────────────────────────────────── */

const named = (hull: string): string =>
  hull in HULLS ? HULLS[hull as HullId].name : hull;

/** "30 Wasp · 10 Lance". What Radar L5 is actually sold for. */
const composition = (ships: Record<string, number>): string =>
  Object.entries(ships)
    .filter(([, n]) => n > 0)
    .map(([hull, n]) => `${String(n)} ${named(hull)}`)
    .join(' · ');

const spoils = (alloy: number, crystal: number): string[] => {
  const out: string[] = [];
  if (alloy >= 1) out.push(`+${compact(alloy)} alloy`);
  if (crystal >= 1) out.push(`+${compact(crystal)} crystal`);
  return out;
};

/**
 * @param now the client's clock, so a countdown can go into the past tense.
 * Passing it rather than reading `Date.now()` in here keeps this pure and lets a
 * test place a notification either side of its own arrival.
 */
export function describeNotification(notification: NotificationView, now: number): string | null {
  switch (notification.kind) {
    case 'incoming_fleet': {
      const parsed = incoming.safeParse(notification.payload);
      if (!parsed.success) return 'Incoming fleet.';
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
        ? 'landed'
        : arriveAt === undefined
          ? `ETA ${String(etaMinutes)} min`
          : `lands in ${duration((arriveAt.getTime() - now) / 60_000)}`;

      const parts = [`Incoming fleet · ${clock}`];
      // Composition is the better line when radar has bought it — it says what
      // to build against, which a count cannot.
      if (ships && Object.keys(ships).length > 0) parts.push(composition(ships));
      else if (estimatedShips !== undefined) parts.push(`est. ${String(estimatedShips)} ships`);
      if (originName !== undefined) parts.push(`from ${originName}`);
      return parts.join(' · ');
    }

    case 'raided': {
      const parsed = raided.safeParse(notification.payload);
      if (!parsed.success) return 'You were raided.';
      const { grade, lootAlloy, lootCrystal, unitsLost, theirLosses } = parsed.data;
      if (grade === 'REPELLED') {
        // What it cost to hold, on both sides. "You repelled a raid" on its own
        // reads as a free win, and a defence that looks free is not one anybody
        // maintains.
        const cost = [`${String(unitsLost)} lost holding`];
        if (theirLosses !== undefined && theirLosses > 0) {
          cost.push(`${String(theirLosses)} of theirs destroyed`);
        }
        return `Raid repelled · ${cost.join(' · ')}`;
      }
      const loot = lootAlloy + lootCrystal;
      return `Raided · −${compact(loot)} taken · ${String(unitsLost)} units lost`;
    }

    case 'raid_result': {
      const parsed = raidResult.safeParse(notification.payload);
      if (!parsed.success) return 'Your raid resolved.';
      const { grade, targetName, lootAlloy, lootCrystal, unitsLost, shipsHome } = parsed.data;
      // The fleet is gone. This is the line the whole notification exists for —
      // before it, nothing in the game told a player their raid had been wiped out.
      if (shipsHome === 0) {
        return `${targetName} held · your fleet was destroyed · ${String(unitsLost)} ships lost`;
      }
      const took = spoils(lootAlloy, lootCrystal);
      const detail = took.length > 0 ? took.join(' · ') : 'nothing taken';
      return `${grade} at ${targetName} · ${detail} · ${String(unitsLost)} ships lost`;
    }

    case 'fleet_returned': {
      const parsed = returned.safeParse(notification.payload);
      if (!parsed.success) {
        const legacy = legacyRaidReturn.safeParse(notification.payload);
        if (!legacy.success) return 'Your fleet is home.';
        const loot = legacy.data.lootAlloy + legacy.data.lootCrystal;
        return loot > 0
          ? `Fleet home · ${String(legacy.data.ships)} ships · +${compact(loot)} looted`
          : `Fleet home · ${String(legacy.data.ships)} ships · empty-handed`;
      }
      const trip = parsed.data;
      if (trip.trip === 'recalled') {
        if (trip.craftKind === 'probe') {
          return 'Your probe was lost · that flight could not be completed';
        }
        return `${String(trip.craft)} craft returned · that flight could not be completed`;
      }
      if (trip.trip === 'raid') {
        const where = trip.fromName ? ` from ${trip.fromName}` : '';
        const loot = trip.lootAlloy + trip.lootCrystal;
        return loot > 0
          ? `Fleet home${where} · ${String(trip.ships)} ships · +${compact(loot)} looted`
          : `Fleet home${where} · ${String(trip.ships)} ships · empty-handed`;
      }
      const what = trip.trip === 'harvest' ? 'Salvage' : 'Ore';
      const landed = spoils(trip.alloy, trip.crystal);
      const wasted = trip.wastedAlloy + trip.wastedCrystal;
      if (landed.length === 0) {
        return wasted > 0
          ? `${what} home · nowhere to put it · ${compact(wasted)} thrown away`
          : `${what} run home · nothing left to take`;
      }
      // The waste is the lesson. Ore mined and then dumped because the works were
      // already full is what D31 charges a miner for, and it had never once been
      // shown anywhere in the client.
      return wasted > 0
        ? `${what} home · ${landed.join(' · ')} · ${compact(wasted)} lost, works full`
        : `${what} home · ${landed.join(' · ')}`;
    }

    case 'scan_detected': {
      const parsed = scanned.safeParse(notification.payload);
      // The bearing is in every payload, but only Radar L2 has earned the right to
      // read it — so the API's own radar-filtered log is the source for that, and
      // this line stays deliberately vague.
      void parsed;
      return 'Scan detected. Someone is building a picture of you.';
    }

    case 'probe_report': {
      const parsed = probeHome.safeParse(notification.payload);
      if (!parsed.success) return 'A probe is home. Its report is readable.';
      const caught = parsed.data.detected === true ? ' · they caught it' : '';
      return `Probe home · ${parsed.data.targetName} is readable${caught}`;
    }

    case 'unlock': {
      const parsed = unlocked.safeParse(notification.payload);
      if (!parsed.success) return null;
      return `${parsed.data.title} — ${parsed.data.body}`;
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
