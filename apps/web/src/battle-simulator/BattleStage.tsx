import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, Stars, useGLTF, useTexture } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useTranslation } from 'react-i18next';
import { HULLS, type BattleShipSnapshot, type BattleShipState, type BattleSide, type HullId } from '@astera/rules';
import { HULL_MODEL, HULL_LOD_MODEL, MODEL_FACING, MODEL_POSE, BATTLEFIELD_PLANET_MODEL } from '../ui/assets.js';
import { EXPLOSION_ATLAS } from '../galaxy/vfx.js';
import { unitPlanetGeometry } from '../galaxy/PlanetSkinModel.js';
import { SpaceLighting } from '../galaxy/SpaceLighting.js';
import { useGpuContext } from '../galaxy/gpuContext.js';
import { QUALITY_PRESETS, useRenderQuality } from '../lib/quality.js';
import { FiniteSceneGuard } from '../galaxy/FiniteSceneGuard.js';
import { guardBloomRef } from '../galaxy/finiteGuard.js';
import { battleCameraRange, battlePlanet, battlefieldEnvironment, destructionScale, fitBattleCamera, fitWorldLabel, focusBattleCamera, layoutBattle, retreatDestinations, sampleRetreatPose, shieldIntercept, type BattlePose } from './sceneLayout.js';
import { hullLabel } from '../i18n/names.js';
import { battleModelParts, isBattleMesh } from './sceneModels.js';
import { sampleReplay, type ReplayFrame, type ReplayTimeline } from './timeline.js';
import type { PlaybackClock } from './BattleReplay.js';
import { damageLabel } from './presentation.js';

interface StageProps {
  timeline: ReplayTimeline; clock: RefObject<PlaybackClock>; viewer: BattleSide;
  selected: string | null; onSelect: (id: string | null) => void; environment: 'PLANET' | 'MONUMENT';
  onReady: () => void; onSuspend: () => void; time: number; playing: boolean;
  onUnavailable?: () => void;
  cameraRequest?: CameraRequest | null;
}
export interface CameraRequest { id: number; kind: 'FIT' | 'FOCUS' | 'IN' | 'OUT'; unitId?: string }
class StageBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch() { this.props.onFailure(); }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function BattleStage(props: StageProps) {
  const [attempt, setAttempt] = useState(0);
  const retry = () => {
    // Drei caches rejected loader promises too. Retrying a failed view must retry the assets.
    for (const hull of new Set(props.timeline.recording.ships.map(ship => ship.hull))) {
      useGLTF.clear([HULL_MODEL[hull], HULL_MODEL[hull]]);
      useGLTF.clear([HULL_MODEL[hull], HULL_LOD_MODEL[hull]]);
    }
    if (props.environment === 'PLANET') useGLTF.clear(BATTLEFIELD_PLANET_MODEL);
    useTexture.clear(EXPLOSION_ATLAS);
    setAttempt(value => value + 1);
  };
  return <StageAttempt key={attempt} {...props} retry={retry} />;
}

function StageAttempt({ retry, ...props }: StageProps & { retry: () => void }) {
  const { t } = useTranslation();
  const quality = useRenderQuality(), preset = QUALITY_PRESETS[quality], gpu = useGpuContext();
  useEffect(() => { if (!gpu.live) { props.onSuspend(); props.onUnavailable?.(); } }, [gpu.live, props.onSuspend, props.onUnavailable]);
  const recovery = <div className="sim-stage-message" role="status"><p>{t(gpu.live ? 'simulator.stageFailed' : 'simulator.gpuLost')}</p>
    <button type="button" onClick={retry}>{t('simulator.reopenStage')}</button></div>;
  return <><StageBoundary key={gpu.epoch} onFailure={() => { props.onSuspend(); props.onUnavailable?.(); }} fallback={gpu.live ? recovery : null}>
    <Canvas className="sim-canvas" frameloop="demand" dpr={[1, preset.dprCap]} camera={{ position: [0, 30, -23], fov: 43, near: .1, far: 600 }}
      gl={{ antialias: false, powerPreference: 'high-performance' }} onPointerMissed={() => { props.onSelect(null); }}
      onCreated={({ gl }) => { gl.outputColorSpace = THREE.SRGBColorSpace; gl.toneMappingExposure = 1.12; gpu.watch(gl.domElement); }}>
      <color attach="background" args={['#050a14']} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[-12, 18, -8]} intensity={2.5} color="#d5e8ff" />
      <directionalLight position={[12, 6, 16]} intensity={1.4} color="#64a5e5" />
      <NebulaBackdrop />
      <SpaceLighting />
      <Stars radius={130} depth={80} count={1300} factor={3} saturation={.1} fade speed={0} />
      <PlaybackFrames clock={props.clock} time={props.time} playing={props.playing} />
      <Suspense fallback={null}><BattleWorld {...props} /></Suspense>
      {gpu.live && <EffectComposer key={`${gpu.epoch}:${quality}`} enableNormalPass={false} multisampling={preset.multisampling}>
        <FiniteSceneGuard /><Bloom ref={guardBloomRef} intensity={.65} luminanceThreshold={.9} luminanceSmoothing={.25} mipmapBlur />
        <Vignette eskil={false} offset={.28} darkness={.58} />
      </EffectComposer>}
    </Canvas>
  </StageBoundary>{!gpu.live && recovery}</>;
}

