import { STARTER_MODEL_SCALE } from './scene.js';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { toWorld, type Vec3 } from '@astera/rules';

const MARK_SIZE = 14;
const COLOUR = new THREE.Color(0.45, 0.85, 1);

function diamond(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d');
  if (c) {
    const glow = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    glow.addColorStop(0, 'rgba(255,255,255,.9)');
    glow.addColorStop(0.35, 'rgba(130,220,255,.35)');
    glow.addColorStop(1, 'rgba(130,220,255,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, 64, 64);
    c.translate(32, 32);
    c.rotate(Math.PI / 4);
    c.fillStyle = '#fff';
    c.fillRect(-6, -6, 12, 12);
  }
  return new THREE.CanvasTexture(canvas);
}

/**
 * THE SHARED SPRITE OF A KNOWN PART. One texture, a sprite each: there are never more than a handful
 * on a map. It breathes so it reads as a thing to go to, not as one more star.
 */
export function PartMarks({ marks }: { marks: readonly Vec3[] }) {
  const material = useMemo(() => new THREE.SpriteMaterial({ map: diamond(), color: COLOUR, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  useEffect(() => () => { material.map?.dispose(); material.dispose(); }, [material]);
  // Every sprite shares the one material, so one write a frame moves them all.
  useFrame(({ clock }) => { material.opacity = 0.65 + Math.sin(clock.elapsedTime * 2.4) * 0.3; });
  return (
    <>
      {marks.map(mark => (
        <sprite key={`${String(mark.x)},${String(mark.z)}`} material={material} position={toWorld(mark)} scale={MARK_SIZE * STARTER_MODEL_SCALE} raycast={() => null} />
      ))}
    </>
  );
}
