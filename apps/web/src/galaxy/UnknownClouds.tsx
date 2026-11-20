import { Suspense, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { PlanetNode } from './scene.js';
import { CLOUD, cloudAttributes, cloudLayout } from './unseenWorld.js';

/**
 * A BAND OF MIST IN FRONT OF EVERY WORLD OUTSIDE LIVE SIGHT (owner, 2026-11-20). See
 * `unseenWorld.ts` for what and why.
 *
 * One draw for the whole galaxy: an instanced quad, faced at the camera in its vertex shader and
 * lifted toward the camera so it hangs in front of the world, not inside it. It takes no taps — a
 * tap on a clouded world reaches the world — and it writes no depth. Its slow drift reads the
 * scene's clock and moves only when the scene is drawn anyway; it never asks for frames of its own.
 */

const vertex = /* glsl */ `
  attribute vec3 aCentre;
  attribute vec4 aShape;
  attribute vec2 aWorld;
  uniform float uLift;
  uniform float uTime;
  uniform vec2 uStretch;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float radius = aWorld.x;
    vec4 view = modelViewMatrix * vec4(aCentre, 1.0);
    view.xyz += normalize(-view.xyz) * radius * uLift;
    float sway = sin(uTime * 0.12 + aWorld.y) * 0.08;
    vec2 corner = position.xy * uStretch * aShape.z * radius;
    float c = cos(aShape.w);
    float s = sin(aShape.w);
    view.xy += vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y) + (aShape.xy + vec2(sway, 0.0)) * radius;
    gl_Position = projectionMatrix * view;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColour;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 cloud = texture2D(uMap, vUv);
    float alpha = cloud.a * uOpacity;
    if (!(alpha > 0.003)) discard;
    gl_FragColor = vec4(uColour * (0.6 + 0.5 * cloud.r), alpha);
  }
`;

const noRaycast = (): void => undefined;

function Clouds({ nodes }: { nodes: readonly PlanetNode[] }) {
  const map = useTexture(CLOUD.texture);
  const packed = useMemo(() => cloudAttributes(cloudLayout(nodes)), [nodes]);
  const geometry = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1);
    const instanced = new THREE.InstancedBufferGeometry();
    instanced.index = quad.index;
    instanced.setAttribute('position', quad.getAttribute('position'));
    instanced.setAttribute('uv', quad.getAttribute('uv'));
    instanced.setAttribute('aCentre', new THREE.InstancedBufferAttribute(packed.centre, 3));
    instanced.setAttribute('aShape', new THREE.InstancedBufferAttribute(packed.shape, 4));
    instanced.setAttribute('aWorld', new THREE.InstancedBufferAttribute(packed.world, 2));
    instanced.instanceCount = packed.count;
    return instanced;
  }, [packed]);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  const uniforms = useMemo(() => ({
    uMap: { value: map },
    uColour: { value: new THREE.Vector3(...CLOUD.colour) },
    uOpacity: { value: CLOUD.opacity },
    uLift: { value: CLOUD.lift },
    uStretch: { value: new THREE.Vector2(...CLOUD.stretch) },
    uTime: { value: 0 },
  }), [map]);
  useFrame((_state, delta) => {
    uniforms.uTime.value = (uniforms.uTime.value + Math.min(delta, 0.1)) % 1000;
  });
  if (packed.count === 0) return null;
  return (
    <mesh name="unknown-clouds" geometry={geometry} frustumCulled={false} raycast={noRaycast} renderOrder={5}>
      <shaderMaterial vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} />
    </mesh>
  );
}

export function UnknownClouds({ nodes }: { nodes: readonly PlanetNode[] }) {
  return <Suspense fallback={null}><Clouds nodes={nodes} /></Suspense>;
}
