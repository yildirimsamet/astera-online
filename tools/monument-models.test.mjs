import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareMonumentModel } from './monument-models.mjs';

describe('incoming monument compression', () => {
  it('decodes the supplied Draco master offline without changing its geometry or source', async () => {
    const source = 'assets/source/models/monuments/monument_fragmented_dyson_sphere.glb';
    const original = await readFile(source);
    const scratch = await mkdtemp(join(tmpdir(), 'astera-monument-decode-test-'));
    try {
      const output = join(scratch, 'decoded.glb');
      await prepareMonumentModel(source, output, 20000);
      const bytes = await readFile(output);
      const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
      expect(json.extensionsRequired ?? []).not.toContain('KHR_draco_mesh_compression');
      const triangles = json.meshes.flatMap(mesh => mesh.primitives).reduce((sum, primitive) => sum + json.accessors[primitive.indices].count / 3, 0);
      expect(triangles).toBe(9557);
      expect(await readFile(source)).toEqual(original);
    } finally { await rm(scratch, { recursive: true, force: true }); }
  });
});
