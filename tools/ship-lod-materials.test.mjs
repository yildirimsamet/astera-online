import { describe, expect, it } from 'vitest';
import { fillLodMaterials, glbJson, materialIndices, withGlbJson } from './ship-lod-materials.mjs';

/**
 * Owner 2026-10-27: the parked Akıncı showed as a bare white model. Its lod1/lod2 primitives had no
 * material: arena-ships.mjs numbered lod0's parts in place, and lod0 was `parts` itself (under
 * budget), so the coarser levels looked their material up among numbers and found none.
 */
describe('class ship levels keep their materials', () => {
  it('numbers every level\'s parts by the source parts without touching them', () => {
    const hull = { name: 'hull' }; const glow = { name: 'glow' };
    const parts = [{ material: hull }, { material: glow }];
    const levels = [parts, [{ material: hull }, { material: glow }], [{ material: glow }]];
    expect(materialIndices(parts, levels).map(level => level.map(part => part.material))).toEqual([[0, 1], [0, 1], [1]]);
    expect(parts[0].material).toBe(hull);
  });

  it('refuses a part whose material is not one of the sources', () => {
    expect(() => materialIndices([{ material: {} }], [[{ material: {} }]])).toThrow(/material/);
  });

  const json = () => ({
    nodes: [{ name: 'ship', children: [1, 2, 3] }, { name: 'lod0', mesh: 0 }, { name: 'lod1', mesh: 1 }, { name: 'lod2', mesh: 2 }],
    meshes: [{ primitives: [{ material: 0 }, { material: 1 }] }, { primitives: [{}, {}] }, { primitives: [{}, { material: 1 }] }],
  });

  it('gives each coarser level\'s part the material of lod0\'s part in the same place', () => {
    const fixed = json();
    expect(fillLodMaterials(fixed)).toBe(3);
    expect(fixed.meshes.map(mesh => mesh.primitives.map(p => p.material))).toEqual([[0, 1], [0, 1], [0, 1]]);
    expect(fillLodMaterials(fixed)).toBe(0);
  });

  it('refuses a level whose parts do not line up with lod0', () => {
    const odd = json(); odd.meshes[1].primitives.pop();
    expect(() => fillLodMaterials(odd)).toThrow(/lod1/);
  });

  it('rewrites a GLB\'s JSON and keeps its binary chunk byte for byte', () => {
    const bin = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const glb = withGlbJson(Buffer.concat([header(), chunk(Buffer.from(JSON.stringify({ asset: { version: '2.0' } })), 0x4e4f534a), chunk(Buffer.from(bin), 0x004e4942)]), { asset: { version: '2.0' }, extra: 'a longer document than before' });
    expect(glbJson(glb)).toEqual({ asset: { version: '2.0' }, extra: 'a longer document than before' });
    expect(glb.readUInt32LE(8)).toBe(glb.length);
    const jsonLength = glb.readUInt32LE(12);
    expect(jsonLength % 4).toBe(0);
    expect([...glb.subarray(20 + jsonLength + 8)]).toEqual([...bin]);
  });
});

function header() { const b = Buffer.alloc(12); b.writeUInt32LE(0x46546c67, 0); b.writeUInt32LE(2, 4); return b; }
function chunk(data, type) {
  const padded = Buffer.concat([data, Buffer.alloc((4 - data.length % 4) % 4, type === 0x4e4f534a ? 0x20 : 0)]);
  const head = Buffer.alloc(8); head.writeUInt32LE(padded.length, 0); head.writeUInt32LE(type, 4);
  return Buffer.concat([head, padded]);
}
