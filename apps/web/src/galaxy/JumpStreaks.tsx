import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { JUMP_FLIGHT } from '@astera/rules';
import type { JumpingShipState } from './JumpingShip.js';
import { jumpStop, type JumpPath } from './jumpCamera.js';
import { shipStateAt } from './jumpShipState.js';

const smooth = (from: number, to: number, value: number): number => {
  const k = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return k * k * (3 - 2 * k);
};

const AHEAD = new THREE.Vector3(), ACROSS = new THREE.Vector3(), UP = new THREE.Vector3();
const STREAKS = 260;

/** Stars streaking past along the way while the ship is fast: one draw call, and it sells the speed. */
export function Streaks({ path, clock }: { path: JumpPath; clock: React.RefObject<number> }) {
  const stop = useMemo(() => jumpStop(path), [path]);
  const seeds = useMemo(() => Array.from({ length: STREAKS }, (_, i) => {
    const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12543.123, c = Math.sin(i * 39.425) * 24634.6345;
    return [(a - Math.floor(a) - 0.5) * 14, (b - Math.floor(b) - 0.5) * 22, c - Math.floor(c)] as const;
  }), []);
  const geometry = useMemo(() => {
    const made = new THREE.BufferGeometry();
    made.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STREAKS * 6), 3));
    return made;
  }, []);
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: '#a8ccff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const state = useRef<JumpingShipState>({ at: new THREE.Vector3(), facing: new THREE.Quaternion(), lever: 0, turbo: 0, vanish: 0 });
  useFrame(() => {
    const s = clock.current;
    const power = smooth(JUMP_FLIGHT.depart + 2.5, JUMP_FLIGHT.depart + 5, s) * (1 - smooth(JUMP_FLIGHT.arrive - 5, JUMP_FLIGHT.arrive - 2.5, s));
    material.opacity = power * 0.55;
    if (power <= 0) return;
    const at = shipStateAt(path.from, stop, s, state.current).at;
    AHEAD.set(stop[0] - path.from[0], stop[1] - path.from[1], stop[2] - path.from[2]).normalize();
    ACROSS.set(AHEAD.z, 0, -AHEAD.x).normalize();
    UP.crossVectors(ACROSS, AHEAD);
    const attribute = geometry.getAttribute('position');
    if (!(attribute instanceof THREE.BufferAttribute)) return;
    const array = attribute.array;
    const span = path.ship * 40;
    for (let i = 0; i < STREAKS; i++) {
      const [x, y, offset] = seeds[i]!;
      const along = span / 2 - ((offset * span + s * path.ship * 60) % span);
      const length = path.ship * (0.4 + power * 3);
      for (let end = 0; end < 2; end++) {
        const k = along - end * length;
        array[i * 6 + end * 3] = at.x + ACROSS.x * x * path.ship + UP.x * y * path.ship + AHEAD.x * k;
        array[i * 6 + end * 3 + 1] = at.y + ACROSS.y * x * path.ship + UP.y * y * path.ship + AHEAD.y * k;
        array[i * 6 + end * 3 + 2] = at.z + ACROSS.z * x * path.ship + UP.z * y * path.ship + AHEAD.z * k;
      }
    }
    attribute.needsUpdate = true;
  });
  return <lineSegments geometry={geometry} material={material} frustumCulled={false} />;
}
