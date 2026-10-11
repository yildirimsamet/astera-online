/** Reproducible production derivatives. Reference originals are read-only. */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('..', import.meta.url));
const sourceRoot = process.env.ASTERA_EXTRACTED ?? '/home/yildirim/astera-ref-assets/extracted';
const publicRoot = join(repository, 'apps/web/public');
const requireCli = createRequire(`${realpathSync(join(repository, 'node_modules/@gltf-transform/cli'))}/`);
const requireWeb = createRequire(join(repository, 'apps/web/package.json'));
const { NodeIO } = requireCli('@gltf-transform/core');
const { ALL_EXTENSIONS, EXTTextureWebP } = requireCli('@gltf-transform/extensions');
const { dequantize, joinPrimitives, compactPrimitive, prune, weld, meshopt } = requireCli('@gltf-transform/functions');
const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = requireCli('meshoptimizer');
const THREE = requireWeb('three');
const sharp = requireCli('sharp');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder,
});
const GD = 'galaxy-division', SI = 'subdivision-infinity';
const model = (pack, relative) => `${pack}/models/glb/${relative}.glb`;
const texture = relative => `${GD}/textures/models/${relative}.png`;
const entries = [
  { name: 'missile', source: model(GD, 'Gameplay/Weapons/Missiles/Meshes/SM_Rocket_1'), maps: [texture('Gameplay/Weapons/Missiles/Textures/T_Rocket_1_D')], facing: '+x', output: 'assets/models/missiles/rocket-premium-v2.glb', size: 256 },
  ...[['atria', 'AsteroidsAtria', 'SM_AsteroidAtria_1','T_AsteroidAtria'],['stone','AsteroidsStone','SM_AsteroidStone_1','T_AsteroidStone'],['atria-large','AsteroidsAtria','SM_AsteroidAtria_4','T_AsteroidAtria'],['isotope','AsteroidsCrystal','SM_AsteroidCrystal_Small_2','T_AsteroidCrystal']].map(([name, folder, mesh, map]) => ({
    name, source: model(GD, `Art/Asteroids/${folder}/Meshes/${mesh}`), maps: ['D','N'].map(s => texture(`Art/Asteroids/${folder}/Textures/${map}_${s}`)),
    output: `assets/models/asteroids/${name}-premium-v2.glb`, size: 256, mineral: name === 'isotope', rock: true,
  })),
];
const pathFor = relative => join(sourceRoot, relative);
const destination = relative => { const target = join(publicRoot, relative); mkdirSync(dirname(target), { recursive: true }); return target; };
const triangleCount = doc => doc.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives()).reduce((sum, p) => sum + p.getIndices().getCount() / 3, 0);

