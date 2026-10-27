import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EngineFlameBatch, ENGINE_FLAME_VARIANTS, ENGINE_FLAME_RECIPES, ENGINE_FLAME_NOISE_URL } from '../vfx/engineFlames.js';
import './engine-flame-preview.css';

type View = 'side' | 'oblique' | 'rear';
interface Review {
  ready: boolean;
  renderer: THREE.WebGLRenderer;
  batch: EngineFlameBatch;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  setThrottle: (power: number) => void;
  setView: (view: View) => void;
  setTime: (seconds: number) => void;
  setCount: (count: number) => void;
  setOccluder: (visible: boolean) => void;
  render: () => void;
}
declare global { interface Window { __engineFlameReview?: Review } }

const canvas = document.querySelector('canvas')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#04070c');
const camera = new THREE.PerspectiveCamera(37, 1, .05, 150);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 7;
controls.maxDistance = 40;
controls.target.set(.2, 0, 0);
scene.add(new THREE.AmbientLight('#a5b8ce', 1.9));
const key = new THREE.DirectionalLight('#e1eafa', 3);
key.position.set(-3, 7, 10); scene.add(key);
const rim = new THREE.DirectionalLight('#6a8bac', 2.2);
rim.position.set(1, -4, -5); scene.add(rim);

const metal = new THREE.MeshStandardMaterial({ color: '#2e3946', metalness: .72, roughness: .36 });
const lip = new THREE.MeshStandardMaterial({ color: '#a1a9ad', metalness: .78, roughness: .3 });
const dark = new THREE.MeshStandardMaterial({ color: '#070b12', metalness: .2, roughness: .65 });
const mounts: THREE.Group[] = [];
function nozzle(index: number): THREE.Group {
  const group = new THREE.Group();
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(.13, .22, .7, 24, 1, true), metal);
  bell.rotation.x = Math.PI / 2;
  bell.position.z = .35;
  group.add(bell);
  const throat = new THREE.Mesh(new THREE.CircleGeometry(.18, 24), dark);
  throat.rotation.y = Math.PI;
  throat.position.z = .005;
  group.add(throat);
  for (const [z, radius] of [[.01, .22], [.12, .205], [.62, .145], [.7, .14]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .018, 6, 24), lip);
    ring.position.z = z!;
    group.add(ring);
  }
  for (let j = 0; j < 12; j++) {
    const angle = j / 12 * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(.011, .011, .55, 4), lip);
    rib.rotation.x = Math.PI / 2;
    rib.position.set(Math.cos(angle) * .17, Math.sin(angle) * .17, .38);
    group.add(rib);
  }
  // Presentation hardware is static: merge its repeated ribs and rings once.
  for (const material of [metal, lip, dark]) {
    const parts = group.children.filter((child): child is THREE.Mesh<THREE.BufferGeometry, THREE.Material> =>
      child instanceof THREE.Mesh && child.material === material);
    const geometries = parts.map(part => { part.updateMatrix(); return part.geometry.applyMatrix4(part.matrix); });
    const merged = mergeGeometries(geometries);
    for (const part of parts) { group.remove(part); part.geometry.dispose(); }
    group.add(new THREE.Mesh(merged, material));
  }
  group.scale.setScalar(index === 2 ? 1.1 : 1.4);
  group.rotation.y = -Math.PI / 2;
  group.position.set(-2.3, (1.5 - index) * (canvas.clientWidth < 700 ? 3.1 : 1.9), 0);
  scene.add(group);
  return group;
}
for (let i = 0; i < 4; i++) mounts.push(nozzle(i));

