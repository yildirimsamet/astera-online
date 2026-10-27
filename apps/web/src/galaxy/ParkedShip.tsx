import { Suspense, useEffect, useMemo, useRef, type Ref } from 'react';
import { useLoader } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { arenaCopy } from '../arena/copy.js';
import { clockText } from '../arena/hangarDesk.js';
import { useNow } from '../lib/time.js';
import { radial, shipDecoders, useShipModels, type ShipModel } from '../arena/hangar/shipModels.js';
import { HitboxMaterial } from './hitboxDebug.js';
import { PARK, parkPose, type ParkedShip } from './parkedShip.js';
import type { PlanetNode } from './scene.js';
import { markHit, wasTap } from './tap.js';
import { useVisualFrame } from './visualFrame.js';

/** Past this the ship is a speck beside a dot; the satellites stop at 34 for the same reason. */
const VISIBLE_WITHIN = 40;

/**
 * The commander's own ship beside its capital (KG-A20): the Yarık's class model, lite pack, its
 * coarsest level of detail. A ready ship circles the world with its engines lit; under repair or
 * service it holds still, dark at the nozzles. A tap opens the hangar.
 */
export default function ParkedShipModel({ park, nodes, onSelect }: { park: ParkedShip; nodes: readonly PlanetNode[]; onSelect: () => void }) {
  const models = useShipModels(true, true);
  const planet = nodes.find(node => node.id === park.planetId);
  const model = models?.[park.ship];
  if (!planet || !model) return null;
  return <Suspense fallback={null}><Ship model={model} planet={planet} park={park} onSelect={onSelect} /></Suspense>;
}

/**
 * The class model at its coarsest level of detail, engines lit or dark. Shared by the parked ship
 * and the escort at the rear of a flying fleet (Y9).
 */
export function ShipBody({ model, lit }: { model: ShipModel; lit: boolean }) {
  const gltf = useLoader(GLTFLoader, model.url, loader => { shipDecoders(loader, model); });
  // A copy: the loader caches one scene per file, and the hangar may hold that one in its own canvas.
  const body = useMemo(() => {
    const copy = gltf.scene.clone(true);
    let coarsest = -1;
    copy.traverse(node => { const lod = /^lod(\d)$/.exec(node.name); if (lod) coarsest = Math.max(coarsest, Number(lod[1])); });
    if (coarsest >= 0) copy.traverse(node => { const lod = /^lod(\d)$/.exec(node.name); if (lod) node.visible = Number(lod[1]) === coarsest; });
    return copy;
  }, [gltf]);
  const glow = useMemo(() => radial([[0, 'rgba(210,250,255,1)'], [0.25, 'rgba(110,220,255,.55)'], [1, 'rgba(40,120,255,0)']]), []);
  useEffect(() => () => { glow.dispose(); }, [glow]);
  return <>
    <primitive object={body} />
    {lit && model.engines.map((at, i) => <sprite key={i} position={at} scale={model.nozzle * 7}>
      <spriteMaterial map={glow} blending={THREE.AdditiveBlending} depthWrite={false} transparent toneMapped={false} />
    </sprite>)}
  </>;
}

function Ship({ model, planet, park, onSelect }: { model: ShipModel; planet: PlanetNode; park: ParkedShip; onSelect: () => void }) {
  const { docked } = park;
  const root = useRef<THREE.Group>(null); const tag = useRef<HTMLButtonElement>(null);
  useVisualFrame(({ camera, clock }) => {
    const group = root.current; if (!group) return;
    const [px, py, pz] = planet.position;
    group.visible = (camera.position.x - px) ** 2 + (camera.position.y - py) ** 2 + (camera.position.z - pz) ** 2 < VISIBLE_WITHIN ** 2;
    if (tag.current) tag.current.style.display = group.visible ? '' : 'none';
    if (!group.visible) return;
    const pose = parkPose(planet, clock.elapsedTime, docked);
    group.position.set(pose.x, pose.y, pose.z);
    group.rotation.set(0, pose.yaw, 0);
    group.scale.setScalar(planet.radius * PARK.length);
  });
  return <group ref={root} name="commander-ship" userData={{ docked }}>
    <ShipBody model={model} lit={!docked} />
    <Html zIndexRange={[9, 9]} style={{ pointerEvents: 'none' }}><ShipTag ref={tag} park={park} onSelect={onSelect} /></Html>
    <mesh onPointerUp={event => { if (!wasTap()) return; markHit(); event.stopPropagation(); onSelect(); }}>
      <sphereGeometry args={[0.6, 8, 6]} />
      <HitboxMaterial kind="fleet" />
    </mesh>
  </group>;
}

/**
 * What the speck is, and when it flies: the class and level, or the repair clock. A button: at the
 * galaxy's usual distance the ship is a few pixels and the tag is what a thumb finds (F16).
 */
export function ShipTag({ ref, park, onSelect }: { ref?: Ref<HTMLButtonElement>; park: ParkedShip; onSelect: () => void }) {
  const c = arenaCopy();
  return <button ref={ref} type="button" onClick={event => { event.stopPropagation(); onSelect(); }}
    className="pointer-events-auto -translate-x-1/2 translate-y-2 whitespace-nowrap px-2 py-1.5 galaxy-ship-tag font-v2-mono text-micro uppercase tracking-label" data-part="commander-ship-tag">
    {park.docked && park.until !== null ? <DockClock reason={park.reason === 'service' ? c.servicing : c.repairing} until={park.until} />
      : <span className="text-v2-self">{c.classes[park.ship].name} · {c.level(park.level)}</span>}
  </button>;
}

function DockClock({ reason, until }: { reason: string; until: number }) {
  const now = useNow();
  return <span className="text-v2-warn">{reason} · {clockText(until - now)}</span>;
}
