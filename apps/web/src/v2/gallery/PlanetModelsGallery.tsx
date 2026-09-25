import { Suspense, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SCENE_LIGHT, planetSurface } from '../../galaxy/planetSurface.js';
import { PLANET_ART } from '../../ui/assets.js';

/** Where the key light stands for a card: upper left and to the side, so the terminator crosses the face. */
const CARD_KEY: [number, number, number] = [-5, 2.5, 2.2];
/**
 * The disc a card's world fills: the 3D world is drawn at 0.96 of a world's radius and
 * its billboard quad is twice the radius, so a card at 0.96 matches the model exactly.
 */
const CARD_FILL = 0.96;

/** One default world, dressed as the disc dresses it (`planetSurface`), centred at unit scale. */
function useWorld(index: number): THREE.Object3D {
  const { scene } = useGLTF(`/assets/models/planets/defaults/planet_${String(index)}.glb`, false);
  return useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const material: THREE.Material | THREE.Material[] = node.material as THREE.Material | THREE.Material[];
      if (!Array.isArray(material)) node.material = planetSurface(material, true);
    });
    const sphere = new THREE.Box3().setFromObject(clone).getBoundingSphere(new THREE.Sphere());
    clone.position.sub(sphere.center);
    const holder = new THREE.Group();
    holder.add(clone);
    holder.scale.setScalar(1 / sphere.radius);
    return holder;
  }, [scene]);
}

function Grid({ index, x, y }: { index: number; x: number; y: number }) {
  const world = useWorld(index);
  return <primitive object={world} position={[x, y, 0]} scale={0.42} />;
}

/**
 * A DEV VIEW (F9): the sixteen default models beside the sixteen cards, to check a card
 * against its model. Not reachable from the game.
 */
export function PlanetModelsGallery() {
  return (
    <div className="grid h-dvh grid-rows-2 bg-v2-void">
      <Canvas orthographic camera={{ zoom: 80, position: [0, 0, 10] }}>
        <ambientLight intensity={SCENE_LIGHT.ambient} />
        <directionalLight position={CARD_KEY} intensity={SCENE_LIGHT.key} />
        <Suspense fallback={null}>
          {Array.from({ length: 16 }, (_, i) => (
            <Grid key={i} index={i + 1} x={((i % 4) - 1.5) * 1} y={(1.5 - Math.floor(i / 4)) * 1} />
          ))}
        </Suspense>
      </Canvas>
      <div className="grid grid-cols-4 place-items-center gap-1 p-2">
        {PLANET_ART.map((src, i) => (
          <figure key={src} className="flex flex-col items-center">
            <img src={src} alt="" className="size-16 object-contain" />
            <figcaption className="text-micro text-v2-ink-3">{i + 1}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

/** Marks the page ready once the world is on screen, for `tools/planet-cards.mjs` to capture. */
function Ready() {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => { document.body.dataset.cardReady = 'true'; });
    });
    return () => { cancelAnimationFrame(frame); };
  }, [invalidate]);
  return null;
}

function Card({ index }: { index: number }) {
  const world = useWorld(index);
  return (
    <>
      <primitive object={world} scale={CARD_FILL} />
      <Ready />
    </>
  );
}

/**
 * ONE WORLD'S CARD, RENDERED FROM ITS MODEL (F9 · K7, owner 2026-09-25: "kartları 3B'den
 * render et"). A transparent square, the world filling it as the billboard expects, under
 * the disc's own light. `tools/planet-cards.mjs` captures it into `images/planets/`.
 */
export function PlanetCardRender({ index, size }: { index: number; size: number }) {
  return (
    <div style={{ width: size, height: size }} data-planet-card="">
      <Canvas
        orthographic
        camera={{ left: -1, right: 1, top: 1, bottom: -1, near: 0.1, far: 20, position: [0, 0, 10] }}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
      >
        <ambientLight intensity={SCENE_LIGHT.ambient} />
        <directionalLight position={CARD_KEY} intensity={SCENE_LIGHT.key} />
        <Suspense fallback={null}>
          <Card index={index} />
        </Suspense>
      </Canvas>
    </div>
  );
}
