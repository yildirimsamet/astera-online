import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { planetEmbers } from './planetImpactMaterial.js';
import { screenFloorScale, screenPixels } from './publicMoments.js';
import type { PlanetNode } from './scene.js';

/**
 * A DEATH STAR'S EMBER, SEEN FROM ACROSS THE DISC. Owner, 2026-10-16: *"Oyuncu zoom-out iken
 * galaksiye baktığında -> aa bu gezegen ölüm yıldızı ile vurulmuş … diyecek kadar fark
 * edebilir olmalı (abartmadan)."*
 *
 * The fissures (`planetImpactMaterial`) carry the close view; they are sub-pixel once a world
 * is a speck. This is a dull red corona behind the body for the hour of EMP: depth-tested, so
 * the world itself covers its middle and only a burning rim shows, slowly breathing, a little
 * hotter with each hit. Below `MIN_PIXELS` of radius it keeps that size on screen so the mark
 * survives the zoom — and only the mark; the world stays its true size. Close up, where the
 * fissures are legible, it fades to a faint rim.
 */

const MIN_PIXELS = 5;
/** Corona radius as a multiple of the world's: wide enough to read as a rim, not a halo. */
const SPREAD = 1.55;

let corona: THREE.Texture | null = null;
function coronaTexture(): THREE.Texture {
  if (corona) return corona;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The ember corona needs a 2D canvas');
  const glow = context.createRadialGradient(64, 64, 18, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255, 92, 40, 0.9)');
  glow.addColorStop(0.45, 'rgba(230, 38, 18, 0.55)');
  glow.addColorStop(1, 'rgba(120, 8, 4, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 128, 128);
  corona = new THREE.CanvasTexture(canvas);
  corona.colorSpace = THREE.SRGBColorSpace;
  return corona;
}

export function PlanetEmbers({ nodes }: { nodes: readonly PlanetNode[] }) {
  const embers = useMemo(() => planetEmbers(nodes), [nodes]);
  return <>{embers.map(({ node, level }) => <Ember key={node.id} node={node} level={level} />)}</>;
}

function Ember({ node, level }: { node: PlanetNode; level: number }) {
  const sprite = useRef<THREE.Sprite>(null);
  const centre = useMemo(() => new THREE.Vector3(...node.position), [node.position]);
  const material = useMemo(() => new THREE.SpriteMaterial({
    map: coronaTexture(), transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, toneMapped: false,
  }), []);
  useEffect(() => () => { material.dispose(); }, [material]);
  // A seeded phase, so a galaxy of struck worlds does not pulse in step.
  const phase = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < node.id.length; i++) sum += node.id.charCodeAt(i);
    return sum % 7;
  }, [node.id]);

  useFrame(({ camera, size, clock }) => {
    if (!sprite.current) return;
    const radius = node.radius * screenFloorScale(node.radius, centre, camera, size.height, MIN_PIXELS);
    const width = radius * SPREAD * 2;
    sprite.current.scale.set(width, width, 1);
    const breath = 0.86 + 0.14 * Math.sin(clock.elapsedTime * 1.4 + phase);
    // Up close the fissures tell it; the corona steps back as the world fills the screen.
    const near = Math.min(1, Math.max(0, (screenPixels(node.radius, centre, camera, size.height) - 12) / 48));
    material.opacity = (0.26 + level * 0.05) * breath * (1 - 0.6 * near);
  });

  return <sprite ref={sprite} position={node.position} material={material}
    name="planet-ember" raycast={() => undefined} />;
}
