import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { GalaxyMoons } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { playSound } from '../lib/sound.js';
import { moonOrbitPosition, moonRadiusFor } from './moonOrbit.js';
import type { MoonHostRef } from './MoonGateWarpFx.js';

/*
  VFX BRIEF — Moon Gözcü Scanner Telemetry Wave, Target Hologram Lock & Discovered Route Arcs
  - Physical event: The commander's moon fires a silent Gözcü route scan. A crisp circular
    sensor pulse expands from the scanning moon (`circle-wave-5x5.webp`), a telemetry beam packet
    streaks to the target world, and a holographic latitude/longitude scan shell + counter-rotating
    Sci-Fi reticle (`circles-outlines-2x2.webp`) sweeps and locks onto the target.
  - Legendary cloak-piercing scans burn amber-gold, aim the electric pierce burst directly onto
    the target's orbiting moon (when present), and highlight discovered flight routes as temporary
    glowing curved telemetry tubes across the galaxy map.
  - Zero radial glow sprites; 60fps only while active.
*/

const CIRCLE_WAVE_TEX = '/assets/vfx/library/circle-wave-5x5.webp';
const RETICLE_TEX = '/assets/vfx/library/circles-outlines-2x2.webp';
const SHOCK_TEX = '/assets/vfx/library/white-shock-4x4.webp';
const ARC_TEX = '/assets/vfx/library/electric-line-4x4.webp';

useTexture.preload(CIRCLE_WAVE_TEX);
useTexture.preload(RETICLE_TEX);
useTexture.preload(SHOCK_TEX);
useTexture.preload(ARC_TEX);

export const MOON_SCAN_DURATION_MS = 6_500;

export interface MoonScanRouteFx {
  readonly fromPlanetId: string;
  readonly toPlanetId: string;
  readonly cloaked?: boolean | undefined;
}

export interface MoonScanFxEvent {
  readonly id: string;
  readonly fromPlanetId: string;
  readonly targetPlanetId: string;
  readonly startedAtMs: number;
  readonly pierced: boolean;
  readonly routes?: readonly MoonScanRouteFx[] | undefined;
}

const SCAN_SHELL_VERT = /* glsl */ `
  varying vec3 vDir;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelViewMatrix) * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const SCAN_SHELL_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uSweep;
  uniform float uBand;
  uniform float uGrid;
  varying vec3 vDir;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float facing = max(0.0, dot(vNormal, vView));
    float rim = (1.0 - facing) * (1.0 - facing);
    float y = vDir.y;
    float a = (y - uSweep) / 0.035;
    float b = (y - uSweep) / 0.14;
    float band = exp(-(a * a)) * 1.7 + exp(-(b * b)) * 0.4;
    float lat = asin(clamp(y, -1.0, 1.0)) * 18.0 / 3.14159265;
    float lon = atan(vDir.z, vDir.x) * 24.0 / 6.28318530;
    float lines = max(
      1.0 - smoothstep(0.0, 0.09, abs(fract(lat) - 0.5) - 0.41),
      1.0 - smoothstep(0.0, 0.09, abs(fract(lon) - 0.5) - 0.41)
    );
    float grid = lines * smoothstep(uSweep - 0.04, uSweep + 0.35, y) * uGrid * (0.35 + 0.65 * rim);
    float alpha = clamp(band * uBand + grid * 0.65 + rim * 0.22 * uBand, 0.0, 1.0);
    gl_FragColor = vec4(uColor * alpha, alpha);
  }
`;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, t: number): number => {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
};

function setGridFrame(tex: THREE.Texture, frame: number, cols: number, rows: number): void {
  const f = Math.max(0, Math.min(cols * rows - 1, Math.floor(frame)));
  tex.offset.set((f % cols) / cols, 1 - (Math.floor(f / cols) + 1) / rows);
}

interface ScanMaps {
  wave: THREE.Texture;
  reticle: THREE.Texture;
  shock: THREE.Texture;
  arc: THREE.Texture;
}

