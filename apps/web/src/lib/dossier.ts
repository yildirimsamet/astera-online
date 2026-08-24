import {
  ALL_HULLS,
  coreTier,
  distance,
  reachableTiers,
  telescopeRange,
  telescopeSlots,
  tiersWithinBand,
  withinTelescopeRange,
  type Fleet,
} from '@astera/rules';
import type {
  BattleReport,
  GalaxyPlanet,
  IntelView,
  PlanetView,
  RivalSummary,
} from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { hullLabel, satelliteLabel } from '../i18n/names.js';

/**
 * WHAT YOU KNOW, AND HOW YOU KNOW IT.
 *
 * The focus panel's whole job. A number on its own is worse than useless in this
 * game — "defence 1,400" invites a player to bet a fleet on it without asking when
 * it was measured, how precisely, or by what. Every line this produces therefore
 * carries its PROVENANCE and its AGE, because in an information game those are not
 * decoration around the fact; they are most of the fact.
 *
 * Four sources, in ascending order of trustworthiness, which is also the order
 * they cost:
 *
 *   · PUBLIC — free, live, and true forever. Name, owner, development tier, and
 *     which instruments are in orbit (D15).
 *   · TELESCOPE — a slot and a cooldown. One fact only, and the most valuable one:
 *     is their combat fleet home. May be stale, and says so.
 *   · PROBE — resources and a round trip, and it may be caught. Bands, never
 *     numbers, and the band widens as the reading ages.
 *   · BATTLE — ships you cannot get back. Ground truth about what they FIELDED,
 *     and the only place a composition ever comes from.
 *
 * Pure. No clock of its own, no fetching — `now` is passed in, so this is
 * testable and cannot drift between renders.
 */

export type Source = 'public' | 'telescope' | 'probe' | 'battle';

export interface Fact {
  key: string;
  label: string;
  value: string;
  source: Source;
  /** Minutes since this was true. Zero means live; null means timeless. */
  ageMinutes: number | null;
  /** 0–1 where the source reports one. Only probes do. */
  accuracy?: number;
  /** One line of context, in the player's terms. */
  note?: string;
  /** True when this is the opportunity the whole game is about. */
  opportunity?: boolean;
}

export interface Gap {
  key: string;
  label: string;
  /** What is missing, stated as a state of the world rather than a failure. */
  missing: string;
  /** Why a player should care enough to close it. */
  why: string;
  /** Which action closes it, for the panel to render a control. */
  closes: 'telescope' | 'probe' | 'battle';
  /** Set when the action exists but cannot be taken yet, and why. */
  blocked?: string;
}

export interface Dossier {
  facts: Fact[];
  gaps: Gap[];
  /** Distance in game units. */
  range: number;
  /**
   * Whether this world is inside your development-tier band. D49.
   *
   * Computed here rather than in the panel because it is a READING of the target
   * like every other line in this file, and because the server will refuse the
   * launch on exactly this rule — a control that offers what the server refuses is
   * the one thing a commitment surface must never do.
   */
  inBand: boolean;
  /** The tiers you may fight, inclusive. For saying WHY, when you may not. */
  band: { low: number; high: number };
}

/**
 * Where a fact came from, in one word.
 *
 * Keys rather than sentences: a table of finished strings is built once at module
 * load and would still be English after the language changed under it.
 */
const SOURCE_LABEL = {
  public: 'dossier.sourcePublic',
  telescope: 'dossier.sourceTelescope',
  probe: 'dossier.sourceProbe',
  battle: 'dossier.sourceBattle',
} as const satisfies Record<Source, string>;

export const sourceLabel = (source: Source): string => i18n.t(SOURCE_LABEL[source]);

const band = (low: number, high: number): string =>
  low === high
    ? String(Math.round(low))
    : `${Math.round(low)}${i18n.t('units.rangeJoin')}${Math.round(high)}`;

/** "3 Wasp · 1 Lance", in the fixed hull order so it reads the same every time. */
export function describeFleet(fleet: Fleet): string {
  const parts: string[] = [];
  for (const id of ALL_HULLS) {
    const n = fleet[id] ?? 0;
    if (n > 0) parts.push(`${String(n)} ${hullLabel(id)}`);
  }
  return parts.join(' · ');
}

/**
 * The most anyone has ever SEEN this planet field, from battle reports.
 *
 * Losses, not holdings — a report says what died, which is a floor on what was
 * there and never a ceiling. Phrased that way in the UI too: "at least", because
 * quietly presenting a floor as a total is how a player loses a fleet.
 */
function fieldedAtLeast(reports: readonly BattleReport[], planetId: string): {
  fleet: Fleet;
  atMinutes: number;
} | null {
  let best: { fleet: Fleet; at: number } | null = null;

  for (const report of reports) {
    if (report.opponentPlanetId !== planetId) continue;
    const theirs = report.theirLosses;
    const total = ALL_HULLS.reduce((s, id) => s + (theirs[id] ?? 0), 0);
    if (total === 0) continue;
    if (!best || report.at.getTime() > best.at) {
      best = { fleet: theirs, at: report.at.getTime() };
    }
  }
  if (!best) return null;
  return { fleet: best.fleet, atMinutes: best.at };
}

