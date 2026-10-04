import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { MonumentModel, MONUMENT_MODELS } from '../../galaxy/MonumentModel.js';
import { orientedCraft } from '../../galaxy/model.js';
import { TRADE_SHIP_SCALE } from '../../galaxy/TradeShip.js';
import { MODEL, MODEL_FACING } from '../../ui/assets.js';
import { monumentName } from '../../i18n/names.js';

function ComparisonShip() {
  const { scene } = useGLTF(MODEL.tradeShip, false);
  const model = useMemo(() => {
    const normalized = orientedCraft(scene, MODEL_FACING[MODEL.tradeShip] ?? '+z');
    normalized.scale.multiplyScalar(TRADE_SHIP_SCALE);
    return normalized;
  }, [scene]);
  return <primitive object={model} name="monument-reference-ship" position={[5.4, 0, 0]} dispose={null} />;
}

function Camera() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  useEffect(() => {
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = Math.min(size.width / 18, size.height / 13);
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height]);
  return <OrbitControls makeDefault target={[0, 0, 0]} />;
}

function Ready({ ordinal }: { ordinal: number }) {
  const frames = useRef(0);
  useEffect(() => { document.body.dataset.monumentReady = 'false'; }, [ordinal]);
  useFrame(({ scene }) => {
    if (frames.current >= 2) return;
    const model = scene.getObjectByName(`monument-model-${ordinal}`);
    const ship = scene.getObjectByName('monument-reference-ship');
    if (!model || !ship) return;
    const modelSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const shipSize = new THREE.Box3().setFromObject(ship).getSize(new THREE.Vector3());
    const triangleCount = (root: THREE.Object3D | undefined): number => {
      if (!root) return 0;
      let count = 0;
      root.traverse((node) => {
        if (node instanceof THREE.Mesh && node.geometry instanceof THREE.BufferGeometry) {
          const position: unknown = node.geometry.getAttribute('position');
          if (node.geometry.index) count += node.geometry.index.count / 3;
          else if (position instanceof THREE.BufferAttribute || position instanceof THREE.InterleavedBufferAttribute) count += position.count / 3;
        }
      });
      return count;
    };
    const outline = model.getObjectByName('craft-silhouette-rim');
    const triangles = triangleCount(model) - triangleCount(outline);
    const outlineTriangles = triangleCount(outline);
    if (Math.max(modelSize.x, modelSize.y, modelSize.z) <= 0 || triangles <= 0) return;
    frames.current += 1;
    if (frames.current !== 2) return;
    Object.assign(document.body.dataset, {
      monumentOrdinal: String(ordinal),
      monumentSize: String(Math.max(modelSize.x, modelSize.y, modelSize.z)),
      monumentReferenceSize: String(Math.max(shipSize.x, shipSize.y, shipSize.z)),
      monumentTriangles: String(triangles),
      monumentOutlineTriangles: String(outlineTriangles),
      monumentReady: 'true',
    });
  });
  return null;
}

/** Development model review: the actual runtime body beside the trade-ship size anchor. */
export function MonumentModelsGallery() {
  const [ordinal, setOrdinal] = useState(1);
  const colours = useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    return { background: styles.getPropertyValue('--color-v2-void').trim(), light: styles.getPropertyValue('--color-v2-crystal').trim() };
  }, []);
  return (
    <main className="min-h-dvh bg-v2-void text-v2-ink">
      <header className="space-y-2 p-3">
        <h1 className="text-title">Monuments</h1>
        <p className="text-caption text-v2-ink-2">Monument: 3× trade ship · Drag to inspect the silhouette.</p>
        <div className="flex flex-wrap gap-1" aria-label="Choose monument">
          {MONUMENT_MODELS.map((url, index) => (
            <button
              type="button" key={url} aria-pressed={ordinal === index + 1}
              onClick={() => { setOrdinal(index + 1); }}
              className="rounded-control border border-v2-ink-3 px-2 py-1 text-caption aria-pressed:bg-v2-ink aria-pressed:text-v2-void"
            >{monumentName(index + 1)}</button>
          ))}
        </div>
      </header>
      <div className="h-[min(70vh,580px)]" data-monument-view="">
        <Canvas orthographic camera={{ position: [0, 7, 20], near: 0.1, far: 100 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
          <color attach="background" args={[colours.background]} />
          <ambientLight intensity={1.3} />
          <directionalLight position={[-5, 8, 6]} intensity={2.8} />
          <directionalLight position={[7, 0, -5]} intensity={1.2} color={colours.light} />
          <Camera />
          <Suspense fallback={null}>
            <group key={ordinal}>
              <group position={[-1.5, 0, 0]}><MonumentModel ordinal={ordinal} /></group>
              <ComparisonShip />
              <Ready ordinal={ordinal} />
            </group>
          </Suspense>
        </Canvas>
      </div>
      <p className="px-3 text-caption text-v2-ink-2">{monumentName(ordinal)} · trade ship reference</p>
    </main>
  );
}
