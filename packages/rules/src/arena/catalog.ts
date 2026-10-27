import { ARENA_CATALOG } from './catalog.generated.js';
import { createMesh, type ArenaMesh } from './mesh.js';

/** What a collider shape is for: field rock, landmark giant, or crystal deposit. */
export type CatalogFamily = 'rock' | 'giant' | 'crystal';

/**
 * One collider shape, written by `tools/arena-colliders.mjs` from the same quantised
 * vertices as the model the client draws (Y2: visual = collision). Unit space: centred on
 * its bounds, bounding radius 1. `positions` are little-endian int16 (÷ 32767), `indices`
 * little-endian uint16, both base64. Triangles from `glowFrom` on are crystal (they glow).
 */
export interface CatalogEntry {
  key: string;
  family: CatalogFamily;
  glowFrom: number;
  positions: string;
  indices: string;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VALUE = new Int8Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) VALUE[ALPHABET.charCodeAt(i)] = i;

/** Base64 to bytes, without the platform: the server and every browser decode alike. */
function bytes(text: string): Uint8Array {
  let end = text.length;
  while (end > 0 && text[end - 1] === '=') end--;
  const out = new Uint8Array(Math.floor(end * 3 / 4));
  let buffer = 0; let bits = 0; let n = 0;
  for (let i = 0; i < end; i++) {
    const code = text.charCodeAt(i);
    const value = code < 128 ? VALUE[code] ?? -1 : -1;
    if (value < 0) throw new Error(`Corrupt collider catalog encoding at ${String(i)}`);
    buffer = ((buffer << 6) | value) & 0xffff; bits += 6;
    if (bits >= 8) { bits -= 8; out[n++] = (buffer >> bits) & 0xff; }
  }
  return out;
}

export function decodeEntry(entry: Pick<CatalogEntry, 'positions' | 'indices'>): { positions: Float64Array; indices: Uint32Array } {
  const p = bytes(entry.positions); const t = bytes(entry.indices);
  const positions = new Float64Array(p.length >> 1);
  for (let i = 0; i < positions.length; i++) {
    const v = (p[i * 2] ?? 0) | ((p[i * 2 + 1] ?? 0) << 8);
    positions[i] = (v >= 32768 ? v - 65536 : v) / 32767;
  }
  const indices = new Uint32Array(t.length >> 1);
  for (let i = 0; i < indices.length; i++) indices[i] = (t[i * 2] ?? 0) | ((t[i * 2 + 1] ?? 0) << 8);
  return { positions, indices };
}

let meshes: readonly ArenaMesh[] | null = null;

/** The catalog's collider trees, built once and shared; index = position in ARENA_CATALOG. */
export function catalogMeshes(): readonly ArenaMesh[] {
  meshes ??= ARENA_CATALOG.map(entry => {
    const { positions, indices } = decodeEntry(entry);
    return createMesh(positions, indices);
  });
  return meshes;
}

export { ARENA_CATALOG };