interface Runtime {
  frame: ReplayFrame;
  flashes: Map<string, { at: number; shield: boolean }>;
}
declare global {
  interface Window {
    __battleSimulator?: {
      snapshot: () => { time: number; aegis: number; ships: BattleShipState[]; drawCalls: number; triangles: number; finite: boolean; phase: string; pendingFire: string[]; activeSourceId: string | null };
      finalShips: readonly BattleShipState[];
      initialAegis: number;
    };
  }
}
function BattleWorld({ timeline, clock, viewer, selected, onSelect, environment, onReady, cameraRequest }: StageProps) {
  const { gl, scene } = useThree();
  const positions = useMemo(() => layoutBattle(timeline.recording), [timeline]);
  const destinations = useMemo(() => retreatDestinations(timeline, positions), [timeline, positions]);
  const runtime = useRef<Runtime>({ frame: sampleReplay(timeline, 0), flashes: new Map() });
  const buckets = useMemo(() => {
    const grouped = new Map<HullId, BattleShipSnapshot[]>();
    for (const ship of timeline.recording.ships) {
      const members = grouped.get(ship.hull) ?? []; members.push(ship); grouped.set(ship.hull, members);
    }
    return [...grouped];
  }, [timeline]);
  const deaths = useMemo(() => {
    const times = new Map<string, number>();
    for (const event of timeline.events) if (event.kind === 'DESTROY') times.set(event.shipId, event.at);
    return times;
  }, [timeline]);
  const retreats = useMemo(() => new Map(timeline.events.flatMap(event => event.kind === 'RETREAT' ? [[event.shipId, event.at] as const] : [])), [timeline]);
  useEffect(() => {
    if (!import.meta.env.DEV && import.meta.env.VITE_VISUAL_TEST !== '1') return;
    const bridge = {
      initialAegis: timeline.recording.initialAegis,
      finalShips: timeline.recording.finalState ?? timeline.recording.rounds.at(-1)?.after ?? timeline.recording.ships,
      snapshot: () => {
        let finite = true;
        scene.traverse(node => {
          if (node instanceof THREE.InstancedMesh) for (const value of node.instanceMatrix.array) if (!Number.isFinite(value)) finite = false;
        });
        return { time: runtime.current.frame.time, aegis: runtime.current.frame.aegis, ships: [...runtime.current.frame.ships.values()],
          phase: runtime.current.frame.phase, pendingFire: [...runtime.current.frame.pendingFire], activeSourceId: runtime.current.frame.activeShot?.shot.sourceId ?? runtime.current.frame.activeAegisStrike?.strike.sourceId ?? null,
          drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles, finite };
      },
    };
    window.__battleSimulator = bridge;
    return () => { if (window.__battleSimulator === bridge) delete window.__battleSimulator; };
  }, [timeline, gl, scene]);
  useFrame(() => {
    runtime.current.frame = sampleReplay(timeline, clock.current.time);
    runtime.current.flashes.clear();
    for (const event of timeline.events) {
      if (event.at > clock.current.time) break;
      if (event.kind === 'HIT' && clock.current.time - event.at < .22 && event.hit.shieldDamage + event.hit.hullDamage > 0) runtime.current.flashes.set(event.hit.targetId,
        { at: event.at, shield: event.hit.shieldDamage > 0 });
    }
  }, -50);
  return <>
    <StageReady onReady={onReady} />
    <BattleCamera positions={positions} destinations={destinations} timeline={timeline} clock={clock} viewer={viewer} request={cameraRequest} />
    <group rotation={[0, viewer === 'ATTACK' ? 0 : Math.PI, 0]}>
      {environment === 'PLANET' && <PlanetBackdrop positions={positions} ships={timeline.recording.ships} deaths={deaths} clock={clock} />}
      {buckets.map(([hull, members]) => <ShipBucket planet={battlePlanet(timeline.recording.ships, positions)} key={hull} hull={hull} members={members} positions={positions} runtime={runtime}
        selected={selected} viewer={viewer} onSelect={onSelect} clock={clock} deaths={deaths} retreats={retreats} destinations={destinations} />)}
      {timeline.recording.ships.map(ship => <UnitReadout key={ship.id} ship={ship} pose={positions.get(ship.id)!} runtime={runtime} deaths={deaths} selected={selected}
        viewer={viewer} destination={destinations.get(ship.id)} retreatAt={retreats.get(ship.id)} compact={timeline.recording.ships.length > 64} />)}
      <FormationLabels timeline={timeline} positions={positions} viewer={viewer} runtime={runtime} destinations={destinations} />
      <BattleEffects timeline={timeline} positions={positions} clock={clock} viewer={viewer} />
      <AegisField timeline={timeline} runtime={runtime} positions={positions} />
    </group>
  </>;
}

function StageReady({ onReady }: { onReady: () => void }) {
  const drawn = useRef(0);
  useFrame(({ invalidate }) => { if (drawn.current < 3) invalidate(); if (drawn.current++ === 2) onReady(); });
  return null;
}

function PlaybackFrames({ clock, time, playing }: { clock: RefObject<PlaybackClock>; time: number; playing: boolean }) {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => { invalidate(); }, [invalidate, time, playing]);
  useFrame(() => { if (clock.current.playing && !document.hidden) invalidate(); });
  return null;
}

function BattleCamera({ positions, destinations, timeline, clock, viewer, request }: {
  positions: ReadonlyMap<string, BattlePose>; destinations: ReadonlyMap<string, BattlePose>; timeline: ReplayTimeline;
  clock: RefObject<PlaybackClock>; viewer: BattleSide; request?: CameraRequest | null;
}) {
  const { camera, size, invalidate } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const desired = useRef<{ position: THREE.Vector3; center: THREE.Vector3 } | null>(null);
  const range = useMemo(() => battleCameraRange(new Map([...positions, ...destinations]), size.width / Math.max(1, size.height)), [positions, destinations, size.width, size.height]);
  useLayoutEffect(() => {
    const frame = fitBattleCamera(positions, viewer, size.width / Math.max(1, size.height));
    const center = new THREE.Vector3(frame.center.x, frame.center.y, frame.center.z);
    camera.position.set(frame.position.x, frame.position.y, frame.position.z);
    camera.far = range.far; camera.lookAt(center); camera.updateProjectionMatrix();
    controls.current?.target.copy(center); controls.current?.update();
  }, [camera, positions, viewer, size.width, size.height, range]);
  useEffect(() => {
    if (!request || !controls.current) return;
    const present = new Map(positions);
    for (const event of timeline.events) if (event.kind === 'RETREAT' && clock.current.time >= event.at) {
      const ship = timeline.recording.ships.find(item => item.id === event.shipId)!;
      const destination = destinations.get(ship.id);
      if (destination) present.set(ship.id, sampleRetreatPose(positions.get(ship.id)!, destination, ship.side, clock.current.time - event.at));
    }
    const unit = request.unitId ? present.get(request.unitId) : undefined;
    const ship = timeline.recording.ships.find(item => item.id === request.unitId);
    const surface = ship && (ship.ground ?? HULLS[ship.hull].ground) ? battlePlanet(timeline.recording.ships, positions) : undefined;
    const view = request.kind === 'FOCUS' && unit ? focusBattleCamera(unit, viewer, size.width / Math.max(1, size.height), surface)
      : request.kind === 'FIT' ? fitBattleCamera(present, viewer, size.width / Math.max(1, size.height)) : null;
    const center = view ? new THREE.Vector3(view.center.x, view.center.y, view.center.z) : controls.current.target.clone();
    const position = view ? new THREE.Vector3(view.position.x, view.position.y, view.position.z)
      : camera.position.clone().sub(center).multiplyScalar(request.kind === 'IN' ? .72 : 1.38).clampLength(3, range.maxDistance).add(center);
    desired.current = { position, center }; invalidate();
  }, [request, camera, clock, positions, destinations, timeline, viewer, size.width, size.height, invalidate, range]);
  useFrame((_, dt) => {
    if (!desired.current || !controls.current) return;
    camera.position.lerp(desired.current.position, 1 - Math.exp(-7 * dt));
    controls.current.target.lerp(desired.current.center, 1 - Math.exp(-7 * dt)); controls.current.update();
    if (camera.position.distanceTo(desired.current.position) < .01 && controls.current.target.distanceTo(desired.current.center) < .01) desired.current = null;
    else invalidate();
  });
  return <OrbitControls ref={controls} makeDefault enablePan enableDamping dampingFactor={.08}
    minPolarAngle={.15} maxPolarAngle={1.35} minDistance={3} maxDistance={range.maxDistance} onStart={() => { desired.current = null; }} />;
}

