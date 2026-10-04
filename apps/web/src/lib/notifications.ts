import { z } from 'zod';
import { FAULT_KINDS } from '@astera/rules';
import type { NotificationView } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { hullName, monumentName, unlockCopy } from '../i18n/names.js';
import { compact, decimal, full } from './format.js';
import { commanderLabel } from './identity.js';
import { dayClock, duration } from './time.js';

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
const resourceBundle = z.object({
  alloy: z.number(),
  crystal: z.number(),
  deuterium: z.number(),
});

const convoyResult = z.object({
  trip: z.literal('intergalactic_convoy'),
  runId: z.string().uuid(),
  resourceReward: resourceBundle,
  awardedFleet: fleet,
  inTransit: z.literal(true),
});

/**
 * WHAT A CONVOY RUN WON, WHICHEVER OF ITS TWO MOMENTS IS BEING READ. D201.
 *
 * A run writes `convoy_result` when the firing ends and `fleet_returned` when the
 * prizes land, and the two payloads differ in their tail — `inTransit` on one, a
 * `destinationPlanetId` on the other. Only the prize itself decides whether the
 * row reads as a win, so the check is stated on the half they share and neither
 * strict shape is widened to serve it.
 */
const convoyPrize = z.object({
  trip: z.literal('intergalactic_convoy'),
  resourceReward: resourceBundle,
  awardedFleet: fleet,
});

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

/**
 * WHAT A RAID'S GARBAGE COLLECTORS LIFTED. D200.
 *
 * Present only when something was lifted, so every payload written before the hull
 * existed — and every raid without one — parses to zero and reads as it always did.
 * Its own three fields rather than folded into the loot: the loot moved Dominion
 * and the salvage never does, and a sentence that summed them would say otherwise.
 */
const salvageFields = {
  salvageAlloy: z.number().default(0),
  salvageCrystal: z.number().default(0),
  salvageDeuterium: z.number().default(0),
};

/**
 * WHAT THE REPAIR STATION DID WITH SHIPS THAT CAME OUT DAMAGED. Kalıcı gemi hasarı.
 *
 * Present only when it happened, so every payload written before the dock existed —
 * and every fight that left nobody scratched — reads exactly as it always did.
 */
const dockFields = {
  docked: z.number().int().nonnegative().optional(),
  autoRepaired: z.number().int().nonnegative().optional(),
};

/*
  KLAN SAVUNMA DESTEĞİ. The names are frozen into the payload when it is written, like
  every other notice's; `role` says which side of a departure this reader stood on.
*/
const RETURN_REASONS = ['RECALLED', 'SENT_BACK', 'HOST_CLOSED', 'EXPIRED', 'BAND', 'MEMBERSHIP', 'WORLD_CHANGED', 'FREEZE'] as const;
const supportInbound = z.object({
  senderName: z.string(),
  hostPlanetName: z.string(),
  fleet,
  arriveAt: z.coerce.date(),
});
const supportDeparted = z.object({
  reason: z.enum(RETURN_REASONS),
  role: z.enum(['SENDER', 'HOST']),
  senderName: z.string(),
  hostPlanetName: z.string(),
});
const supportResult = z.object({
  /** The raid's grade, which is the raider's: REPELLED is the line holding. */
  grade: z.enum(['DECISIVE', 'PARTIAL', 'REPELLED']),
  hostPlanetName: z.string(),
  lost: z.number(),
  survived: z.number(),
});
const postureReset = z.object({ planetNames: z.array(z.string()) });


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
  /** Taktik geri çekilme: the ships ran, or would have and the tank was dry. */
  escape: z.enum(['ESCAPED', 'STRANDED']).optional(),
  escapeShips: z.number().int().nonnegative().optional(),
  ...dockFields,
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
  ...salvageFields,
  unitsLost: z.number(),
  shipsHome: z.number(),
  dominion: z.number().int().safe().optional(),
  /** The line emptied in front of the raid. Nothing about what it held. */
  targetFled: z.boolean().optional(),
  /** Survivors flying home damaged; the Repair Station judges them when they land. */
  damaged: z.number().int().nonnegative().optional(),
});

