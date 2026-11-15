import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clearAegisHits, strikeAegis, type AegisHit } from '../../galaxy/aegisHits.js';
import { serverNow } from '../../lib/clock.js';

/*
  The lab's raid on the Aegis dome (2026-11-12): a round strikes every 0.45 s somewhere on the side
  facing the camera, through the game's own hit channel (`aegisHits`), so the dome drawn is the game's.
*/
const RAID = 'lab-raid';
const SPACING_MS = 450;
const hash = (n: number): number => { const x = Math.sin(n * 91.7 + 13.1) * 43758.5453; return x - Math.floor(x); };

export function AegisRaid({ start }: { start: number }) {
  const base = useMemo(() => serverNow() + (start - Date.now()), [start]);
  const hits = useMemo<AegisHit[]>(() => Array.from({ length: 4 }, () => ({ centre: [0, 0, 0], direction: [1, 0, 0], at: 0, strength: 1 })), []);
  const view = useMemo(() => new THREE.Vector3(), []);
  const d = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => () => { clearAegisHits(RAID); }, []);
  useFrame(({ camera }) => {
    view.copy(camera.position).normalize();
    const latest = Math.floor((serverNow() - base) / SPACING_MS);
    hits.forEach((hit, i) => {
      const shot = latest - i;
      const z = hash(shot * 3 + 1) * 2 - 1, a = hash(shot * 3 + 2) * Math.PI * 2, s = Math.sqrt(1 - z * z);
      d.set(Math.cos(a) * s, z, Math.sin(a) * s);
      const facing = d.dot(view);
      if (facing < 0.35) d.addScaledVector(view, 0.35 - facing + 0.3).normalize();
      hit.direction[0] = d.x; hit.direction[1] = d.y; hit.direction[2] = d.z;
      hit.at = shot >= 0 ? base + shot * SPACING_MS : -Infinity;
    });
    strikeAegis(RAID, hits);
  });
  return null;
}
