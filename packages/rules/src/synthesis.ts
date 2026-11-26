/**
 * ASTERYUM VE SENTEZ LABORATUVARI. Owner plan 2026-11-24, answers 2026-11-25
 * (`docs/asteryum-ve-sentez-laboratuvari-plani-2026-11-24.md`).
 *
 * Asteryum is a commander's own strategic stock: it comes only from the daily Asteryum
 * Fırtınası in the Yarık and from moons, and is spent only here. The laboratory turns it
 * into capsules; a capsule is pressed onto a launch, one per 500 bulk of flying ships.
 *
 * Pure rules only, so the server, the client's launch quote and the simulator price a
 * capsule the same way. Content lives in `CAPSULE_CATALOG` (EN-20).
 */
import { hangarLoad } from './hulls.js';
import type { MoonRarity } from './moon.js';
import type { Fleet, MissionKind } from './types.js';

export const CAPSULE_IDS = ['OPTIC_VEIL', 'SILENT_THRUST'] as const;
export type CapsuleId = (typeof CAPSULE_IDS)[number];

/** Every launch a capsule could be asked for; `clan_war` is the joint strike its leader fires. */
export type CapsuleMissionKind = MissionKind | 'clan_war';

/** What one capsule (or a batch of them) costs. Asteryum rides beside the three resources. */
export interface SynthesisCost {
  readonly alloy: number;
  readonly crystal: number;
  readonly deuterium: number;
  readonly asterium: number;
}

export interface CapsuleDefinition {
  readonly id: CapsuleId;
  /** The layer it covers; two capsules of one group cannot ride one flight. */
  readonly stackGroup: 'FLEET_SIGHT' | 'FLEET_WARNING';
  readonly allowedMissions: readonly CapsuleMissionKind[];
  readonly cost: SynthesisCost;
  /** Per capsule (K13); a batch takes `quantity` times this. */
  readonly craftMinutes: number;
}

/** A capsule pressed onto one mission, and how many it took. Stored on `missions.applied_capsules`. */
export interface AppliedCapsule {
  readonly id: CapsuleId;
  readonly count: number;
}

export const SYNTHESIS = Object.freeze({
  /**
   * Seasons created at this ruleset are dealt Asteryum (and the storm) at creation; a live season
   * gets it from one activation instant (`seasons.synthesis_starts_at`), as moons did.
   */
  rulesetVersion: 21,
  /** Komuta Merkezi level that opens the laboratory, capital only (K5). */
  requiredCore: 10,
  /** One capsule per this much `hangarLoad` (K12). */
  bulkPerCapsule: 500,
  /** Share of an unmade capsule's price a cancel returns (K6). */
  cancelRefundRatio: 0.5,
  /** Capsules one job may make. A full Hangar 10 (7,270 bulk) needs 15. */
  maxBatch: 20,
  /** Asteryum a moon makes in a day, by rarity (K4). */
  // Owner 2026-11-25: halved ("2-3 kolonisi olanlar çok fazla üretebilir"); the storm stays the active player's source.
  moonPerDay: Object.freeze({ COMMON: 1, RARE: 1.5, EPIC: 2, LEGENDARY: 3 }) satisfies Readonly<Record<MoonRarity, number>>,
});

export const CAPSULE_CATALOG: Readonly<Record<CapsuleId, CapsuleDefinition>> = Object.freeze({
  /** Optik Örtü: gone from every map but its owner's and their clan's (K8, K11). */
  OPTIC_VEIL: Object.freeze({
    id: 'OPTIC_VEIL',
    stackGroup: 'FLEET_SIGHT',
    allowedMissions: Object.freeze(['attack', 'clan_war', 'transfer', 'settlement'] as const),
    cost: Object.freeze({ alloy: 2_000, crystal: 3_000, deuterium: 250, asterium: 4 }),
    craftMinutes: 30,
  }),
  /**
   * Sessiz İtki: the target is never warned (K8). Only on flights that warn at all — a transfer
   * or a settlement raises no warning, so the capsule would burn for nothing there.
   */
  SILENT_THRUST: Object.freeze({
    id: 'SILENT_THRUST',
    stackGroup: 'FLEET_WARNING',
    allowedMissions: Object.freeze(['attack', 'clan_war'] as const),
    cost: Object.freeze({ alloy: 4_000, crystal: 2_000, deuterium: 350, asterium: 6 }),
    craftMinutes: 60,
  }),
});

export const isCapsuleId = (value: unknown): value is CapsuleId =>
  typeof value === 'string' && (CAPSULE_IDS as readonly string[]).includes(value);

/** Capsules of one kind a fleet needs: one per `bulkPerCapsule` of flying ships, rounded up. */
export function requiredCapsules(_id: CapsuleId, fleet: Fleet): number {
  const bulk = hangarLoad(fleet);
  return bulk <= 0 ? 0 : Math.ceil(bulk / SYNTHESIS.bulkPerCapsule);
}

export type CapsuleValidation =
  | { readonly ok: true; readonly ids: CapsuleId[] }
  | { readonly ok: false; readonly code: 'CAPSULE_DUPLICATE' | 'CAPSULE_MISSION_FORBIDDEN' };

