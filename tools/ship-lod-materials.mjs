#!/usr/bin/env node
/**
 * CLASS SHIP LEVELS KEEP THEIR MATERIALS.
 *
 * Owner 2026-10-27: the parked Akıncı showed as a bare white model. arena-ships.mjs numbered lod0's
 * parts in place, and when lod0 was `parts` itself (under budget) lod1/lod2 looked their material
 * up among numbers and wrote primitives with none; three draws those with its default white.
 * `materialIndices` is the pipeline's fix; `fillLodMaterials` repairs files already packed, in
 * their JSON only (geometry and textures untouched):
 *
 *   node tools/ship-lod-materials.mjs <file.glb>...
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Every level's parts with `material` as the index of its source part's material; nothing mutated. */
export function materialIndices(parts, levels) {
  const index = new Map(parts.map((part, i) => [part.material, i]));
  return levels.map(level => level.map(part => {
    const material = typeof part.material === 'number' ? part.material : index.get(part.material);
    if (material === undefined) throw new Error('a level part\'s material is none of the source parts\'');
    return { ...part, material };
  }));
}

/** Gives every material-less primitive of lod1, lod2… the material of lod0's primitive in its place. */
export function fillLodMaterials(json) {
  const meshOf = name => json.nodes?.find(node => node.name === name)?.mesh;
  const first = meshOf('lod0');
  if (first === undefined) return 0;
  const model = json.meshes[first].primitives;
  let filled = 0;
  for (let level = 1; meshOf(`lod${String(level)}`) !== undefined; level++) {
    const primitives = json.meshes[meshOf(`lod${String(level)}`)].primitives;
    if (primitives.length !== model.length) throw new Error(`lod${String(level)}: ${String(primitives.length)} parts, lod0 has ${String(model.length)}`);
    primitives.forEach((primitive, i) => {
      if (primitive.material !== undefined || model[i].material === undefined) return;
      primitive.material = model[i].material; filled++;
    });
  }
  return filled;
}

const JSON_CHUNK = 0x4e4f534a;

/** A GLB's JSON chunk. */
export function glbJson(glb) {
  if (glb.readUInt32LE(16) !== JSON_CHUNK) throw new Error('not a GLB with its JSON first');
  return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
}

/** The GLB with its JSON chunk replaced (space-padded to 4 bytes); every later chunk copied as is. */
export function withGlbJson(glb, json) {
  const text = Buffer.from(JSON.stringify(json));
  const padded = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 0x20)]);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4);
  head.writeUInt32LE(padded.length, 12); head.writeUInt32LE(JSON_CHUNK, 16);
  const rest = glb.subarray(20 + glb.readUInt32LE(12));
  const out = Buffer.concat([head, padded, rest]);
  out.writeUInt32LE(out.length, 8);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const file of process.argv.slice(2)) {
    const glb = readFileSync(file); const json = glbJson(glb);
    const filled = fillLodMaterials(json);
    if (filled > 0) writeFileSync(file, withGlbJson(glb, json));
    console.log(`${file}: ${String(filled)} primitives given their material`);
  }
}