function FormationLabels({ timeline, positions, destinations, viewer, runtime }: {
  timeline: ReplayTimeline; positions: ReadonlyMap<string, BattlePose>; destinations: ReadonlyMap<string, BattlePose>; viewer: BattleSide; runtime: RefObject<Runtime>;
}) {
  const { t } = useTranslation();
  const attack = useRef<HTMLSpanElement>(null), defence = useRef<HTMLSpanElement>(null);
  useFrame(() => {
    for (const [side, ref] of [['ATTACK', attack], ['DEFENCE', defence]] as const) if (ref.current) {
      const count = runtime.current.frame.retreats.filter(event => timeline.recording.ships.find(ship => ship.id === event.shipId)?.side === side).length;
      ref.current.style.display = count > 0 ? '' : 'none'; ref.current.textContent = `↗ ${t('simulator.outOfCombat')} · ${count}`;
    }
  }, -1);
  return <>{(['ATTACK', 'DEFENCE'] as const).map(side => {
    const ships = timeline.recording.ships.filter(ship => ship.side === side && !(ship.ground ?? HULLS[ship.hull].ground));
    if (ships.length === 0) return null;
    const x = Math.min(...ships.map(ship => positions.get(ship.id)!.x)) - 1;
    const z = side === 'ATTACK' ? Math.max(...ships.map(ship => positions.get(ship.id)!.z)) : Math.min(...ships.map(ship => positions.get(ship.id)!.z));
    const escaped = ships.map(ship => destinations.get(ship.id)).filter((pose): pose is BattlePose => pose !== undefined);
    return <group key={side}><WorldLabel position={[x, .3, z]} viewer={viewer} side={side} className={`sim-world-force ${side === viewer ? 'is-self' : 'is-enemy'}`}>{side === viewer ? '◆' : '▲'} {t(side === 'ATTACK' ? 'simulator.attacker' : 'simulator.defender')}</WorldLabel>
      {escaped.length > 0 && <WorldLabel position={[escaped[0]!.x, 1.6, escaped[0]!.z]} viewer={viewer} className="sim-world-escape" labelRef={side === 'ATTACK' ? attack : defence} />}
    </group>;
  })}</>;
}

function WorldLabel({ position, viewer, children, className, side, labelRef }: {
  position: [number, number, number]; viewer: BattleSide; children?: ReactNode; className: string; side?: BattleSide; labelRef?: RefObject<HTMLSpanElement | null>;
}) {
  const own = useRef<HTMLSpanElement>(null), root = labelRef ?? own;
  const { camera, size } = useThree();
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!root.current) return;
    const sign = viewer === 'ATTACK' ? 1 : -1;
    point.set(position[0] * sign, position[1], position[2] * sign).project(camera);
    const offset = fitWorldLabel((point.x * .5 + .5) * size.width, root.current.offsetWidth, size.width);
    root.current.style.transform = `translateX(${offset}px)`;
  });
  return <Html position={position} center zIndexRange={[2, 1]} style={{ pointerEvents: 'none' }}><span ref={root} data-force-label={side} className={className} style={{ display: labelRef ? 'none' : undefined }}>{children}</span></Html>;
}

function PlanetBackdrop({ positions, ships, deaths, clock }: { positions: ReadonlyMap<string, BattlePose>; ships: readonly BattleShipSnapshot[]; deaths: ReadonlyMap<string, number>; clock: RefObject<PlaybackClock> }) {
  const loaded = useGLTF(BATTLEFIELD_PLANET_MODEL, false);
  const planet = useMemo(() => {
    const meshes: THREE.Mesh[] = [];
    loaded.scene.traverse(node => { if (isBattleMesh(node)) meshes.push(node); });
    const body = meshes[0];
    if (!body) return null;
    const source = Array.isArray(body.material) ? body.material[0]! : body.material;
    const material = source.clone();
    if (material instanceof THREE.MeshStandardMaterial) {
      material.metalness = 0; material.roughness = 1; material.envMapIntensity = .05;
      material.emissiveIntensity = .06;
      material.color.multiplyScalar(.45);
    }
    return { geometry: unitPlanetGeometry(body), material };
  }, [loaded.scene]);
  useEffect(() => () => { planet?.material.dispose(); }, [planet]);
  const planetPose = useMemo(() => battlePlanet(ships, positions), [ships, positions]);
  return <group>
    {planet && <mesh geometry={planet.geometry} material={planet.material} position={[0, planetPose.y, planetPose.z]} scale={planetPose.radius} />}
    <mesh position={[0, planetPose.y, planetPose.z]} scale={planetPose.radius * 1.008}>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.BackSide}
        vertexShader="varying vec3 vN;varying vec3 vV;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=-p.xyz;gl_Position=projectionMatrix*p;}"
        fragmentShader="varying vec3 vN;varying vec3 vV;void main(){float rim=pow(1.-abs(dot(normalize(vN),normalize(vV))),4.);gl_FragColor=vec4(.2,.55,1.,rim*.35);}"
      />
    </mesh>
    <GroundPlatforms ships={ships} positions={positions} planet={planetPose} deaths={deaths} clock={clock} />
  </group>;
}

