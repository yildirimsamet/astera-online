import { fleetCount, vaultProtects } from '@astera/rules';
import type { GalaxyView, IntelView, PendingThread, PlanetView } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { compact, full } from './format.js';
import { duration } from './time.js';

/**
 * THE SITUATION ENGINE.
 *
 * The single biggest thing missing from the first client: it displayed sixteen
 * equally-weighted rows and never once said what mattered. A player could not
 * answer "what should I do next, and why", so nothing on screen created a
 * decision — which is the whole product.
 *
 * This is a game system, not copy. It reads real state and ranks it. Every rule
 * below has to justify itself against one question: *would a competent player,
 * looking at this planet, actually think about this right now?* If not, it does
 * not belong here — a directive list that cries wolf is worse than none, because
 * the player learns to skip it.
 *
 * Deliberately capped and deliberately quiet when the answer is "nothing urgent".
 *
 * THREATS AND OPPORTUNITIES ONLY (owner, 2026-10-20): *"Bu weakness kartlarını iptal et sil
 * istemiyorum"* — a new commander closed one advice card after another. Build tips, the
 * shielded "prepare" variants and the "nothing in flight" card are gone.
 */

export type DirectiveKind = 'threat' | 'opportunity';
export type Screen = 'planet' | 'galaxy' | 'intel';
/**
 * The planet screen's sections, named for the problem each one solves.
 *
 * `see` became `orbit` in D22. The old section held three of the five satellites
 * and the other two lived under Defend and Grow, so a player could not compare the
 * choice the design calls "the identity choice" without visiting three tabs.
 * `orbit` holds all five and nothing else.
 */
export type PlanetGroup = 'defend' | 'orbit' | 'reach' | 'grow' | 'tactical';

export interface Directive {
  id: string;
  kind: DirectiveKind;
  /** Consequence first. Never a system name. */
  title: string;
  /** One clause on why it matters. Never a paragraph. */
  detail: string;
  /** What pressing it does, and where it lands the player. */
  action: { label: string; screen: Screen; planetId?: string; group?: PlanetGroup };
  /** Higher wins. Only relative order matters. */
  weight: number;
}

export interface Situation {
  planet: PlanetView;
  galaxy: GalaxyView | undefined;
  intel: IntelView | undefined;
  pending: PendingThread[];
  /** Projected stock, so a directive agrees with the number on screen. */
  held: { alloy: number; crystal: number; deuterium?: number };
  /**
   * WHEN THE ATTACK SHIELD ENDS, IF ONE HOLDS (`season.shieldUntil`). Spec H1.
   *
   * Newcomer or recovery, no raid can be launched at this commander until then, so
   * exposure is not worth a card — red is for something happening to you. A fleet
   * already in the air stays a threat regardless.
   */
  shieldUntil?: Date | null;
  /** The instant the shield is read against: the host's server clock. */
  now?: number;
}

