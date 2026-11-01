/**
 * ONE PIECE ON THE PRESENTATION PLINTH, at the top of its detail sheet. It turns on its own
 * and a drag turns it by hand; it never tilts or zooms, so the plinth stays under it.
 */
import { Suspense, useRef, type RefObject, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LegacyAward } from '../api/legacySchemas.js';
import { PlinthAward, StudioLight, TurntableFrames } from './AwardScene.js';

export const STAGE_ART = '/assets/legacy/stage-v1.webp';
const ART = { width: 1448, height: 1086 } as const;
/** The plinth top's centre and its width, measured on the painting. */
const PLINTH = { x: 724, y: 795, width: 755 } as const;

interface Drag { active: boolean; x: number; angle: number; velocity: number }

/** Drag turns the piece; letting go hands it back to the slow turn with a little momentum. */
function DragTurn({ drag, children }: { drag: RefObject<Drag>; children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const state = drag.current;
    if (!state.active) {
      state.velocity *= Math.exp(-delta * 3);
      state.angle += state.velocity * delta;
    }
    if (group.current) group.current.rotation.y = state.angle;
  });
  return <group ref={group}>{children}</group>;
}

export function AwardStage({ award, live = true }: { award: LegacyAward; live?: boolean }) {
  const aspect = ART.height / ART.width;
  const drag = useRef<Drag>({ active: false, x: 0, angle: 0, velocity: 0 });
  const end = () => { drag.current.active = false; };
  return (
    <div data-legacy-stage className="relative w-full touch-pan-y overflow-hidden rounded-control border border-v2-line bg-v2-void"
      style={{ aspectRatio: `${String(ART.width)} / ${String(ART.height)}` }}
      onPointerDown={event => { drag.current.active = true; drag.current.x = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => {
        const state = drag.current;
        if (!state.active) return;
        const step = (event.clientX - state.x) * 0.012;
        state.x = event.clientX;
        state.angle += step;
        state.velocity = step * 30;
      }}
      onPointerUp={end} onPointerCancel={end}>
      <img src={STAGE_ART} alt="" aria-hidden="true" decoding="async" draggable={false} className="absolute inset-0 size-full select-none object-cover" />
      {live && (
        <Canvas
          orthographic
          frameloop="demand"
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
          camera={{ manual: true, left: 0, right: 1, top: 0, bottom: -aspect, near: -10, far: 10, position: [0, 0, 5], zoom: 1 }}
          onCreated={({ gl, camera }) => {
            // A manual camera is never fitted by the canvas: without this its projection was
            // NaN and the stage showed an empty plinth.
            camera.updateProjectionMatrix();
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
            gl.setClearColor(0x000000, 0);
          }}
          className="pointer-events-none !absolute inset-0"
          aria-hidden="true"
        >
          <StudioLight keyIntensity={2.8} />
          <TurntableFrames />
          <Suspense fallback={null}>
            <group position={[PLINTH.x / ART.width, -PLINTH.y / ART.width, 0]} rotation-x={0.2}>
              <DragTurn drag={drag}>
                <PlinthAward award={award} scale={(PLINTH.width / ART.width) * 0.62} />
              </DragTurn>
            </group>
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
