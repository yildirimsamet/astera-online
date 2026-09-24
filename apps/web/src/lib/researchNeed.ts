import { RESEARCH_PROJECTS, type ResearchProjectId } from '@astera/rules';

/**
 * WHICH WORLD A RESEARCH CARD'S FIX OPENS. D209, owner instruction.
 *
 * Research is gated by the CAPITAL's Command Core on every world, so a Core
 * shortfall is answered on the capital's planet sheet — never on the colony the
 * research menu happened to be opened from, where raising the Core changes nothing
 * about the gate. Anything else stays on the current world. Null means "do not
 * change world".
 */
export function researchNeedWorld(id: string, capitalPlanetId: string | null): string | null {
  return id === 'CORE' ? capitalPlanetId : null;
}

/**
 * IS THIS REQUIREMENT A RESEARCH PROJECT? A refusal names its fix by id — a building, a
 * hull, a satellite or a project — and only a project opens the research map, on itself.
 * Own keys only: `toString` is on every object and is no project.
 */
export function isResearchProject(id: string): id is ResearchProjectId {
  return Object.hasOwn(RESEARCH_PROJECTS, id);
}
