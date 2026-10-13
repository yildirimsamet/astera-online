import { createContext, useContext, useLayoutEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { Vector3, Camera } from 'three';

import type { OpeningPreparation, OpeningResult } from './openingPreparation.js';
import { createOpeningViews } from './openingViewSequence.js';

interface OpeningControls { target: Vector3; object: Camera; enabled: boolean; update: () => unknown }

/** Pending React LOD work belongs to this canvas, never to another preview. */
export const OpeningWork = createContext<OpeningPreparation | null>(null);
export function useOpeningWork(pending: boolean) {
  const work = useContext(OpeningWork);
  useLayoutEffect(() => {
    if (!work || !pending) return;
    const finish = work.begin();
    return () => { finish('cancelled'); };
  }, [work, pending]);
}

/** Suspense fallback participates in preparation without hiding its existing art. */
export function OpeningAssetPending() {
  useOpeningWork(true);
  return null;
}

/** The normal camera rig pauses while this hook prepares hidden views. */
export function useOpeningViews({ controls, covered, ready, settled, wideDistance, homeDistance, work }: {
  controls: RefObject<OpeningControls | null>;
  covered: boolean;
  ready: boolean;
  settled: RefObject<boolean>;
  wideDistance: number;
  homeDistance: number | null;
  work: OpeningPreparation;
}) {
  const gl = useThree(state => state.gl);
  const invalidate = useThree(state => state.invalidate);
  const machine = useRef(createOpeningViews());
  const saved = useRef<{ position: Vector3; target: Vector3; enabled: boolean } | null>(null);
  const active = useRef(false);
  const restore = () => {
    const c = controls.current;
    const s = saved.current;
    if (!c || !s) return;
    c.target.copy(s.target);
    c.object.position.copy(s.position);
    c.enabled = s.enabled;
    c.update();
    saved.current = null;
  };
  const finish = (result: OpeningResult) => {
    work.finish(result);
    gl.domElement.dataset.galaxyPreparation = work.result ?? result;
    settled.current = true;
  };
  // Restore camera state synchronously if the parent cover times out.
  useLayoutEffect(() => {
    if (settled.current || (covered && (ready || !active.current))) return;
    machine.current.beforeFrame(covered, ready);
    restore();
    active.current = false;
    finish(machine.current.result ?? (covered ? 'context-lost' : 'timeout'));
    invalidate();
  }, [covered, ready, settled, invalidate]);
  // Before LOD selection (0), after OrbitControls' damping update (-1).
  useFrame(() => {
    const c = controls.current;
    if (!c || settled.current) return;
    const step = machine.current.beforeFrame(covered, ready);
    if (!covered || (active.current && !ready)) {
      if (step === 'restore') restore();
      active.current = false;
      finish(machine.current.result ?? (covered ? 'context-lost' : 'timeout'));
      invalidate();
      return;
    }
    if (!step || step === 'restore') return;
    if (!saved.current) {
      const target = c.target.clone();
      const direction = c.object.position.clone().sub(target).normalize();
      const position = homeDistance === null ? c.object.position.clone() : target.clone().addScaledVector(direction, homeDistance);
      saved.current = { position, target, enabled: c.enabled };
    }
    const s = saved.current;
    active.current = true;
    c.enabled = false;
    const direction = s.position.clone().sub(s.target).normalize();
    if (step === 'wide') {
      c.target.set(0, 0, 0);
      c.object.position.copy(direction.multiplyScalar(wideDistance));
    } else if (step === 'middle') {
      c.target.copy(s.target).multiplyScalar(0.5);
      c.object.position.copy(c.target).addScaledVector(direction, Math.sqrt(wideDistance * s.position.distanceTo(s.target)));
    } else {
      c.target.copy(s.target);
      c.object.position.copy(s.position);
    }
    c.update();
    c.object.updateMatrixWorld();
    invalidate();
  }, -0.5);
  // After the real composer (1). Each stage includes the normal visual/culling path.
  useFrame(() => {
    if (!active.current || !ready) return;
    if (machine.current.afterFrame(work.size > 0, work.revision)) {
      restore();
      active.current = false;
      finish('ready');
    }
    invalidate();
  }, 1.5);
  // Effect replay also runs cleanup; only the live camera owner may finish the barrier.
  useLayoutEffect(() => () => { restore(); active.current = false; }, []);
  return active;
}
