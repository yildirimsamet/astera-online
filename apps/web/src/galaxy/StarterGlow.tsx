import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { starterGlowDirections } from './mainSky.js';

/** The same spiral the first galaxies' screens show; 124×68. */
const GALAXY_URL = '/assets/images/starter/galaxy-badge.webp';
const GALAXY_ASPECT = 68 / 124;

/**
 * WHERE YOU CAME FROM, in the main galaxy's sky (A18). No data, no tap, nothing to read: only that
 * those places are really out there.
 *
 * VFX brief (owner 2026-11-18: no round glow anywhere). In the world: the first galaxies hang far off
 * in the main galaxy's sky, each a small spiral turned its own way. Asset:
 * `assets/images/starter/galaxy-badge.webp`, the spiral the starter screens use. Why: a galaxy looks
 * like a galaxy; a blur of light says nothing about where you came from.
 */
function Galaxies() {
  const map = useTexture(GALAXY_URL);
  const far = useThree(state => (state.camera instanceof THREE.PerspectiveCamera ? state.camera.far : 6000));
  const galaxies = useMemo(() => starterGlowDirections().map(([x, y, z], index) => ({
    at: [x * far * 0.8, y * far * 0.8, z * far * 0.8] as const,
    // Screen-fixed sizes a little apart, so they read as near and far, each turned its own way.
    width: 0.034 + 0.012 * ((index * 5) % 3) / 2,
    turn: index * 1.13,
  })), [far]);
  return (
    <>
      {galaxies.map(({ at, width, turn }, index) => (
        <sprite key={index} position={[...at]} scale={[width, width * GALAXY_ASPECT, 1]} raycast={() => null}>
          <spriteMaterial map={map} rotation={turn} sizeAttenuation={false} transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </>
  );
}

export function StarterGlow() {
  return <Suspense fallback={null}><Galaxies /></Suspense>;
}
