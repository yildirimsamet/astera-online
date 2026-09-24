import { describe, expect, it } from 'vitest';
import { RESEARCH_PROJECTS, RESEARCH_PROJECT_IDS, type ResearchProjectId } from '@astera/rules';
import { constellationLayout, RESEARCH_GROUPS } from '../src/lib/constellation.js';

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
  it('draws every project once, sixteen stars', () => {
    const ids = layout.nodes.map((node) => node.id);
    expect(ids).toHaveLength(16);
    expect(new Set(ids)).toEqual(new Set(RESEARCH_PROJECT_IDS));
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
    A label is one line under its star, 76px wide; on a 350px phone the map is about
    333px across and 350px down. So a label spans 0.24 of the width and — star, name and
    the "← prerequisite" line — 0.13 of the height.
  */
  const LABEL_W = 0.24;
  const LABEL_H = 0.13;

  it('leaves room between any two stars for their labels', () => {
    for (const a of layout.nodes) {
      for (const b of layout.nodes) {
        if (a.id === b.id) continue;
        const apart = Math.abs(a.x - b.x) >= LABEL_W || Math.abs(a.y - b.y) >= LABEL_H;
        expect(apart, `${a.id} and ${b.id} crowd each other`).toBe(true);
      }
    }
  });

  it('keeps every label inside the map, off its edges', () => {
    for (const node of layout.nodes) {
      expect(node.x, node.id).toBeGreaterThanOrEqual(LABEL_W / 2);
      expect(node.x, node.id).toBeLessThanOrEqual(1 - LABEL_W / 2);
      expect(node.y + LABEL_H, node.id).toBeLessThanOrEqual(1);
    }
  });

  /** The group's name prints at the top of its quarter; the quarter below starts with its own. */
  it('keeps the group names clear of the stars', () => {
    for (const node of layout.nodes) {
      const region = layout.regions.find((candidate) => candidate.group === node.group)!;
      expect(node.y - region.y, `${node.id} sits on its group's name`).toBeGreaterThanOrEqual(0.07);
      expect(node.y + LABEL_H - (region.y + region.h), `${node.id}'s label runs into the next group`).toBeLessThanOrEqual(0.005);
    }
  });
});