/** Two shared meshes replace two draw calls per ground unit; dead foundations do not survive their guns. */
function GroundPlatforms({ ships, positions, planet, deaths, clock }: { ships: readonly BattleShipSnapshot[]; positions: ReadonlyMap<string, BattlePose>;
  planet: ReturnType<typeof battlePlanet>; deaths: ReadonlyMap<string, number>; clock: RefObject<PlaybackClock> }) {
  const bases = useRef<THREE.InstancedMesh>(null), rings = useRef<THREE.InstancedMesh>(null);
  const layouts = useMemo(() => ships.filter(ship => ship.ground ?? HULLS[ship.hull].ground).map(ship => {
    const pose = positions.get(ship.id)!, normal = new THREE.Vector3(pose.x, pose.y - planet.y, pose.z - planet.z).normalize();
    const orientation = new THREE.Quaternion().setFromUnitVectors(THREE.Object3D.DEFAULT_UP, normal);
    const center = new THREE.Vector3(0, planet.y, planet.z).addScaledVector(normal, planet.radius + .08 * pose.scale);
    const scale = new THREE.Vector3().setScalar(pose.scale);
    const base = new THREE.Matrix4().compose(center, orientation, scale);
    center.addScaledVector(normal, .09 * pose.scale);
    orientation.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    return { id: ship.id, base, ring: new THREE.Matrix4().compose(center, orientation, scale) };
  }), [ships, positions, planet]);
  const work = useMemo(() => ({ matrix: new THREE.Matrix4(), scale: new THREE.Vector3() }), []);
  useFrame(() => {
    for (let index = 0; index < layouts.length; index++) {
      const item = layouts[index]!;
      work.scale.setScalar(destructionScale(deaths.get(item.id), clock.current.time));
      bases.current?.setMatrixAt(index, work.matrix.copy(item.base).scale(work.scale));
      rings.current?.setMatrixAt(index, work.matrix.copy(item.ring).scale(work.scale));
    }
    if (bases.current) bases.current.instanceMatrix.needsUpdate = true;
    if (rings.current) rings.current.instanceMatrix.needsUpdate = true;
  });
  if (layouts.length === 0) return null;
  return <group>
    <instancedMesh ref={bases} args={[undefined, undefined, layouts.length]} frustumCulled={false} name="battle-ground-foundations">
      <cylinderGeometry args={[.65, .85, .16, 6]} /><meshStandardMaterial color="#273c53" metalness={.6} roughness={.55} />
    </instancedMesh>
    <instancedMesh ref={rings} args={[undefined, undefined, layouts.length]} frustumCulled={false}>
      <ringGeometry args={[.6, .64, 32]} /><meshBasicMaterial color="#5ea4da" transparent opacity={.45} />
    </instancedMesh>
  </group>;
}

function NebulaBackdrop() {
  return <mesh scale={220}>
    <sphereGeometry args={[1, 32, 20]} />
    <shaderMaterial side={THREE.BackSide} depthWrite={false}
      vertexShader="varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
      fragmentShader="varying vec3 vP;float h(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}void main(){vec3 p=normalize(vP);float cloud=n(p*3.)*.6+n(p*7.)*.25+n(p*17.)*.15;float band=exp(-pow((p.x+p.y*.6-.3)*2.3,2.));vec3 c=vec3(.0008,.0012,.003)+vec3(.005,.008,.017)*pow(cloud,2.)*band;c+=vec3(.008,.003,.009)*pow(n(p*5.+8.),3.)*band;gl_FragColor=vec4(c,1.);}"
    />
  </mesh>;
}

