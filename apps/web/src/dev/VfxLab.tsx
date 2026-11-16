import { Suspense, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/index.js';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { galaxySchema } from '../api/schemas.js';
import { planetNodes } from '../galaxy/scene.js';
import { StrategicBlast } from '../galaxy/StrategicBlast.js';
import { resetClock, serverNow } from '../lib/clock.js';
import { NukeBlast } from '../galaxy/NukeBlast.js';
import { PLANET_SKIN_BODY_SCALE } from '../galaxy/planetSkinAttachments.js';
import { EmpStorm } from '../galaxy/EmpStorm.js';
import { AegisRaid } from './lab/AegisRaid.js';
import { EngineLab } from './lab/ThrusterLab.js';
import { FleetWarp } from './lab/FleetWarp.js';
import { MiningDig } from './lab/MiningDig.js';
import { ScanReveal } from './lab/ScanReveal.js';
import { DamageFx } from './lab/DamageFx.js';
import { GameVessel } from './lab/GameVessel.js';
import { GameScan } from './lab/GameScan.js';
import { GameLevelUp } from './lab/GameLevelUp.js';
import { LAB_MOMENTS, labVariant, type LabMoment } from './lab/moments.js';
import { SensorRings } from '../galaxy/SensorRings.js';
import { VIEW } from '@astera/rules';
import { Shields } from '../galaxy/Satellites.js';
import { PlanetEmbers } from '../galaxy/PlanetEmbers.js';
import { addPlanetImpact } from '../galaxy/planetImpactMaterial.js';
import { labClock } from './lab/clock.js';

/** Playwright stills: `__labFreeze(seconds)` holds every prototype at that age; `null` lets it run. */
Object.assign(window, { __labFreeze: (seconds: number | null) => { labClock.frozen = seconds; } });
import '../styles.css';

/*
  THE VFX LAB (2026-11-12). Dev-only, served like v2-gallery.html and omitted from the production
  entry: each moment of the game played on a real world model with the galaxy's light, today's
  effect beside the prototypes, so the owner judges them in the scene rather than on black.
  ?fx=deathstar&v=now|nuke&cam=near|far — the moment replays every ten seconds.
*/

const MOMENTS = LAB_MOMENTS;
type Moment = LabMoment;
const LOOP_MS = 10_000;

const query = new URLSearchParams(location.search);
// The game's words (the Core's "Kademe N") in the language asked for, Turkish by default.
void i18n.changeLanguage(query.get('lng') ?? 'tr');
const pick = <T extends string>(list: readonly T[], value: string | null, fallback: T): T => list.find((item) => item === value) ?? fallback;

const node = planetNodes([galaxySchema.shape.planets.element.parse({ id: 'lab-world', isSelf: false,
  position: { x: 0, y: 0, z: 0 }, coreTier: 4, coreLevel: 12, name: 'Asterion', owner: 'Lab',
  satellites: [], shielded: false, intel: 'RESOLVED', state: { kind: 'NORMAL' } })])[0]!;
const R = node.radius;
/** The same world in its EMP hour, for today's ember. */
const struck = planetNodes([galaxySchema.shape.planets.element.parse({ id: 'lab-world', isSelf: false,
  position: { x: 0, y: 0, z: 0 }, coreTier: 4, coreLevel: 12, name: 'Asterion', owner: 'Lab', satellites: [], shielded: false,
  intel: 'RESOLVED', state: { kind: 'EMP', until: new Date(Date.now() + 3_600_000), hits: 2 } })]);
const impactTime = { value: 0 };
/** The same world behind an Aegis, seen as a stranger sees it (D15: one uniform dome). */
const guarded = planetNodes([galaxySchema.shape.planets.element.parse({ id: 'lab-world', isSelf: false,
  position: { x: 0, y: 0, z: 0 }, coreTier: 4, coreLevel: 12, name: 'Asterion', owner: 'Lab', satellites: [], shielded: true,
  intel: 'RESOLVED', state: { kind: 'NORMAL' } })]);
/** Forty-eight domes heaped in front of the camera, for timing the dome program on a phone. */
const crowd = planetNodes(Array.from({ length: Number(query.get('n') ?? 48) }, (_, i) => galaxySchema.shape.planets.element.parse({ id: `crowd-${String(i)}`, isSelf: false,
  position: { x: ((i % 8) - 3.5) * 0.9 * R * VIEW.scale, y: ((Math.floor(i / 8) % 6) - 2.5) * 0.9 * R * VIEW.scale / VIEW.verticalExaggeration, z: (((i * 37) % 11 - 5) * 0.2 + Math.floor(i / 48) * 0.05) * R * VIEW.scale }, coreTier: 4, coreLevel: 12,
  name: 'Crowd', owner: 'Lab', satellites: [], shielded: true, intel: 'RESOLVED', state: { kind: 'NORMAL' } })));
const CAMERA = { close: [R * 1.1, R * 0.7, R * 3.0], near: [R * 2.1, R * 1.3, R * 5.8], far: [R * 9, R * 7, R * 34] } as const;
const PLANET = `/assets/models/planets/defaults/planet_${String(Number(query.get('planet') ?? 3))}.glb`;
const LOOP = query.get('loop') !== '0';

const DIAG = query.get('diag') !== null;
/** `?diag`: frames drawn per second, written straight into the page for a phone screenshot (no DevTools attached). */
function FrameMeter() {
  const count = useMemo(() => ({ frames: 0, since: performance.now() }), []);
  useFrame(() => {
    count.frames += 1;
    const now = performance.now();
    if (now - count.since < 2000) return;
    const meter = document.getElementById('lab-fps');
    if (meter) meter.textContent = `${(count.frames * 1000 / (now - count.since)).toFixed(1)} fps`;
    count.frames = 0; count.since = now;
  });
  return null;
}

function World({ impact = 0 }: { impact?: number }) {
  const { scene } = useGLTF(PLANET);
  useFrame(({ clock }) => { impactTime.value = clock.elapsedTime; });
  const body = useMemo(() => {
    const clone = scene.clone(true);
    // Today's EMP fissures, through the game's own material patch.
    if (impact > 0) clone.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      const source: unknown = part.material;
      if (!(source instanceof THREE.MeshStandardMaterial)) return;
      const own = source.clone();
      part.material = own;
      addPlanetImpact(own, impact, impactTime);
    });
    const box = new THREE.Box3().setFromObject(clone);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const group = new THREE.Group(); group.add(clone); clone.position.sub(centre);
    group.scale.setScalar(R * 2 / Math.max(size.x, size.y, size.z));
    return group;
  }, [scene, impact]);
  return <primitive object={body} />;
}