export function directives(s: Situation): Directive[] {
  const out: Directive[] = [];
  const { planet } = s;

  const ground = fleetCount(planet.ground);
  const stock = s.held.alloy + s.held.crystal + (s.held.deuterium ?? 0);
  const protectedFloor = planet.planet.vaultFloor;
  const exposed = Math.max(0, stock - protectedFloor);
  /** While nothing can be launched at this world, its exposure is not a card. */
  const shielded = s.shieldUntil ? s.shieldUntil.getTime() > (s.now ?? Date.now()) : false;

  /* ── threats ──────────────────────────────────────────────── */

  // Radar has already told them. This outranks everything: it is the only moment
  // in the game with a deadline measured in minutes.
  const inbound = s.pending.find((t) => t.kind === 'incoming');
  if (inbound) {
    out.push({
      id: 'inbound',
      kind: 'threat',
      title: i18n.t('directives.inboundTitle', { duration: duration(inbound.minutesRemaining) }),
      detail: i18n.t('directives.inboundDetail'),
      action: { label: i18n.t('directives.inboundAction'), screen: 'planet', group: 'defend',
        ...(inbound.targetPlanetId ? { planetId: inbound.targetPlanetId } : {}) },
      weight: 1000,
    });
  }

  // Nothing on the ground and nothing at home is the one state where a raid takes
  // everything and costs the attacker nothing.
  if (!shielded && ground === 0 && exposed > protectedFloor) {
    out.push({
      id: 'undefended',
      kind: 'threat',
      title: i18n.t('directives.undefendedTitle'),
      detail: i18n.t('directives.undefendedDetail', { amount: full(exposed) }),
      action: { label: i18n.t('directives.undefendedAction'), screen: 'planet', group: 'defend' },
      weight: 820,
    });
  }

  // The vault is the only thing a raid cannot reach, so the gap between stock and
  // floor is literally the amount at risk this minute.
  if (!shielded && exposed > protectedFloor * 3) {
    // The ceiling one level up, across both stores — the same figure the upgrade
    // card quotes, so the directive and the row it sends you to agree.
    const nextFloor = vaultProtects(
      (planet.buildings.VAULT ?? 0) + 1,
      planet.buildings.REFINERY ?? 0,
      planet.buildings.EXTRACTOR ?? 0,
      planet.buildings.DEUTERIUM_PLANT ?? 0,
    );
    const next = nextFloor.alloy + nextFloor.crystal;
    out.push({
      id: 'exposed-stock',
      kind: 'threat',
      title: i18n.t('directives.exposedTitle', { amount: full(exposed) }),
      detail: i18n.t('directives.exposedDetail', {
        now: full(protectedFloor),
        next: full(next),
      }),
      action: { label: i18n.t('directives.exposedAction'), screen: 'planet', group: 'defend' },
      weight: 700,
    });
  }

  const scans = s.intel?.radarLog.length ?? 0;
  if (!shielded && scans > 0) {
    out.push({
      id: 'scanned',
      kind: 'threat',
      title: i18n.t('directives.scannedTitle', { count: scans }),
      detail: i18n.t('directives.scannedDetail'),
      action: { label: i18n.t('directives.scannedAction'), screen: 'intel' },
      weight: 520,
    });
  }

  /* ── opportunities ────────────────────────────────────────── */

  // The most valuable fact in the game, acted on. A fleet that is away is a planet
  // that cannot defend itself, and the window closes without warning.
  for (const target of s.galaxy?.planets ?? []) {
    if (!target.fleet || target.isSelf) continue;
    if (target.fleet.status !== 'AWAY') continue;
    out.push({
      id: `window-${target.id}`,
      kind: 'opportunity',
      title: i18n.t('directives.windowTitle', { name: target.name }),
      detail:
        target.fleet.etaMinutes === null
          ? target.fleet.staleMinutes < 1
            ? i18n.t('directives.windowDetailUnknownJustNow')
            : i18n.t('directives.windowDetailUnknown', {
                age: duration(target.fleet.staleMinutes),
              })
          : i18n.t('directives.windowDetailEta', {
              duration: duration(target.fleet.etaMinutes),
            }),
      action: { label: i18n.t('directives.windowAction'), screen: 'galaxy', planetId: target.id },
      weight: 900,
    });
  }

  /**
   * A FULL STORE BLOCKS THE NEXT COLLECTION. IT DOES NOT THROW PRODUCTION AWAY.
   *
   * This line was written before D16, when production flowed straight into
   * storage and a full store really did mean ore evaporating every hour. It does
   * not any more: production fills the WORKS, and the works are what stop. The old
   * wording survived the change and stayed on screen saying something false.
   *
   * D22 is what made it impossible to ignore. The opening grant is larger than a
   * level-one refinery's own store, so a brand-new commander met "you are throwing
   * away 240 an hour" as the first thing the game ever told them — alarming, and
   * wrong, about ore that was sitting safely in their bank waiting to be spent.
   *
   * It also only fires when there is something WAITING. A full store with empty
   * works costs nothing at all and is not worth a word.
   */
  const alloyFull = s.held.alloy >= planet.planet.alloyCap - 1;
  const crystalFull = s.held.crystal >= planet.planet.crystalCap - 1;
  const deuteriumFull = (s.held.deuterium ?? 0) >= planet.planet.deuteriumCap - 1;
  const waiting = planet.planet.bufferAlloy
    + planet.planet.bufferCrystal
    + planet.planet.bufferDeuterium;
  if ((alloyFull || crystalFull || deuteriumFull) && waiting >= 1) {
    out.push({
      id: 'storage-full',
      kind: 'opportunity',
      title: i18n.t('directives.storageFullTitle', { amount: compact(waiting) }),
      detail: i18n.t('directives.storageFullDetail'),
      action: { label: i18n.t('directives.storageFullAction'), screen: 'planet', group: 'grow' },
      weight: 640,
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}

/** The one thing the player should look at. */
export const primary = (list: Directive[]): Directive | undefined => list[0];
