import {
  ALL_HULLS,
  distance,
  telescopeSlots,
  telescopeWatchRange,
  withinTelescopeRange,
  type Fleet,
  type ResearchProjectId,
} from '@astera/rules';
import type {
  GalaxyPlanet,
  IntelView,
  PlanetView,
  Report,
  RivalSummary,
} from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { hullLabel, researchName, satelliteLabel } from '../i18n/names.js';

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
 *   · PUBLIC — free, live, and true for as long as you can SEE the world. Since
 *     D127 that means inside a Telescope's reach and nowhere else: owner,
 *     development and orbital hardware are readings like any other, and outside
 *     the reach they arrive through a probe with an age on them, or not at all.
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
   * `inBand` AND `band` ARE GONE. D127.
   *
   * They carried D49's development band — the one rule a commitment surface could
   * check before the server did, because tier was public and the player could see
   * the reason. D127 made development private and retired the band with it: there
   * is no longer a development answer to "may I fight them", so there is nothing
   * for this surface to pre-check and nothing to explain when it says no.
   */
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

/**
 * HOW OLD THE RECORD ON A WORLD IS — NULL WHEN THERE IS NO RECORD. D151.
 *
 * The dossier has always stamped this on its fact rows. Two surfaces never did,
 * and between them they are where targets are actually chosen: the label on the
 * disc, and the launch sheet where the fleet stops being recallable. Both printed
 * a `REMEMBERED` world exactly as they print a `RESOLVED` one — same name, same
 * commander, same kind row — so the only thing separating a three-day-old snapshot
 * from a live reading was that the sphere behind it was unlit, which a player
 * reads as art rather than as provenance.
 *
 * `RESOLVED` HAS NO AGE, and that is not the same as zero: it is a live reading,
 * and the honest thing to print beside it is nothing. `UNKNOWN` has no record to
 * be old — its surfaces already say "nobody has looked here".
 *
 * FLOORED AT ZERO. The disc draws on `serverNow()`, and a record written in the
 * same second can reach a render a few milliseconds ahead of it. A negative age
 * would print as a time in the future on the one screen that must not lie.
 */