function ScanEffect({
  event,
  moons,
  nodeById,
  maps,
}: {
  readonly event: MoonScanFxEvent;
  readonly moons: GalaxyMoons | undefined;
  readonly nodeById: ReadonlyMap<string, MoonHostRef>;
  readonly maps: ScanMaps;
}) {
  const invalidate = useThree((s) => s.invalidate);
  const toneHex = event.pierced ? '#fbbf24' : '#38bdf8';

  const localTex = useMemo(() => {
    const wave = maps.wave.clone();
    wave.repeat.set(0.2, 0.2);
    wave.needsUpdate = true;

    const retA = maps.reticle.clone();
    retA.repeat.set(0.5, 0.5);
    retA.offset.set(0, 0.5);
    retA.needsUpdate = true;

    const retB = maps.reticle.clone();
    retB.repeat.set(0.5, 0.5);
    retB.offset.set(0.5, 0);
    retB.needsUpdate = true;

    const shock = maps.shock.clone();
    shock.repeat.set(0.25, 0.25);
    shock.needsUpdate = true;

    const arc = maps.arc.clone();
    arc.repeat.set(0.25, 0.25);
    arc.needsUpdate = true;

    return { wave, retA, retB, shock, arc };
  }, [maps]);

  const beamGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    return geo;
  }, []);

  // Build curved 3D telemetry tubes for any discovered routes returned by Gözcü
  const routeArcs = useMemo(() => {
    const routes = event.routes ?? [];
    const built: { geo: THREE.TubeGeometry; cloaked: boolean }[] = [];
    for (const r of routes.slice(0, 12)) {
      const a = nodeById.get(r.fromPlanetId);
      const b = nodeById.get(r.toPlanetId);
      if (!a || !b || a.id === b.id) continue;
      const p0 = new THREE.Vector3(...a.position);
      const p2 = new THREE.Vector3(...b.position);
      const dist = p0.distanceTo(p2);
      if (dist < 0.01) continue;
      const mid = new THREE.Vector3().addVectors(p0, p2).multiplyScalar(0.5);
      mid.y += Math.min(6.5, dist * 0.14);
      const curve = new THREE.QuadraticBezierCurve3(p0, mid, p2);
      const radius = Math.max(0.06, Math.min(0.16, dist * 0.004));
      built.push({ geo: new THREE.TubeGeometry(curve, 28, radius, 6, false), cloaked: Boolean(r.cloaked) });
    }
    return built;
  }, [event.routes, nodeById]);

  const materials = useMemo(() => {
    const color = new THREE.Color(toneHex);
    const mk = (map: THREE.Texture, c: string) =>
      new THREE.MeshBasicMaterial({
        map,
        color: c,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
    return {
      wave: mk(localTex.wave, toneHex),
      retA: mk(localTex.retA, toneHex),
      retB: mk(localTex.retB, event.pierced ? '#fef08a' : '#bae6fd'),
      shock: mk(localTex.shock, '#fde68a'),
      arc: mk(localTex.arc, '#fef08a'),
      beam: new THREE.LineBasicMaterial({
        color: toneHex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      routeStd: new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      routeCloaked: new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      shell: new THREE.ShaderMaterial({
        vertexShader: SCAN_SHELL_VERT,
        fragmentShader: SCAN_SHELL_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: {
          uColor: { value: color },
          uSweep: { value: 1.2 },
          uBand: { value: 0 },
          uGrid: { value: 0 },
        },
      }),
    };
  }, [localTex, toneHex, event.pierced]);

  const beamLine = useMemo(() => {
    const line = new THREE.Line(beamGeo, materials.beam);
    line.visible = false;
    line.frustumCulled = false;
    return line;
  }, [beamGeo, materials.beam]);

  useEffect(() => () => {
    beamGeo.dispose();
    routeArcs.forEach((a) => { a.geo.dispose(); });
    Object.values(localTex).forEach((t) => { t.dispose(); });
    Object.values(materials).forEach((m) => { m.dispose(); });
  }, [beamGeo, routeArcs, localTex, materials]);

  const waveRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const retARef = useRef<THREE.Mesh>(null);
  const retBRef = useRef<THREE.Mesh>(null);
  const pierceShockRef = useRef<THREE.Mesh>(null);
  const pierceArcRef = useRef<THREE.Mesh>(null);
  const routesGroupRef = useRef<THREE.Group>(null);
  const soundPlayed = useRef({ pulse: false, lock: false });

  const scratch = useMemo(() => ({
    parent: { x: 0, y: 0, z: 0 },
    moonPos: { x: 0, y: 0, z: 0 },
    targetParent: { x: 0, y: 0, z: 0 },
    targetMoonPos: { x: 0, y: 0, z: 0 },
    fromV: new THREE.Vector3(),
    toV: new THREE.Vector3(),
    pierceV: new THREE.Vector3(),
    head: new THREE.Vector3(),
    tail: new THREE.Vector3(),
    toCam: new THREE.Vector3(),
    pierceCam: new THREE.Vector3(),
  }), []);

  useFrame(({ camera }) => {
    const nowMs = serverNow();
    const t = (nowMs - event.startedAtMs) / 1_000;
    if (t < 0 || t > MOON_SCAN_DURATION_MS / 1_000) return;

    const fromNode = nodeById.get(event.fromPlanetId);
    const toNode = nodeById.get(event.targetPlanetId);
    if (!fromNode || !toNode) return;

    if (!soundPlayed.current.pulse && t >= 0.02) {
      soundPlayed.current.pulse = true;
      playSound('charge', { gain: 0.62, key: `moon-scan-pulse:${event.id}` });
    }
    if (!soundPlayed.current.lock && t >= 0.96) {
      soundPlayed.current.lock = true;
      playSound(event.pierced ? 'arc' : 'tick', { gain: 0.7, key: `moon-scan-lock:${event.id}` });
    }

    const timeSec = nowMs / 1_000;
    const fromMoon = moons?.list.find((m) => m.planetId === event.fromPlanetId);
    scratch.parent.x = fromNode.position[0];
    scratch.parent.y = fromNode.position[1];
    scratch.parent.z = fromNode.position[2];
    moonOrbitPosition(scratch.parent, fromNode.radius, fromMoon?.visualSeed ?? 1, timeSec, scratch.moonPos);
    const moonR = moonRadiusFor(fromNode.radius, moons?.rarity[event.fromPlanetId]);

    scratch.fromV.set(scratch.moonPos.x, scratch.moonPos.y, scratch.moonPos.z);
    scratch.toV.set(toNode.position[0], toNode.position[1], toNode.position[2]);

    // If Legendary pierces a target world that has a moon, aim the cloak-pierce burst right at its moon!
    const targetMoon = moons?.list.find((m) => m.planetId === event.targetPlanetId);
    let pierceRadius = toNode.radius;
    if (event.pierced && targetMoon) {
      scratch.targetParent.x = toNode.position[0];
      scratch.targetParent.y = toNode.position[1];
      scratch.targetParent.z = toNode.position[2];
      moonOrbitPosition(scratch.targetParent, toNode.radius, targetMoon.visualSeed, timeSec, scratch.targetMoonPos);
      scratch.pierceV.set(scratch.targetMoonPos.x, scratch.targetMoonPos.y, scratch.targetMoonPos.z);
      pierceRadius = Math.max(toNode.radius * 0.6, moonRadiusFor(toNode.radius, moons?.rarity[event.targetPlanetId]) * 2.1);
    } else {
      scratch.pierceV.copy(scratch.toV);
    }

    // 1. Expanding sensor pulse wave at Origin Moon (0.0s -> 1.6s)
    const waveProg = clamp01(t / 1.55);
    if (waveRef.current) {
      waveRef.current.visible = t < 1.6;
      waveRef.current.position.copy(scratch.fromV);
      waveRef.current.scale.setScalar(Math.max(moonR * 2, fromNode.radius * 0.8) * (0.6 + 6.5 * waveProg));
      setGridFrame(localTex.wave, waveProg * 24, 5, 5);
      materials.wave.opacity = (1 - waveProg) * 0.95;
    }

    // 2. Travelling telemetry pulse line from Origin Moon -> Target Planet (0.15s -> 1.55s)
    const beamProg = (t - 0.15) / 1.05;
    const active = beamProg > 0 && beamProg < 1.25;
    beamLine.visible = active;
    if (active) {
      scratch.head.lerpVectors(scratch.fromV, scratch.toV, clamp01(beamProg));
      scratch.tail.lerpVectors(scratch.fromV, scratch.toV, clamp01(beamProg - 0.35));
      const pos = beamGeo.getAttribute('position') as THREE.BufferAttribute;
      pos.setXYZ(0, scratch.tail.x, scratch.tail.y, scratch.tail.z);
      pos.setXYZ(1, scratch.head.x, scratch.head.y, scratch.head.z);
      pos.needsUpdate = true;
      materials.beam.opacity = smooth(0, 0.15, beamProg) * (1 - smooth(0.9, 1.25, beamProg)) * 0.9;
    }

    // 3. Target Holographic Sweep Shell + Counter-Rotating Sci-Fi Reticles (0.95s -> 6.2s)
    const targetAge = t - 0.95;
    const targetActive = targetAge >= 0 && targetAge < 5.3;
    const r = toNode.radius;
    if (shellRef.current) {
      shellRef.current.visible = targetActive;
      if (targetActive) {
        shellRef.current.position.copy(scratch.toV);
        shellRef.current.scale.setScalar(r * 1.04);
        const sweepProg = clamp01(targetAge / 1.65);
        materials.shell.uniforms.uSweep!.value = 1.15 - sweepProg * 2.3;
        materials.shell.uniforms.uBand!.value = smooth(0, 0.2, targetAge) * (1 - smooth(1.6, 2.4, targetAge));
        materials.shell.uniforms.uGrid!.value = smooth(0.15, 0.7, targetAge) * (1 - smooth(4.0, 5.25, targetAge));
      }
    }

    // Camera-facing reticles locking onto target planet
    scratch.toCam.copy(camera.position).sub(scratch.toV).normalize().multiplyScalar(r * 1.18);
    const lockGrow = smooth(0, 0.35, targetAge);
    const lockFade = 1 - smooth(4.2, 5.25, targetAge);
    const retOpacity = targetActive ? lockGrow * lockFade * 0.92 : 0;
    const retScale = r * (3.1 - 0.65 * lockGrow);

    if (retARef.current) {
      retARef.current.visible = retOpacity > 0.01;
      retARef.current.position.copy(scratch.toV).add(scratch.toCam);
      retARef.current.quaternion.copy(camera.quaternion);
      retARef.current.rotateZ(targetAge * 0.75);
      retARef.current.scale.setScalar(retScale);
      materials.retA.opacity = retOpacity;
    }
    if (retBRef.current) {
      retBRef.current.visible = retOpacity > 0.01;
      retBRef.current.position.copy(scratch.toV).add(scratch.toCam);
      retBRef.current.quaternion.copy(camera.quaternion);
      retBRef.current.rotateZ(-targetAge * 1.15);
      retBRef.current.scale.setScalar(retScale * 1.24);
      materials.retB.opacity = retOpacity * 0.85;
    }

    // 4. Legendary Cloak-Pierce Shock + Electric Arc on Target Moon (or Target World)
    scratch.pierceCam.copy(camera.position).sub(scratch.pierceV).normalize().multiplyScalar(pierceRadius * 1.05);
    const pierceProg = event.pierced && targetAge >= 0.08 ? clamp01((targetAge - 0.08) / 1.35) : -1;
    if (pierceShockRef.current) {
      pierceShockRef.current.visible = pierceProg >= 0 && pierceProg < 1;
      if (pierceProg >= 0 && pierceProg < 1) {
        pierceShockRef.current.position.copy(scratch.pierceV).add(scratch.pierceCam);
        pierceShockRef.current.quaternion.copy(camera.quaternion);
        pierceShockRef.current.scale.setScalar(pierceRadius * (1.8 + 3.4 * pierceProg));
        setGridFrame(localTex.shock, pierceProg * 15, 4, 4);
        materials.shock.opacity = (1 - pierceProg) * 0.95;
      }
    }
    if (pierceArcRef.current) {
      pierceArcRef.current.visible = pierceProg >= 0 && pierceProg < 0.88;
      if (pierceProg >= 0 && pierceProg < 0.88) {
        pierceArcRef.current.position.copy(scratch.pierceV).add(scratch.pierceCam);
        pierceArcRef.current.quaternion.copy(camera.quaternion);
        pierceArcRef.current.rotateZ(Math.floor(t * 16) * 1.1);
        pierceArcRef.current.scale.setScalar(pierceRadius * 2.9);
        setGridFrame(localTex.arc, (t * 24) % 16, 4, 4);
        materials.arc.opacity = (1 - pierceProg / 0.88) * 0.92;
      }
    }

    // 5. Discovered Gözcü Route Arcs glowing temporarily across the galaxy map (1.1s -> 6.2s)
    if (routesGroupRef.current) {
      const routeAlpha = targetActive
        ? smooth(0.15, 0.65, targetAge) * (1 - smooth(4.1, 5.25, targetAge)) * (0.62 + 0.18 * Math.sin(t * 5.0))
        : 0;
      routesGroupRef.current.visible = routeAlpha > 0.01;
      materials.routeStd.opacity = routeAlpha;
      materials.routeCloaked.opacity = routeAlpha * 1.15;
    }

    invalidate();
  });

  return (
    <group name={`moon-scan-fx-${event.id}`}>
      {/* Origin Moon Expanding Wave (in orbital XZ plane) */}
      <mesh ref={waveRef} visible={false} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4} material={materials.wave}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      {/* Telemetry Beam Packet */}
      <primitive object={beamLine} raycast={() => null} />
      {/* Target Planet Hologram Sweep Shell */}
      <mesh ref={shellRef} visible={false} renderOrder={4} material={materials.shell}>
        <sphereGeometry args={[1, 32, 24]} />
      </mesh>
      {/* Counter-Rotating Sci-Fi Reticles */}
      <mesh ref={retARef} visible={false} renderOrder={5} material={materials.retA}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={retBRef} visible={false} renderOrder={5} material={materials.retB}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      {/* Legendary Cloak-Pierce Shock & Arcs */}
      <mesh ref={pierceShockRef} visible={false} renderOrder={6} material={materials.shock}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh ref={pierceArcRef} visible={false} renderOrder={6} material={materials.arc}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      {/* Discovered Route Arcs */}
      {routeArcs.length > 0 && (
        <group ref={routesGroupRef} visible={false}>
          {routeArcs.map((arc, idx) => (
            <mesh
              key={idx}
              geometry={arc.geo}
              material={arc.cloaked ? materials.routeCloaked : materials.routeStd}
              renderOrder={5}
            />
          ))}
        </group>
      )}
    </group>
  );
}

export function MoonScanFx({
  events,
  moons,
  nodes,
}: {
  readonly events: readonly MoonScanFxEvent[];
  readonly moons?: GalaxyMoons | undefined;
  readonly nodes: readonly MoonHostRef[];
}) {
  const [wave, reticle, shock, arc] = useTexture([
    CIRCLE_WAVE_TEX,
    RETICLE_TEX,
    SHOCK_TEX,
    ARC_TEX,
  ]);

  const maps = useMemo<ScanMaps>(() => {
    for (const tex of [wave!, reticle!, shock!, arc!]) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
    }
    return { wave: wave!, reticle: reticle!, shock: shock!, arc: arc! };
  }, [wave, reticle, shock, arc]);

  const nodeById = useMemo(() => {
    const map = new Map<string, MoonHostRef>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  if (events.length === 0) return null;

  return (
    <group name="moon-scan-fx-layer">
      {events.map((ev) => (
        <ScanEffect
          key={ev.id}
          event={ev}
          moons={moons}
          nodeById={nodeById}
          maps={maps}
        />
      ))}
    </group>
  );
}
