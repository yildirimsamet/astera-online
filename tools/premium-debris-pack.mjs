/** Native Galaxy Division explosion fragment; source assets are never modified. */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('..', import.meta.url));
const extracted = process.env.ASTERA_EXTRACTED ?? '/home/yildirim/astera-ref-assets/extracted';
const requireCli = createRequire(`${realpathSync(join(repository, 'node_modules/@gltf-transform/cli'))}/`);
const requireWeb = createRequire(join(repository, 'apps/web/package.json'));
const { NodeIO } = requireCli('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTTextureWebP } = requireCli('@gltf-transform/extensions');
const { dequantize, compactPrimitive, prune, weld, meshopt } = requireCli('@gltf-transform/functions');
const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = requireCli('meshoptimizer');
const THREE = requireWeb('three');
const sharp = requireCli('sharp');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const source = number => `galaxy-division/models/glb/Art/Debris/Meshes/SM_Debris_${number}.glb`;
const candidates = process.argv.includes('--candidates');
const records = candidates
  ? ['04', '05', '09', '11', '13', '15', '16'].map(number => ({ name: number, source: source(number) }))
  : [
    { name: 'wreck-plate-gd-v3', source: source('11'), ceiling: 156 },
  ];
const triangleCount = document => document.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives()).reduce((sum, primitive) => sum + primitive.getIndices().getCount() / 3, 0);

/** Bake the authored static transform, then give every chunk a true unit bounding sphere. */
function normalize(document) {
  const nodes = document.getRoot().listNodes().filter(node => node.getMesh());
  if (nodes.length !== 1 || nodes[0].getMesh().listPrimitives().length !== 1) throw new Error('A fragment must contain exactly one static primitive');
  const node = nodes[0], primitive = node.getMesh().listPrimitives()[0];
  const positions = primitive.getAttribute('POSITION'), normals = primitive.getAttribute('NORMAL');
  const matrix = new THREE.Matrix4().fromArray(node.getWorldMatrix()), normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
  const box = new THREE.Box3(), value = new THREE.Vector3();
  for (let i = 0; i < positions.getCount(); i++) {
    positions.setElement(i, value.fromArray(positions.getElement(i, [])).applyMatrix4(matrix).toArray());
    box.expandByPoint(value);
    normals.setElement(i, value.fromArray(normals.getElement(i, [])).applyNormalMatrix(normalMatrix).normalize().toArray());
  }
  const centre = box.getCenter(new THREE.Vector3());
  let radius = 0;
  for (let i = 0; i < positions.getCount(); i++) radius = Math.max(radius, value.fromArray(positions.getElement(i, [])).distanceTo(centre));
  for (let i = 0; i < positions.getCount(); i++) positions.setElement(i, value.fromArray(positions.getElement(i, [])).sub(centre).multiplyScalar(1 / radius).toArray());
  node.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  for (const semantic of primitive.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0'].includes(semantic)) primitive.setAttribute(semantic, null);
  return primitive;
}

async function map(document, suffix, size, normal = false) {
  const original = readFileSync(join(extracted, `galaxy-division/textures/models/Art/Debris/Textures/T_Scifi_Debris_${suffix}.png`));
  const pixels = await sharp(original).resize(size, size, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  // Unreal authored tangent normals use DirectX's inverted green channel.
  if (normal) for (let i = 1; i < pixels.length; i += 3) pixels[i] = 255 - pixels[i];
  const image = await sharp(pixels, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: normal ? 92 : 90 }).toBuffer();
  return document.createTexture(`native-sci-fi-debris-${suffix}`).setImage(image).setMimeType('image/webp');
}

function simplify(primitive, ceiling) {
  const index = primitive.getIndices();
  if (index.getCount() <= ceiling * 3) return;
  const position = primitive.getAttribute('POSITION'), normal = primitive.getAttribute('NORMAL'), uv = primitive.getAttribute('TEXCOORD_0');
  const attributes = new Float32Array(position.getCount() * 5);
  for (let i = 0; i < position.getCount(); i++) attributes.set([...normal.getElement(i, []), ...uv.getElement(i, [])], i * 5);
  const [indices] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(index.getArray()), new Float32Array(position.getArray()), 3, attributes, 5, [0.4, 0.4, 0.4, 0.8, 0.8], null, ceiling * 3, 0.12, ['Permissive']);
  index.setArray(indices);
  compactPrimitive(primitive);
}

const report = [];
for (const entry of records) {
  const document = await io.read(join(extracted, entry.source));
  await document.transform(dequantize());
  const originalTriangles = triangleCount(document), primitive = normalize(document);
  const material = primitive.getMaterial();
  material.setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(1).setRoughnessFactor(1).setEmissiveTexture(null).setEmissiveFactor([0, 0, 0]).setAlphaMode('OPAQUE').setDoubleSided(false);
  material.setBaseColorTexture(await map(document, 'D', 512)).setNormalTexture(await map(document, 'N', 512, true)).setNormalScale(1);
  const packed = await map(document, 'ORM', 256);
  material.setMetallicRoughnessTexture(packed).setOcclusionTexture(packed);
  document.createExtension(EXTTextureWebP).setRequired(true);
  await document.transform(prune(), weld());
  if (entry.ceiling) simplify(primitive, entry.ceiling);
  const fullTriangles = triangleCount(document);
  const output = candidates ? join(repository, `out/premium-assets/debris-candidates/${entry.name}.glb`) : join(repository, `apps/web/public/assets/models/debris/${entry.name}.glb`);
  mkdirSync(dirname(output), { recursive: true });
  await document.transform(meshopt({ encoder: MeshoptEncoder }), prune());
  await io.write(output, document);
  report.push({ ...entry, originalTriangles, triangles: fullTriangles, bytes: statSync(output).size, textureSizes: { nativeAlbedo: 512, nativeNormal: 512, nativeOrm: 256 } });
  console.log(`${entry.name}: ${originalTriangles} → ${fullTriangles} triangles · ${report.at(-1).bytes} bytes`);
}
writeFileSync(join(repository, candidates ? 'out/premium-assets/debris-candidates/measurements.json' : 'docs/implementation/premium-debris-measurements.json'), JSON.stringify(report, null, 2) + '\n');
