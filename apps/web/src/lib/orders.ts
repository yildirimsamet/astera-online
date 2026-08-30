import {
  HULLS,
  RESEARCH_PROJECTS,
  type BuildingId,
  type HullId,
  type InstrumentId,
  type ResearchProjectId,
  type SatelliteId,
} from '@astera/rules';
import type { BuildOrderView } from '../api/schemas.js';
import {
  buildingName,
  hullLabel,
  instrumentLabel,
  researchName,
  satelliteLabel,
} from '../i18n/names.js';
import {
  BUILDING_ART,
  HULL_ART,
  RESEARCH_ART,
  SATELLITE_ART,
  buildingArt,
  instrumentArt,
} from '../ui/assets.js';

/**
 * WHAT A QUEUED ORDER IS, IN A NAME AND IN A PICTURE. D141.
 *
 * This lived inside `PlanetScreen` as `buildOrderName`, with a hand-written list of
 * four research projects — written when four was all there was. A queued Cargo
 * Holds order printed the raw id `CARGO_HOLDS` on the build queue, which is the
 * same defect as the route enums and the missing rows: a list beside an enum.
 *
 * It moved out here when the queue became a strip, because a segment forty pixels
 * wide cannot carry a name and needs the RENDER instead — and two callers reading
 * one answer is the whole reason this file exists.
 */
export function buildOrderLabel(order: BuildOrderView): string {
  switch (order.kind) {
    case 'BUILDING':
      return buildingName(order.subject as BuildingId);
    case 'HULL':
      return hullLabel(order.subject as HullId);
    case 'INSTRUMENT':
      return instrumentLabel(order.subject as InstrumentId);
    case 'SATELLITE':
      return satelliteLabel(order.subject as SatelliteId);
    case 'RESEARCH':
      return Object.hasOwn(RESEARCH_PROJECTS, order.subject)
        ? researchName(order.subject as ResearchProjectId)
        : order.subject;
  }
}

/**
 * The render, or null where a thing has none.
 *
 * A building's art is tiered by level, and the order is for the level it is BUYING
 * — `count` carries it for a building the same way it carries the rung for
 * research — so the picture is the one the world will be wearing when it lands.
 */
export function buildOrderArt(order: BuildOrderView): string | null {
  switch (order.kind) {
    case 'BUILDING':
      return buildingArt(order.subject as BuildingId, Math.max(1, order.count))
        ?? BUILDING_ART[order.subject as BuildingId]
        ?? null;
    case 'HULL':
      return Object.hasOwn(HULLS, order.subject)
        ? HULL_ART[order.subject as HullId] ?? null
        : null;
    case 'INSTRUMENT':
      return instrumentArt(order.subject as InstrumentId, Math.max(1, order.count));
    case 'SATELLITE':
      return SATELLITE_ART[order.subject as SatelliteId];
    case 'RESEARCH':
      return Object.hasOwn(RESEARCH_PROJECTS, order.subject)
        ? RESEARCH_ART[order.subject as ResearchProjectId]
        : null;
  }
}
