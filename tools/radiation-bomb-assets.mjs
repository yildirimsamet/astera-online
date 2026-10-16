import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import * as T from '../apps/web/node_modules/three/build/three.module.js';
import { OBJLoader } from '../apps/web/node_modules/three/examples/jsm/loaders/OBJLoader.js';
import { GLTFExporter } from '../apps/web/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from '../apps/web/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';

/** Offline authoring of the owner's selected M1 geometry. No other model is regenerated. */
class BlobReader {
  result = null;
  onloadend = null;
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then(buffer => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
}
globalThis.FileReader = BlobReader;

const refs = resolve(process.argv[2] ?? '../blindspace-komutan-gemisi/astera-refs');
const geometryPath = resolve(refs, 'extract/com.HomeNetGames.SpaceCommander/exported/models/Missile_0002_high-2-1.obj');
const geometry = await readFile(geometryPath, 'utf8');
const sourceDirectory = resolve('assets/source/models/missiles');
const servedDirectory = resolve('apps/web/public/assets/models/missiles');
await mkdir(sourceDirectory, { recursive: true });
await mkdir(servedDirectory, { recursive: true });
const records = [];
const finishes = {
  1: { casing: '#36482b', armour: '#6c8a38', metalness: .65, radius: .25 },
  2: { casing: '#183d43', armour: '#399c91', metalness: .78, radius: .33 },
  3: { casing: '#262a31', armour: '#d39a36', metalness: .78, radius: .43 },
};

for (const level of [1, 2, 3]) {
  const finish = finishes[level];
  const root = new T.Group();
  root.name = `Radiation Bomb L${level}`;
  const body = new OBJLoader().parse(geometry);
  const bounds = new T.Box3().setFromObject(body);
  const centre = bounds.getCenter(new T.Vector3());
  const size = bounds.getSize(new T.Vector3());
  const scale = 2.2 / Math.max(size.x, size.y, size.z);
  body.traverse(node => {
    if (!node.isMesh) return;
    node.geometry.translate(-centre.x, -centre.y, -centre.z);
    node.geometry.scale(scale, scale, scale);
    if (!node.geometry.getAttribute('normal')) node.geometry.computeVertexNormals();
    node.material = new T.MeshStandardMaterial({ color: finish.casing, metalness: finish.metalness, roughness: .38 });
    node.name = 'M1 titanium pressure casing';
  });
  root.add(body);
  const armour = new T.MeshStandardMaterial({ color: finish.armour, metalness: .65, roughness: .36 });
  const steel = new T.MeshStandardMaterial({ color: '#424c53', metalness: .85, roughness: .3 });
  const hazard = new T.MeshStandardMaterial({ color: '#d9b735', metalness: .65, roughness: .35 });
  const warningPaint = new T.MeshStandardMaterial({ color: '#10130e', metalness: .2, roughness: .68 });
  warningPaint.name = 'Radiation trefoil warning paint';
  const green = new T.MeshStandardMaterial({ color: '#9acb52', emissive: '#6cac23', emissiveIntensity: 1.3, metalness: .35, roughness: .3 });
  // The source M1's pointed warhead is +Z; aft fins and the drive are -Z.
  // Octagonal armour and external canisters make the three silhouettes distinct at map scale.
  const warhead = new T.Mesh(new T.CylinderGeometry(finish.radius * .8, finish.radius, .52, 8, 1), armour);
  warhead.rotation.x = Math.PI / 2;
  warhead.position.z = .52;
  warhead.name = 'Warhead armour';
  root.add(warhead);
  const tip = new T.Mesh(new T.ConeGeometry(.035, .08, 8), steel);
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 1.06;
  tip.name = 'Warhead tip';
  root.add(tip);
  for (let band = 0; band < level; band++) {
    const z = .34 + band * .15;
    const collar = new T.Mesh(new T.TorusGeometry(finish.radius + .006, .025, 4, 24), steel);
    collar.position.z = z;
    collar.name = `Pressure collar ${band + 1}`;
    root.add(collar);
    const seal = new T.Mesh(new T.TorusGeometry(finish.radius + .008, .013, 4, 24), green);
    seal.position.z = z + .035;
    seal.name = `Contained isotope seal ${band + 1}`;
    root.add(seal);
  }
  for (const z of [-.58, .78]) {
    const band = new T.Mesh(new T.TorusGeometry(z < 0 ? .16 : finish.radius * .82, .023, 4, 24), hazard);
    band.position.z = z;
    band.name = 'Hazard service band';
    root.add(band);
    for (let stripe = 0; stripe < 8; stripe++) {
      const warning = new T.Mesh(new T.TorusGeometry((z < 0 ? .16 : finish.radius * .82) + .001, .024, 4, 4, Math.PI / 8), warningPaint);
      warning.rotation.z = stripe * Math.PI / 4;
      warning.position.z = z;
      root.add(warning);
    }
  }
  // Geometry decals stay embedded in GLB: four visible casing faces, no texture
  // fetches, all black markings merged into one draw alongside the safety bands.
  body.updateWorldMatrix(true, true);
  const trefoil = [];
  for (let blade = 0; blade < 3; blade++) {
    const start = blade * Math.PI * 2 / 3 + Math.PI / 6;
    const end = start + Math.PI / 3;
    const shape = new T.Shape();
    shape.moveTo(Math.cos(start) * .039, Math.sin(start) * .039);
    shape.lineTo(Math.cos(start) * .107, Math.sin(start) * .107);
    shape.absarc(0, 0, .107, start, end, false);
    shape.lineTo(Math.cos(end) * .039, Math.sin(end) * .039);
    shape.absarc(0, 0, .039, end, start, true);
    shape.closePath();
    trefoil.push(new T.ShapeGeometry(shape, 8));
  }
  trefoil.push(new T.CircleGeometry(.023, 16));
  const marking = mergeGeometries(trefoil.map(part => part.index ? part.toNonIndexed() : part));
  if (!marking) throw new Error('Cannot author radioactive trefoil');
  for (let face = 0; face < 4; face++) {
    const angle = face * Math.PI / 2;
    const outward = new T.Vector3(Math.cos(angle), Math.sin(angle), 0);
    const from = outward.clone().multiplyScalar(2).setZ(-.1);
    const [hit] = new T.Raycaster(from, outward.clone().negate()).intersectObject(body, true);
    if (!hit?.face) throw new Error('Missing M1 casing face for radiation marking');
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const rotation = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), normal);
    const plaque = new T.Mesh(new T.CircleGeometry(.135, 6), hazard);
    plaque.position.copy(hit.point).addScaledVector(normal, .003);
    plaque.quaternion.copy(rotation);
    root.add(plaque);
    const emblem = new T.Mesh(marking.clone(), warningPaint);
    emblem.position.copy(hit.point).addScaledVector(normal, .004);
    emblem.quaternion.copy(rotation);
    root.add(emblem);
  }
  if (level > 1) for (let i = 0; i < level; i++) {
    const angle = i * Math.PI * 2 / level;
    const pod = new T.Mesh(new T.CylinderGeometry(.052, .052, .55, 8), steel);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(Math.cos(angle) * finish.radius, Math.sin(angle) * finish.radius, .49);
    pod.name = `External isotope canister ${i + 1}`;
    root.add(pod);
    const cap = new T.Mesh(new T.SphereGeometry(.054, 8, 4), green);
    cap.position.copy(pod.position); cap.position.z = .79;
    cap.name = `Isotope canister cap ${i + 1}`;
    root.add(cap);
  }
  const nozzle = new T.Mesh(new T.CylinderGeometry(.11, .14, .12, 16, 1, true), steel);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = -.98;
  nozzle.name = 'Aft engine bell';
  root.add(nozzle);
  const drive = new T.Mesh(new T.CylinderGeometry(.095, .095, .015, 16), green);
  drive.rotation.x = Math.PI / 2;
  drive.position.z = -1.04;
  drive.name = 'Isotope drive throat';
  root.add(drive);
  root.userData = { product: 'RADIATION_BOMB', level, source: 'Owner-selected M1', hazardMark: 'radiation-trefoil', nose: [0, 0, 1],
    engine: [0, 0, -1.04], finish: finish.armour };
  // Preserve the reviewed nose/drive/warhead witnesses, batch all repeated fittings by material.
  const fittings = new Map();
  root.updateWorldMatrix(true, true);
  for (const part of [...root.children]) {
    if (!part.isMesh || [warhead, tip, drive].includes(part)) continue;
    const bucket = fittings.get(part.material) ?? [];
    bucket.push(part.geometry.clone().applyMatrix4(part.matrixWorld));
    fittings.set(part.material, bucket);
    root.remove(part);
  }
  for (const [material, geometries] of fittings) {
    const allIndexed = geometries.every(part => part.index !== null);
    const combined = mergeGeometries(allIndexed ? geometries : geometries.map(part => part.index ? part.toNonIndexed() : part));
    if (!combined) throw new Error('Cannot merge isotope fittings');
    const mesh = new T.Mesh(combined, material);
    mesh.name = 'Batched pressure fittings';
    root.add(mesh);
  }
  const bytes = Buffer.from(await new GLTFExporter().parseAsync(root, { binary: true }));
  const name = `radiation-bomb-l${level}.glb`;
  await writeFile(resolve(sourceDirectory, name), bytes);
  await writeFile(resolve(servedDirectory, name), bytes);
  records.push({ level, model: `/assets/models/missiles/${name}`, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex') });
}

const textures = [
  ['extract/com.crescentmoongames.subdivision/assets/data/textures/vfx_atlas/weapons/plasma_beam_hit_green.webp', 'radiation-impact-green.webp'],
  ['extract/com.crescentmoongames.subdivision/exported/textures/vfx/fog/large_smoke.png', 'radiation-smoke.png'],
];
for (const [source, name] of textures) {
  const destination = resolve('apps/web/public/assets/fx', name);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(refs, source), destination);
}
await writeFile(resolve(sourceDirectory, 'radiation-bomb-provenance.json'), `${JSON.stringify({
  selectedGeometry: 'Space Commander / Missile_0002_high-2-1.obj (M1)',
  sourceSha256: createHash('sha256').update(geometry).digest('hex'),
  ownerSelection: 'M1; E3 green plasma impact + A1 large smoke; 15 October 2026',
  authoring: 'M1 nose +Z; distinct olive/teal/ochre armour, increasing warhead diameter, counted pressure collars, external isotope canisters, aft drive throat, casing-mounted radiation trefoils on four faces and black/yellow safety bands; warning paint batched; archive files unchanged',
  records,
}, null, 2)}\n`);
console.log(JSON.stringify(records, null, 2));
