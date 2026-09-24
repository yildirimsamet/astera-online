import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { rightCover } from '../lib/cover.js';

/** How much of the remaining gap one frame closes: a quarter-second glide, no bounce. */
const EASE = 0.18;

/**
 * THE CAMERA'S SUBJECT STAYS IN WHAT IS STILL OPEN. E11 · K10.
 *
 * On a wide screen a page docks as a column over the right of the galaxy, and the camera
 * kept centring its subject on the full width: the selected world, or home, sat under the
 * page's edge. This shifts the view — the projection, not the camera — by half of what a
 * right-docked page covers (`rightCover`), so the subject sits in the middle of the open
 * part. Taps, labels and the composer read the same projection, so they stay true.
 *
 * The pages are found in the DOM (both sheet kits mark `data-sheet-panel`), because they
 * are opened from the shell, from the galaxy and from inside other pages alike. Reads are
 * batched to one per animation frame. Nothing happens on a phone: a bottom sheet covers
 * nothing to the side.
 */
export function ViewOffset() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const target = useRef(0);
  const current = useRef(0);
  const applied = useRef<{ width: number; height: number; offset: number } | null>(null);

  useEffect(() => {
    let frame = 0;
    const read = (): void => {
      frame = 0;
      const canvas = gl.domElement.getBoundingClientRect();
      const panels = [...document.querySelectorAll('[data-sheet-panel]')].map((panel) => panel.getBoundingClientRect());
      const next = rightCover(canvas, panels);
      if (next !== target.current) {
        target.current = next;
        invalidate();
      }
    };
    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(read);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [gl, invalidate]);

  useFrame(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const goal = target.current;
    const gap = goal - current.current;
    current.current = Math.abs(gap) < 0.5 ? goal : current.current + gap * EASE;
    const offset = current.current / 2;
    const last = applied.current;
    // Re-applied on a resize too: the offset is in pixels of a size that has changed.
    if (last?.offset === offset && last.width === size.width && last.height === size.height) return;
    if (offset === 0) camera.clearViewOffset();
    else camera.setViewOffset(size.width, size.height, offset, 0, size.width, size.height);
    applied.current = { width: size.width, height: size.height, offset };
    if (current.current !== goal) invalidate();
  });

  return null;
}