/** The capsules a launch asked for, in catalog order, or why they may not ride it. */
export function validateMissionCapsules(kind: CapsuleMissionKind, requested: readonly CapsuleId[]): CapsuleValidation {
  const groups = new Set<string>();
  for (const id of requested) {
    const def = CAPSULE_CATALOG[id];
    if (groups.has(def.stackGroup)) return { ok: false, code: 'CAPSULE_DUPLICATE' };
    groups.add(def.stackGroup);
    if (!def.allowedMissions.includes(kind)) return { ok: false, code: 'CAPSULE_MISSION_FORBIDDEN' };
  }
  return { ok: true, ids: CAPSULE_IDS.filter((id) => requested.includes(id)) };
}

/** What a launch of `fleet` with `ids` (already validated) takes from the inventory. */
export function capsulesForLaunch(ids: readonly CapsuleId[], fleet: Fleet): AppliedCapsule[] {
  return ids.map((id) => ({ id, count: requiredCapsules(id, fleet) }));
}

const assertQuantity = (quantity: number): void => {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > SYNTHESIS.maxBatch) {
    throw new Error(`Invalid synthesis quantity ${quantity}`);
  }
};

/** The whole price of a batch of `quantity` capsules. */
export function synthesisCost(id: CapsuleId, quantity: number): SynthesisCost {
  assertQuantity(quantity);
  const unit = CAPSULE_CATALOG[id].cost;
  return {
    alloy: unit.alloy * quantity,
    crystal: unit.crystal * quantity,
    deuterium: unit.deuterium * quantity,
    asterium: unit.asterium * quantity,
  };
}

/** From start to the last capsule. */
export function synthesisDurationMs(id: CapsuleId, quantity: number): number {
  assertQuantity(quantity);
  return CAPSULE_CATALOG[id].craftMinutes * 60_000 * quantity;
}

/** Capsules a running job has made by `nowMs`: one each time a capsule's minutes pass (K6). */
export function synthesisDelivered(
  job: { readonly capsuleId: CapsuleId; readonly quantity: number; readonly startedAtMs: number },
  nowMs: number,
): number {
  const each = CAPSULE_CATALOG[job.capsuleId].craftMinutes * 60_000;
  const made = Math.floor(Math.max(0, nowMs - job.startedAtMs) / each);
  return Math.min(job.quantity, made);
}

/**
 * A cancel returns half of what the UNMADE capsules cost, from what was actually paid (ML-06):
 * a later price change can never turn a cancel into profit. Made capsules stay in the inventory.
 */
export function synthesisCancelRefund(paid: SynthesisCost, quantity: number, delivered: number): SynthesisCost {
  const unmade = Math.max(0, quantity - Math.max(0, delivered));
  const back = (amount: number): number =>
    quantity <= 0 ? 0 : Math.floor((amount * unmade * SYNTHESIS.cancelRefundRatio) / quantity + 1e-9);
  return {
    alloy: back(paid.alloy),
    crystal: back(paid.crystal),
    deuterium: back(paid.deuterium),
    asterium: back(paid.asterium),
  };
}

export const moonAsteriumPerDay = (rarity: MoonRarity): number => SYNTHESIS.moonPerDay[rarity];

/**
 * A MOON'S ASTERYUM, COUNTED WHEN SOMEBODY LOOKS (no cron). Time only counts while the moon is
 * open: a Death Star's `closedUntil` holds production until it passes (K4). Whole units are paid,
 * the fraction is carried, and reading twice pays the same as reading once.
 */
export function accrueMoonAsterium(input: {
  readonly rarity: MoonRarity;
  readonly syncedAtMs: number;
  readonly closedUntilMs: number | null;
  readonly fraction: number;
  readonly nowMs: number;
}): { gained: number; fraction: number; syncedAtMs: number } {
  const from = Math.max(input.syncedAtMs, input.closedUntilMs ?? -Infinity);
  const syncedAtMs = Math.max(input.syncedAtMs, input.nowMs);
  if (input.nowMs <= from) return { gained: 0, fraction: input.fraction, syncedAtMs };
  const perMs = moonAsteriumPerDay(input.rarity) / 86_400_000;
  const total = input.fraction + (input.nowMs - from) * perMs;
  const gained = Math.floor(total + 1e-9);
  return { gained, fraction: Math.max(0, total - gained), syncedAtMs };
}

const carries = (applied: readonly AppliedCapsule[], id: CapsuleId): boolean =>
  applied.some((capsule) => capsule.id === id && capsule.count > 0);

/** Optik Örtü: drawn for nobody but its owner and their clan, Gözcü included (K8, K11). */
export const missionHidesFromGalaxy = (applied: readonly AppliedCapsule[]): boolean => carries(applied, 'OPTIC_VEIL');

/** Sessiz İtki: no warning, clan alarm, paid alert or inbound mark reaches the target (K8). */
export const missionSuppressesRadarWarning = (applied: readonly AppliedCapsule[]): boolean => carries(applied, 'SILENT_THRUST');

/** Asteryum and the laboratory exist in this season: dealt at creation or activated live; main galaxies only. */
export function synthesisEnabled(
  season: { readonly rulesetVersion: number; readonly synthesisStartsAt?: Date | null },
  shard: { readonly role: 'MAIN' | 'WAITING' },
): boolean {
  return (season.rulesetVersion >= SYNTHESIS.rulesetVersion || (season.synthesisStartsAt ?? null) !== null)
    && shard.role === 'MAIN';
}
