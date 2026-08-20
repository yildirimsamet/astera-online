/**
 * SIX SIDES OF A HULL, so `MODEL_FACING` can be measured rather than guessed.
 *
 * `galaxy/model.ts` says facing is declared, not inferred, and why: a bounding box
 * cannot tell a fuselage from a wingspan, and it cannot tell a nose from a tail at
 * all. The five ships already in the game were each photographed from six sides and
 * read off their engine bells. This is the tool that did it, written down so the
 * next hull does not have to be guessed either.
 *
 *   pnpm --filter @blindspace/web dev   →   http://localhost:5173/facing.html
 *
 * Development only. `facing.html` is not linked from the app and is never built.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const MODEL = new URLSearchParams(location.search).get('model') ?? '/assets/models/drills/drill.glb';

/** Where the camera sits for each view, in the model's OWN axes. */
const VIEWS: [string, [number, number, number]][] = [
  ['+x', [1, 0, 0]],
  ['-x', [-1, 0, 0]],
  ['+z', [0, 0, 1]],
  ['-z', [0, 0, -1]],
  ['+y', [0, 1, 0]],
  ['-y', [0, -1, 0]],
];

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const gltf = await loader.loadAsync(MODEL);

/** Centre and normalise, so every view frames the same object at the same size. */
const box = new THREE.Box3().setFromObject(gltf.scene);
const size = new THREE.Vector3();
const centre = new THREE.Vector3();
box.getSize(size);
box.getCenter(centre);
const span = Math.max(size.x, size.y, size.z) || 1;

const report = document.createElement('p');
report.style.padding = '8px';
report.textContent = `${MODEL} — extent x ${size.x.toFixed(2)} · y ${size.y.toFixed(2)} · z ${size.z.toFixed(2)}`;
document.body.prepend(report);

const grid = document.getElementById('grid')!;

for (const [label, dir] of VIEWS) {
  const figure = document.createElement('figure');
  const caption = document.createElement('figcaption');
  caption.textContent = `looking at the ${label} face`;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(260, 200);
  renderer.setClearColor('#0b0f18');

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 3, 4);
  scene.add(key);

  const model = gltf.scene.clone(true);
  model.position.sub(centre);
  const wrapper = new THREE.Group();
  wrapper.add(model);
  wrapper.scale.setScalar(1 / span);
  scene.add(wrapper);

  // Orthographic, so the silhouette is the silhouette and perspective cannot
  // flatter one end of the hull over the other.
  const camera = new THREE.OrthographicCamera(-0.75, 0.75, 0.6, -0.6, 0.01, 10);
  camera.position.set(dir[0] * 3, dir[1] * 3, dir[2] * 3);
  camera.up.set(0, dir[1] === 0 ? 1 : 0, dir[1] === 0 ? 0 : 1);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);

  figure.append(renderer.domElement, caption);
  grid.append(figure);
}
