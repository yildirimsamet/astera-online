import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ActiveClanAlarm } from '../lib/clanAlarm.js';
import { SELECTION_RING, eyeMarkerScale } from './PlanetField.js';
import { screenFloorScale } from './publicMoments.js';
import type { PlanetNode } from './scene.js';

/**
 * KLAN ALARMI OVER THE GALAXY (F2 plan §5, owner 2026-11-10): a clanmate's world under a raid
 * still in the air wears a red ring that keeps breaking outward, at every zoom, so a commander who
 * opens the map sees where the clan is being hit before reading a word. When the host's radar read
 * where the raid came from, a red trail flows from the raider's world into the ringed one.
 *
 * Fed by the reader's own bell (`activeClanAlarms`): nothing here is drawn that the alarm card did
 * not already tell this commander.
 */
const THREAT = '#e2412c';
const WAVE_SECONDS = 1.8;
/** The ring never reads smaller than this across, so a raid is found from the whole disc. */
const RING_MIN_PIXELS = 34;

let ringTexture: THREE.Texture | null = null;
function ring(): THREE.Texture {
  if (ringTexture) return ringTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The alarm ring needs a 2D canvas');
  context.beginPath();
  context.arc(64, 64, 58, 0, Math.PI * 2);
  context.lineWidth = 5;
  context.strokeStyle = THREAT;
  context.shadowColor = THREAT;
  context.shadowBlur = 8;
  context.stroke();
  ringTexture = new THREE.CanvasTexture(canvas);
  ringTexture.colorSpace = THREE.SRGBColorSpace;
  return ringTexture;
}

export function AlarmRings({ nodes, alarms }: { nodes: readonly PlanetNode[]; alarms: readonly ActiveClanAlarm[] }) {
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  return <>{alarms.map((alarm) => {
    const host = byId.get(alarm.hostPlanetId);
    if (!host) return null;
    const origin = alarm.originPlanetId ? byId.get(alarm.originPlanetId) : undefined;
    return (
      <group key={alarm.hostPlanetId} name="clan-alarm">
        <AlarmRing node={host} />
        {origin && origin.id !== host.id && <RaidTrail from={origin} to={host} />}
      </group>
    );
  })}</>;
}

function AlarmRing({ node }: { node: PlanetNode }) {
  const group = useRef<THREE.Group>(null);
  const waves = useRef<(THREE.Mesh | null)[]>([]);
  const centre = useMemo(() => new THREE.Vector3(...node.position), [node.position]);
  const materials = useMemo(() => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({
    map: ring(), transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
  })), []);
  useEffect(() => () => { for (const material of materials) material.dispose(); }, [materials]);

  useFrame(({ camera, size, clock }) => {
    if (!group.current || !(camera instanceof THREE.PerspectiveCamera)) return;
    const across = node.radius * SELECTION_RING * 2.3;
    const scale = Math.max(
      eyeMarkerScale(camera.position.distanceTo(centre), node.radius, size.height, camera.fov),
      screenFloorScale(across, centre, camera, size.height, RING_MIN_PIXELS),
    );
    group.current.position.copy(centre);
    group.current.quaternion.copy(camera.quaternion);
    group.current.scale.setScalar(across * scale);
    // A steady band, and two waves leaving it half a beat apart.
    materials[0]!.opacity = 0.75 + Math.sin(clock.elapsedTime * 5) * 0.2;
    for (const index of [1, 2]) {
      const t = ((clock.elapsedTime / WAVE_SECONDS) + (index - 1) * 0.5) % 1;
      waves.current[index]?.scale.setScalar(1 + t * 0.85);
      materials[index]!.opacity = 0.6 * (1 - t) ** 2;
    }
  });

  return (
    <group ref={group} renderOrder={1190}>
      {materials.map((material, index) => (
        <mesh key={index} ref={(mesh) => { waves.current[index] = mesh; }} material={material}
          renderOrder={1190 + index} raycast={() => undefined}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
    </group>
  );
}

const TRAIL_STEPS = 48;

/** A red dashed line that flows from the raider's world into the alarmed one. */
function RaidTrail({ from, to }: { from: PlanetNode; to: PlanetNode }) {
  const geometry = useMemo(() => {
    const start = new THREE.Vector3(...from.position);
    const end = new THREE.Vector3(...to.position);
    const positions: number[] = [];
    const along: number[] = [];
    for (let step = 0; step < TRAIL_STEPS; step++) {
      for (const t of [step / TRAIL_STEPS, (step + 1) / TRAIL_STEPS]) {
        const at = start.clone().lerp(end, t);
        positions.push(at.x, at.y, at.z);
        along.push(t);
      }
    }
    const built = new THREE.BufferGeometry();
    built.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    built.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    return built;
  }, [from.position, to.position]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(THREAT) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    vertexShader: `
      attribute float aAlong;
      varying float vAlong;
      void main() {
        vAlong = aAlong;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying float vAlong;
      void main() {
        float dash = step(0.45, fract(vAlong * 18.0 - uTime * 1.6));
        // Faint where the raid left, bright where it lands.
        float alpha = (0.25 + 0.75 * vAlong) * (0.35 + 0.65 * dash);
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  }), []);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  useEffect(() => () => { material.dispose(); }, [material]);
  useFrame(({ clock }) => { material.uniforms.uTime!.value = clock.elapsedTime; });

  return (
    <lineSegments name="clan-alarm-trail" geometry={geometry} frustumCulled={false} renderOrder={-1} raycast={() => null}>
      <primitive object={material} attach="material" />
    </lineSegments>
  );
}