function UnitReadout({ ship, pose, runtime, deaths, selected, compact, destination, retreatAt, viewer }: {
  ship: BattleShipSnapshot; pose: BattlePose; runtime: RefObject<Runtime>; deaths: ReadonlyMap<string, number>;
  selected: string | null; compact: boolean; destination?: BattlePose; retreatAt?: number; viewer: BattleSide;
}) {
  const { t, i18n } = useTranslation();
  const { camera, size } = useThree();
  const point = useMemo(() => new THREE.Vector3(), []);
  const anchor = useRef<THREE.Group>(null);
  const root = useRef<HTMLDivElement>(null), values = useRef<HTMLSpanElement>(null);
  const damage = useRef<HTMLDivElement>(null), hullDamage = useRef<HTMLSpanElement>(null), shieldDamage = useRef<HTMLSpanElement>(null);
  const pending = useRef<HTMLSpanElement>(null), name = useRef<HTMLSpanElement>(null);
  useFrame(() => {
    const frame = runtime.current.frame, state = frame.ships.get(ship.id)!;
    if (!root.current) return;
    const badge = frame.damageBadges.find(item => item.targetId === ship.id);
    const firing = frame.activeShot?.shot.sourceId === ship.id || frame.activeAegisStrike?.strike.sourceId === ship.id;
    const awaiting = frame.pendingFire.has(ship.id);
    const deadAt = deaths.get(ship.id);
    const present = deadAt === undefined || frame.time < deadAt + .6;
    const current = retreatAt !== undefined && destination ? sampleRetreatPose(pose, destination, ship.side, frame.time - retreatAt) : pose;
    anchor.current?.position.set(current.x, current.y + current.scale * .5, current.z);
    root.current.style.opacity = present || badge ? '1' : '0';
    if (values.current) {
      values.current.textContent = `${Math.max(0, Math.ceil(state.hp))}\n/ ${Math.ceil(ship.maxHp)}`;
      const sign = viewer === 'ATTACK' ? 1 : -1;
      const distance = camera.position.distanceTo(point.set(current.x * sign, current.y, current.z * sign));
      const pixels = size.height * current.scale / (2 * Math.tan(43 * Math.PI / 360) * Math.max(1, distance));
      values.current.style.display = selected === ship.id || firing || badge || !compact && pixels >= 28 ? '' : 'none';
    }
    if (name.current) { name.current.style.display = selected === ship.id || firing || state.status === 'RETREATED' && frame.time - (retreatAt ?? 0) < 1.7 ? '' : 'none'; }
    if (pending.current) {
      const fleeing = state.status === 'RETREATED' && (selected === ship.id || frame.time - (retreatAt ?? 0) < 1.7);
      pending.current.style.display = awaiting || fleeing ? '' : 'none';
      pending.current.textContent = awaiting ? t('simulator.pendingFire') : `↗ ${t('simulator.outOfCombat')}`;
    }
    if (damage.current) {
      damage.current.style.opacity = badge ? '1' : '0';
      damage.current.style.transform = badge ? `translateY(${-14 - (frame.time - badge.at) * 12}px)` : 'translateY(-14px)';
      if (hullDamage.current) hullDamage.current.textContent = badge ? damageLabel(badge.hullDamage, i18n.language) : '';
      if (shieldDamage.current) shieldDamage.current.textContent = badge && badge.shieldDamage > 0 ? `◈ ${damageLabel(badge.shieldDamage, i18n.language)}` : '';
    }
  });
  return <group ref={anchor} position={[pose.x, pose.y + pose.scale * .5, pose.z]}><Html center zIndexRange={[3, 1]} style={{ pointerEvents: 'none' }}>
    <div className={`sim-unit-readout ${ship.side === viewer ? 'is-self' : 'is-enemy'} ${selected === ship.id ? 'is-selected' : ''}`} ref={root} data-unit-readout={ship.id}>
      <span className="sim-unit-faction" aria-hidden="true">{ship.side === viewer ? '◆' : '▲'}</span>
      <span ref={name} className="sim-readout-name" style={{ display: 'none' }}>{hullLabel(ship.hull)} <small>#{ship.id}</small></span>
      <span ref={values} className="sim-hp-value">{`${Math.ceil(ship.hp)}\n/ ${Math.ceil(ship.maxHp)}`}</span>
      <span ref={pending} className="sim-pending-fire" style={{ display: 'none' }}>{t('simulator.pendingFire')}</span>
      <div ref={damage} className="sim-damage-badge" style={{ opacity: 0 }} data-unit-damage={ship.id}>
        <span ref={hullDamage} className="is-hull" /><span ref={shieldDamage} className="is-shield" />
      </div>
    </div>
  </Html></group>;
}