export interface DossierInput {
  target: GalaxyPlanet;
  planet: PlanetView;
  intel: IntelView | undefined;
  reports: readonly BattleReport[];
  rival?: RivalSummary;
  /** Epoch millis. Passed in so this stays pure. */
  now: number;
}

/**
 * Everything the player is entitled to know about another world, in one list.
 *
 * The server has already enforced the fog — a planet the caller does not watch
 * arrives with no `fleet` key at all, and probe bands are stored pre-fuzzed. This
 * only ARRANGES what came back; it never infers a value the payload withheld.
 */
export function dossier({ target, planet, intel, reports, rival, now }: DossierInput): Dossier {
  const facts: Fact[] = [];
  const gaps: Gap[] = [];
  const range = distance(planet.planet.position, target.position);

  /* ── public ─────────────────────────────────────────────── */

  facts.push({
    key: 'owner',
    label: i18n.t('dossier.ownerLabel'),
    value: target.owner,
    source: 'public',
    ageMinutes: null,
    note: i18n.t('dossier.ownerNote'),
  });

  /**
   * DEVELOPMENT, AND SINCE D49 ALSO WHETHER YOU MAY FIGHT THEM.
   *
   * The tier band replaced a Wealth ratio precisely so that this line could carry
   * it: the figure that decides whether a launch is legal is now the one free,
   * public, always-live fact on every world in the galaxy. A player can read the
   * whole question off the map before they pack a fleet, which a private ratio and
   * a 403 could never let them do.
   */
  const myTier = coreTier(planet.buildings.CORE ?? 1);
  const myBand = reachableTiers(planet.buildings.CORE ?? 1);
  const inBand = tiersWithinBand(myTier, target.coreTier);

  facts.push({
    key: 'development',
    label: i18n.t('dossier.developmentLabel'),
    value: i18n.t('dossier.developmentValue', { tier: target.coreTier }),
    source: 'public',
    ageMinutes: null,
    note: inBand
      ? i18n.t('dossier.developmentInBand', { tier: myTier })
      : i18n.t('dossier.developmentOutOfBand', {
          tier: myTier,
          low: myBand.low,
          high: myBand.high,
        }),
  });

  if (target.satellites.length > 0) {
    facts.push({
      key: 'hardware',
      label: i18n.t('dossier.hardwareLabel'),
      value: target.satellites.map((id) => satelliteLabel(id)).join(' · '),
      source: 'public',
      ageMinutes: null,
      // D15 in one sentence, in the player's terms.
      note: i18n.t('dossier.hardwareNote'),
    });
  }

  /* ── telescope ──────────────────────────────────────────── */

  const telescope = planet.instruments.TELESCOPE ?? 0;

  if (target.fleet) {
    const away = target.fleet.status === 'AWAY';
    const unreadable = target.fleet.status === 'UNKNOWN';

    facts.push({
      key: 'fleet',
      label: i18n.t('dossier.fleetLabel'),
      value: unreadable
        ? i18n.t('dossier.fleetUnreadable')
        : away
          ? i18n.t('dossier.fleetAway')
          : i18n.t('dossier.fleetHome'),
      source: 'telescope',
      ageMinutes: unreadable ? null : target.fleet.staleMinutes,
      opportunity: away,
      note: unreadable
        ? i18n.t('dossier.fleetVeiledNote')
        : away
          ? target.fleet.etaMinutes === null
            ? i18n.t('dossier.fleetAwayUnknownNote')
            : i18n.t('dossier.fleetAwayNote')
          : i18n.t('dossier.fleetHomeNote'),
    });
  } else {
    const outOfRange = telescope > 0 && !withinTelescopeRange(telescope, range);
    const slots = telescopeSlots(telescope);
    const used = intel?.watching.length ?? 0;

    gaps.push({
      key: 'fleet',
      label: i18n.t('dossier.fleetLabel'),
      missing:
        telescope === 0
          ? i18n.t('dossier.fleetGapNoTelescope')
          : outOfRange
            ? i18n.t('dossier.fleetGapOutOfRange')
            : i18n.t('dossier.fleetGapNoSlot'),
      why: i18n.t('dossier.fleetGapWhy'),
      closes: 'telescope',
      ...(outOfRange
        ? {
            blocked: i18n.t('dossier.fleetGapRange', {
              reach: Math.round(telescopeRange(telescope)),
              distance: Math.round(range),
            }),
          }
        : telescope > 0 && used >= slots
          ? { blocked: i18n.t('dossier.fleetGapSlots', { count: slots }) }
          : {}),
    });
  }

  /* ── probe ──────────────────────────────────────────────── */

  const report = intel?.probeReports.find((r) => r.targetPlanetId === target.id);
  if (report) {
    const age = (now - report.at.getTime()) / 60_000;

    facts.push({
      key: 'stock',
      label: i18n.t('dossier.stockLabel'),
      value: band(report.stock.low, report.stock.high),
      source: 'probe',
      ageMinutes: age,
      accuracy: report.accuracy,
      note: report.detected ? i18n.t('dossier.stockCaught') : i18n.t('dossier.stockClean'),
    });

    facts.push({
      key: 'defence',
      label: i18n.t('dossier.defenceLabel'),
      value: band(report.defence.low, report.defence.high),
      source: 'probe',
      ageMinutes: age,
      accuracy: report.accuracy,
      note: i18n.t('dossier.defenceNote'),
    });

    facts.push({
      key: 'ships',
      label: i18n.t('dossier.shipsLabel'),
      value: band(report.fleetSize.low, report.fleetSize.high),
      source: 'probe',
      ageMinutes: age,
      accuracy: report.accuracy,
      note: report.fleetHome ? i18n.t('dossier.shipsAllHome') : i18n.t('dossier.shipsSomeOut'),
    });
  } else {
    gaps.push({
      key: 'stock',
      label: i18n.t('dossier.probeGapLabel'),
      missing: i18n.t('dossier.probeGapMissing'),
      why: i18n.t('dossier.probeGapWhy'),
      closes: 'probe',
    });
  }

  /* ── battle ─────────────────────────────────────────────── */

  const fought = rival?.lastKnownFleet && rival.lastKnownAt
    ? { fleet: rival.lastKnownFleet, atMinutes: rival.lastKnownAt.getTime() }
    : fieldedAtLeast(reports, target.id);
  if (fought) {
    facts.push({
      key: 'composition',
      label: i18n.t('dossier.compositionLabel'),
      value: i18n.t('dossier.compositionValue', { fleet: describeFleet(fought.fleet) }),
      source: 'battle',
      ageMinutes: (now - fought.atMinutes) / 60_000,
      note: i18n.t('dossier.compositionNote'),
    });
  } else {
    gaps.push({
      key: 'composition',
      label: i18n.t('dossier.compositionGapLabel'),
      missing: i18n.t('dossier.compositionGapMissing'),
      why: i18n.t('dossier.compositionGapWhy'),
      closes: 'battle',
    });
  }

  return { facts, gaps, range, inBand, band: myBand };
}