export const recordAgeMinutes = (
  world: { intel: GalaxyPlanet['intel']; seenAt?: Date },
  now: number,
): number | null =>
  world.intel === 'REMEMBERED' && world.seenAt
    ? Math.max(0, (now - world.seenAt.getTime()) / 60_000)
    : null;

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
function fieldedAtLeast(reports: readonly Report[], planetId: string): {
  fleet: Fleet;
  atMinutes: number;
} | null {
  let best: { fleet: Fleet; at: number } | null = null;

  for (const report of reports) {
    if (report.kind === 'STRATEGIC') continue;
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
  reports: readonly Report[];
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

  /* ── the surface ────────────────────────────────────────── */

  /**
   * "PUBLIC" IS A STATE NOW, NOT A GUARANTEE. D127.
   *
   * Owner, development and orbital hardware used to be free, live and true for
   * every world in the galaxy, which is why they were pushed unconditionally with
   * `source: 'public'` and no age. D127 took all three behind the fog, and leaving
   * this block alone made the dossier LIE in both of the new states — the one
   * thing an intel surface may never do.
   *
   *   · UNKNOWN. The payload omits every one of these fields and the schema fills
   *     the hole with a default, so the panel was printing `Tier 1` and an empty
   *     owner and stamping them PUBLIC. A Core 18 fortress read as a Tier 1 rock
   *     with a free, live, trustworthy label on it. Nothing is pushed now; the
   *     absence becomes a gap a probe closes, which is what it actually is.
   *   · REMEMBERED. These are real facts, but they are a RECORD — what a probe saw
   *     at `seenAt`, possibly hours ago. Same provenance machinery every other
   *     probe line already uses, so the age is printed and the reader can price it.
   *
   * `accuracy` is deliberately absent even on the remembered rows: a probe fuzzes
   * stock and defence into bands, but the outside of a world is simply seen and
   * recorded exactly. Attaching a confidence to it would invent a doubt.
   */
  const surface: Source = target.intel === 'REMEMBERED' ? 'probe' : 'public';
  const surfaceAge = recordAgeMinutes(target, now);

  if (target.intel === 'UNKNOWN') {
    gaps.push({
      key: 'surface',
      label: i18n.t('dossier.surfaceGapLabel'),
      missing: i18n.t('dossier.surfaceGapMissing'),
      why: i18n.t('dossier.surfaceGapWhy'),
      closes: 'probe',
    });
  } else {
    facts.push({
      key: 'owner',
      label: i18n.t('dossier.ownerLabel'),
      value: target.owner,
      source: surface,
      ageMinutes: surfaceAge,
      note: i18n.t(surface === 'probe' ? 'dossier.ownerRecordNote' : 'dossier.ownerNote'),
    });
  }

  /**
   * DEVELOPMENT — AND IT IS NO LONGER FREE, NOR A PERMISSION. D127.
   *
   * D49 made this line carry the attack band: tier was the one public, always-live
   * fact on every world, so a player could read "may I fight them" off the map
   * before packing a fleet. D127 made development private and retired the band
   * with it — permission no longer depends on it, and the figure itself is now
   * something the reader has EARNED, either live through a Telescope or frozen
   * through a probe.
   *
   * So the note goes. There is no band to be in or out of, and a dossier that
   * still explained one would be describing a rule the server stopped enforcing.
   */
  if (target.intel !== 'UNKNOWN') {
    facts.push({
      key: 'development',
      label: i18n.t('dossier.developmentLabel'),
      value: i18n.t('dossier.developmentValue', { tier: target.coreTier }),
      source: surface,
      ageMinutes: surfaceAge,
    });
  }

  if (target.intel !== 'UNKNOWN' && target.satellites.length > 0) {
    facts.push({
      key: 'hardware',
      label: i18n.t('dossier.hardwareLabel'),
      value: target.satellites.map((id) => satelliteLabel(id)).join(' · '),
      source: surface,
      ageMinutes: surfaceAge,
      // D15 in one sentence, in the player's terms — and D127's correction to it
      // when the hardware is something you went and looked at rather than see.
      note: i18n.t(surface === 'probe' ? 'dossier.hardwareRecordNote' : 'dossier.hardwareNote'),
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
    /**
     * THE SOCKETS ON *THIS* WORLD, AND IT USED TO COUNT EVERY WORLD'S.
     *
     * A slot belongs to the world whose Telescope it is, so the denominator here
     * is one world's ladder. The numerator counted the commander's whole watch
     * list, so a capital with a free socket was told "all slots are in use"
     * because a colony had spent one of its own.
     */
    const used = (intel?.watching ?? []).filter(
      (watch) => watch.observerPlanetId === undefined
        || watch.observerPlanetId === planet.planet.id,
    ).length;

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
              reach: Math.round(telescopeWatchRange(telescope)),
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

    /**
     * THE FOUR READINGS THE PROBE TOOK AND NOTHING EVER PRINTED.
     *
     * Every one of them was collected on arrival, stored on the report and then
     * dropped: two never left the server at all, and two reached the client and
     * were parsed by a schema no surface read. A commander paid alloy, a flight
     * bay, a round trip and the risk of being caught for readings the game then
     * refused to show them.
     *
     * They are pushed with `source: 'probe'` and the report's age, like every
     * other line here, because all four are frozen at the look — the target may
     * have finished a doctrine or loaded a charge since.
     *
     * ABSENT IS NOT ZERO, and each branch is written to say so. A missing
     * `doctrines` means the reading was never taken (a caretaker world, or a
     * report older than the field); an EMPTY one means the probe looked and found
     * none. Printing "no doctrines" for the first would be the dossier inventing
     * a fact, which is the one thing this file may not do.
     */
    if (report.deuteriumStock) {
      facts.push({
        key: 'deuterium',
        label: i18n.t('dossier.deuteriumLabel'),
        value: band(report.deuteriumStock.low, report.deuteriumStock.high),
        source: 'probe',
        ageMinutes: age,
        accuracy: report.accuracy,
        note: i18n.t('dossier.deuteriumNote'),
      });
    }

    if (report.deathStar !== undefined && report.deathStar !== 'NONE') {
      facts.push({
        key: 'strategic',
        label: i18n.t('dossier.strategicLabel'),
        value: i18n.t(
          report.deathStar === 'READY'
            ? 'dossier.strategicReady'
            : report.deathStar === 'BUILDING'
              ? 'dossier.strategicBuilding'
              : 'dossier.strategicUnknown',
        ),
        source: 'probe',
        ageMinutes: age,
        note: i18n.t(
          report.deathStar === 'UNKNOWN'
            ? 'dossier.strategicUnknownNote'
            : 'dossier.strategicNote',
        ),
        // A finished strategic weapon pointed at the galaxy is the loudest thing
        // a probe can come home with.
        opportunity: report.deathStar === 'READY',
      });
    }

    if (report.interceptor !== undefined) {
      facts.push({
        key: 'interceptor',
        label: i18n.t('dossier.interceptorLabel'),
        value: i18n.t(report.interceptor
          ? 'dossier.interceptorLoaded'
          : 'dossier.interceptorEmpty'),
        source: 'probe',
        ageMinutes: age,
        note: i18n.t(report.interceptor
          ? 'dossier.interceptorLoadedNote'
          : 'dossier.interceptorEmptyNote'),
      });
    }

    if (report.doctrines !== undefined) {
      const held = Object.entries(report.doctrines)
        .filter(([, level]) => level > 0)
        .map(([id, level]) => `${researchName(id as ResearchProjectId)} ${String(level)}`);
      facts.push({
        key: 'doctrines',
        label: i18n.t('dossier.doctrinesLabel'),
        value: held.length > 0 ? held.join(' · ') : i18n.t('dossier.doctrinesNone'),
        source: 'probe',
        ageMinutes: age,
        note: i18n.t(held.length > 0
          ? 'dossier.doctrinesNote'
          : 'dossier.doctrinesNoneNote'),
      });
    }
  } else {
    /**
     * AND IT MUST NOT CLAIM AN IGNORANCE THE PLAYER DOES NOT HAVE.
     *
     * A REMEMBERED world is one this commander HAS probed — that is what put the
     * silhouette on the map and the age under it. If the detailed report is not in
     * hand, the reading has aged out of the history, which is a different fact
     * from never having looked. Saying the wrong one is the worst class of bug an
     * information surface can have: asserting an ignorance the player does not
     * have, on the exact screen they use to decide where to send a fleet.
     */
    gaps.push({
      key: 'stock',
      label: i18n.t('dossier.probeGapLabel'),
      missing: i18n.t(target.intel === 'REMEMBERED'
        ? 'dossier.probeGapAged'
        : 'dossier.probeGapMissing'),
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

  return { facts, gaps, range };
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