function Stars() {
  const geometry = useMemo(() => {
    let seed = 7;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const points = new Float32Array(2400 * 3);
    for (let i = 0; i < 2400; i++) {
      const z = random() * 2 - 1, a = random() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      points.set([Math.cos(a) * s * R * 400, z * R * 400, Math.sin(a) * s * R * 400], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(points, 3)); return g;
  }, []);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  return <points geometry={geometry}><pointsMaterial size={1.4} sizeAttenuation={false} color="#c9d6ea" /></points>;
}

/** Holds the game's server clock at the frozen age too, so today's effects stop on the same second. */
function ClockDriver({ at }: { at: number }) {
  useFrame(() => { if (labClock.frozen !== null) resetClock(at + labClock.frozen * 1000 - Date.now()); }, -1);
  return null;
}

function Lab() {
  const [moment, setMoment] = useState<Moment>(pick(Object.keys(MOMENTS) as Moment[], query.get('fx'), 'deathstar'));
  const variants = Object.keys(MOMENTS[moment].variants);
  const [variant, setVariant] = useState(() => labVariant(moment, query.get('v')));
  const [cam, setCam] = useState(pick(['close', 'near', 'far'] as const, query.get('cam'), 'near'));
  const [start, setStart] = useState(() => Date.now() + 600);
  const [born] = useState(() => Date.now());
  const clock = MOMENTS[moment].continuous ? born : start;
  /** The storm reads the server clock, as in the galaxy. */
  const stormSince = useMemo(() => serverNow() + (clock - Date.now()), [clock]);
  useEffect(() => { if (!LOOP) return undefined; const id = setInterval(() => { setStart(Date.now() + 300); }, LOOP_MS); return () => { clearInterval(id); }; }, []);
  useEffect(() => {
    history.replaceState(null, '', `?fx=${moment}&v=${variant}&cam=${cam}${LOOP ? '' : '&loop=0'}&planet=${query.get('planet') ?? '3'}`);
    setStart(Date.now() + 300);
  }, [moment, variant, cam]);
  const event = useMemo(() => ({ id: `lab-${String(start)}`, at: serverNow() + (start - Date.now()), position: [0, 0, 0] as [number, number, number], radius: R, intensity: 1 }), [start]);

  const chip = (on: boolean) => `rounded-pill border px-3 py-1 text-caption ${on ? '' : 'border-white/20 text-white/70'}`;
  const tone = (on: boolean) => (on ? { color: '#2ee6c8', borderColor: '#2ee6c8' } : undefined);
  return (
    <main style={{ position: 'fixed', inset: 0, background: '#03060b', color: '#e8edf5' }}>
      <Canvas key={`${cam}-${moment}`} data-lab-canvas="" camera={{ position: moment === 'engines' ? [R * 0.5, R * 1.1, R * 8] : moment === 'mining' ? [R * 1.0, R * 0.5, R * 1.9] : moment === 'damage' ? [R * 1.5, R * 0.95, R * 1.9] : moment === 'warp' ? (cam === 'far' ? [R * 5.9, R * 4.2, R * 14.0] : [R * 3.9, R * 1.7, R * 5.7]) : [...CAMERA[cam]], fov: 40, near: R * 0.05, far: R * 2000 }} gl={{ antialias: true }}>
        <color attach="background" args={['#03060b']} />
        <ambientLight intensity={0.18} />
        <directionalLight position={[-R * 6, R * 3, R * 4]} intensity={2.6} color="#fff4e6" />
        <directionalLight position={[R * 5, -R, -R * 3]} intensity={0.35} color="#7f9bc4" />
        <Stars />
        <ClockDriver at={event.at} />
        <Suspense fallback={null}>
          {moment !== 'engines' && moment !== 'mining' && moment !== 'damage' && moment !== 'levelup' && <World impact={moment === 'emp' ? 2 : 0} />}
          {moment === 'levelup' && <GameLevelUp key={`${variant}-${String(start)}`} world={node} start={start} tier={variant === 'tier'}><World /></GameLevelUp>}
          {moment === 'engines' && <group scale={R * 1.1}><EngineLab start={clock} variant={variant === 'now' ? 'now' : 'lab'} /></group>}
          {moment === 'emp' && <PlanetEmbers nodes={struck} />}
          {moment === 'emp' && variant === 'storm' && <EmpStorm position={node.position} radius={R} since={stormSince} until={stormSince + 3_600_000} />}
          {moment === 'warp' && <FleetWarp key={`${variant}-${String(start)}`} start={start} radius={R} mode={variant === 'arrive' ? 'arrive' : variant === 'jump' ? 'jump' : 'depart'} />}
          {moment === 'mining' && <MiningDig key={`${variant}-${String(start)}`} start={start} radius={R} dig={variant === 'dig'} />}
          {moment === 'scan' && variant === 'now' && <SensorRings posts={[{ planetId: 'lab-world', at: { x: 0, y: 0, z: 0 }, identify: R * 4 * VIEW.scale, detect: R * 7 * VIEW.scale, telescope: true }]} showTelescope showRadar />}
          {moment === 'scan' && variant === 'reveal' && <ScanReveal key={start} start={start} radius={R} />}
          {moment === 'scan' && (variant === 'game' || variant === 'probe') && <GameScan key={variant} world={node} start={start} probe={variant === 'probe'} />}
          {moment === 'damage' && variant === 'burn' && <DamageFx key={variant} start={clock} radius={R} burning />}
          {moment === 'damage' && variant !== 'burn' && <GameVessel key={variant} radius={R} repair={variant === 'repair'} />}
          {moment === 'aegis' && <Shields nodes={variant === 'crowd' ? crowd : guarded} ownLevel={0} ownId={undefined} />}
          {moment === 'aegis' && variant === 'raid' && <AegisRaid start={clock} />}
          {moment === 'deathstar' && variant === 'now' && <StrategicBlast key={event.id} event={event} />}
          {/* The game's own strike; the lab world is drawn at R, the game's at its radius × the body scale. */}
          {moment === 'deathstar' && variant === 'nuke' && <NukeBlast key={event.id} event={{ ...event, radius: R / PLANET_SKIN_BODY_SCALE }} />}
        </Suspense>
        <OrbitControls enablePan={false} minDistance={R * 1.6} maxDistance={R * 60} target={moment === 'warp' ? [R * 2.86, R * 0.42, R * 1.52] : moment === 'mining' ? [R * 0.45, R * 0.1, R * 0.15] : [0, 0, 0]} />
        {DIAG && <FrameMeter />}
      </Canvas>
      {DIAG && <div id="lab-fps" style={{ position: 'fixed', left: 8, bottom: 8, color: '#5f5', font: '28px monospace', background: '#000', padding: 4, zIndex: 20 }}>…</div>}
      <header data-lab-ui="" style={{ position: 'absolute', left: 12, right: 12, top: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <b style={{ fontFamily: 'Saira Condensed, sans-serif', fontSize: 18, marginRight: 8 }}>{MOMENTS[moment].title}</b>
        {(Object.keys(MOMENTS) as Moment[]).length > 1 && (Object.keys(MOMENTS) as Moment[]).map((m) => <button key={m} type="button" className={chip(m === moment)} style={tone(m === moment)} onClick={() => { setMoment(m); setVariant(labVariant(m, null)); }}>{MOMENTS[m].title}</button>)}
        {variants.map((v) => <button key={v} type="button" className={chip(v === variant)} style={tone(v === variant)} onClick={() => { setVariant(v); }}>{(MOMENTS[moment].variants as Record<string, string>)[v]}</button>)}
        <button type="button" className={chip(cam !== 'near')} style={tone(cam !== 'near')} onClick={() => { setCam(cam === 'close' ? 'near' : cam === 'near' ? 'far' : 'close'); }}>{cam === 'close' ? 'Yakın plan' : cam === 'near' ? 'Odak' : 'Uzak'}</button>
        <button type="button" className={chip(false)} style={tone(false)} onClick={() => { setStart(Date.now() + 300); }}>↻</button>
      </header>
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<I18nextProvider i18n={i18n}><Lab /></I18nextProvider>);