/**
 * THE ONE LINE THE COLLAPSED RAIL SHOWS.
 *
 * It used to be computed from `target.fleet` alone, and said "Never looked" for
 * anything with no telescope reading — including a world the player had probed an
 * hour earlier and fought a war with last night. That is the worst class of bug an
 * information game can have: the interface asserting ignorance the player does not
 * have, on the exact surface they use to decide where to send a fleet.
 *
 * So the headline is now drawn from everything known, in the order the facts are
 * worth: a live fleet reading first, then the most recent thing that ever looked,
 * and only then the genuine absence. `none` really does mean nothing has ever been
 * learned about this world beyond what is public.
 *
 * Returned as a shape rather than a string so it stays pure — ages are formatted
 * by the panel, which owns the clock.
 */
export type Headline =
  | { kind: 'fleet-away' }
  | { kind: 'fleet-home' }
  /** You looked, and their Veil beat your Telescope. Information, not absence. */
  | { kind: 'veiled' }
  | { kind: 'probed'; ageMinutes: number }
  | { kind: 'fought'; ageMinutes: number }
  | { kind: 'none' };

export function headline(read: Dossier, target: GalaxyPlanet): Headline {
  if (target.fleet) {
    if (target.fleet.status === 'AWAY') return { kind: 'fleet-away' };
    if (target.fleet.status === 'UNKNOWN') return { kind: 'veiled' };
    return { kind: 'fleet-home' };
  }

  const probe = read.facts.find((f) => f.source === 'probe' && f.ageMinutes !== null);
  if (probe?.ageMinutes != null) return { kind: 'probed', ageMinutes: probe.ageMinutes };

  const battle = read.facts.find((f) => f.source === 'battle' && f.ageMinutes !== null);
  if (battle?.ageMinutes != null) return { kind: 'fought', ageMinutes: battle.ageMinutes };

  return { kind: 'none' };
}

/**
 * How much to trust a line, as a word.
 *
 * Deliberately coarse. A percentage invites arithmetic the player has no way to do
 * — the underlying band is already fuzzed — whereas "roughly" and "precisely" are
 * exactly as precise as the reading deserves.
 */
export function confidenceWord(accuracy: number | undefined): string | null {
  if (accuracy === undefined) return null;
  if (accuracy >= 0.9) return i18n.t('dossier.confidencePrecise');
  if (accuracy >= 0.7) return i18n.t('dossier.confidenceGood');
  if (accuracy >= 0.5) return i18n.t('dossier.confidenceRough');
  return i18n.t('dossier.confidenceVague');
}

/**
 * Whether a reading is old enough that acting on it is a gamble.
 *
 * Twenty minutes is not arbitrary: it is `INTEL.intermittentRefreshMin`, the
 * window the telescope's own seeding uses. Inside it a reading is as fresh as the
 * game will ever let it be; past it, the fleet may have moved twice.
 */
export const isStale = (ageMinutes: number | null): boolean =>
  ageMinutes !== null && ageMinutes >= 20;
