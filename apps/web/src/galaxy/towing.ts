import { fleetEntries, type Fleet, type HullId } from '@astera/rules';
import { formationLayout, hullVisualScale } from './flightVisual.js';
import { HULL_MODEL, hullPoseLift } from '../ui/assets.js';
import { nativeEngineAnchors } from './engineAnchors.js';
import { markersFor } from './Squadrons.js';
import type { Vec3Tuple } from './scene.js';

export interface TowedHull {
  hull: HullId;
  position: Vec3Tuple;
  /** -1 connects to the formation tip; subsequent hulls connect to their predecessor. */
  previous: number;
}

/** Keep the exact tally, but draw each prize outside the powered formation. */
export function towingFormation(fleet: Fleet, towing: Fleet | undefined, base: number) {
  const escort = { ...fleet };
  const prizes: HullId[] = [];
  for (const [hull, count] of fleetEntries(towing ?? {})) {
    const carried = Math.min(count, escort[hull] ?? 0);
    escort[hull] = (escort[hull] ?? 0) - carried;
    for (let i = 0; i < carried; i++) prizes.push(hull);
  }
  const escortMarkers = markersFor(escort);
  // If only prizes survive, there is no tug. Keep the surviving hulls visible without inventing a tow.
  if (prizes.length && escortMarkers.length === 0) {
    const markers = markersFor(fleet);
    return {markers, ...formationLayout(markers, base), tugIndex: null, tows: [] as TowedHull[]};
  }
  const markers = escortMarkers;
  const formation = formationLayout(markers, base);
  const slots = formation.slots;
  let tugIndex: number | null = null;
  let rear = 0;
  for (const [index, marker] of markers.entries()) {
    if (tugIndex === null || slots[index]![2] > slots[tugIndex]![2]) tugIndex = index;
    rear = Math.min(rear, slots[index]![2] - hullVisualScale(marker.hull, base) / 2);
  }
  const tows: TowedHull[] = [];
  if (tugIndex !== null) for (const hull of prizes) {
    const size = hullVisualScale(hull, base);
    const z = rear - Math.max(base, size * .8) - size / 2;
    tows.push({hull, position: [0, 0, z], previous: tows.length - 1});
    rear = z - size / 2;
  }
  return {markers, ...formation, tugIndex, tows};
}

/** A slack physical cable, lowered clear of the escort instead of cutting through its hulls. */
export function towCablePoint(start: Vec3Tuple, end: Vec3Tuple, drop: number, t: number,
  out: Vec3Tuple = [0, 0, 0]): Vec3Tuple {
  const u = 1 - t;
  const low = Math.min(start[1], end[1]) - drop;
  out[0] = start[0] * u + end[0] * t;
  out[1] = u * u * u * start[1] + 3 * u * t * low + t * t * t * end[1];
  out[2] = start[2] * u + end[2] * t;
  return out;
}

export const towRoll = (timeMs: number, index: number): number => Math.sin(timeMs / 1000 * .38 + index * .8) * .09;

/** Attach in the model's posed space and follow the same axial roll as its body. */
export function towAnchor(tow: TowedHull, base: number, timeMs: number, index: number, nose: boolean,
  out: Vec3Tuple = [0, 0, 0]): Vec3Tuple {
  const size = hullVisualScale(tow.hull, base);
  const ports = nose ? undefined : nativeEngineAnchors(HULL_MODEL[tow.hull]);
  const y = ports?.length ? ports.reduce((sum, port) => sum + port[1], 0) / ports.length : hullPoseLift(tow.hull);
  const z = nose ? .43 : ports?.length ? ports.reduce((sum, port) => sum + port[2], 0) / ports.length + .025 : -.42;
  const roll = towRoll(timeMs, index);
  out[0] = tow.position[0] - Math.sin(roll) * y * size;
  out[1] = tow.position[1] + Math.cos(roll) * y * size;
  out[2] = tow.position[2] + z * size;
  return out;
}
