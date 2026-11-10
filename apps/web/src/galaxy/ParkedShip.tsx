import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { arenaCopy } from '../arena/copy.js';
import { clockText } from '../arena/hangarDesk.js';
import { useNow } from '../lib/time.js';
import { radial, shipDecoders, useGalaxyShipModels, type ShipModel } from '../arena/hangar/shipModels.js';
import { HitboxMaterial } from './hitboxDebug.js';
import { PARK, parkPose, type ParkedShip } from './parkedShip.js';
import type { PlanetNode } from './scene.js';
import { markHit, wasTap } from './tap.js';
import { useVisualFrame } from './visualFrame.js';
import { ShipAssetBoundary } from './ShipAssetBoundary.js';
import { CommanderShipLabel } from './CommanderShipLabel.js';
export { ShipAssetBoundary } from './ShipAssetBoundary.js';
import { commanderExhaustScale, createCommanderExhaust, createCommanderExhaustMaterial, createCommanderHull } from './commanderAppearance.js';

/** Past this the ship is a speck beside a dot; the satellites stop at 34 for the same reason. */
const VISIBLE_WITHIN = 40;

/**
 * The commander's own ship beside its capital (KG-A20): the Yarık's class model, lite pack, its
 * coarsest level of detail. A ready ship circles the world with its engines lit; under repair or
 * service it holds still, dark at the nozzles. A tap opens the hangar.
 */
export default function ParkedShipModel({ park, nodes, onSelect, own = true }: { park: ParkedShip; nodes: readonly PlanetNode[]; onSelect: () => void; own?: boolean }) {
  const planet = nodes.find(node => node.id === park.planetId);
  const [near, setNear] = useState(own);
  const nearRef = useRef(own);
  useVisualFrame(({ camera }) => {
    if (own || !planet) return;
    const [x, y, z] = planet.position;
    const visible = (camera.position.x - x) ** 2 + (camera.position.y - y) ** 2 + (camera.position.z - z) ** 2 < VISIBLE_WITHIN ** 2;
    if (visible !== nearRef.current) { nearRef.current = visible; setNear(visible); }
  });
  const models = useGalaxyShipModels(near);
  const model = models?.[park.ship];
  if (!near || !planet) return null;
  return <Suspense fallback={null}><Ship model={model} planet={planet} park={park} onSelect={onSelect} own={own} /></Suspense>;
}

/**
 * The class model at its coarsest level of detail, engines lit or dark. Shared by the parked ship
 * and the escort at the rear of a flying fleet (Y9).
 */
export function ShipBody({ model, lit }: { model: ShipModel | undefined; lit: boolean }) {
  if (!model) return null;
  return <ShipAssetBoundary key={model.url} onError={() => { useLoader.clear(GLTFLoader, model.url); }} fallback={null}>
    <Suspense fallback={null}><LoadedShipBody model={model} lit={lit} /></Suspense>
  </ShipAssetBoundary>;
}

function LoadedShipBody({ model, lit }: { model: ShipModel; lit: boolean }) {
  const gltf = useLoader(GLTFLoader, model.url, loader => { shipDecoders(loader, model); });
  const body = useMemo(() => createCommanderHull(gltf.scene), [gltf]);
  const glow = useMemo(() => {
    const texture = radial([[0, 'rgba(210,250,255,1)'], [0.25, 'rgba(110,220,255,.55)'], [1, 'rgba(40,120,255,0)']]);
    texture.wrapS = THREE.RepeatWrapping; return texture;
  }, []);
  useEffect(() => () => { body.dispose(); }, [body]);
  useEffect(() => () => { glow.dispose(); }, [glow]);
  return <>
    <primitive object={body.scene} />
    {lit && <CommanderDrive model={model} glow={glow} />}
  </>;
}

function CommanderDrive({ model, glow }: { model: ShipModel; glow: THREE.Texture }) {
  const root = useRef<THREE.Group>(null);
  const geometry = useMemo(createCommanderExhaust, []);
  const material = useMemo(createCommanderExhaustMaterial, []);
  const scale = useMemo(() => commanderExhaustScale(model.nozzle), [model.nozzle]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useVisualFrame(({ clock }) => {
    const time = material.uniforms.uTime;
    if (time) time.value = clock.elapsedTime;
    for (const engine of root.current?.children ?? []) {
      const plume = engine.children[1];
      if (plume) plume.scale.z = scale[2] * (1 + 0.055 * Math.sin(clock.elapsedTime * 17 + engine.position.x * 21));
    }
  });
  return <group ref={root} name="commander-drive">
    {model.engines.map((at, i) => <group key={i} position={at}>
      <sprite scale={model.nozzle * 7 * 0.75}><spriteMaterial map={glow} blending={THREE.AdditiveBlending} depthWrite={false} transparent toneMapped={false} /></sprite>
      <mesh name="commander-exhaust" scale={scale} geometry={geometry} material={material} dispose={null} />
    </group>)}
  </group>;
}

function Ship({ model, planet, park, onSelect, own }: { model: ShipModel | undefined; planet: PlanetNode; park: ParkedShip; onSelect: () => void; own: boolean }) {
  const { docked } = park;
  const root = useRef<THREE.Group>(null);
  useVisualFrame(({ camera, clock }) => {
    const group = root.current; if (!group) return;
    const [px, py, pz] = planet.position;
    const distance = Math.hypot(camera.position.x - px, camera.position.y - py, camera.position.z - pz);
    group.visible = distance < VISIBLE_WITHIN;
    if (!group.visible) return;
    const pose = parkPose(planet, clock.elapsedTime, docked);
    group.position.set(pose.x, pose.y, pose.z);
    group.rotation.set(0, pose.yaw, 0);
    group.scale.setScalar(planet.radius * PARK.length);
  });
  return <group ref={root} name="commander-ship" userData={{ docked }}>
    <ShipBody model={model} lit={!docked} />
    <CommanderShipLabel><ShipTag park={park} onSelect={onSelect} own={own} /></CommanderShipLabel>
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
export function ShipTag({ park, onSelect, own = true }: { park: ParkedShip; onSelect: () => void; own?: boolean }) {
  const c = arenaCopy();
  return <button type="button" onClick={event => { event.stopPropagation(); onSelect(); }}
    className="pointer-events-auto -translate-x-1/2 translate-y-2 whitespace-nowrap px-2 py-1.5 galaxy-ship-tag font-v2-mono text-micro uppercase tracking-label" data-part="commander-ship-tag">
    {park.docked && park.until !== null ? <DockClock reason={park.reason === 'service' ? c.servicing : c.repairing} until={park.until} />
      : <span className={own ? "text-v2-self" : "text-v2-ink-2"}>{c.classes[park.ship].name} · {c.level(park.level)}</span>}
  </button>;
}

function DockClock({ reason, until }: { reason: string; until: number }) {
  const now = useNow();
  return <span className="text-v2-warn">{reason} · {clockText(until - now)}</span>;
}
