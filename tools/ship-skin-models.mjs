/** Builds the three ship skin tiers from immutable masters, including authored panel light. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { prepareMonumentModel } from './monument-models.mjs';
import { polishCosmeticMaterial } from './cosmetic-materials.mjs';

export async function buildShipSkin(source, target, name, lodOnly = false) {
  const fromCli = createRequire(`${realpathSync('node_modules/@gltf-transform/cli')}/`);
  const { NodeIO } = fromCli('@gltf-transform/core');
  const { ALL_EXTENSIONS } = fromCli('@gltf-transform/extensions');
  const { MeshoptDecoder, MeshoptEncoder } = fromCli('meshoptimizer');
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
  });
  const scratch = mkdtempSync(join(tmpdir(), 'astera-ship-skin-'));
  mkdirSync(dirname(target), { recursive: true });
  const optimize = (input, output, size) => execFileSync('npx', ['gltf-transform', 'optimize', input, output,
    '--texture-size', String(size), '--texture-compress', 'webp', '--compress', 'meshopt', '--simplify', 'false'], { stdio: 'pipe' });
  try {
    const decoded = join(scratch, 'decoded.glb');
    // The browser supports meshopt. The source Draco export is decoded only offline.
    optimize(source, decoded, 512);
    for (const [suffix, ceiling, textureSize, error] of [
      ['_preview', 32000, 512, .01], ['', 5000, 1024, .04], ['_lod', 3000, 512, .06],
    ]) {
      if (lodOnly && suffix !== '_lod') continue;
      const prepared = join(scratch, `prepared${suffix}.glb`);
      await prepareMonumentModel(decoded, prepared, ceiling, error, textureSize);
      const document = await io.read(prepared);
      const triangles = document.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives())
        .reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0);
      if (triangles > ceiling) throw new Error(`${name}${suffix}: ${triangles} triangles exceeds ${ceiling}`);
      await polishCosmeticMaterial(document, name);
      const styled = join(scratch, `styled${suffix}.glb`);
      await io.write(styled, document);
      const output = target.replace(/\.glb$/, `${suffix}.glb`);
      optimize(styled, output, textureSize);
      console.log(`${name}${suffix}: ${triangles} tris → ${output}`);
    }
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}
