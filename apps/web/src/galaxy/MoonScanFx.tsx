import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { GalaxyMoons } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { moonOrbitPosition, moonRadiusFor } from './moonOrbit.js';
import type { MoonHostRef } from './MoonGateWarpFx.js';

/*
  VFX BRIEF — Moon Gözcü Scanner Telemetry Wave & Target Hologram Lock
  - Physical event: The commander's moon fires a silent Gözcü route scan. A crisp circular
    sensor pulse expands from the scanning moon (`circle-wave-5x5.webp`), a telemetry beam packet
    streaks to the target world, and a holographic latitude/longitude scan shell + counter-rotating
    Sci-Fi reticle (`circles-outlines-2x2.webp`) sweeps and locks onto the target. Legendary
    cloak-piercing scans burn amber-gold and add an electric pierce burst (`white-shock-4x4.webp`
    + `electric-line-4x4.webp`).
  - Zero radial glow sprites; 60fps only while active.
*/

const CIRCLE_WAVE_TEX = '/assets/vfx/library/circle-wave-5x5.webp';
const RETICLE_TEX = '/assets/vfx/library/circles-outlines-2x2.webp';
const SHOCK_TEX = '/assets/vfx/library/white-shock-4x4.webp';
const ARC_TEX = '/assets/vfx/library/electric-line-4x4.webp';

export const MOON_SCAN_DURATION_MS = 6_000;

export interface MoonScanFxEvent {
  readonly id: string;
  readonly fromPlanetId: string;
  readonly targetPlanetId: string;
  readonly startedAtMs: number;
  readonly pierced: boolean;
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
    Object.values(localTex).forEach((t) => { t.dispose(); });
    Object.values(materials).forEach((m) => { m.dispose(); });
  }, [beamGeo, localTex, materials]);

  const waveRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const retARef = useRef<THREE.Mesh>(null);
  const retBRef = useRef<THREE.Mesh>(null);
  const pierceShockRef = useRef<THREE.Mesh>(null);
  const pierceArcRef = useRef<THREE.Mesh>(null);

  const scratch = useMemo(() => ({
    parent: { x: 0, y: 0, z: 0 },
    moonPos: { x: 0, y: 0, z: 0 },
    fromV: new THREE.Vector3(),
    toV: new THREE.Vector3(),
    head: new THREE.Vector3(),
    tail: new THREE.Vector3(),
    toCam: new THREE.Vector3(),
  }), []);

  useFrame(({ camera }) => {
    const nowMs = serverNow();
    const t = (nowMs - event.startedAtMs) / 1_000;
    if (t < 0 || t > MOON_SCAN_DURATION_MS / 1_000) return;

    const fromNode = nodeById.get(event.fromPlanetId);
    const toNode = nodeById.get(event.targetPlanetId);
    if (!fromNode || !toNode) return;

    const timeSec = nowMs / 1_000;
    const fromMoon = moons?.list.find((m) => m.planetId === event.fromPlanetId);
    scratch.parent.x = fromNode.position[0];
    scratch.parent.y = fromNode.position[1];
    scratch.parent.z = fromNode.position[2];
    moonOrbitPosition(scratch.parent, fromNode.radius, fromMoon?.visualSeed ?? 1, timeSec, scratch.moonPos);
    const moonR = moonRadiusFor(fromNode.radius, moons?.rarity[event.fromPlanetId]);

    scratch.fromV.set(scratch.moonPos.x, scratch.moonPos.y, scratch.moonPos.z);
    scratch.toV.set(toNode.position[0], toNode.position[1], toNode.position[2]);

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

    // 3. Target Holographic Sweep Shell + Counter-Rotating Sci-Fi Reticles (0.95s -> 5.8s)
    const targetAge = t - 0.95;
    const targetActive = targetAge >= 0 && targetAge < 4.9;
    const r = toNode.radius;
    if (shellRef.current) {
      shellRef.current.visible = targetActive;
      if (targetActive) {
        shellRef.current.position.copy(scratch.toV);
        shellRef.current.scale.setScalar(r * 1.04);
        const sweepProg = clamp01(targetAge / 1.65);
        materials.shell.uniforms.uSweep!.value = 1.15 - sweepProg * 2.3;
        materials.shell.uniforms.uBand!.value = smooth(0, 0.2, targetAge) * (1 - smooth(1.6, 2.4, targetAge));
        materials.shell.uniforms.uGrid!.value = smooth(0.15, 0.7, targetAge) * (1 - smooth(3.6, 4.85, targetAge));
      }
    }

    // Camera-facing reticles locking onto target planet
    scratch.toCam.copy(camera.position).sub(scratch.toV).normalize().multiplyScalar(r * 1.18);
    const lockGrow = smooth(0, 0.35, targetAge);
    const lockFade = 1 - smooth(3.9, 4.85, targetAge);
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

    // 4. Legendary Cloak-Pierce Shock + Electric Arc on Target (1.05s -> 2.4s)
    const pierceProg = event.pierced && targetAge >= 0.08 ? clamp01((targetAge - 0.08) / 1.2) : -1;
    if (pierceShockRef.current) {
      pierceShockRef.current.visible = pierceProg >= 0 && pierceProg < 1;
      if (pierceProg >= 0 && pierceProg < 1) {
        pierceShockRef.current.position.copy(scratch.toV).add(scratch.toCam);
        pierceShockRef.current.quaternion.copy(camera.quaternion);
        pierceShockRef.current.scale.setScalar(r * (1.8 + 3.4 * pierceProg));
        setGridFrame(localTex.shock, pierceProg * 15, 4, 4);
        materials.shock.opacity = (1 - pierceProg) * 0.95;
      }
    }
    if (pierceArcRef.current) {
      pierceArcRef.current.visible = pierceProg >= 0 && pierceProg < 0.85;
      if (pierceProg >= 0 && pierceProg < 0.85) {
        pierceArcRef.current.position.copy(scratch.toV).add(scratch.toCam);
        pierceArcRef.current.quaternion.copy(camera.quaternion);
        pierceArcRef.current.rotateZ(Math.floor(t * 16) * 1.1);
        pierceArcRef.current.scale.setScalar(r * 2.9);
        setGridFrame(localTex.arc, (t * 24) % 16, 4, 4);
        materials.arc.opacity = (1 - pierceProg / 0.85) * 0.9;
      }
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