/** Freeze the authored bind pose before dropping skeletons; preserve every node transform. */
function staticGeometry(document, entry) {
  const primitives = [];
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const skin = node.getSkin();
    const inverseBind = skin?.getInverseBindMatrices();
    const joints = skin?.listJoints();
    const matrices = joints?.map((joint, index) => {
      const inverse = inverseBind ? new THREE.Matrix4().fromArray(inverseBind.getElement(index, [])) : new THREE.Matrix4();
      return new THREE.Matrix4().fromArray(joint.getWorldMatrix()).multiply(inverse);
    });
    for (const primitive of mesh.listPrimitives()) {
      // Tiny red/green animation markers become the renderer's shared drive signature.
      // Their separate Unreal pulse materials would cost a full extra pass each.
      if (/Light|EmissivePulse/i.test(primitive.getMaterial()?.getName() ?? '')) continue;
      const positions = primitive.getAttribute('POSITION');
      const normals = primitive.getAttribute('NORMAL');
      const weights = primitive.getAttribute('WEIGHTS_0'), indices = primitive.getAttribute('JOINTS_0');
      const transform = new THREE.Matrix4().fromArray(node.getWorldMatrix());
      const p = new THREE.Vector3(), n = new THREE.Vector3();
      const outP = new THREE.Vector3(), outN = new THREE.Vector3();
      const points = new Float32Array(positions.getCount() * 3), vectors = new Float32Array(positions.getCount() * 3);
      for (let i = 0; i < positions.getCount(); i++) {
        p.fromArray(positions.getElement(i, [])); n.fromArray(normals.getElement(i, []));
        if (matrices && weights && indices) {
          outP.set(0,0,0); outN.set(0,0,0);
          const w = weights.getElement(i, []), j = indices.getElement(i, []);
          for (let k = 0; k < w.length; k++) {
            if (!w[k]) continue;
            const matrix = matrices[j[k]];
            outP.addScaledVector(p.clone().applyMatrix4(matrix), w[k]);
            outN.addScaledVector(n.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(matrix)), w[k]);
          }
        } else {
          outP.copy(p).applyMatrix4(transform); outN.copy(n).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(transform));
        }
        outP.toArray(points, i * 3); outN.normalize().toArray(vectors, i * 3);
      }
      primitive.setAttribute('POSITION', positions.clone().setArray(points));
      primitive.setAttribute('NORMAL', normals.clone().setArray(vectors));
      for (const semantic of primitive.listSemantics()) if (!['POSITION','NORMAL','TEXCOORD_0'].includes(semantic)) primitive.setAttribute(semantic, null);
      const uv = primitive.getAttribute('TEXCOORD_0');
      if (entry.source.startsWith(SI) && uv) for (let i = 0; i < uv.getCount(); i++) {
        const v = uv.getElement(i, []); uv.setElement(i, [v[0], 1 - v[1]]);
      }
      primitives.push(primitive);
    }
  }
  if (primitives.length === 0) throw new Error(`${entry.name}: empty visual body`);
  const material = primitives[0].getMaterial();
  for (const p of primitives) p.setMaterial(material);
  const merged = joinPrimitives(primitives);
  const points = merged.getAttribute('POSITION'), normals = merged.getAttribute('NORMAL');
  const box = new THREE.Box3(), v = new THREE.Vector3();
  for (let i = 0; i < points.getCount(); i++) box.expandByPoint(v.fromArray(points.getElement(i, [])));
  const centre = box.getCenter(new THREE.Vector3());
  const facing = { '+x': [1,0,0], '-x': [-1,0,0], '+z': [0,0,1], '-z': [0,0,-1] }[entry.facing ?? '+z'];
  const turn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...facing), new THREE.Vector3(0,0,1));
  let radius = 0;
  for (let i = 0; i < points.getCount(); i++) radius = Math.max(radius, v.fromArray(points.getElement(i, [])).distanceTo(centre));
  for (let i = 0; i < points.getCount(); i++) {
    points.setElement(i, v.fromArray(points.getElement(i, [])).sub(centre).applyQuaternion(turn).multiplyScalar(1 / radius).toArray());
    normals.setElement(i, v.fromArray(normals.getElement(i, [])).applyQuaternion(turn).toArray());
  }
  for (const scene of document.getRoot().listScenes()) scene.dispose();
  for (const node of document.getRoot().listNodes()) node.dispose();
  for (const mesh of document.getRoot().listMeshes()) mesh.dispose();
  const mesh = document.createMesh(entry.name).addPrimitive(merged);
  document.createScene('production').addChild(document.createNode(entry.name).setMesh(mesh));
  for (const skin of document.getRoot().listSkins()) skin.dispose();
  for (const animation of document.getRoot().listAnimations()) animation.dispose();
  return { primitive: merged, material };
}