// A fixed test occluder, hidden during normal use. Its depth must cover the volume.
const occluder = new THREE.Mesh(new THREE.PlaneGeometry(7, 12), new THREE.MeshBasicMaterial({ color: '#04070c' }));
occluder.position.set(1.5, 0, 2.5); occluder.visible = false; scene.add(occluder);
const noise = await new THREE.TextureLoader().loadAsync(ENGINE_FLAME_NOISE_URL);
noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
noise.colorSpace = THREE.NoColorSpace;
noise.generateMipmaps = true;
noise.minFilter = THREE.LinearMipmapLinearFilter;
const mobile = new URLSearchParams(location.search).get('quality') === 'mobile';
const batch = new EngineFlameBatch(noise, { capacity: 128, quality: mobile ? 'mobile' : 'standard' });
scene.add(batch.mesh);
let power = 1, count = 4, paused = false, time = 0;
const matrix = new THREE.Matrix4();
const orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
const position = new THREE.Vector3();
const scale = new THREE.Vector3(1, 1, 1);
function setInstances(): void {
  batch.mesh.count = 0;
  for (let i = 0; i < count; i++) {
    if (count === 4) position.copy(mounts[i]!.position);
    else position.set(-3.2 + Math.floor(i / 16) * .85, (i % 16 - 7.5) * .43, -(i % 3) * .3);
    matrix.compose(position, orientation, scale);
    batch.set(i, { variant: ENGINE_FLAME_VARIANTS[i % 4]!, matrix, length: count === 4 ? 4.6 : .72,
      nozzleRadius: count === 4 ? (i === 2 ? .22 : .28) : .028, throttle: power, seed: i * 17.13 });
  }
  for (const mount of mounts) mount.visible = count === 4;
}
setInstances();

function setView(view: View): void {
  const distance = canvas.clientWidth < 700 ? 25.5 : 12.3;
  if (view === 'side') camera.position.set(.2, 0, distance);
  else if (view === 'oblique') camera.position.set(9, 5, distance * .78);
  else camera.position.set(18, .3, .35);
  controls.target.set(.2, 0, 0);
  controls.update();
  document.querySelector('#view-label')!.textContent = `KARŞILAŞTIRMA / ${view === 'side' ? 'YAN GÖRÜNÜM' : view === 'rear' ? 'EGZOZDAN GÖRÜNÜM' : 'ÇAPRAZ GÖRÜNÜM'}`;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
}
function setThrottle(value: number): void {
  power = Math.max(0, Math.min(1, value));
  setInstances();
  document.querySelector('#power-label')!.textContent = `%${Math.round(power * 100)} İTİŞ`;
  document.querySelector('#throttle-value')!.textContent = `${Math.round(power * 100)}%`;
  document.querySelector<HTMLInputElement>('#throttle')!.value = String(Math.round(power * 100));
}
document.querySelector<HTMLInputElement>('#throttle')!.addEventListener('input', event => {
  if (event.currentTarget instanceof HTMLInputElement) setThrottle(Number(event.currentTarget.value) / 100);
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
  button.addEventListener('click', () => { setView(button.dataset.view === 'rear' ? 'rear' : button.dataset.view === 'oblique' ? 'oblique' : 'side'); });
}
document.querySelector('#pause')!.addEventListener('click', event => {
  paused = !paused;
  if (event.currentTarget instanceof HTMLButtonElement) {
    event.currentTarget.setAttribute('aria-pressed', String(paused));
    event.currentTarget.textContent = paused ? 'Oynat' : 'Durdur';
  }
});
for (const [index, id] of ENGINE_FLAME_VARIANTS.entries()) {
  const recipe = ENGINE_FLAME_RECIPES[id];
  const article = document.createElement('article');
  article.className = 'variant';
  article.style.setProperty('--accent', ['#efa14c', '#69b4fb', '#a49aef', '#e7c079'][index]!);
  const [name, family] = recipe.name.split(' / ');
  article.innerHTML = `<span class="number">0${index + 1} / ENGINE STUDY</span><h2>${name}</h2><span class="family">${family?.toUpperCase()}</span><p>${recipe.description}</p>`;
  document.querySelector('.variants')!.append(article);
}

function resize(): void {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize(); setView('side');
let previous = performance.now();
function render(): void { batch.update(time); scene.updateMatrixWorld(); renderer.render(scene, camera); }
renderer.setAnimationLoop(now => {
  if (!paused) time += Math.max(0, Math.min((now - previous) / 1000, .05));
  previous = now;
  controls.update(); render();
});
window.__engineFlameReview = { ready: true, renderer, batch, scene, camera, setThrottle, setView,
  setTime: seconds => { paused = true; time = seconds; render(); },
  setCount: value => { count = Math.max(1, Math.min(128, Math.floor(value))); setInstances(); },
  setOccluder: visible => { occluder.visible = visible; }, render };
