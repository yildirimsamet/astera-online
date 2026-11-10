import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { SHIP_CLASSES, type ShipClass } from '@astera/rules/arena';
import { galaxySchema, type PendingThread } from '../../api/schemas.js';
import { arenaCopy } from '../../arena/copy.js';
import { useShipModels } from '../../arena/hangar/shipModels.js';
import { Sky, BrightStars } from '../../galaxy/Environment.js';
import { OwnFleets } from '../../galaxy/Fleets.js';
import HomewardShipModel from '../../galaxy/HomewardShip.js';
import ParkedShipModel, { ShipBody } from '../../galaxy/ParkedShip.js';
import { PlanetField } from '../../galaxy/PlanetField.js';
import { SCENE_LIGHT } from '../../galaxy/planetSurface.js';
import { planetNodes, CRAFT_SCALE } from '../../galaxy/scene.js';
import { ESCORT_LENGTH, FLEET_CRAFT } from '../../galaxy/flightVisual.js';
import { SpaceLighting } from '../../galaxy/SpaceLighting.js';

type Mode = 'detail' | 'park' | 'fleet' | 'homeward';
const MODES: readonly [Mode, string][] = [['detail', 'Yakın inceleme'], ['park', 'Gezegen yanında'], ['fleet', 'Filo ile'], ['homeward', 'Eve dönüş']];
const nodes = planetNodes(galaxySchema.parse({ you: { planetId: 'preview-home', playerId: 'preview-owner', planetIds: ['preview-home'] }, sensors: [],
  planets: [{ id: 'preview-home', name: 'Ana gezegen', owner: 'Sen', position: { x: 60, y: 0, z: 0 }, kind: 'CAPITAL', intel: 'RESOLVED',
    isSelf: true, isOwned: true, coreLevel: 11, controller: { kind: 'PLAYER', playerId: 'preview-owner', displayName: 'Sen' }, state: { kind: 'NORMAL' } }] }).planets);

