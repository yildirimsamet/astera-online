/**
 * Monument masters contain many UV/normal seams. The CLI's position-only
 * simplifier treats every seam as an immovable border (58k → 34k on the wreck).
 * Simplify with weighted attributes, then bake the high-resolution material onto
 * a new atlas: crossing an old UV seam must not stretch its texture. The normal
 * model pipeline still handles texture compression and meshopt transport.
 * Offline only; dependencies are resolved beside the CLI that supplies them.
 */
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import { bakeMonumentSurface, captureMonumentSurface } from './monument-textures.mjs';

export async function prepareMonumentModel(source, target, triangleCeiling, errorLimit = 0.05, textureSize = 1280) {
  const fromCli = createRequire(`${realpathSync('node_modules/@gltf-transform/cli')}/`);
  const { NodeIO } = fromCli('@gltf-transform/core');
  const { ALL_EXTENSIONS } = fromCli('@gltf-transform/extensions');
  const { compactPrimitive, dequantize, prune, weld } = fromCli('@gltf-transform/functions');
  const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = fromCli('meshoptimizer');
  const draco = fromCli('draco3dgltf');
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
    'draco3d.decoder': await draco.createDecoderModule(),
  });
  const document = await io.read(source);
  // Incoming masters may use Draco; runtime models use Meshopt exclusively.
  document.getRoot().listExtensionsUsed().find(extension => extension.extensionName === 'KHR_draco_mesh_compression')?.dispose();
  await document.transform(dequantize(), weld());
  const primitives = document.getRoot().listMeshes().flatMap((mesh) => mesh.listPrimitives());
  if (primitives.length !== 1) throw new Error(`${source}: expected one static monument primitive`);
  const triangles = primitives.reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0);
  if (triangles > triangleCeiling) {
    for (const primitive of primitives) {
      const high = await captureMonumentSurface(primitive, fromCli);
      const position = primitive.getAttribute('POSITION');
      const normal = primitive.getAttribute('NORMAL');
      const uv = primitive.getAttribute('TEXCOORD_0');
      if (!position || !normal || !uv) throw new Error(`${source}: missing position, normal or UV data`);
      const indices = primitive.getIndices();
      const attributes = new Float32Array(position.getCount() * 5);
      const n = [];
      const t = [];
      for (let vertex = 0; vertex < position.getCount(); vertex += 1) {
        normal.getElement(vertex, n);
        uv.getElement(vertex, t);
        attributes.set([...n, ...t], vertex * 5);
      }
      const targetCount = Math.floor(indices.getCount() * triangleCeiling / triangles / 3) * 3;
      const [simplified, error] = MeshoptSimplifier.simplifyWithAttributes(
        new Uint32Array(indices.getArray()), new Float32Array(position.getArray()), 3,
        attributes, 5, [0.5, 0.5, 0.5, 0.05, 0.05], null, targetCount, errorLimit, ['Permissive'],
      );
      indices.setArray(simplified);
      compactPrimitive(primitive);
      console.log(`  weighted simplification: ${simplified.length / 3} tris · error ${error.toFixed(4)}`);
      await bakeMonumentSurface(document, primitive, high, textureSize);
    }
  }
  await document.transform(prune());
  await io.write(target, document);
}
