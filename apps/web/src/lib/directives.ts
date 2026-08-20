import {
  fleetCount,
  fleetValue,
  radarDetectsFleets,
  vaultProtects,
} from '@blindspace/rules';
import type { GalaxyView, IntelView, PendingThread, PlanetView } from '../api/schemas.js';
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
 */

export type DirectiveKind = 'threat' | 'opportunity' | 'growth' | 'idle';
export type Screen = 'planet' | 'galaxy' | 'intel';
/**
 * The planet screen's sections, named for the problem each one solves.
 *
 * `see` became `orbit` in D22. The old section held three of the five satellites
 * and the other two lived under Defend and Grow, so a player could not compare the
 * choice the design calls "the identity choice" without visiting three tabs.
 * `orbit` holds all five and nothing else.
 */
export type PlanetGroup = 'defend' | 'orbit' | 'reach' | 'grow';

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
  held: { alloy: number; crystal: number };
}

export function directives(s: Situation): Directive[] {
  const out: Directive[] = [];
  const { planet } = s;

  const ground = fleetCount(planet.ground);
  const home = fleetCount(planet.fleet);
  const stock = s.held.alloy + s.held.crystal;
  const protectedFloor = planet.planet.vaultFloor;
  const exposed = Math.max(0, stock - protectedFloor);

  /* ── threats ──────────────────────────────────────────────── */

  // Radar has already told them. This outranks everything: it is the only moment
  // in the game with a deadline measured in minutes.
  const inbound = s.pending.find((t) => t.kind === 'incoming');
  if (inbound) {
    out.push({
      id: 'inbound',
      kind: 'threat',
      title: `Inbound fleet · ${duration(inbound.minutesRemaining)}`,
      detail: 'Spend the stock, send your fleet out, or stand and fight. It cannot be taken if it is not here.',
      action: { label: 'Spend it now', screen: 'planet', group: 'defend' },
      weight: 1000,
    });
  }

  // Nothing on the ground and nothing at home is the one state where a raid takes
  // everything and costs the attacker nothing.
  if (ground === 0 && exposed > protectedFloor) {
    out.push({
      id: 'undefended',
      kind: 'threat',
      title: 'Nothing is defending this planet',
      detail: `${full(exposed)} above your vault floor, and no ground defence. Bastions never leave.`,
      action: { label: 'Build defence', screen: 'planet', group: 'defend' },
      weight: 820,
    });
  }

  // The vault is the only thing a raid cannot reach, so the gap between stock and
  // floor is literally the amount at risk this minute.
  if (exposed > protectedFloor * 3) {
    const next = vaultProtects((planet.buildings.VAULT ?? 0) + 1);
    out.push({
      id: 'exposed-stock',
      kind: 'threat',
      title: `${full(exposed)} can be taken from you`,
      detail: `Your vault protects ${full(protectedFloor)}. The next level protects ${full(next)}.`,
      action: { label: 'Raise the Vault', screen: 'planet', group: 'defend' },
      weight: 700,
    });
  }

  const scans = s.intel?.radarLog.length ?? 0;
  if (scans > 0) {
    out.push({
      id: 'scanned',
      kind: 'threat',
      title: scans === 1 ? 'Someone scanned you' : `${String(scans)} scans against you`,
      detail: 'They are building a picture of what you hold. A Veil makes that picture wrong.',
      action: { label: 'See the log', screen: 'intel' },
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
      title: `${target.name}'s fleet is away`,
      detail:
        target.fleet.etaMinutes === null
          ? `Seen ${target.fleet.staleMinutes < 1 ? 'just now' : `${duration(target.fleet.staleMinutes)} ago`}. You do not know when it returns.`
          : `Back in about ${duration(target.fleet.etaMinutes)}. Their planet is holding whatever they left behind.`,
      action: { label: 'Open the window', screen: 'galaxy', planetId: target.id },
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
  const waiting = planet.planet.bufferAlloy + planet.planet.bufferCrystal;
  if ((alloyFull || crystalFull) && waiting >= 1) {
    out.push({
      id: 'storage-full',
      kind: 'opportunity',
      title: `${compact(waiting)} cannot be collected`,
      detail:
        'Your store is full, so the works have nowhere to empty into. Spend something and claim it.',
      action: { label: 'Spend it', screen: 'planet', group: 'grow' },
      weight: 640,
    });
  }

  /* ── growth ───────────────────────────────────────────────── */

  // Blind is the default state and it is the one the whole game is about.
  const telescope = planet.instruments.TELESCOPE ?? 0;
  if (telescope === 0) {
    out.push({
      id: 'no-telescope',
      kind: 'growth',
      title: 'You cannot see anyone',
      detail: 'A Telescope watches one planet and tells you when its fleet leaves. Nobody is told you are watching.',
      action: { label: 'Install a Telescope', screen: 'planet', group: 'orbit' },
      weight: 600,
    });
  }

  const radar = planet.instruments.RADAR ?? 0;
  if (!radarDetectsFleets(radar) && fleetValue(planet.ground) + fleetValue(planet.fleet) > 0) {
    out.push({
      id: 'no-radar',
      kind: 'growth',
      title: 'A fleet could land here without warning',
      detail: 'Radar L3 gives you minutes of notice — enough to spend the stock or move the fleet.',
      action: { label: 'Look at Radar', screen: 'planet', group: 'orbit' },
      weight: radar === 0 ? 480 : 300,
    });
  }

  // The Core ceiling is the most common invisible wall: several rows refuse at
  // once and the reason is one level away.
  const core = planet.buildings.CORE ?? 0;
  const capped = (['REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD'] as const).filter(
    (id) => (planet.buildings[id] ?? 0) >= core,
  ).length;
  if (capped >= 2) {
    out.push({
      id: 'core-ceiling',
      kind: 'growth',
      title: `Command Core is blocking ${String(capped)} upgrades`,
      detail: 'Nothing may exceed the Core. Raising it releases all of them at once.',
      action: { label: 'Raise the Core', screen: 'planet', group: 'grow' },
      weight: 440,
    });
  }

  /* ── the empty state is itself a directive ────────────────── */

  /**
   * READ OFF THE BAYS, NOT OFF `pending`. D28.
   *
   * `/api/session/pending` carries missions only — a Prospector out at a rock
   * produces no thread — so `pending.length === 0` told a miner that nothing was in
   * flight while three of their bays were occupied. `flight.used` is the count the
   * server enforces launches against, so it is the one that can be trusted here.
   */
  const bays = planet.flight;

  if (bays.used === 0) {
    out.push({
      id: 'idle',
      kind: 'idle',
      title: 'Nothing is in flight',
      detail:
        home > 0
          ? 'Nothing will happen to you, or for you, until you send something.'
          : 'You have no ships at home. Build some, or wait for yours to come back.',
      action: { label: 'Find a target', screen: 'galaxy' },
      weight: 200,
    });
  } else if (bays.used < bays.total) {
    /**
     * DELIBERATELY THE QUIETEST THING ON THE LIST.
     *
     * It states a fact and stops. The moment this argues — "don't waste your
     * bays!" — it is a streak counter with better manners, and `game-design.md`
     * excludes those by name. A player who has committed something and chosen not
     * to commit more has made a decision, and this must read as noticing it rather
     * than as correcting it.
     */
    const free = bays.total - bays.used;
    out.push({
      id: 'bays-free',
      kind: 'idle',
      title: free === 1 ? 'One bay is still free' : `${String(free)} bays are still free`,
      detail: 'A probe, a raid or a mining run — anything that leaves takes one.',
      action: { label: 'Look for something', screen: 'galaxy' },
      weight: 120,
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}

/** The one thing the player should look at. */
export const primary = (list: Directive[]): Directive | undefined => list[0];

/** Threats and opportunities only — what a player would want on every screen. */
export const urgent = (list: Directive[]): Directive[] =>
  list.filter((d) => d.kind === 'threat' || d.kind === 'opportunity');