/** Ships a cloud finished in flight. Radyasyon (plan F9/F10). Only their commander hears. */
const radiationLost = z.object({
  lost: z.number().int().positive(),
  left: z.number().int().nonnegative(),
  toPlanetId: z.string(),
  toPlanetName: z.string().nullable().optional(),
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
    /** Turned before it struck (K8): no battle was fought. */
    recalled: z.boolean().optional(),
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
    ...salvageFields,
    ...dockFields,
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
  z.object({
    trip: z.literal('mining_recalled'),
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
    ...dockFields,
  }),
  /** A clan support wave landed back at its sender's world. */
  z.object({
    trip: z.literal('support'),
    craft: z.number(),
    ...dockFields,
  }),
  z.object({
    trip: z.literal('transfer_rerouted'),
    reason: z.enum(['CAPACITY', 'OWNERSHIP']),
    craft: z.number(),
    targetPlanetId: z.string(),
    targetPlanetName: z.string(),
  }),
  /**
   * A CONVOY BACK FROM THE MERCHANT. D156 · D166.
   *
   * This branch was missing while the server was already writing `trip: 'trade'`,
   * and the failure mode is the reason it is called out here: an unparsed
   * `fleet_returned` falls through to `legacyRaidReturn`, which asks for exactly
   * the four fields a trade payload happens to carry — so it PARSED, and a swap
   * that took nothing from anybody was reported as plunder. A new `trip` value has
   * to grow this union in the same change.
   *
   * The field names are the server's (`lootAlloy` and friends), kept rather than
   * renamed: they are the same wire the raid branch reads and a rename would be a
   * migration for the notifications already written.
   */
  z.object({
    trip: z.literal('trade'),
    ships: z.number(),
    lootAlloy: z.number(),
    lootCrystal: z.number(),
    lootDeuterium: z.number().default(0),
  }),
  /**
   * A RAID ON A PIRATE COMING HOME. D177, and the branch above's warning made good.
   *
   * The server has written `trip: 'pirate'` since D150 and this union never had a
   * case for it, so every pirate homecoming fell to `legacyRaidReturn` — which
   * asks for exactly the four fields a pirate payload happens to carry. It parsed,
   * and printed the PvP fleet's wording over a lane with no commander in it. The
   * words were nearly right, which is why a year of them went unnoticed; the next
   * field added to the payload would have made them wrong.
   */
  z.object({
    trip: z.literal('pirate'),
    ships: z.number(),
    lootAlloy: z.number(),
    lootCrystal: z.number(),
    lootDeuterium: z.number().default(0),
    ...salvageFields,
    /** `resolvePirateReturn` puts it here; a capture is fleet, not ore. */
    capturedHull: z.string().optional(),
    ...dockFields,
  }),
  z.object({
    trip: z.literal('intergalactic_convoy'),
    runId: z.string().uuid(),
    resourceReward: resourceBundle,
    awardedFleet: fleet,
    destinationPlanetId: z.string().uuid(),
  }),
]);

/**
 * A FLIGHT THAT ARRIVED AT NOTHING. D177.
 *
 * One kind for two lanes because it is one fact: the pirate somebody else wiped
 * and the rock somebody else emptied are the same moment for the commander who
 * flew at it. `targetKind` says which, exactly as `raid_result` already carries
 * one. The payload names the target and never the rival — who got there first is
 * their own raid, and D127 does not hand it over.
 */