/** Write-free inspection of the actual galaxy hull, parked, fleet and homeward renderers. */
export function CommanderPresenceGallery() {
  const c = arenaCopy();
  const [ship, setShip] = useState<ShipClass>('muhafiz'); const [mode, setMode] = useState<Mode>('detail');
  const [lit, setLit] = useState(true); const [ready, setReady] = useState(false);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const onReady = useCallback(() => { setReady(true); }, []);
  const camera = useMemo<[number, number, number]>(() => window.innerWidth < 600 ? [4.4, 3.2, -6.5] : [3.2, 2.4, -4.8], []);
  const zoom = (factor: number): void => {
    const orbit = controls.current; if (!orbit) return;
    orbit.object.position.sub(orbit.target).multiplyScalar(factor).add(orbit.target); orbit.update();
  };
  const resetCamera = (next: Mode = mode): void => {
    const orbit = controls.current;
    if (orbit) { orbit.target.set(0, 0, 0); orbit.object.position.set(...camera).multiplyScalar(next === 'fleet' ? 1.6 : 1); orbit.update(); }
  };
  const changeMode = (next: Mode): void => {
    if (next === mode) return;
    setMode(next); setReady(false); resetCamera(next);
  };
  // Scene colours come from the theme tokens, like the monument gallery.
  const colours = useMemo(() => {
    const styles = getComputedStyle(document.documentElement);
    return { background: styles.getPropertyValue('--color-v2-void').trim(), rim: styles.getPropertyValue('--color-v2-crystal').trim() };
  }, []);
  const button = 'rounded-control border border-v2-line bg-v2-panel/90 px-3 py-2 text-caption text-v2-ink-2 aria-pressed:border-v2-self/70 aria-pressed:bg-v2-self/10 aria-pressed:text-v2-self';
  return <main className="relative h-dvh overflow-hidden bg-v2-void text-v2-ink" data-commander-presence>
    <Canvas camera={{ position: camera, fov: 38, near: 0.02, far: 1500 }} dpr={[1, 1.5]}>
      <color attach="background" args={[colours.background]} />
      <ambientLight intensity={SCENE_LIGHT.ambient} />
      <directionalLight position={[-8, 12, 9]} intensity={SCENE_LIGHT.key} />
      <directionalLight position={[10, -3, -12]} intensity={0.48} color={colours.rim} />
      <SpaceLighting />
      <Suspense fallback={null}><Sky /><BrightStars />
        <Preview ship={ship} mode={mode} lit={lit} onReady={onReady} />
      </Suspense>
      <OrbitControls ref={controls} target={[0, 0, 0]} minDistance={0.6} maxDistance={40} enableDamping dampingFactor={0.08} />
    </Canvas>
    <section className="absolute left-3 top-3 max-w-[calc(100%-1.5rem)] space-y-2 rounded-plate border border-v2-line bg-v2-void/92 p-3">
      <h1 className="text-title font-semibold">Komutan Gemisi · galaksi görünümü</h1>
      <div className="flex flex-wrap gap-1" aria-label="Gemi sınıfı">{SHIP_CLASSES.map(value => <button key={value} className={button} aria-pressed={ship === value}
        onClick={() => { if (value !== ship) { setShip(value); setReady(false); } }}>{c.classes[value].name}</button>)}</div>
      <div className="flex flex-wrap gap-1" aria-label="Görünüm">{MODES.map(([value, label]) => <button key={value} className={button} aria-pressed={mode === value}
        onClick={() => { changeMode(value); }}>{label}</button>)}</div>
      {(mode === 'detail' || mode === 'park') && <button className={button} aria-pressed={lit} onClick={() => { setLit(value => !value); }}>{lit ? 'Motor açık' : 'Motor kapalı'}</button>}
      <p className="text-micro text-v2-ink-3">Sol tuşla döndür · Tekerlekle yakınlaştır · Sağ tuşla kaydır</p>
      <p className="text-micro text-v2-ink-3">Telefonda tek parmakla döndür, iki parmakla yakınlaştır.</p>
      {!ready && <p className="text-caption text-v2-self" role="status">Model hazırlanıyor…</p>}
    </section>
    <nav className="absolute bottom-5 right-3 flex gap-2" aria-label="Kamera">
      <button className={button} aria-label="Yakınlaştır" onClick={() => { zoom(0.8); }}>＋</button>
      <button className={button} aria-label="Uzaklaştır" onClick={() => { zoom(1.25); }}>−</button>
      <button className={button} onClick={() => { resetCamera(); }}>Kamerayı sıfırla</button>
    </nav>
  </main>;
}

function Preview({ ship, mode, lit, onReady }: { ship: ShipClass; mode: Mode; lit: boolean; onReady: () => void }) {
  const model = useShipModels(true, true)?.[ship];
  const [epoch] = useState(Date.now);
  const path = useMemo(() => ({ from: { x: -50, y: 0, z: 0 }, to: { x: 50, y: 0, z: 0 }, departAt: new Date(epoch - 1800000), arriveAt: new Date(epoch + 1800000) }), [epoch]);
  const pending = useMemo<PendingThread[]>(() => [{ id: 'preview-flight', kind: 'fleet', leg: 'return', targetName: 'Ana gezegen', minutesRemaining: 30,
    arriveAt: path.arriveAt, fleet: { CITADEL: 1, DART: 3 }, admiral: { ship, level: 3 }, path }], [ship, path]);
  if (!model) return null;
  return <>
    {mode === 'detail' && <group name="commander-detail" scale={ESCORT_LENGTH * FLEET_CRAFT * CRAFT_SCALE}><ShipBody model={model} lit={lit} /></group>}
    {mode === 'park' && <><PlanetField nodes={nodes} selectedId={null} rivals={[]} onSelect={() => undefined} />
      <ParkedShipModel park={{ planetId: 'preview-home', ship, level: 3, docked: !lit, reason: !lit ? 'repair' : null, until: null }} nodes={nodes} onSelect={() => undefined} /></>}
    {mode === 'fleet' && <OwnFleets pending={pending} nodes={[]} focusedKey={null} onSelect={() => undefined} />}
    {mode === 'homeward' && <HomewardShipModel home={{ ship, level: 3, path }} nodes={[]} onSelect={() => undefined} />}
    <Ready key={`${ship}:${mode}`} onReady={onReady} />
  </>;
}

function Ready({ onReady }: { onReady: () => void }) { useEffect(onReady, [onReady]); return null; }
