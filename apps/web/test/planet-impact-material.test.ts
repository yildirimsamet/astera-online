import { describe, expect, it } from 'vitest';
import { planetImpactGroups, planetImpactLevel } from '../src/galaxy/planetImpactMaterial.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';

const state = (hits: number): GalaxyPlanet['state'] => ({ kind: 'EMP', until: new Date(1_000), hits });
describe('surface damage from the public hit count', () => {
  it('keeps healthy/protected worlds clear and accepts older EMP payloads', () => {
    expect(planetImpactLevel({})).toBe(0);
    expect(planetImpactLevel({ state: { kind: 'NORMAL' } })).toBe(0);
    expect(planetImpactLevel({ state: { kind: 'PROTECTED', until: new Date(1_000) } })).toBe(0);
    expect(planetImpactLevel({ state: { kind: 'EMP', until: new Date(1_000) } })).toBe(1);
  });
  it('adds visual damage through five hits and bounds further rendering work', () => {
    expect([1, 2, 3, 4, 5, 100].map(hits => planetImpactLevel({ state: state(hits) }))).toEqual([1, 2, 3, 4, 5, 5]);
  });
  it('isolates injured instances from healthy neighbours sharing a model', () => {
    const nodes = [{ id: 'healthy', state: { kind: 'NORMAL' as const } }, { id: 'first', state: state(1) }, { id: 'fifth', state: state(5) }, { id: 'sixth', state: state(6) }];
    const groups = planetImpactGroups(nodes);
    expect(groups.map(group => [group.level, group.nodes.map(node => node.id)])).toEqual([[0, ['healthy']], [1, ['first']], [5, ['fifth', 'sixth']]]);
    expect(nodes[0]?.state.kind).toBe('NORMAL');
  });
});
