import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SELECTION_RING, eyeMarkerScale } from './PlanetField.js';
import { screenFloorScale } from './publicMoments.js';
import type { PlanetNode } from './scene.js';

/**
 * A BROKEN COLONY SAYS SO OVER ITS OWN WORLD, TO ITS OWN COMMANDER. Owner, 2026-10-16:
 * *"Kolonilerde arıza olduğunda kolonin üstünde sahibinin görebileceği bir arıza işareti
 * çıkıyordu eskiden. Yok olmuş tekrar gelmeli. Kolonide arıza olduğunu anlamakta
 * zorlanıyorlar … Görünür anlaşılır fark edilir olsun."*
 *
 * The label's icon (`GalaxyPlanetName`) is still there, but labels now appear only once the
 * camera is close, and beside a small grey name a thin glyph is easy to miss. This badge
 * stands in the marker stack instead, on the eye's scale law, so it keeps its size on screen
 * from the whole disc: the fault glyph the base and repair screens use, white on the threat
 * red, at the world's upper-right shoulder where neither the chevron nor the eye sits. A soft
 * ring leaves it every few seconds, so the eye finds it without it shouting.
 *
 * Owner-only by construction: `faulty` is attached server-side to the caller's own worlds
 * alone, and the selector also requires `isOwned`, so a forged payload marks nothing foreign.
 */

export const faultMarkNodes = (nodes: readonly PlanetNode[]): PlanetNode[] =>
  nodes.filter((node) => node.isOwned && node.faulty === true && node.intel !== 'UNKNOWN');

/** Badge width as a multiple of the world's radius, before the marker scale. */
const BADGE = 0.62;
/** Where it sits: out along the shoulder, past the edge marker. */
const SHOULDER = SELECTION_RING * 0.82;
const WAVE_SECONDS = 2.4;
/** The badge never reads smaller than this across, so a broken colony is found from afar. */
const BADGE_MIN_PIXELS = 18;
const THREAT = '#e2412c';

let badge: THREE.Texture | null = null;
function badgeTexture(): THREE.Texture {
  if (badge) return badge;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The fault badge needs a 2D canvas');
  context.beginPath();
  context.arc(64, 64, 58, 0, Math.PI * 2);
  context.fillStyle = THREAT;
  context.fill();
  context.lineWidth = 6;
  context.strokeStyle = 'rgba(12, 6, 6, 0.85)';
  context.stroke();
  // `FaultMark` (ui/marks.tsx), drawn from its own 24-unit paths.
  context.save();
  context.translate(64 - 36, 64 - 36);
  context.scale(3, 3);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2.3;
  context.stroke(new Path2D('M13.5 3 5.5 13h5l-1 8 8-10h-5z'));
  context.lineWidth = 2.5;
  context.stroke(new Path2D('M3 3l18 18'));
  context.restore();
  badge = new THREE.CanvasTexture(canvas);
  badge.colorSpace = THREE.SRGBColorSpace;
  return badge;
}

let ring: THREE.Texture | null = null;
function waveTexture(): THREE.Texture {
  if (ring) return ring;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The fault wave needs a 2D canvas');
  context.beginPath();
  context.arc(64, 64, 56, 0, Math.PI * 2);
  context.lineWidth = 8;
  context.strokeStyle = THREAT;
  context.stroke();
  ring = new THREE.CanvasTexture(canvas);
  ring.colorSpace = THREE.SRGBColorSpace;
  return ring;
}

export function FaultMarks({ nodes }: { nodes: readonly PlanetNode[] }) {
  const marked = useMemo(() => faultMarkNodes(nodes), [nodes]);
  return <>{marked.map((node) => <FaultBadge key={node.id} node={node} />)}</>;
}

function FaultBadge({ node }: { node: PlanetNode }) {
  const group = useRef<THREE.Group>(null);
  const wave = useRef<THREE.Mesh>(null);
  const centre = useMemo(() => new THREE.Vector3(...node.position), [node.position]);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const face = useMemo(() => new THREE.MeshBasicMaterial({
    map: badgeTexture(), transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
  }), []);
  const halo = useMemo(() => new THREE.MeshBasicMaterial({
    map: waveTexture(), transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
  }), []);
  useEffect(() => () => { face.dispose(); halo.dispose(); }, [face, halo]);

  useFrame(({ camera, size, clock }) => {
    if (!group.current || !(camera instanceof THREE.PerspectiveCamera)) return;
    const scale = Math.max(
      eyeMarkerScale(camera.position.distanceTo(centre), node.radius, size.height, camera.fov),
      screenFloorScale(node.radius * BADGE, centre, camera, size.height, BADGE_MIN_PIXELS),
    );
    const out = node.radius * SHOULDER * scale;
    offset.set(out, out, 0).applyQuaternion(camera.quaternion);
    group.current.position.copy(centre).add(offset);
    group.current.quaternion.copy(camera.quaternion);
    group.current.scale.setScalar(node.radius * scale * BADGE);
    if (wave.current) {
      const t = (clock.elapsedTime % WAVE_SECONDS) / WAVE_SECONDS;
      wave.current.scale.setScalar(1 + t * 0.9);
      halo.opacity = 0.55 * (1 - t) ** 2;
    }
  });

  return (
    <group ref={group} name="colony-fault-badge" renderOrder={1200}>
      <mesh ref={wave} material={halo} renderOrder={1200} raycast={() => undefined}><planeGeometry args={[1, 1]} /></mesh>
      <mesh material={face} renderOrder={1201} raycast={() => undefined}><planeGeometry args={[1, 1]} /></mesh>
    </group>
  );
}