async function encodeTexture(document, name, input, size, normal = false, mineral = false) {
  let data = await sharp(input).resize(size, size, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  if (normal) for (let i = 1; i < data.length; i += 3) data[i] = 255 - data[i];
  if (mineral) for (let i = 0; i < data.length; i += 3) {
    const red = data[i], green = data[i+1], blue = data[i+2];
    const value = Math.max(red, green, blue);
    const purple = Math.max(red, blue) > green * 1.12 + 5;
    if (purple) { data[i] = value * 0.3; data[i+1] = value * 0.64; data[i+2] = value * 0.25; }
    else { const grey = (red * 0.25 + green * 0.5 + blue * 0.25) * 0.8; data[i] = grey * 0.91; data[i+1] = grey; data[i+2] = grey * 0.94; }
  }
  const image = await sharp(data, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: normal ? 88 : 86 }).toBuffer();
  return document.createTexture(name).setImage(image).setMimeType('image/webp');
}
async function applyMaps(document, entry, material) {
  const previousD = material.getBaseColorTexture()?.getImage(), previousN = material.getNormalTexture()?.getImage();
  if (!entry.maps && !previousD) throw new Error(`${entry.name}: source material has no base colour`);
  const diffuse = entry.maps ? readFileSync(pathFor(entry.maps[0])) : previousD;
  const normal = entry.maps?.[1] ? readFileSync(pathFor(entry.maps[1])) : previousN;
  const orm = entry.maps?.[2] ? readFileSync(pathFor(entry.maps[2])) : null;
  const nativeMetal = entry.name === 'probe' ? 0.914286 : entry.rock ? 0 : entry.source.startsWith(SI) ? material.getMetallicFactor() : 0.45;
  const nativeRough = entry.name === 'probe' ? 0.33 : entry.rock ? 0.88 : entry.source.startsWith(SI) ? material.getRoughnessFactor() : 0.5;
  material.setBaseColorFactor([1,1,1,1]).setAlphaMode('OPAQUE').setDoubleSided(false)
    .setMetallicFactor(orm ? 1 : nativeMetal).setRoughnessFactor(orm ? 1 : nativeRough).setEmissiveFactor([0,0,0]).setEmissiveTexture(null)
    .setBaseColorTexture(await encodeTexture(document, `${entry.name}-albedo`, diffuse, entry.size, false, entry.mineral));
  if (normal) material.setNormalTexture(await encodeTexture(document, `${entry.name}-normal`, normal, entry.size, true)).setNormalScale(1);
  if (orm) {
    const packed = await encodeTexture(document, `${entry.name}-orm`, orm, entry.size);
    material.setMetallicRoughnessTexture(packed).setOcclusionTexture(packed);
  } else material.setMetallicRoughnessTexture(null).setOcclusionTexture(null);
}
function simplifyTo(document, ceiling) {
  const total = triangleCount(document);
  if (total <= ceiling) return;
  for (const mesh of document.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const position = p.getAttribute('POSITION'), normal = p.getAttribute('NORMAL'), uv = p.getAttribute('TEXCOORD_0'), indices = p.getIndices();
    const attributes = new Float32Array(position.getCount() * 5);
    for (let i = 0; i < position.getCount(); i++) attributes.set([...normal.getElement(i, []), ...uv.getElement(i, [])], i * 5);
    const [array] = MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(indices.getArray()), new Float32Array(position.getArray()), 3,
      attributes, 5, [0.3,0.3,0.3,0.5,0.5], null, Math.floor(ceiling / total * indices.getCount() / 3) * 3, 0.12, ['Permissive']);
    indices.setArray(array); compactPrimitive(p);
  }
}
const report = [];
if (!process.argv.includes('--effects-only')) for (const entry of entries) {
  if (!existsSync(pathFor(entry.source))) throw new Error(`Missing original: ${entry.source}`);
  const doc = await io.read(pathFor(entry.source));
  await doc.transform(dequantize());
  const original = triangleCount(doc);
  const { material } = staticGeometry(doc, entry);
  if (!entry.effect) {
    await applyMaps(doc, entry, material);
    doc.createExtension(EXTTextureWebP).setRequired(true);
  }
  await doc.transform(prune(), weld());
  if (entry.full) simplifyTo(doc, entry.full);
  const full = triangleCount(doc);
  const raw = await io.writeBinary(doc);
  await doc.transform(meshopt({ encoder: MeshoptEncoder }), prune());
  await io.write(destination(entry.output), doc);
  let low = null;
  if (entry.low) {
    const lod = await io.readBinary(raw);
    simplifyTo(lod, Math.min(entry.low, Math.floor(full * 0.6)));
    low = triangleCount(lod);
    for (const mesh of lod.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) p.setMaterial(null);
    await lod.transform(prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder }));
    await io.write(destination(entry.output.replace('.glb', '_lod.glb')), lod);
  }
  report.push({ ...entry, original, triangles: full, lowTriangles: low, bytes: statSync(destination(entry.output)).size });
  console.log(`${entry.name}: ${original} → ${full} / ${low ?? '—'} · ${report.at(-1).bytes} bytes`);
}
if (report.length) writeFileSync(join(repository, 'docs/implementation/premium-asset-measurements.json'), JSON.stringify(report, null, 2)+'\n');

const effects = [
  ['explosion', `${GD}/vfx/textures/Effects/Explosions/Textures/T_Expl_001.png`, 1024],
  ['smoke', `${GD}/vfx/textures/Effects/FlameAndFire/Textures/T_Smoke_Puff_color.png`, 512],
  ['shock', `${GD}/vfx/textures/Effects/Impact/Textures/T_ky_shockWave03_4x4.png`, 512, 'green'],
  ['trail', `${GD}/vfx/textures/Effects/ShipTrails/T_trail_001.png`, 256, 'rotate'],
  ['thruster-grunge', `${GD}/vfx/textures/Effects/RocketThrusterExhaustFX/Textures/T_Smoke_Grunge.png`, 384],
  ['thruster-noise', `${GD}/vfx/textures/Effects/RocketThrusterExhaustFX/Textures/T_Noise.png`, 128],
  ['dust', `${GD}/vfx/textures/Effects/Explosions/RealisticFXPack/Textures/t_smokebomb.png`, 768],
  ['burst', `${GD}/vfx/textures/Effects/Explosions/RealisticFXPack/Textures/t_explosion_shapes_burst_add.png`, 512, 'wide'],
];
  for (const [name, source, size, operation] of effects) {
    let image = sharp(pathFor(source));
    if (operation === 'green') image = image.extractChannel(1).removeAlpha().toColourspace('srgb');
    if (operation === 'rotate') image = image.rotate(90);
    await image.resize(size, operation === 'rotate' ? size * 2 : operation === 'wide' ? size / 2 : size, { fit: 'fill' }).webp({ quality: 90 }).toFile(destination(`assets/vfx/premium-v2/${name}.webp`));
  }
