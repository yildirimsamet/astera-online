import {
  SHIP_DAMAGE,
  applyDose,
  applyHpDose,
  HULLS,
  hullTech,
  fleetEntries,
  segmentsExposureHp,
  transferStayingFleet,
  fleetCount,
  missionSegments,
  needsDock,
  needsHpDock,
  segmentsDoseBp,
  type Fleet,
  type RadiationSource,
  type HpRadiationSource,
  type HpDamageLots,
  type HullId,
  type Segment,
  type TechLevels,
  type Vec3,
} from '@astera/rules';
import { ApiError } from '../api/client.js';
import type { HpRadiationSourceView, RadiationSourceView } from '../api/schemas.js';
import { damagePct } from './repairStation.js';

/**
 * RADIATION ON THE CLIENT. Owner decisions K3 · D10 · D15 (`plan.md` F10).
 *
 * Nothing here computes a dose: the rules package does, with the functions the server
 * settles every flight with. This file only feeds them what the client holds — the
 * galaxy's clouds and a route — so the quote on the launch sheet is the settlement,
 * read early. The fade of the commander's own wing (D15) comes from the server, which
 * holds the whole path, the recall's turn and the damage carried.
 */

/** The galaxy's clouds, as the rules package reads them. */
export const toRadiationSources = (views: readonly RadiationSourceView[]): RadiationSource[] =>
  views.map((view) => ({
    id: view.id,
    mode: view.mode,
    center: view.center,
    radius: view.radius,
    intensityPctPerMinute: view.intensityPctPerMinute,
    activeFromMs: view.activeFrom.getTime(),
    activeUntilMs: view.activeUntil?.getTime() ?? null,
  }));

export interface PctRouteRadiation {
  kind?: 'PCT';
  /** Share of a full hull every ship takes, in basis points. */
  doseBp: number;
  /** The same, as the whole percent a player reads. */
  pct: number;
  /** Over the Repair Station's line: the ships land needing a repair. */
  docks: boolean;
  /** Ships it finishes before they arrive. The launch asks before flying these. */
  destroyed: number;
}

export interface HpRouteRadiation {
  kind: 'HP';
  doseHp: number;
  returnDoseHp?: number;
  destroyed: number;
  docks: boolean;
  lostFleet: Fleet;
  lots: { hull: HullId; count: number; maxHp: number; remainingHp: number; healthPct: number; needsDock: boolean; returning?: boolean }[];
}
export type RouteRadiation = PctRouteRadiation | HpRouteRadiation;

export const toHpRadiationSources = (views: readonly HpRadiationSourceView[]): HpRadiationSource[] =>
  views.map(view => ({ id: view.id, mode: view.mode, center: view.center, radius: view.radius,
    intensityHpPerMinute: view.intensityHpPerMinute, activeFromMs: view.activeFrom.getTime(), activeUntilMs: view.activeUntil?.getTime() ?? null }));

/** Exact own-ship health on known flight segments. Combat may add another wound. */
export function routeHpRadiation(route: { fleet: Fleet; tech: TechLevels; path: readonly Segment[]; damage?: HpDamageLots },
  sources: readonly HpRadiationSource[]): HpRouteRadiation | null {
  if (sources.length === 0 || fleetCount(route.fleet) === 0) return null;
  const doseHp = segmentsExposureHp(route.path, sources);
  if (doseHp <= 0) return null;
  const outcome = applyHpDose(route.fleet, route.damage, doseHp, route.tech);
  const lots: HpRouteRadiation['lots'] = [];
  for (const [hull, count] of fleetEntries(outcome.fleet)) {
    const maxHp = HULLS[hull].hp * hullTech(route.tech, hull).hp;
    const damaged = outcome.lots.filter(lot => lot.hull === hull);
    for (const lot of damaged) {
      const bp = lot.damageBp + (lot.remainderBp ?? 0);
      lots.push({ hull, count: lot.count, maxHp, remainingHp: maxHp * (1 - bp / 10_000),
        healthPct: 100 - bp / 100, needsDock: needsHpDock(lot) });
    }
    const healthy = count - damaged.reduce((sum, lot) => sum + lot.count, 0);
    if (healthy > 0) lots.push({ hull, count: healthy, maxHp, remainingHp: maxHp, healthPct: 100, needsDock: false });
  }
  return { kind: 'HP', doseHp, destroyed: fleetCount(outcome.destroyed), lostFleet: outcome.destroyed,
    lots, docks: lots.some(lot => lot.needsDock) };
}

/** A transfer's selected return ships keep their outbound wound; the rest land once. */
export function transferHpRadiation(route: { fleet: Fleet; returning: Fleet; tech: TechLevels; path: readonly Segment[] },
  sources: readonly HpRadiationSource[]): HpRouteRadiation | null {
  const outward = route.path.slice(0, 1);
  const stay = routeHpRadiation({ ...route, fleet: transferStayingFleet(route.fleet, route.returning), path: outward }, sources);
  const home = routeHpRadiation({ ...route, fleet: route.returning }, sources);
  if (!stay && !home) return null;
  const doseHp = segmentsExposureHp(outward, sources);
  const lostFleet: Fleet = { ...(stay?.lostFleet ?? {}) };
  for (const [hull, count] of fleetEntries(home?.lostFleet ?? {})) lostFleet[hull] = (lostFleet[hull] ?? 0) + count;
  const lots = [...(stay?.lots ?? []).map(lot => ({ ...lot, returning: false })),
    ...(home?.lots ?? []).map(lot => ({ ...lot, returning: true }))];
  return { kind: 'HP', doseHp, returnDoseHp: home ? Math.max(0, home.doseHp - doseHp) : 0,
    lostFleet, destroyed: fleetCount(lostFleet), lots, docks: lots.some(lot => lot.needsDock) };
}

