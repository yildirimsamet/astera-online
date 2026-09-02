import {
  HULLS,
  hullRequirementsMet,
  type HullId,
  type TechLevels,
} from '@astera/rules';
import { GameError } from './planet.js';

/** One authoritative answer for building or receiving a Fleet V2 hull. */
export const hullProductionAccessible = (
  hull: HullId,
  shipyard: number,
  tech: TechLevels,
): boolean => shipyard >= HULLS[hull].minShipyard && hullRequirementsMet(hull, tech);

export function assertHullProductionAccess(
  hull: HullId,
  shipyard: number,
  tech: TechLevels,
): void {
  const spec = HULLS[hull];
  if (shipyard < spec.minShipyard) {
    throw new GameError('SHIPYARD_TOO_LOW', `Needs Shipyard L${String(spec.minShipyard)}`, 400, {
      level: spec.minShipyard,
    });
  }

  const missing = spec.requiredResearch.filter(
    ({ project, level }) => (tech[project] ?? 0) < level,
  );
  if (missing.length > 0) {
    throw new GameError(
      'NEEDS_HULL_RESEARCH',
      'Required ship research is incomplete',
      403,
      { requirements: missing.map(({ project, level }) => `${project}:${String(level)}`).join(',') },
    );
  }
}

