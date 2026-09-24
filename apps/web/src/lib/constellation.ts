import { ALL_HULLS, HULLS, type HullId, type ResearchProjectId } from '@astera/rules';

/**
 * FOUR GROUPS, AND NONE OF THEM HAS ONE ROW IN IT. (Moved here from `ResearchPanel`
 * so the constellation and the list read one statement of it.)
 *
 * The integration plan asked for five and put Cargo Holds in a "Logistics" band on
 * its own. A band with a single row under it is a heading, not a group: it costs a
 * full band of vertical space on a phone to separate one card from the three it
 * belongs with. What you make and what you carry are both industry.
 *
 * FRONTIER IS FIRST because it is the only group whose cards are FOUND rather than
 * bought, so it is the one a player has to read rather than scan.
 */
export const RESEARCH_GROUPS = [
  {
    id: 'frontier',
    label: 'research.frontierBand',
    note: 'research.frontierNote',
    projects: [
      'ISOTOPE_SPECTROMETRY', 'DENSE_FUEL_CELLS', 'GRAVITIC_CHARGES', 'DEATH_STAR_PROTOCOL',
    ],
  },
  {
    id: 'industry',
    label: 'research.industryBand',
    note: 'research.industryNote',
    /** The two build queues sit side by side: what flies, then what stands. D198. */
    projects: [
      'DEUTERIUM_SYNTHESIS', 'YARD_AUTOMATION', 'AI_ROBOTS',
      'PROSPECTOR_HOLDS', 'CARGO_HOLDS',
    ],
  },
  {
    id: 'doctrine',
    label: 'research.doctrineBand',
    note: 'research.doctrineNote',
    projects: [
      'STARSHIP_ENGINEERING', 'SHIP_POWER', 'SHIP_ARMOR',
      'SHIP_PROPULSION', 'EMPLACEMENT_DOCTRINE',
    ],
  },
  {
    id: 'strategic',
    label: 'research.strategicBand',
    note: 'research.strategicNote',
    projects: ['INTERCEPTION_GRID', 'STRATEGIC_STOCKPILE'],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  note: string;
  projects: readonly ResearchProjectId[];
}[];

export type ResearchGroupId = (typeof RESEARCH_GROUPS)[number]['id'];

export interface StarNode {
  id: ResearchProjectId;
  group: ResearchGroupId;
  /** Where the star sits on the map, 0–1 across and down. */
  x: number;
  y: number;
  /** A prerequisite in another group: said under the star, not drawn across the map. */
  outside: ResearchProjectId | null;
}

export interface Constellation {
  nodes: StarNode[];
  edges: { from: ResearchProjectId; to: ResearchProjectId }[];
  regions: { group: ResearchGroupId; x: number; y: number; w: number; h: number }[];
}

/** Each group's quarter of the map, as the mock draws them: Frontier and Doctrine over Industry and Strategic. */
const QUARTER: Record<ResearchGroupId, { x: number; y: number }> = {
  frontier: { x: 0, y: 0 },
  doctrine: { x: 0.5, y: 0 },
  industry: { x: 0, y: 0.5 },
  strategic: { x: 0.5, y: 0.5 },
};

/**
 * WHERE THE STARS OF A GROUP SIT INSIDE ITS QUARTER, by how many there are.
 *
 * Two columns per quarter, at a quarter of its width in from each side: every column on
 * the map is then a label's width from the next, and no label hangs off an edge. Down a
 * column the stars stand a label's height apart, staggered against the other column so
 * the lines between them zigzag like the mock's. The first row clears the group's name;
 * the last one's label ends where the quarter does.
 */
const LEFT = 0.24;
const RIGHT = 0.76;
const SPOTS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0.5, 0.45]],
  2: [[LEFT, 0.3], [RIGHT, 0.6]],
  3: [[LEFT, 0.2], [RIGHT, 0.4], [LEFT, 0.62]],
  4: [[LEFT, 0.16], [RIGHT, 0.3], [LEFT, 0.5], [RIGHT, 0.66]],
  5: [[LEFT, 0.14], [RIGHT, 0.26], [LEFT, 0.44], [RIGHT, 0.58], [LEFT, 0.74]],
};

/**
 * THE RESEARCH CONSTELLATION. Spec E8 · K9 (docs/ui-v2/gozlemevi.md).
 *
 * Pure: the groups and each project's prerequisite in, the stars, the lines and the
 * regions out. A line joins a project to the one in front of it inside the same group;
 * across groups the prerequisite is named under the star instead.
 */
export function constellationLayout(
  groups: readonly { id: ResearchGroupId; projects: readonly ResearchProjectId[] }[],
  prerequisiteOf: (id: ResearchProjectId) => ResearchProjectId | null,
): Constellation {
  const groupOf = new Map<ResearchProjectId, ResearchGroupId>();
  for (const group of groups) for (const id of group.projects) groupOf.set(id, group.id);

  const nodes: StarNode[] = [];
  const edges: Constellation['edges'] = [];
  for (const group of groups) {
    const quarter = QUARTER[group.id];
    const spots = SPOTS[group.projects.length] ?? SPOTS[5] ?? [];
    group.projects.forEach((id, index) => {
      const [sx, sy] = spots[index] ?? [0.5, 0.5];
      const before = prerequisiteOf(id);
      const sameGroup = before !== null && groupOf.get(before) === group.id;
      if (before !== null && sameGroup) edges.push({ from: before, to: id });
      nodes.push({
        id,
        group: group.id,
        x: quarter.x + sx * 0.5,
        y: quarter.y + sy * 0.5,
        outside: before !== null && !sameGroup ? before : null,
      });
    });
  }
  return {
    nodes,
    edges,
    regions: groups.map((group) => ({ group: group.id, x: QUARTER[group.id].x, y: QUARTER[group.id].y, w: 0.5, h: 0.5 })),
  };
}

/**
 * THE NEXT DOOR THIS PROJECT HOLDS FOR A SHIP. Spec E8: the card names the hulls a
 * research opens (`HULLS[*].requiredResearch`) — at the lowest rung above `level` that
 * any hull asks for, every hull asking for it there; null once every such door is open.
 *
 * A hull may ask for more than this ladder (Engineering, a Shipyard level): the card
 * says what this project's part of it is, and the Shipyard states the rest.
 */
export function hullDoor(project: ResearchProjectId, level: number): { level: number; hulls: HullId[] } | null {
  let door: { level: number; hulls: HullId[] } | null = null;
  for (const hull of ALL_HULLS) {
    for (const need of HULLS[hull].requiredResearch) {
      if (need.project !== project || need.level <= level) continue;
      if (door === null || need.level < door.level) door = { level: need.level, hulls: [hull] };
      else if (need.level === door.level) door.hulls.push(hull);
    }
  }
  return door;
}
