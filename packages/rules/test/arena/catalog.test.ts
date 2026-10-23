import { describe, expect, it } from 'vitest';
import { ARENA_CATALOG, catalogMeshes, decodeEntry } from '../../src/arena/index.js';

/** Welded by exact position (the data is quantised, so shared corners are bit-identical). */
function edgesOf(positions: Float64Array, indices: Uint32Array): Map<string, number> {
  const id = new Map<string, number>();
  const vertex = (i: number): number => {
    const key = `${String(positions[i * 3])},${String(positions[i * 3 + 1])},${String(positions[i * 3 + 2])}`;
    let n = id.get(key);
    if (n === undefined) { n = id.size; id.set(key, n); }
    return n;
  };
  const directed = new Map<string, number>();
  for (let t = 0; t < indices.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const key = `${String(vertex(indices[t + e] ?? 0))}>${String(vertex(indices[t + (e + 1) % 3] ?? 0))}`;
      directed.set(key, (directed.get(key) ?? 0) + 1);
    }
  }
  return directed;
}

describe('collider catalog (Y2: the rock you see is the rock you hit)', () => {
  it('decodes quantised positions and indices exactly', () => {
    const { positions, indices } = decodeEntry({ positions: '/38AAAGAAAAAQAEA', indices: 'AAABAP//' });
    expect(Array.from(positions)).toEqual([1, 0, -1, 0, 16384 / 32767, 1 / 32767]);
    expect(Array.from(indices)).toEqual([0, 1, 65535]);
    expect(Array.from(decodeEntry({ positions: '//8=', indices: '' }).positions)).toEqual([-1 / 32767]);
  });

  it('refuses a corrupt encoding instead of building a wrong collider', () => {
    expect(() => decodeEntry({ positions: 'AA*A', indices: '' })).toThrow();
  });

  it('has every family the layout draws from', () => {
    const count = (family: string): number => ARENA_CATALOG.filter(entry => entry.family === family).length;
    expect(count('rock')).toBeGreaterThanOrEqual(3);
    expect(count('giant')).toBeGreaterThanOrEqual(1);
    expect(count('crystal')).toBeGreaterThanOrEqual(2);
    expect(new Set(ARENA_CATALOG.map(entry => entry.key)).size).toBe(ARENA_CATALOG.length);
  });

  for (const entry of ARENA_CATALOG) {
    it(`${entry.key}: closed, wound outwards, centred, bounding radius 1`, () => {
      const { positions, indices } = decodeEntry(entry);
      const triangles = indices.length / 3;
      // Closed and consistently wound: every directed edge once, and its reverse once.
      const directed = edgesOf(positions, indices);
      for (const [key, uses] of directed) {
        expect(uses, key).toBe(1);
        const [a, b] = key.split('>');
        expect(directed.get(`${b ?? ''}>${a ?? ''}`), key).toBe(1);
      }
      let volume = 0; let radius = 0;
      const min = [Infinity, Infinity, Infinity]; const max = [-Infinity, -Infinity, -Infinity];
      for (let t = 0; t < indices.length; t += 3) {
        const a = (indices[t] ?? 0) * 3; const b = (indices[t + 1] ?? 0) * 3; const c = (indices[t + 2] ?? 0) * 3;
        const p = positions;
        volume += (p[a] ?? 0) * ((p[b + 1] ?? 0) * (p[c + 2] ?? 0) - (p[b + 2] ?? 0) * (p[c + 1] ?? 0))
          - (p[a + 1] ?? 0) * ((p[b] ?? 0) * (p[c + 2] ?? 0) - (p[b + 2] ?? 0) * (p[c] ?? 0))
          + (p[a + 2] ?? 0) * ((p[b] ?? 0) * (p[c + 1] ?? 0) - (p[b + 1] ?? 0) * (p[c] ?? 0));
      }
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i] ?? 0; const y = positions[i + 1] ?? 0; const z = positions[i + 2] ?? 0;
        radius = Math.max(radius, Math.sqrt(x * x + y * y + z * z));
        [x, y, z].forEach((v, k) => { min[k] = Math.min(min[k] ?? 0, v); max[k] = Math.max(max[k] ?? 0, v); });
      }
      expect(volume).toBeGreaterThan(0);
      expect(radius).toBeGreaterThan(0.999);
      expect(radius).toBeLessThanOrEqual(1);
      for (let k = 0; k < 3; k++) expect(Math.abs(((min[k] ?? 0) + (max[k] ?? 0)) / 2)).toBeLessThan(1e-3);
      if (entry.family === 'crystal') {
        expect(entry.glowFrom).toBeGreaterThan(0);
        expect(entry.glowFrom).toBeLessThan(triangles);
      } else expect(entry.glowFrom).toBe(triangles);
      // Nothing is dropped as degenerate: the collider has every triangle that is drawn.
      expect(catalogMeshes()[ARENA_CATALOG.indexOf(entry)]?.indices.length).toBe(indices.length);
    });
  }

  it('builds each collider tree once and shares it', () => {
    expect(catalogMeshes()).toBe(catalogMeshes());
    expect(catalogMeshes()).toHaveLength(ARENA_CATALOG.length);
  });
});