interface BucketProps {
  planet: ReturnType<typeof battlePlanet>; hull: HullId; members: readonly BattleShipSnapshot[]; positions: ReadonlyMap<string, BattlePose>;
  runtime: RefObject<Runtime>; clock: RefObject<PlaybackClock>; selected: string | null; viewer: BattleSide;
  onSelect: (id: string) => void; deaths: ReadonlyMap<string, number>; retreats: ReadonlyMap<string, number>;
  destinations: ReadonlyMap<string, BattlePose>;
}
function ShipBucket({ planet, hull, members, positions, runtime, selected, onSelect, clock, deaths, retreats, destinations, viewer }: BucketProps) {
  const quality = useRenderQuality();
  const url = members.length > 32 || quality === 'low' ? HULL_LOD_MODEL[hull] : HULL_MODEL[hull];
  const models = useGLTF([HULL_MODEL[hull], url], false);
  const full = models[0]!, loaded = models[1]!;
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const barriers = useRef<THREE.InstancedMesh>(null), rims = useRef<(THREE.InstancedMesh | null)[]>([]);
  const hpBar = useRef<THREE.InstancedMesh>(null), shieldBar = useRef<THREE.InstancedMesh>(null);
  const hpTrack = useRef<THREE.InstancedMesh>(null), shieldTrack = useRef<THREE.InstancedMesh>(null);
  const work = useMemo(() => ({ transform: new THREE.Object3D(), matrix: new THREE.Matrix4(), color: new THREE.Color(), rimColor: new THREE.Color(),
    normal: new THREE.Vector3(), surface: new THREE.Quaternion(), rimScale: new THREE.Vector3(1.055, 1.055, 1.055), quat: new THREE.Quaternion(), rotation: new THREE.Quaternion(), right: new THREE.Vector3() }), []);
  const paint = useMemo(() => {
    const materials: (THREE.Material | THREE.Material[])[] = [];
    full.scene.traverse(node => { if (isBattleMesh(node)) materials.push(node.material); });
    return materials;
  }, [full.scene]);
  const parts = useMemo(() => battleModelParts(loaded.scene, MODEL_FACING[HULL_MODEL[hull]] ?? '+z', MODEL_POSE[HULL_MODEL[hull]], paint), [loaded.scene, hull, paint]);
  useEffect(() => () => {
    for (const part of parts) for (const material of Array.isArray(part.material) ? part.material : [part.material]) material.dispose();
  }, [parts]);
  useFrame(({ camera }) => {
    const { transform, color } = work, time = clock.current.time;
    work.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, viewer === 'ATTACK' ? 0 : -Math.PI);
    work.quat.copy(work.rotation).multiply(camera.quaternion);
    work.right.set(1, 0, 0).applyQuaternion(work.quat);
    for (let i = 0; i < members.length; i++) {
      const ship = members[i]!, base = positions.get(ship.id)!, state = runtime.current.frame.ships.get(ship.id)!;
      const death = deaths.get(ship.id), retreat = retreats.get(ship.id);
      const destination = destinations.get(ship.id);
      const pose = retreat !== undefined && destination ? sampleRetreatPose(base, destination, ship.side, time - retreat) : { ...base, yaw: ship.side === 'ATTACK' ? 0 : Math.PI };
      const deadProgress = 1 - destructionScale(death, time);
      const ground = ship.ground ?? HULLS[hull].ground;
      const bob = ground ? 0 : Math.sin(time * 1.1 + i * 2) * .08;
      const z = pose.z;
      transform.position.set(pose.x, pose.y + bob, z);
      transform.rotation.set(0, pose.yaw, 0);
      if (ground) {
        work.normal.set(pose.x, pose.y - planet.y, pose.z - planet.z).normalize();
        work.surface.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, work.normal);
        transform.quaternion.premultiply(work.surface);
      }
      transform.scale.setScalar(pose.scale * (1 - deadProgress)); transform.updateMatrix();
      const flash = runtime.current.flashes.get(ship.id);
      const firing = runtime.current.frame.activeShot?.shot.sourceId === ship.id || runtime.current.frame.activeAegisStrike?.strike.sourceId === ship.id;
      const awaiting = runtime.current.frame.pendingFire.has(ship.id);
      color.set(flash ? '#c3eaff' : firing ? '#d7ffee' : awaiting ? '#676b78' : selected === ship.id ? '#b9ffe9' : '#ffffff');
      work.rimColor.set(ship.side === viewer ? '#65e6d1' : '#ff8780');
      for (let part = 0; part < meshes.current.length; part++) {
        const mesh = meshes.current[part];
        work.matrix.multiplyMatrices(transform.matrix, parts[part]!.matrix);
        mesh?.setMatrixAt(i, work.matrix); mesh?.setColorAt(i, color);
        if ((firing || selected === ship.id) && deadProgress === 0) work.matrix.copy(transform.matrix).scale(work.rimScale).multiply(parts[part]!.matrix);
        else work.matrix.makeScale(0, 0, 0);
        rims.current[part]?.setMatrixAt(i, work.matrix); rims.current[part]?.setColorAt(i, work.rimColor);
      }
      if (barriers.current) {
        transform.position.set(pose.x, pose.y + bob, z); transform.rotation.set(0, 0, 0);
        transform.scale.setScalar(state.status === 'ACTIVE' && (flash?.shield || selected === ship.id && state.shield > 0) ? pose.scale * .58 : 0);
        transform.updateMatrix(); barriers.current.setMatrixAt(i, transform.matrix);
      }
      const visible = deadProgress === 0;
      const width = Math.min(1.05, Math.max(.5, pose.scale * .65));
      const bar = (mesh: THREE.InstancedMesh | null, ratio: number, y: number, thickness: number, track: boolean) => {
        const offset = track ? 0 : -width * (1 - ratio) / 2;
        transform.position.set(pose.x, pose.y + pose.scale * .5 + .3 + y + bob, z);
        transform.position.addScaledVector(work.right, offset); transform.quaternion.copy(work.quat);
        transform.scale.set(visible ? width * ratio : 0, thickness, 1); transform.updateMatrix(); mesh?.setMatrixAt(i, transform.matrix);
      };
      bar(hpTrack.current, 1, 0, .045, true);
      bar(hpBar.current, state.hp / ship.maxHp, .005, .035, false);
      color.set(ship.side === viewer ? '#52dbb9' : '#ff8780'); hpBar.current?.setColorAt(i, color);
      bar(shieldTrack.current, ship.maxShield > 0 ? 1 : 0, .10, .03, true);
      bar(shieldBar.current, ship.maxShield > 0 ? state.shield / ship.maxShield : 0, .105, .025, false);
    }
    for (const mesh of [...meshes.current, ...rims.current, barriers.current, hpBar.current, shieldBar.current, hpTrack.current, shieldTrack.current]) if (mesh) {
      mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });
  return <group>
    {parts.map((part, index) => <instancedMesh key={index} ref={node => { meshes.current[index] = node; }} args={[part.geometry, part.material, members.length]} frustumCulled={false}
      onClick={event => { event.stopPropagation(); if (event.instanceId !== undefined) onSelect(members[event.instanceId]!.id); }} />)}
    {parts.map((part, index) => <instancedMesh key={`rim-${index}`} ref={node => { rims.current[index] = node; }} args={[part.geometry, undefined, members.length]} frustumCulled={false}>
      <meshBasicMaterial color="#ffffff" side={THREE.BackSide} transparent opacity={.25} depthWrite={false} blending={THREE.AdditiveBlending} />
    </instancedMesh>)}
    <instancedMesh ref={barriers} args={[undefined, undefined, members.length]} frustumCulled={false}><sphereGeometry args={[1, 20, 12]} />
      <shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending}
        vertexShader="varying vec3 vN; varying vec3 vV; void main(){vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.);vN=normalize(normalMatrix*mat3(instanceMatrix)*normal);vV=-p.xyz;gl_Position=projectionMatrix*p;}"
        fragmentShader="varying vec3 vN; varying vec3 vV; void main(){float rim=pow(1.-abs(dot(normalize(vN),normalize(vV))),3.);gl_FragColor=vec4(.2,.65,1.,.015+rim*.23);}"
      />
    </instancedMesh>
    <instancedMesh ref={hpBar} args={[undefined, undefined, members.length]} frustumCulled={false}><planeGeometry /><meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={shieldBar} args={[undefined, undefined, members.length]} frustumCulled={false}><planeGeometry /><meshBasicMaterial color="#65bfff" side={THREE.DoubleSide} /></instancedMesh>
    <instancedMesh ref={hpTrack} args={[undefined, undefined, members.length]} frustumCulled={false}><planeGeometry /><meshBasicMaterial color="#a6b3c6" transparent opacity={.22} side={THREE.DoubleSide} depthWrite={false} /></instancedMesh>
    <instancedMesh ref={shieldTrack} args={[undefined, undefined, members.length]} frustumCulled={false}><planeGeometry /><meshBasicMaterial color="#5485af" transparent opacity={.2} side={THREE.DoubleSide} depthWrite={false} /></instancedMesh>
  </group>;
}

