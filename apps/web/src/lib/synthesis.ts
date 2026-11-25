import { CAPSULE_CATALOG, CAPSULE_IDS, SYNTHESIS, accrueMoonAsterium, capsulesForLaunch, moonAsteriumPerDay, hangarLoad, synthesisCost, synthesisDurationMs, type CapsuleMissionKind, type Fleet, type MoonRarity } from '@astera/rules';
import type { TFunction } from 'i18next';
import type { CapsuleIdView, SynthesisView } from '../api/schemas.js';
import { RESOURCE_ART } from '../ui/assets.js';

/** What stops a batch, first thing first; null when it can start. */
export type LabRefusal = 'disabled' | 'locked' | 'busy' | 'asterium' | 'resources' | null;

export interface LabState {
  cost: { alloy: number; crystal: number; deuterium: number };
  asterium: number;
  minutes: number;
  /** The largest batch the Asteryum held and the rules allow; never under one. */
  most: number;
  refusal: LabRefusal;
}

/**
 * THE LABORATORY'S ARITHMETIC, FROM THE RULES (plan 2026-11-24 §4.4). The card shows these numbers and the
 * server charges the same ones, because both read `synthesisCost`; nothing is re-derived on the client.
 */
export function labState(view: SynthesisView, held: { alloy: number; crystal: number; deuterium: number }, capsule: CapsuleIdView, quantity: number): LabState {
  const { asterium, ...cost } = synthesisCost(capsule, quantity);
  const unit = CAPSULE_CATALOG[capsule].cost.asterium;
  const most = Math.max(1, Math.min(SYNTHESIS.maxBatch, Math.floor(view.asterium / unit)));
  const refusal: LabRefusal = !view.enabled ? 'disabled'
    : !view.unlocked ? 'locked'
      : view.job ? 'busy'
        : view.asterium < asterium ? 'asterium'
          : held.alloy < cost.alloy || held.crystal < cost.crystal || held.deuterium < cost.deuterium ? 'resources'
            : null;
  return { cost, asterium, minutes: synthesisDurationMs(capsule, quantity) / 60_000, most, refusal };
}

/** One capsule this flight may wear: how many its `bulk` needs, how many are held, and whether that covers it. */
export interface CapsuleChoice { id: CapsuleIdView; need: number; held: number; enough: boolean; bulk: number }

/**
 * THE CAPSULES THIS FLIGHT MAY WEAR, PRICED FROM ITS OWN BULK (plan §3.5). The same `capsulesForLaunch` the
 * server charges with, so the toggle and the bill agree; an empty fleet wears nothing.
 */
export function capsuleChoices(kind: CapsuleMissionKind, fleet: Fleet, held: Record<CapsuleIdView, number>): CapsuleChoice[] {
  const allowed = CAPSULE_IDS.filter((id) => CAPSULE_CATALOG[id].allowedMissions.includes(kind));
  const bulk = hangarLoad(fleet);
  return capsulesForLaunch(allowed, fleet).filter((one) => one.count > 0)
    .map((one) => ({ id: one.id, need: one.count, held: held[one.id], enough: held[one.id] >= one.count, bulk }));
}

/** The laboratory's picture names each capsule's potion (G14 art). */
export const CAPSULE_ART: Readonly<Record<CapsuleIdView, string>> = {
  OPTIC_VEIL: '/assets/ui/icons/capsule-veil.webp',
  SILENT_THRUST: '/assets/ui/icons/capsule-silent.webp',
};
export const ASTERIUM_ART = RESOURCE_ART.asterium;

export interface Vial { state: 'full' | 'brewing' | 'empty'; fill: number }

/**
 * A running batch as a rack of vials (owner 2026-11-25: "kimya laboratuvarı"): the made ones full, the one in
 * the still filling by its own clock (one capsule's craft time up to `nextAt`), the rest empty.
 */
export function vialRack(job: { capsuleId: CapsuleIdView; quantity: number; delivered: number; nextAt: Date }, now: number): Vial[] {
  const each = CAPSULE_CATALOG[job.capsuleId].craftMinutes * 60_000;
  const left = Math.max(0, job.nextAt.getTime() - now);
  const brewing = Math.min(1, Math.max(0, 1 - left / each));
  return Array.from({ length: job.quantity }, (_, index): Vial =>
    index < job.delivered ? { state: 'full', fill: 1 }
      : index === job.delivered ? { state: 'brewing', fill: brewing }
        : { state: 'empty', fill: 0 });
}

/**
 * WHAT A CAPSULE DOES, IN WORDS (owner 2026-11-25). The veil hides the flight from everyone but its owner and clan;
 * on a flight that attacks it also says the target's Radar still warns, which a settlement or a transfer has no
 * use for. The laboratory tells the whole of it (`attacks` true).
 */
export function capsuleWords(t: TFunction, id: CapsuleIdView, attacks: boolean): string {
  const effect = t(`synthesis.capsule.${id}.effect`);
  return id === 'OPTIC_VEIL' && attacks ? `${effect} ${t('synthesis.capsule.OPTIC_VEIL.warns')}` : effect;
}

/** Where a moon's Asteryum stands now, counted on from the server's last read with the same rule the server pays by. */
export interface MoonAsteriumReading {
  perDay: number;
  /** Whole units this moon has paid its holder, the ones made since the last read included. */
  produced: number;
  /** How far the next unit is made, 0 to 1. */
  progress: number;
  /** Until the next unit lands in the laboratory's stock: a shut moon's wait included. */
  nextInMs: number;
  /** Until a Death Star's shut ends; 0 for an open moon. */
  closedForMs: number;
}

export function moonAsteriumReading(moon: {
  rarity: MoonRarity;
  closedUntil: Date | null;
  asterium: { syncedAt: Date; fraction: number; produced: number };
}, now: number): MoonAsteriumReading {
  const perDay = moonAsteriumPerDay(moon.rarity);
  const closedUntilMs = moon.closedUntil?.getTime() ?? null;
  const accrued = accrueMoonAsterium({ rarity: moon.rarity, syncedAtMs: moon.asterium.syncedAt.getTime(), closedUntilMs,
    fraction: moon.asterium.fraction, nowMs: now });
  const closedForMs = closedUntilMs !== null && closedUntilMs > now ? closedUntilMs - now : 0;
  return {
    perDay,
    produced: moon.asterium.produced + accrued.gained,
    progress: accrued.fraction,
    nextInMs: closedForMs + (1 - accrued.fraction) * 86_400_000 / perDay,
    closedForMs,
  };
}