const targetGone = z.discriminatedUnion('targetKind', [
  z.object({
    targetKind: z.literal('PIRATE'),
    callsign: z.string(),
    level: z.number().optional(),
    ships: z.number(),
  }),
  z.object({
    targetKind: z.enum(['ASTEROID', 'DEBRIS']),
    craft: z.number(),
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
  /** A colony's loyalty before and after the hit (owner, 2026-10-01); absent off a colony. */
  loyalty: z.object({ before: z.number(), after: z.number() }).optional(),
});

const colonyEvent = z.object({ targetPlanetId: z.string() });

/** A secession (`loyalty.ts`) names the world it lost; older rows may not. */
const colonySeceded = z.object({ planetName: z.string().optional() });

/**
 * ONE BROKEN THING, NAMED. Koloni arızaları.
 *
 * `group` and `itemId` are parsed but not read here: the sentence does not need them and
 * `Signals` takes them straight off the raw payload to build the deep link. Declared all
 * the same, so this schema is the one statement of what the server sends.
 */
const colonyFault = z.object({
  planetId: z.string(),
  planetName: z.string(),
  fault: z.enum(FAULT_KINDS),
  group: z.string().optional(),
  itemId: z.string().optional(),
});

/** How far a world has fallen and how long is left of it. */
const loyaltyWarning = z.object({
  planetId: z.string(),
  planetName: z.string(),
  loyalty: z.number(),
  faults: z.number(),
  minutesLeft: z.number(),
});

/**
 * A PUBLIC EVENT STARTING OR ENDING — AND THERE ARE TWO KINDS OF THEM. D156.
 *
 * This pinned `eventKind` to the shower, so a merchant's start and end parsed as
 * FAILURES and the two cases below returned null: the row was written, delivered,
 * counted and then silently dropped from Signals. Nothing errored, which is what
 * made it expensive. Discriminated now, so a kind that is added and not taught
 * fails to parse loudly at the one place that has to say a sentence about it.
 */
const galaxyLifecycle = z.discriminatedUnion('eventKind', [
  z.object({
    eventKind: z.literal('ASTEROID_SHOWER'),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    asteroidSpawnMultiplier: z.number().gt(1),
  }),
  z.object({
    eventKind: z.literal('TRADE_SHIP'),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    rate: z.object({
      alloy: z.number().positive(),
      crystal: z.number().positive(),
      deuterium: z.number().positive(),
    }),
  }),
  z.object({
    eventKind: z.literal('INTERGALACTIC_CONVOY'),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    resourceCapHours: z.number().positive(),
    shipDropChanceAtFullQuality: z.number().min(0).max(1),
  }),
]);

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

/** "+15k salvage", or null when the collectors lifted nothing. */
const salvageClause = (trip: {
  salvageAlloy: number;
  salvageCrystal: number;
  salvageDeuterium: number;
}): string | null => {
  const lifted = trip.salvageAlloy + trip.salvageCrystal + trip.salvageDeuterium;
  return lifted >= 1 ? i18n.t('notifications.spoilSalvage', { amount: compact(lifted) }) : null;
};

/** A homecoming line with the salvage clause on the end, when there is one. */
const withSalvage = (line: string, clause: string | null): string =>
  clause === null ? line : `${line}${JOIN()}${clause}`;

/** "2 ships to the Repair Station · 1 patched free", each said only when it happened. */
const dockClauses = (dock: { docked?: number | undefined; autoRepaired?: number | undefined }): string[] => [
  ...(dock.docked !== undefined && dock.docked > 0
    ? [i18n.t('notifications.dockedClause', { count: dock.docked })] : []),
  ...(dock.autoRepaired !== undefined && dock.autoRepaired > 0
    ? [i18n.t('notifications.patchedClause', { count: dock.autoRepaired })] : []),
];

/** A landing line with what the Repair Station did on the end. */
const withDock = (line: string, dock: { docked?: number | undefined; autoRepaired?: number | undefined }): string =>
  [line, ...dockClauses(dock)].join(JOIN());

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
  monumentId?: string;
}

const monumentTarget = z.object({ monumentId: z.string().uuid(), monumentOrdinal: z.number().int().min(1).max(5).optional() });
const monumentResult = monumentTarget.extend({ targetKind: z.literal('MONUMENT'), attacking: z.boolean(),
  grade: z.enum(['DECISIVE', 'PARTIAL', 'REPELLED']), control: z.enum(['ATTACKER', 'DEFENDER', 'EMPTY']),
  survivors: z.number().int().nonnegative(), unitsLost: z.number().int().nonnegative(),
  lootDeuterium: z.number().finite().nonnegative(), dominion: z.number().int().safe(),
  opponents: z.array(z.object({ kind: z.enum(['PLAYER', 'NEUTRAL']), name: z.string(),
    clanName: z.string().nullable(), clanTag: z.string().nullable() })).default([]) });

/** Native target payloads cannot be treated as historical planet-shaped news. */
export function notificationMonumentTarget(notification: NotificationView): NotificationIdentity | null {
  const allowed = notification.kind === 'monument_inbound' || notification.kind === 'monument_probe_lost'
    || z.object({ targetKind: z.literal('MONUMENT') }).safeParse(notification.payload).success;
  if (!allowed) return null;
  const parsed = monumentTarget.safeParse(notification.payload);
  if (!parsed.success) return null;
  return { label: monumentName(parsed.data.monumentOrdinal), monumentId: parsed.data.monumentId };
}

/** A hostile monument wave is actionable only until its server-authored ETA. */
export function activeMonumentInbound(notification: NotificationView, monumentId: string, now: number): boolean {
  if (notification.kind !== 'monument_inbound') return false;
  const parsed = monumentTarget.extend({ arriveAt: z.coerce.date() }).safeParse(notification.payload);
  return parsed.success
    && parsed.data.monumentId === monumentId
    && parsed.data.arriveAt.getTime() > now;
}

/** The identity already printed in a notification, plus its safe Galaxy route. */
export function notificationIdentity(notification: NotificationView): NotificationIdentity | null {
  const target = notificationMonumentTarget(notification);
  if (target) return target;
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
  const native = notificationMonumentTarget(notification);
  if (native) {
    const name = native.label;
    if (notification.kind === 'radiation_lost') {
      const parsed = monumentTarget.extend({ lost: z.number().int().positive(), left: z.number().int().nonnegative(), lostDeuterium: z.number().finite().nonnegative() }).safeParse(notification.payload);
      return parsed.success ? i18n.t('monument.newsRadiation', { name, count: parsed.data.lost, left: parsed.data.left,
        cargo: decimal(parsed.data.lostDeuterium, 3) }) : null;
    }
    if (notification.kind === 'monument_inbound') {
      const parsed = monumentTarget.extend({ arriveAt: z.coerce.date() }).safeParse(notification.payload);
      if (!parsed.success) return null;
      return i18n.t('monument.newsInbound', { name, clock: parsed.data.arriveAt.getTime() <= now
        ? i18n.t('notifications.incomingLanded') : duration((parsed.data.arriveAt.getTime() - now) / 60_000) });
    }
    if (notification.kind === 'monument_probe_lost') return i18n.t('monument.newsProbeLost', { name });
    if (notification.kind === 'monument_returning') {
      const parsed = monumentTarget.extend({ craft: z.number().int().positive(), arriveAt: z.coerce.date(),
        reason: z.enum(['RECALLED', 'CAPACITY', 'MEMBERSHIP', 'CONTROL_CHANGED', 'DEFEAT', 'WORLD_CHANGED', 'FREEZE']) }).safeParse(notification.payload);
      return parsed.success ? i18n.t('monument.newsReturning', { name, count: parsed.data.craft,
        reason: i18n.t(`monument.returnReason.${parsed.data.reason}`),
        clock: duration(Math.max(0, (parsed.data.arriveAt.getTime() - now) / 60_000)) }) : null;
    }
    if (notification.kind === 'probe_report') {
      const parsed = monumentTarget.extend({ observedAt: z.coerce.date(), deliveredAt: z.coerce.date() }).safeParse(notification.payload);
      return parsed.success ? i18n.t('monument.newsProbeHome', { name,
        observed: dayClock(parsed.data.observedAt, now), delivered: dayClock(parsed.data.deliveredAt, now) }) : null;
    }
    if (notification.kind === 'raid_result') {
      const parsed = monumentResult.safeParse(notification.payload);
      if (!parsed.success) return null;
      const sentence = i18n.t('monument.newsBattle', { name, outcome: i18n.t(`monument.reportControl.${parsed.data.control}`),
        left: parsed.data.survivors, lost: parsed.data.unitsLost, points: String(parsed.data.dominion) });
      if (parsed.data.opponents.length === 0) return sentence;
      const opponents = parsed.data.opponents.map((opponent) => opponent.kind === 'NEUTRAL'
        ? i18n.t('monument.neutral')
        : opponent.clanTag ? `${opponent.name} [${opponent.clanTag}]` : opponent.name).join(' · ');
      return `${sentence} · ${i18n.t('monument.newsOpponents', { names: opponents })}`;
    }
    if (notification.kind === 'fleet_returned') {
      const parsed = monumentTarget.extend({ trip: z.literal('monument'), craft: z.number().int().nonnegative(), deuterium: z.number().finite().nonnegative() }).safeParse(notification.payload);
      return parsed.success ? i18n.t('monument.newsHome', { name, count: parsed.data.craft, cargo: decimal(parsed.data.deuterium, 3) }) : null;
    }
  }
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
        cost.push(...dockClauses(parsed.data));
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
      /*
        THE SHIPS ARE THE HEADLINE WHEN THEY RAN — or when they could not. Without it a
        defender whose whole fleet just outlived a raid three times its size read only
        what was carried off, and one whose tank was dry read "20 units lost" with
        nothing to say it was the fuel, not the fight, that lost them.
      */
      const { escape, escapeShips } = parsed.data;
      if (escape === 'ESCAPED') {
        clauses.push(i18n.t('notifications.raidedEscaped', { count: escapeShips ?? 0 }));
      } else if (escape === 'STRANDED') {
        clauses.push(i18n.t('notifications.raidedStranded', { count: escapeShips ?? 0 }));
      }
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
      clauses.push(...dockClauses(parsed.data));
      /**
       * A raid that genuinely cost nothing — repelled by the vault floor with no
       * defenders to lose and, on an older row, no works figure to report. Saying
       * so plainly is better than assembling an empty sentence.
       */
      if (clauses.length === 0) return `${raider}${i18n.t('notifications.raidedNothing')}`;
      return `${raider}${i18n.t('notifications.raided', { detail: clauses.join(JOIN()) })}`;
    }

    case 'radiation_lost': {
      const parsed = radiationLost.safeParse(notification.payload);
      if (!parsed.success) return null;
      const { lost, left, toPlanetName } = parsed.data;
      const way = toPlanetName
        ? i18n.t('notifications.radiationWayTo', { name: toPlanetName })
        : i18n.t('notifications.radiationWay');
      return left === 0
        ? i18n.t('notifications.radiationLostAll', { count: lost, way })
        : i18n.t('notifications.radiationLost', { count: lost, left, way });
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
      // After the loot and apart from it: wreck the collectors lifted, never plunder.
      const lifted = salvageClause(parsed.data);
      if (lifted !== null) took.push(lifted);
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
      // The line emptied in front of the raid: said first, because it is why nothing died.
      if (parsed.data.targetFled === true) took.unshift(i18n.t('notifications.raidTargetFled'));
      const { damaged } = parsed.data;
      const detail = [
        took.length > 0 ? took.join(JOIN()) : i18n.t('notifications.raidNothing'),
        ...(damaged !== undefined && damaged > 0 ? [i18n.t('notifications.damagedClause', { count: damaged })] : []),
      ].join(JOIN());
      return i18n.t('notifications.raidResult', {
        grade: gradeWord(grade),
        target,
        detail,
        count: unitsLost,
      });
    }

    case 'convoy_result': {
      const parsed = convoyResult.safeParse(notification.payload);
      if (!parsed.success) return null;
      const resources = spoils(
        parsed.data.resourceReward.alloy,
        parsed.data.resourceReward.crystal,
        parsed.data.resourceReward.deuterium,
      );
      const ships = composition(parsed.data.awardedFleet);
      return i18n.t('notifications.intergalacticConvoyResult', {
        resources: resources.length > 0
          ? resources.join(JOIN())
          : i18n.t('notifications.intergalacticConvoyNoResources'),
        ships: ships || i18n.t('notifications.intergalacticConvoyNoShip'),
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
      if (trip.trip === 'support') {
        return withDock(i18n.t('clanSupport.noticeHome', { count: trip.craft }), trip);
      }
      if (trip.trip === 'recalled') {
        if (trip.craftKind === 'probe') return i18n.t('notifications.probeLost');
        return withDock(i18n.t('notifications.recalled', { count: trip.craft }), trip);
      }
      if (trip.trip === 'trade') {
        /*
          WHAT IT BOUGHT, NOT WHAT IT TOOK. The merchant is a transaction, so the
          sentence names the goods and never uses the plunder wording — a convoy
          that came home with nothing bought nothing, which is a different fact
          from a raid that found nothing.
        */
        const bought = spoils(trip.lootAlloy, trip.lootCrystal, trip.lootDeuterium);
        return bought.length === 0
          ? i18n.t('notifications.tradeHomeEmpty', { count: trip.ships })
          : i18n.t('notifications.tradeHome', {
              count: trip.ships,
              landed: bought.join(JOIN()),
            });
      }
      if (trip.trip === 'intergalactic_convoy') {
        const resources = spoils(
          trip.resourceReward.alloy,
          trip.resourceReward.crystal,
          trip.resourceReward.deuterium,
        );
        const ships = composition(trip.awardedFleet);
        return i18n.t('notifications.intergalacticConvoyHome', {
          resources: resources.length > 0
            ? resources.join(JOIN())
            : i18n.t('notifications.intergalacticConvoyNoResources'),
          ships: ships || i18n.t('notifications.intergalacticConvoyNoShip'),
        });
      }
      if (trip.trip === 'pirate') {
        /*
          THE LANE IS NOT A COMMANDER, so it never borrows the raid's wording. A
          pirate has no world to come back FROM by name and no ledger to move, and
          `fleetFrom` would have nothing to put in it.
        */
        const loot = trip.lootAlloy + trip.lootCrystal + trip.lootDeuterium;
        /*
          A TOWED HULL IS NOT AN EMPTY HAND. `raid_result` puts a capture first
          because it is the one thing this lane pays in FLEET rather than in ore,
          and a raid whose cargo hulls all died comes home with nothing in the hold
          and a ship behind it — which "empty-handed" states as a falsehood.
          `hullName` returns null for a hull this build does not know, which is the
          honest answer mid-rolling-deploy: the clause is dropped rather than
          printing a raw id at the player.
        */
        const towed = trip.capturedHull === undefined ? null : hullName(trip.capturedHull);
        const lifted = salvageClause(trip);
        if (towed !== null) {
          return withDock(withSalvage(i18n.t('notifications.pirateHomeTowed', {
            count: trip.ships,
            hull: towed,
            ...(loot > 0 ? { amount: compact(loot) } : {}),
            context: loot > 0 ? 'looted' : 'empty',
          }), lifted), trip);
        }
        /*
          SALVAGE IS NOT AN EMPTY HAND EITHER. A squadron whose holds came home empty
          but whose collectors lifted a wreck brought something home, and
          "empty-handed" would state that as a falsehood — the towed-hull reasoning
          above, for the D200 hull.
        */
        return withDock(withSalvage(i18n.t(
          loot > 0
            ? 'notifications.pirateHome'
            : lifted !== null ? 'notifications.pirateHomeBare' : 'notifications.pirateHomeEmpty',
          { count: trip.ships, amount: compact(loot) },
        ), lifted), trip);
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
        // Called back before it struck (K8): "empty-handed" would say it fought and found nothing.
        if (trip.recalled === true) {
          return i18n.t('notifications.fleetHomeRecalled', { where, count: trip.ships });
        }
        const loot = trip.lootAlloy + trip.lootCrystal + trip.lootDeuterium;
        const lifted = salvageClause(trip);
        return withDock(withSalvage(i18n.t(
          loot > 0
            ? 'notifications.fleetHomeLooted'
            : lifted !== null ? 'notifications.fleetHomeBare' : 'notifications.fleetHomeEmpty',
          { where, count: trip.ships, amount: compact(loot) },
        ), lifted), trip);
      }
      if (trip.trip === 'mining_recalled') {
        return i18n.t('notifications.miningRecalledHome', { count: trip.craft });
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

    /**
     * ARRIVED, AND THERE WAS NOTHING THERE. D177.
     *
     * The sentence's job is to be the news the flight itself cannot be: a
     * committed launch cannot turn early, so this is the whole of what the
     * commander can act on — the trip is spent, and the next one should be aimed
     * somewhere else. It names the target and the craft turning back, and stops.
     */
    case 'target_gone': {
      const parsed = targetGone.safeParse(notification.payload);
      if (!parsed.success) return null;
      if (parsed.data.targetKind === 'PIRATE') {
        return i18n.t('notifications.targetGonePirate', {
          callsign: parsed.data.callsign,
          count: parsed.data.ships,
        });
      }
      return i18n.t(
        parsed.data.targetKind === 'DEBRIS'
          ? 'notifications.targetGoneDebris'
          : 'notifications.targetGoneAsteroid',
        { count: parsed.data.craft },
      );
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
      /*
        A HIT ON A COLONY SAYS WHAT IT TOOK. Rounded up like every loyalty figure, so a
        colony reported at 20% is one a hit really takes; at zero it says the colony is gone.
      */
      const loyalty = parsed.data.loyalty;
      if (parsed.data.outcome === 'FIRST_STRIKE' && loyalty) {
        return loyalty.after <= 0
          ? i18n.t('notifications.deathStarSeceded')
          : i18n.t('notifications.deathStarColony', {
            before: Math.ceil(loyalty.before),
            after: Math.ceil(loyalty.after),
          });
      }
      return i18n.t(`notifications.deathStar.${parsed.data.outcome}`);
    }

    case 'colony_captured':
    case 'settlement_success': {
      const parsed = colonyEvent.safeParse(notification.payload);
      void parsed;
      return i18n.t('notifications.colonyCaptured');
    }

    /*
      ONLY A SECESSION SENDS THIS NOW, whether neglect or a Death Star brought loyalty to
      zero. It used to blame "a strategic strike" for a colony its own commander let fall.
    */
    case 'colony_lost': {
      const parsed = colonySeceded.safeParse(notification.payload);
      const planet = parsed.success ? parsed.data.planetName : undefined;
      return planet
        ? i18n.t('notifications.colonyLost', { planet })
        : i18n.t('notifications.colonyLostUnnamed');
    }

    case 'settlement_lost': {
      const parsed = colonyEvent.safeParse(notification.payload);
      void parsed;
      return i18n.t('notifications.settlementLost');
    }

    /*
      SOMETHING BROKE, AND THE SENTENCE NAMES BOTH THE WORLD AND THE THING.

      A commander may hold four worlds and this is the only news in the game where
      knowing WHICH is not enough — "Vantage: something is broken" would send them
      hunting through four tabs for a row the payload already knows. The name of the
      fault is its own translation key, shared with the row and the repair sheet, so all
      three call one thing by one name.
    */
    case 'colony_fault': {
      const parsed = colonyFault.safeParse(notification.payload);
      if (!parsed.success) return null;
      return i18n.t('notifications.colonyFault', {
        planet: parsed.data.planetName,
        fault: i18n.t(`faults.name.${parsed.data.fault}`),
      });
    }

    /*
      THE WORLD IS ABOUT TO STOP BEING YOURS, and the sentence leads with the TIME.
      "34%" is not something a commander can act on; "eleven hours" is the figure that
      decides between fixing it now and fixing it tonight.
    */
    case 'colony_loyalty_warning': {
      const parsed = loyaltyWarning.safeParse(notification.payload);
      if (!parsed.success) return null;
      return i18n.t('notifications.colonyLoyalty', {
        planet: parsed.data.planetName,
        count: parsed.data.faults,
        time: duration(parsed.data.minutesLeft),
      });
    }

    case 'galaxy_event_started': {
      const parsed = galaxyLifecycle.safeParse(notification.payload);
      if (!parsed.success) return null;
      /*
        THE MERCHANT'S ARRIVAL IS THE ONE PIECE OF NEWS IN THIS GAME THAT IS AN
        INVITATION RATHER THAN A WARNING. It reaches Signals with the rate on it,
        because the rate is the whole of the decision it is asking for.
      */
      return parsed.data.eventKind === 'TRADE_SHIP'
        ? i18n.t('notifications.tradeShipStarted', {
            alloy: full(parsed.data.rate.deuterium / parsed.data.rate.alloy),
          })
        : parsed.data.eventKind === 'INTERGALACTIC_CONVOY'
          ? i18n.t('notifications.intergalacticConvoyStarted')
          : i18n.t('notifications.asteroidShowerStarted');
    }

    case 'galaxy_event_ended': {
      const parsed = galaxyLifecycle.safeParse(notification.payload);
      if (!parsed.success) return null;
      return parsed.data.eventKind === 'TRADE_SHIP'
        ? i18n.t('notifications.tradeShipEnded')
        : parsed.data.eventKind === 'INTERGALACTIC_CONVOY'
          ? i18n.t('notifications.intergalacticConvoyEnded')
          : i18n.t('notifications.asteroidShowerEnded');
    }

    /* KLAN SAVUNMA DESTEĞİ: who is coming, who left and why, what the ships did. */
    case 'clan_support_inbound': {
      const parsed = supportInbound.safeParse(notification.payload);
      if (!parsed.success) return i18n.t('clanSupport.noticeFallback');
      const { senderName, hostPlanetName, fleet: ships, arriveAt } = parsed.data;
      const count = Object.values(ships).reduce((sum, n) => sum + n, 0);
      return arriveAt.getTime() <= now
        ? i18n.t('clanSupport.noticeStanding', { name: senderName, count, world: hostPlanetName })
        : i18n.t('clanSupport.noticeInbound', {
          name: senderName, count, world: hostPlanetName,
          time: duration((arriveAt.getTime() - now) / 60_000),
        });
    }
    case 'clan_support_departed': {
      const parsed = supportDeparted.safeParse(notification.payload);
      if (!parsed.success) return i18n.t('clanSupport.noticeFallback');
      const { role, reason, senderName, hostPlanetName } = parsed.data;
      return i18n.t(role === 'SENDER' ? 'clanSupport.noticeLeavingSender' : 'clanSupport.noticeLeftHost', {
        name: senderName, world: hostPlanetName, reason: i18n.t(`clanSupport.reason.${reason}`),
      });
    }
    case 'clan_support_result': {
      const parsed = supportResult.safeParse(notification.payload);
      if (!parsed.success) return i18n.t('clanSupport.noticeFallback');
      const { hostPlanetName, lost, survived } = parsed.data;
      return i18n.t('clanSupport.noticeResult', { world: hostPlanetName, lost, kept: survived });
    }
    case 'defence_posture_reset': {
      const parsed = postureReset.safeParse(notification.payload);
      return i18n.t('clanSupport.noticeReset', {
        worlds: parsed.success ? parsed.data.planetNames.join(', ') : '',
      });
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
  if (notification.kind === 'monument_inbound' || notification.kind === 'monument_probe_lost') return true;
  const result = monumentResult.safeParse(notification.payload);
  if (notification.kind === 'raid_result' && result.success) return result.data.survivors === 0 || result.data.dominion < 0;
  if (
    notification.kind === 'incoming_fleet'
    || notification.kind === 'strategic_incoming'
    || notification.kind === 'radiation_lost'
    || notification.kind === 'colony_lost'
    || notification.kind === 'raided'
  ) return true;
  if (notification.kind === 'fleet_returned') return transferWasRerouted(notification);
  if (notification.kind !== 'raid_result') return false;
  const parsed = raidResult.safeParse(notification.payload);
  return parsed.success && parsed.data.shipsHome === 0;
};

/* ── what a row looks like ──────────────────────────────────── */

/**
 * WHICH FAMILY OF NEWS THIS IS — the hue, and nothing else.
 *
 * Every row in Signals used to be drawn identically: five glyphs plus a bell for
 * the other eleven kinds, aqua while unread and grey once read. A probe coming
 * home, a colony falling and an asteroid shower starting were interchangeable
 * lines, so the surface whose whole job is to say WHAT happened while you were
 * away could only say THAT something had.
 *
 * `docs/visual-design.md` states the law: **icons carry shape, the interface
 * carries colour.** This is the colour half — the CATEGORY — and `signalGlyph`
 * below is the shape half, the KIND. Neither is allowed to be the only thing that
 * separates two rows.
 *
 * IT IS A DIFFERENT QUESTION FROM `isAlarming`, WHICH IS WHY BOTH EXIST. This asks
 * what sort of news arrived; that asks whether the news is bad, and it decides the
 * sentence's ink and the toast's severity. They part company on exactly one lane:
 * a raid at a pirate wears the pirate's red skull whichever way it went, and a
 * decisive win is still not bad news — so the chip is red and the sentence is not.
 *
 *   · `threat` — done TO you, and it cost you something.
 *   · `pirate` — the pirate lane, which is red and skulled on the disc too.
 *   · `gain`   — a reading landed, a gate opened, something came home.
 *   · `watch`  — somebody is looking at you. A warning, not yet a loss.
 *   · `world`  — the whole galaxy, not you. Drawn as a banner, not a row.
 *   · `note`   — a kind this build has never heard of. Furniture, on purpose:
 *                a newer server's news must never borrow a hue that means something.
 */
export type SignalFamily = 'threat' | 'pirate' | 'gain' | 'watch' | 'world' | 'note';

/** A pirate raid, from the one field that says so. D150. */
const isPirateNews = (notification: NotificationView): boolean => {
  if (notification.kind === 'target_gone') {
    const gone = targetGone.safeParse(notification.payload);
    return gone.success && gone.data.targetKind === 'PIRATE';
  }
  if (notification.kind !== 'raid_result') return false;
  const parsed = raidResult.safeParse(notification.payload);
  return parsed.success && parsed.data.targetKind === 'PIRATE';
};

export function signalFamily(notification: NotificationView): SignalFamily {
  if (notification.kind === 'monument_inbound' || notification.kind === 'monument_probe_lost') return 'threat';
  switch (notification.kind) {
    case 'galaxy_event_started':
    case 'galaxy_event_ended':
      return 'world';
    /**
     * `settlement_lost` IS A LOSS AND IS NOT IN `isAlarming`, nor is an
     * interception the caller did not make (below).
     *
     * A settlement race lost sends the Couriers and their cargo home for nothing;
     * a Death Star shot off somebody else's ring is the most expensive hull in the
     * game gone. `isAlarming` is deliberately left alone — it drives a toast's
     * severity and a line's ink, and widening it here would be changing two
     * surfaces to fix one.
     */
    case 'incoming_fleet':
    case 'strategic_incoming':
    case 'raided':
    case 'colony_lost':
    case 'settlement_lost':
    case 'colony_loyalty_warning':
    case 'radiation_lost':
      return 'threat';
    /*
      A FAULT IS NOT AN ATTACK, and the ink says so. Threat red in this game means
      somebody is coming for you; spending it on an outage would cost the colour its
      meaning the first time a commander saw four red rows about their own plumbing.
      The LOYALTY WARNING above is a threat, because that one ends with a world gone.
    */
    case 'colony_fault':
      return 'watch';
    case 'scan_detected':
      return 'watch';
    /*
      KLAN SAVUNMA DESTEĞİ. Help on its way is good news; a wave leaving and a posture
      reset change the defence without costing anything yet; a fight the supporter's
      ships stood in reads by what it did to their Dominion.
    */
    case 'clan_support_inbound':
      return 'gain';
    case 'clan_support_departed':
    case 'defence_posture_reset':
      return 'watch';
    case 'clan_support_result': {
      const parsed = supportResult.safeParse(notification.payload);
      if (!parsed.success) return 'watch';
      return parsed.data.grade === 'REPELLED' ? 'gain' : 'threat';
    }
    case 'strategic_intercepted': {
      const parsed = intercepted.safeParse(notification.payload);
      // An unreadable payload is the fallback sentence, which says a weapon was
      // destroyed without saying whose. Neither hue would be honest; grey is.
      if (!parsed.success) return 'note';
      return parsed.data.defended ? 'gain' : 'threat';
    }
    case 'raid_result':
      if (isPirateNews(notification)) return 'pirate';
      return isAlarming(notification) ? 'threat' : 'gain';
    /*
      The lane it was flying, not a category of its own: a wasted pirate raid is
      pirate news and a wasted drill is the mining lane's, which is the family its
      own homecoming already wears. `signalOutcome` is what says it paid nothing.
    */
    case 'target_gone':
      return isPirateNews(notification) ? 'pirate' : 'gain';
    case 'fleet_returned':
      return isAlarming(notification) ? 'threat' : 'gain';
    /*
      A CONVOY RESULT IS THE PAYOFF, SO IT READS AS ONE. D201. It fell through to
      `note` — a grey row with a bell on it — which is how the moment the whole
      five-second action exists for was drawn as unremarkable housekeeping.
    */
    case 'convoy_result':
      return 'gain';
    case 'probe_report':
    case 'unlock':
    case 'colony_captured':
    case 'settlement_success':
    case 'death_star_result':
      return 'gain';
    default:
      return 'note';
  }
}

/**
 * DID IT GO THE READER'S WAY? Owner decision, and the row's own background says so.
 *
 * The third and last question a row is asked, and the only one whose answer is
 * legible without focusing on the row at all: a thin green wash for a win, a thin
 * red one for a loss, nothing on what is neither. `signalFamily` says which
 * CATEGORY of news arrived and `signalGlyph` says which kind; neither says whether
 * it was good, which is the first thing a person scanning forty rows wants.
 *
 * NEUTRAL IS UNTOUCHED, ON INSTRUCTION. Being scanned has cost nothing yet, an
 * asteroid shower is the galaxy's news rather than the reader's, and a strike that
 * did nothing did nothing. Washing them too would make three states out of two and
 * cost the other two their meaning.
 *
 * IT IS NOT `isAlarming` EITHER, though it agrees with it on every loss. That one
 * answers "is this worth a red toast and red ink"; this one has a third answer,
 * and the two part company on the pirate lane, where the chip is red whichever way
 * the fight went and only the squadron coming home decides this.
 */
export type SignalOutcome = 'win' | 'loss' | 'neutral';

export function signalOutcome(notification: NotificationView): SignalOutcome {
  const family = signalFamily(notification);
  /*
    NOTHING WAS WON AND NOTHING WAS LOST. D177.

    Every ship is coming back and the fuel was spent at launch, so a trip that
    arrived at nothing is the third answer this function exists to have. Without
    this line a pirate-family row falls through to `win` and the interface
    congratulates a commander on a trip that paid nothing.
  */
  if (notification.kind === 'target_gone') return 'neutral';
  if (notification.kind === 'fleet_returned') {
    const parsed = returned.safeParse(notification.payload);
    if (parsed.success && parsed.data.trip === 'mining_recalled') return 'neutral';
  }
  if (family === 'threat' || isAlarming(notification)) return 'loss';
  if (family === 'world' || family === 'watch' || family === 'note') return 'neutral';
  /**
   * A STRIKE THAT DID NOTHING. D105.
   *
   * `INEFFECTIVE` means protection or target state absorbed it — the Death Star is
   * still consumed, and nothing happened. It is the one `gain`-family row that is
   * not a gain, and painting it green would be the interface congratulating the
   * player on a wasted capital ship.
   */
  /**
   * A STRIKE THAT BROUGHT NOTHING HOME. D201, and the same rule as D105 above.
   *
   * A world with no production and a wing under the ship threshold can complete
   * the whole five seconds and come back empty. The convoy never fires back, so
   * nothing was lost either — which is exactly the third answer, and painting it
   * green would congratulate a commander on an empty hold.
   */
  if (notification.kind === 'convoy_result' || notification.kind === 'fleet_returned') {
    const parsed = convoyPrize.safeParse(notification.payload);
    if (parsed.success) {
      const { alloy, crystal, deuterium } = parsed.data.resourceReward;
      const ships = Object.values(parsed.data.awardedFleet)
        .reduce((sum, count) => sum + count, 0);
      if (alloy + crystal + deuterium + ships === 0) return 'neutral';
    }
  }
  if (notification.kind === 'death_star_result') {
    const parsed = strategicResult.safeParse(notification.payload);
    if (parsed.success && parsed.data.outcome === 'INEFFECTIVE') return 'neutral';
  }
  // `gain`, and the half of the pirate lane whose squadron came home.
  return 'win';
}

/**
 * WHICH SHAPE THIS KIND OF NEWS IS DRAWN WITH.
 *
 * A name rather than a component, so this stays a pure function next to the
 * sentence it labels and the one file that draws Signals maps the names to glyphs.
 * The test that matters asserts no kind the server can send falls back to `bell` —
 * eight of them did, which is indistinguishable from having no icon at all.
 */
export type SignalGlyph =
  | 'incoming'
  | 'strategic'
  | 'raided'
  | 'returned'
  | 'skull'
  | 'probe'
  | 'scan'
  | 'unlock'
  | 'conquest'
  | 'world-lost'
  | 'galaxy'
  | 'bell';

export function signalGlyph(notification: NotificationView): SignalGlyph {
  // Before the kind, because a raid at a pirate and a raid at a commander are the
  // same kind and are not the same news.
  if (isPirateNews(notification)) return 'skull';
  switch (notification.kind) {
    case 'monument_inbound':
      return 'incoming';
    case 'monument_probe_lost':
      return 'probe';
    case 'monument_returning':
      return 'returned';
    case 'incoming_fleet':
      return 'incoming';
    case 'strategic_incoming':
    case 'strategic_intercepted':
    case 'death_star_result':
      return 'strategic';
    case 'raided':
    case 'raid_result':
    case 'clan_support_result':
      return 'raided';
    case 'clan_support_inbound':
    case 'clan_support_departed':
    case 'fleet_returned':
    case 'target_gone':
    case 'convoy_result':
    case 'radiation_lost':
      return 'returned';
    /**
     * AN EYE FOR YOUR PROBE, A PING FOR SOMEBODY ELSE'S. See `EyeIcon`.
     *
     * The two used to share `ScanIcon`, which put "your reading came home" and
     * "you were scanned" under one mark — the two halves of "watching is silent;
     * probing is loud", drawn as the same thing.
     */
    case 'probe_report':
      return 'probe';
    case 'scan_detected':
      return 'scan';
    case 'unlock':
      return 'unlock';
    case 'colony_captured':
    case 'settlement_success':
      return 'conquest';
    case 'colony_lost':
    case 'settlement_lost':
      return 'world-lost';
    case 'galaxy_event_started':
    case 'galaxy_event_ended':
      return 'galaxy';
    default:
      return 'bell';
  }
}