const BEAM_LIMIT = 512, EXPLOSION_LIMIT = 80;
function BattleEffects({ timeline, positions, clock, viewer }: {
  timeline: ReplayTimeline; positions: ReadonlyMap<string, BattlePose>; clock: RefObject<PlaybackClock>; viewer: BattleSide;
}) {
  const atlas = useTexture(EXPLOSION_ATLAS);
  const shots = useMemo(() => timeline.events.filter(event => event.kind === 'SHOT'), [timeline]);
  const opening = useMemo(() => timeline.events.filter(event => event.kind === 'AEGIS_STRIKE'), [timeline]);
  const impacts = useMemo(() => timeline.events.filter(event => event.kind === 'HIT' || event.kind === 'DESTROY' || event.kind === 'AEGIS_HIT' || event.kind === 'AEGIS_STRIKE'), [timeline]);
  const shield = useMemo(() => battlefieldEnvironment(timeline.recording, positions).aegis, [timeline, positions]);
  const beam = useRef<THREE.LineSegments>(null), bursts = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<THREE.InstancedMesh>(null), muzzle = useRef<THREE.Mesh>(null);
  const buffer = useMemo(() => new Float32Array(BEAM_LIMIT * 6), []);
  const colorBuffer = useMemo(() => new Float32Array(BEAM_LIMIT * 6), []);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(buffer, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colorBuffer, 3)); return g;
  }, [buffer, colorBuffer]);
  const progress = useMemo(() => new Float32Array(EXPLOSION_LIMIT), []);
  const burstGeometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1); plane.setAttribute('burstProgress', new THREE.InstancedBufferAttribute(progress, 1)); return plane;
  }, [progress]);
  const uniforms = useMemo(() => ({ atlas: { value: atlas } }), [atlas]);
  const scratch = useMemo(() => ({ transform: new THREE.Object3D(), color: new THREE.Color(), rotation: new THREE.Quaternion(), normal: new THREE.Vector3(), point: new THREE.Vector3() }), []);
  useEffect(() => () => { geometry.dispose(); burstGeometry.dispose(); }, [geometry, burstGeometry]);
  useFrame(({ camera }) => {
    const time = clock.current.time;
    let n = 0, flashes = 0;
    const active = shots.find(event => event.at <= time && time <= event.impactEnd);
    if (muzzle.current) muzzle.current.visible = false;
    if (active) {
      const source = positions.get(active.shot.sourceId)!;
      const from = { x: source.x, y: source.y + .12, z: source.z + (active.side === 'ATTACK' ? 1 : -1) * source.scale * .45 };
      if (muzzle.current && time - active.at < .38) {
        muzzle.current.visible = true; muzzle.current.position.set(from.x, from.y, from.z);
        scratch.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, viewer === 'ATTACK' ? 0 : -Math.PI);
        muzzle.current.quaternion.copy(scratch.rotation).multiply(camera.quaternion);
        muzzle.current.scale.setScalar(source.scale * (.18 + (time - active.at) * .65));
      }
      for (let h = 0; h < active.shot.hits.length && n < BEAM_LIMIT; h++) {
        const hit = active.shot.hits[h]!, target = positions.get(hit.targetId)!;
        const offset = h / Math.max(1, active.shot.hits.length) * (active.impactEnd - active.impactAt);
        const arrive = active.impactAt + offset, shieldAt = active.at + .43 + offset;
        const intercepted = hit.normalAegisDamage + hit.bonusAegisDamage > 0;
        const contact = intercepted ? shieldIntercept(from, target, shield) : target;
        let a = from, b: Pick<BattlePose, 'x' | 'y' | 'z'> = target, start = active.at, end = arrive;
        if (intercepted) {
          if (time <= shieldAt) { b = contact; end = shieldAt; }
          else if (hit.shieldDamage + hit.hullDamage > 0) { a = contact; b = target; start = shieldAt + .04; end = arrive; }
          else continue;
        }
        if (time > end + .04 || time < start) continue;
        const t = Math.min(1, Math.max(0, (time - start) / Math.max(.001, end - start)));
        const back = Math.max(0, t - .19), offsetN = n * 6;
        buffer[offsetN] = a.x + (b.x - a.x) * back; buffer[offsetN + 1] = a.y + (b.y - a.y) * back; buffer[offsetN + 2] = a.z + (b.z - a.z) * back;
        buffer[offsetN + 3] = a.x + (b.x - a.x) * t; buffer[offsetN + 4] = a.y + (b.y - a.y) * t; buffer[offsetN + 5] = a.z + (b.z - a.z) * t;
        const specialist = timeline.recording.ships.find(ship => ship.id === active.shot.sourceId)?.hull === 'NULLIFIER';
        scratch.color.set(specialist ? '#b897ff' : active.side === viewer ? '#96ffe9' : '#ffb18c').multiplyScalar(2.1);
        for (let j = 0; j < 2; j++) scratch.color.toArray(colorBuffer, offsetN + j * 3);
        n++;
      }
    }
    const openingShot = opening.find(event => event.launchAt <= time && time <= event.at + .04);
    if (openingShot && n < BEAM_LIMIT) {
      const source = positions.get(openingShot.strike.sourceId)!;
      const from = { x: source.x, y: source.y + .12, z: source.z + source.scale * .45 };
      const contact = shieldIntercept(from, shield, shield);
      const progress = Math.min(1, Math.max(0, (time - openingShot.launchAt) / Math.max(.001, openingShot.at - openingShot.launchAt)));
      const back = Math.max(0, progress - .24), offset = n * 6;
      buffer[offset] = from.x + (contact.x - from.x) * back;
      buffer[offset + 1] = from.y + (contact.y - from.y) * back;
      buffer[offset + 2] = from.z + (contact.z - from.z) * back;
      buffer[offset + 3] = from.x + (contact.x - from.x) * progress;
      buffer[offset + 4] = from.y + (contact.y - from.y) * progress;
      buffer[offset + 5] = from.z + (contact.z - from.z) * progress;
      scratch.color.set('#c6a3ff').multiplyScalar(2.5);
      for (let j = 0; j < 2; j++) scratch.color.toArray(colorBuffer, offset + j * 3);
      n++;
      if (muzzle.current && time - openingShot.launchAt < .38) {
        muzzle.current.visible = true; muzzle.current.position.set(from.x, from.y, from.z);
        scratch.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, viewer === 'ATTACK' ? 0 : -Math.PI);
        muzzle.current.quaternion.copy(scratch.rotation).multiply(camera.quaternion);
        muzzle.current.scale.setScalar(source.scale * (.18 + (time - openingShot.launchAt) * .65));
      }
    }
    geometry.setDrawRange(0, n * 2); geometry.attributes.position!.needsUpdate = true; geometry.attributes.color!.needsUpdate = true;
    let explosions = 0;
    for (const event of impacts) {
      if (event.at > time) break;
      const age = time - event.at;
      if (age > 1.05) continue;
      if ((event.kind === 'AEGIS_HIT' || event.kind === 'AEGIS_STRIKE') && flashes < EXPLOSION_LIMIT) {
        const from = positions.get(event.kind === 'AEGIS_STRIKE' ? event.strike.sourceId : event.shot.sourceId)!;
        const to = event.kind === 'AEGIS_STRIKE' ? shield : positions.get(event.hit.targetId)!;
        const contact = shieldIntercept(from, to, shield);
        scratch.transform.position.set(contact.x, contact.y, contact.z);
        scratch.normal.set(contact.x - shield.x, contact.y - shield.y, contact.z - shield.z).normalize();
        scratch.transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), scratch.normal);
        scratch.transform.scale.setScalar(.12 + age * 2.2); scratch.transform.updateMatrix();
        rings.current?.setMatrixAt(flashes, scratch.transform.matrix);
        scratch.color.set('#85bdff').multiplyScalar(Math.max(0, 1 - age / 1.05) * 2);
        rings.current?.setColorAt(flashes, scratch.color); flashes++;
      }
      if (explosions >= EXPLOSION_LIMIT || event.kind === 'AEGIS_HIT' || event.kind === 'AEGIS_STRIKE' || event.kind === 'HIT' && (event.hit.hpAfter === 0 || event.hit.hullDamage <= 0)) continue;
      const pose = positions.get(event.kind === 'DESTROY' ? event.shipId : event.hit.targetId)!;
      const death = event.kind === 'DESTROY';
      scratch.transform.position.set(pose.x, pose.y + .15, pose.z);
      scratch.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, viewer === 'ATTACK' ? 0 : -Math.PI);
      scratch.transform.quaternion.copy(scratch.rotation).multiply(camera.quaternion);
      scratch.transform.scale.setScalar(pose.scale * (death ? 1.8 + age * 2.6 : .25 + age * .35)); scratch.transform.updateMatrix();
      bursts.current?.setMatrixAt(explosions, scratch.transform.matrix);
      progress[explosions] = age / 1.05; explosions++;
    }
    if (bursts.current) { bursts.current.count = explosions; bursts.current.instanceMatrix.needsUpdate = true; burstGeometry.attributes.burstProgress!.needsUpdate = true; }
    if (rings.current) { rings.current.count = flashes; rings.current.instanceMatrix.needsUpdate = true; if (rings.current.instanceColor) rings.current.instanceColor.needsUpdate = true; }
  });
  return <>
    <lineSegments ref={beam} geometry={geometry} frustumCulled={false}><lineBasicMaterial vertexColors transparent opacity={.95} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></lineSegments>
    <mesh ref={muzzle} visible={false}><planeGeometry /><shaderMaterial transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}
      vertexShader="varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
      fragmentShader="varying vec2 vUv;void main(){float d=length(vUv-.5)*2.;float a=exp(-d*d*8.);gl_FragColor=vec4(.7,.9,1.,a);}" /></mesh>
    <instancedMesh ref={rings} args={[undefined, undefined, EXPLOSION_LIMIT]} frustumCulled={false}><ringGeometry args={[.85, 1, 40]} /><meshBasicMaterial transparent opacity={.55} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={bursts} args={[burstGeometry, undefined, EXPLOSION_LIMIT]} frustumCulled={false}>
      <shaderMaterial uniforms={uniforms} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false}
        vertexShader="attribute float burstProgress; varying vec2 vUv; varying float vProgress; void main(){vUv=uv;vProgress=burstProgress;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}"
        fragmentShader="uniform sampler2D atlas;varying vec2 vUv;varying float vProgress;void main(){float f=floor(clamp(vProgress,0.,.999)*64.);vec2 cell=vec2(mod(f,8.),7.-floor(f/8.));vec4 c=texture2D(atlas,(vUv+cell)/8.);gl_FragColor=vec4(c.rgb*1.6,c.a*(1.-vProgress));}"
      />
    </instancedMesh>
  </>;
}

