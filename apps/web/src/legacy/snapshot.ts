/**
 * COLLECTION THUMBNAILS, drawn by the same builder as the showcase.
 *
 * A grid of forty live 3D tiles would cost forty WebGL contexts; one hidden renderer draws
 * each distinct piece once, hands back an image URL, and closes its context when the queue
 * has been idle for a few seconds. A device without WebGL simply gets no picture: the tile
 * keeps its name, its metal colour and its rarity, which carry the meaning on their own.
 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { awardStudioRoom } from './studio.js';
import { buildAward } from './awardObject.js';
import { legacyArt, legacyEditionMark, legacyFinish, legacyVisualKey } from './presentation.js';
import type { LegacyAward } from '../api/legacySchemas.js';

type Face = Pick<LegacyAward, 'definitionId' | 'tier' | 'rarity' | 'edition' | 'seasonOrdinal'>;
const SIZE = 256;
const IDLE_CLOSE_MS = 4_000;

const cache = new Map<string, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();
let studio: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; environment: THREE.Texture } | null = null;
let idle = 0;

function open() {
  if (studio) return studio;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const generator = new THREE.PMREMGenerator(renderer);
  const room = awardStudioRoom();
  const environment = generator.fromScene(room, 0.04).texture;
  generator.dispose(); room.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 0.85;
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight('#ffe2b8', 2.4);
  key.position.set(0.2, 3, 2.2);
  const fill = new THREE.DirectionalLight('#9fd8ff', 0.45);
  fill.position.set(-2, 0.6, 1.5);
  scene.add(key, fill);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 50);
  studio = { renderer, scene, camera, environment };
  return studio;
}

function scheduleClose() {
  window.clearTimeout(idle);
  idle = window.setTimeout(() => {
    if (!studio) return;
    studio.environment.dispose();
    studio.renderer.dispose();
    studio.renderer.forceContextLoss();
    studio = null;
  }, IDLE_CLOSE_MS);
}

const faceKey = legacyVisualKey;

async function draw(award: Face): Promise<string | null> {
  const art = legacyArt(award);
  if (!art) return null;
  const built = await buildAward(art, legacyFinish(award), legacyEditionMark({ ...award }));
  try {
    const { renderer, scene, camera } = open();
    // A slight three-quarter turn, the piece framed from a little above, filling the tile.
    built.object.rotation.y = built.motion === 'spin' ? -0.5 : -0.28;
    scene.add(built.object);
    const box = new THREE.Box3().setFromObject(built.object);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const distance = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.02;
    camera.position.set(sphere.center.x, sphere.center.y + distance * 0.22, sphere.center.z + distance);
    camera.lookAt(sphere.center);
    renderer.render(scene, camera);
    const blob = await new Promise<Blob | null>(resolve => { renderer.domElement.toBlob(resolve, 'image/webp', 0.9); });
    return blob ? URL.createObjectURL(blob) : null;
  } finally {
    built.dispose();
    scheduleClose();
  }
}

/** One image per distinct piece; drawn one at a time so a big collection never stalls a frame for long. */
export function awardSnapshot(award: Face): Promise<string | null> {
  const key = faceKey(award);
  let pending = cache.get(key);
  if (!pending) {
    pending = queue.then(() => draw(award)).catch(() => null);
    queue = pending;
    cache.set(key, pending);
  }
  return pending;
}

export function useAwardSnapshot(award: Face | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const definitionId = award?.definitionId, tier = award?.tier, rarity = award?.rarity;
  const edition = award?.edition, seasonOrdinal = award?.seasonOrdinal ?? null;
  useEffect(() => {
    if (definitionId === undefined || tier === undefined || rarity === undefined || edition === undefined) { setUrl(null); return; }
    let alive = true;
    void awardSnapshot({ definitionId, tier, rarity, edition, seasonOrdinal }).then(next => { if (alive) setUrl(next); });
    return () => { alive = false; };
  }, [definitionId, tier, rarity, edition, seasonOrdinal]);
  return url;
}
