import { describe, expect, it } from 'vitest';
import { ALL_HULLS, HULLS, RESEARCH_PROJECTS, RESEARCH_PROJECT_IDS, type ResearchProjectId } from '@astera/rules';
import { CONSTELLATION_ASPECT, constellationLayout, hullDoor, RESEARCH_GROUPS } from '../src/lib/constellation.js';

/**
 * THE RESEARCH CONSTELLATION'S LAYOUT. Spec E8 · K9 (docs/ui-v2/gozlemevi.md).
 *
 * "16 düğüm · çizgiler önkoşullarla birebir · hiçbir etiket üst üste binmez." Groups
 * are regions, projects are stars in their group's region, a line joins a project to
 * the one in front of it inside the same group, and a prerequisite in another group is
 * said under the star ("← name") instead of drawn across the map.
 */
const layout = constellationLayout(RESEARCH_GROUPS, (id) => RESEARCH_PROJECTS[id].prerequisite);

describe('the research constellation', () => {
  it('draws every project exactly once', () => {
    const ids = layout.nodes.map((node) => node.id);
    expect(ids).toHaveLength(RESEARCH_PROJECT_IDS.length);
    expect(new Set(ids)).toEqual(new Set(RESEARCH_PROJECT_IDS));
  });

  it('puts Industrial beside the yard it grows out of, joined by a line', () => {
    expect(layout.nodes.find((node) => node.id === 'INDUSTRIAL')?.group).toBe('industry');
    expect(layout.edges.some((edge) => edge.from === 'YARD_AUTOMATION' && edge.to === 'INDUSTRIAL')).toBe(true);
  });

  it('draws exactly the prerequisites that sit in the same group, and says the rest', () => {
    const groupOf = new Map(layout.nodes.map((node) => [node.id, node.group]));
    const expected: string[] = [];
    const outside: [ResearchProjectId, ResearchProjectId][] = [];
    for (const id of RESEARCH_PROJECT_IDS) {
      const before = RESEARCH_PROJECTS[id].prerequisite;
      if (before === null) continue;
      if (groupOf.get(before) === groupOf.get(id)) expected.push(`${before}>${id}`);
      else outside.push([id, before]);
    }
    expect(layout.edges.map((edge) => `${edge.from}>${edge.to}`).sort()).toEqual(expected.sort());
    for (const [id, before] of outside) {
      expect(layout.nodes.find((node) => node.id === id)?.outside).toBe(before);
    }
  });

  it('keeps every star inside its group’s region', () => {
    for (const node of layout.nodes) {
      const region = layout.regions.find((candidate) => candidate.group === node.group)!;
      expect(node.x).toBeGreaterThanOrEqual(region.x);
      expect(node.x).toBeLessThanOrEqual(region.x + region.w);
      expect(node.y).toBeGreaterThanOrEqual(region.y);
      expect(node.y).toBeLessThanOrEqual(region.y + region.h);
    }
  });

  /*
    G2-i (2026-11-15): A NAME IS WHOLE, ON UP TO TWO LINES. At 320 px the map is 318 across
    and CONSTELLATION_ASPECT times that down; a label is 24 % of the width (the widest Turkish
    word, "Spektrometrisi", is 72 px in the kit's narrow face). Under the 16 px star a label
    is two lines of 12 px (44 px with the star); a prerequisite from another group adds up to three
    more ("← Yoğun / Yakıt / Hücreleri").
  */
  const MAP_W = 318;
  const LABEL_W = 0.24;
  const DOT = 8;
  const NAME_H = 44;
  const FROM_H = 42;
  const BAND = 18;

  const boxes = (aspect: number) => {
    const h = MAP_W * aspect;
    return layout.nodes.map((node) => {
      const top = node.y * h - DOT;
      return { node, top, bottom: top + NAME_H + (node.outside === null ? 0 : FROM_H), h };
    });
  };

  const crowd = (aspect: number) => {
    const all = boxes(aspect);
    for (const a of all) {
      for (const b of all) {
        if (a.node.id === b.node.id || Math.abs(a.node.x - b.node.x) >= LABEL_W) continue;
        const apart = a.bottom <= b.top || b.bottom <= a.top;
        expect(apart, `${a.node.id} and ${b.node.id} crowd each other`).toBe(true);
      }
    }
    for (const { node, top, bottom, h } of all) {
      const region = layout.regions.find((candidate) => candidate.group === node.group)!;
      expect(top - region.y * h, `${node.id} sits on its group's name`).toBeGreaterThanOrEqual(BAND);
      expect(bottom, `${node.id}'s label runs into the next group`).toBeLessThanOrEqual((region.y + region.h) * h);
    }
  };

  it('leaves room under every star for its whole name and its outside prerequisite', () => {
    crowd(CONSTELLATION_ASPECT);
  });

  it('keeps every label inside the map, off its edges', () => {
    for (const node of layout.nodes) {
      expect(node.x, node.id).toBeGreaterThanOrEqual(LABEL_W / 2);
      expect(node.x, node.id).toBeLessThanOrEqual(1 - LABEL_W / 2);
    }
  });
});

/**
 * WHAT A PROJECT'S NEXT DOOR OPENS. Spec E8: the card names "açtığı gemiler
 * (`HULLS[*].requiredResearch`)" — the next rung of this project that a hull asks
 * for, and every hull asking for it there.
 */
describe('the ships a research rung opens', () => {
  it('names the rung and the hulls that ask for it', () => {
    expect(hullDoor('SHIP_ARMOR', 1)).toEqual({ level: 2, hulls: ['LEVIATHAN', 'PRAETORIAN', 'CITADEL', 'PALADIN'] });
    expect(hullDoor('STARSHIP_ENGINEERING', 0)?.level).toBe(1);
    expect(hullDoor('STARSHIP_ENGINEERING', 0)?.hulls).toHaveLength(7);
    expect(hullDoor('STARSHIP_ENGINEERING', 1)).toEqual({
      level: 2,
      hulls: ['CATACLYSM', 'CORSAIR', 'CITADEL', 'PALADIN', 'ARGOSY'],
    });
  });

  it('has nothing to say once every door is open, or on a project no hull asks for', () => {
    expect(hullDoor('SHIP_ARMOR', 2)).toBeNull();
    expect(hullDoor('CARGO_HOLDS', 0)).toBeNull();
  });

  /** Derived from the rules, so a new hull with a research gate is named without a copy. */
  it('names every hull a research gates, on the rung that opens it', () => {
    for (const hull of ALL_HULLS) {
      for (const need of HULLS[hull].requiredResearch) {
        expect(hullDoor(need.project, need.level - 1)?.hulls, `${hull} ← ${need.project}`).toContain(hull);
      }
    }
  });
});