function AegisField({ timeline, runtime, positions }: { timeline: ReplayTimeline; runtime: RefObject<Runtime>; positions: ReadonlyMap<string, BattlePose> }) {
  const field = useRef<THREE.Mesh>(null);
  const shape = useMemo(() => battlefieldEnvironment(timeline.recording, positions).aegis, [timeline, positions]);
  const uniforms = useMemo(() => ({ charge: { value: 1 }, pulse: { value: 0 }, hitDirection: { value: new THREE.Vector3(0, 0, -1) } }), []);
  const hits = useMemo(() => timeline.events.filter(event => event.kind === 'AEGIS_HIT' || event.kind === 'AEGIS_STRIKE'), [timeline]);
  useFrame(() => {
    if (!field.current) return;
    const time = runtime.current.frame.time;
    const last = hits.findLast(event => event.at <= time);
    uniforms.pulse.value = last ? Math.max(0, 1 - (time - last.at) / .7) : 0;
    uniforms.charge.value = runtime.current.frame.aegis / Math.max(1, timeline.recording.initialAegis);
    if (last) {
      const from = positions.get(last.kind === 'AEGIS_STRIKE' ? last.strike.sourceId : last.shot.sourceId)!;
      const to = last.kind === 'AEGIS_STRIKE' ? shape : positions.get(last.hit.targetId)!;
      const contact = shieldIntercept(from, to, shape);
      uniforms.hitDirection.value.set(contact.x - shape.x, contact.y - shape.y, contact.z - shape.z).normalize();
    }
    field.current.visible = timeline.recording.initialAegis > 0 && (uniforms.charge.value > 0 || uniforms.pulse.value > 0);
  });
  return <mesh ref={field} name="battle-aegis" position={[shape.x, shape.y, shape.z]} scale={shape.radius}>
    <sphereGeometry args={[1, 64, 40]} /><shaderMaterial uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide}
      vertexShader="varying vec3 vNormal; varying vec3 vView;varying vec3 vLocal;varying vec2 vUv; void main(){ vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=-p.xyz;vLocal=normalize(position);vUv=uv;gl_Position=projectionMatrix*p;}"
      fragmentShader="uniform float charge;uniform float pulse;uniform vec3 hitDirection;varying vec3 vNormal;varying vec3 vView;varying vec3 vLocal;varying vec2 vUv;void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),5.);float ripple=pow(max(0.,dot(vLocal,hitDirection)),22.)*pulse;float alpha=(.002+rim*.27)*min(1.,charge+.4*pulse)+ripple*.24;gl_FragColor=vec4(vec3(.2,.5,1.)*(1.+ripple*2.),alpha);}"
    />
  </mesh>;
}