/**
 * WHAT A ROUTE WILL COST IN RADIATION, before the ships leave. A launch leaves home whole
 * (I1), so every ship takes the same dose. `null` when the route crosses no live cloud.
 */
export function routeRadiation(
  route: { fleet: Fleet; from: Vec3; to: Vec3; departMs: number; arriveMs: number },
  sources: readonly RadiationSource[],
): PctRouteRadiation | null {
  if (sources.length === 0 || fleetCount(route.fleet) === 0) return null;
  const doseBp = segmentsDoseBp(missionSegments({
    origin: route.from, target: route.to, departAtMs: route.departMs, arriveAtMs: route.arriveMs,
  }), sources);
  if (doseBp === 0) return null;
  return {
    doseBp,
    // A lethal dose reads 100; any other reads on the right side of the free line (`damagePct`).
    pct: doseBp >= SHIP_DAMAGE.destroyedBp ? 100 : damagePct(doseBp),
    docks: needsDock(Math.min(doseBp, SHIP_DAMAGE.destroyedBp - 1)),
    destroyed: fleetCount(applyDose(route.fleet, null, doseBp).destroyed),
  };
}

/**
 * THE CLOUD A POINT STANDS IN, NOW: every live cloud over it added, and whether a live
 * shelter covers it. `null` where no cloud reaches — a shelter alone is nothing to say.
 * The focus panel states it on the world a route would be planned to (D10's rule, at the
 * place it is used).
 */
export function radiationAt(
  point: Vec3,
  sources: readonly RadiationSource[],
  nowMs: number,
): { pctPerMinute: number; sheltered: boolean } | null {
  const live = sources.filter((source) =>
    source.activeFromMs <= nowMs && (source.activeUntilMs === null || nowMs < source.activeUntilMs)
    && Math.hypot(point.x - source.center.x, point.y - source.center.y, point.z - source.center.z) < source.radius);
  const pctPerMinute = live
    .filter((source) => source.mode === 'EMIT')
    .reduce((sum, source) => sum + source.intensityPctPerMinute, 0);
  if (pctPerMinute <= 0) return null;
  return { pctPerMinute, sheltered: live.some((source) => source.mode === 'SHELTER') };
}

/**
 * HOW THICK A CLOUD IS DRAWN. Denser with the dose a minute, on a log scale because the
 * operator's clouds span two orders of magnitude, and capped low: the haze says where
 * radiation is and never hides the worlds inside it.
 */
export const hazeAlpha = (pctPerMinute: number): number =>
  0.75 * Math.min(0.09, 0.018 + 0.014 * Math.log2(1 + Math.max(0, pctPerMinute)));

/** HP clouds use a different unit scale; four HP/min is the season baseline. */
export const hpHazeAlpha = (hpPerMinute: number, level?: 1 | 2): number =>
  (level === 1 ? 0.55 : 1) * 0.75 * Math.min(0.09, 0.018 + 0.014 * Math.log2(1 + Math.max(0, hpPerMinute) / 4));

/** The clouds on the disc now: lit and emitting. A shelter cancels a dose; it is not a cloud. */
export const drawnClouds = (views: readonly RadiationSourceView[], nowMs: number): RadiationSourceView[] =>
  views.filter((view) => view.mode === 'EMIT'
    && view.activeFrom.getTime() <= nowMs
    && (view.activeUntil === null || nowMs < view.activeUntil.getTime()));

export const drawnHpClouds = (views: readonly HpRadiationSourceView[], nowMs: number): HpRadiationSourceView[] =>
  views.filter((view) => view.mode === 'EMIT' && view.intensityHpPerMinute > 0
    && view.activeFrom.getTime() <= nowMs && (view.activeUntil === null || nowMs < view.activeUntil.getTime()));

/** A server's `RADIATION_LETHAL`, kept against the selection it refused (plan D10). */
export interface RadiationRefusal {
  count: number;
  fleet: Fleet;
}

/** How many ships the server said the route would finish, or `null` for any other refusal. */
export const radiationRefusalCount = (err: unknown): number | null => {
  if (!(err instanceof ApiError) || err.code !== 'RADIATION_LETHAL') return null;
  const count = Number(err.params?.count);
  return Number.isInteger(count) && count > 0 ? count : 1;
};

/**
 * THE QUOTE, WITH THE SERVER'S ANSWER FOLDED IN. The sheet's own forecast can miss a lethal
 * route at a window's edge; a refusal for this same selection outranks it, so the line says
 * how many ships will die and the next hold carries the acknowledgement. A refusal for a
 * selection since changed says nothing.
 */
export function lethalAfterRefusal(
  quoted: RouteRadiation | null,
  refused: RadiationRefusal | null,
  fleet: Fleet,
): RouteRadiation | null {
  if (refused?.fleet !== fleet || refused.count <= (quoted?.destroyed ?? 0)) return quoted;
  return { ...(quoted ?? { doseBp: SHIP_DAMAGE.destroyedBp, pct: 100, docks: true }), destroyed: refused.count };
}
