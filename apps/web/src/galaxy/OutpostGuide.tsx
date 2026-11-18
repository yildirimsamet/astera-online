import { useMemo, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Vector3 } from 'three';
import { haptic } from '../lib/haptics.js';
import { screenPixels } from './publicMoments.js';
import type { PlanetNode } from './scene.js';
import { createSignalGuideProjection } from './signalGuide.js';
import { markHit } from './tap.js';
import { useVisualFrame } from './visualFrame.js';
import './outpostGuide.css';

type Flags = RefObject<Map<string, HTMLButtonElement>>;
type Locks = RefObject<Map<string, HTMLElement>>;

/** How far above the screen's foot a flag waits: the objective line and the tab bar hold the rest. */
export const FLAG_FLOOR = 170;

/** The narrowest a lock is drawn: a far world is a few pixels, and the mark round it still has to be seen. */
const LOCK_MIN_PX = 44;
/** The lock's ring stands this far out of the world's disc. */
const LOCK_MARGIN = 1.35;

/**
 * THE SENSORS' LOCK ON A HUNT'S WORLD (owner, phone playtest 2026-11-18, item 14). Four arcs on the
 * diagonals and a tick in each gap; drawn only while the guide points at the world, never in the way of
 * the tap on it. The shape is the library's combat reticle arc (Synty military combat HUD), as strokes.
 */
function OutpostLock() {
  return (
    <svg viewBox="-50 -50 100 100" fill="none" aria-hidden="true">
      <circle r="46" pathLength="360" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="50 40" strokeDashoffset="-20" vectorEffect="non-scaling-stroke" />
      <path d="M50 0h-8M-50 0h8M0 50v-8M0-50v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A pirate pennant on its pole; only the cloth moves. */
export function OutpostFlag({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M5 2.5v19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path className="outpost-flag-cloth" d="M5.8 3.5h13.4l-3.6 4.2 3.6 4.3H5.8Z" fill="currentColor" fillOpacity=".9" />
      <circle cx="10.6" cy="7.6" r="1.5" fill="#1a1405" />
    </svg>
  );
}

/**
 * THE FIRST HUNT'S FLAGS (plan §5.2, F4d). Each of the ship's two first outposts flies one, named,
 * which the tracker below places: over the outpost while it is in view, at the screen's edge pointing
 * to it while it is not. A tap opens the outpost. This DOM sits beside the Canvas, never clipped by it.
 */
export function OutpostGuides({ nodes, elements, locks, onSelect }: { nodes: readonly PlanetNode[]; elements: Flags; locks: Locks; onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  return nodes.filter(node => node.firstHunt).flatMap(node => [
    <span
      key={`${node.id}:lock`}
      ref={lock => { if (lock) locks.current.set(node.id, lock); else locks.current.delete(node.id); }}
      aria-hidden="true"
      data-outpost-planet={node.id}
      data-scene-mark=""
      className="outpost-lock"
    >
      <OutpostLock />
    </span>,
    <button
      key={node.id}
      ref={flag => { if (flag) elements.current.set(node.id, flag); else elements.current.delete(node.id); }}
      type="button"
      aria-label={t('starter.outpostGuide', { name: node.name })}
      data-outpost-guide={node.id}
      data-scene-mark=""
      className="outpost-guide text-v2-warn"
      style={{ transform: 'translate3d(-9999px,-9999px,0)' }}
      onPointerDown={event => { event.stopPropagation(); }}
      onClick={event => { event.stopPropagation(); markHit(); haptic('tap'); onSelect(node.id); }}
    >
      <span aria-hidden="true" className="outpost-guide-mark">
        <span className="outpost-guide-bearing" />
        <OutpostFlag className="outpost-guide-flag" />
      </span>
      <span className="outpost-guide-name font-v2-ui">{node.name}</span>
    </button>,
  ]);
}

/** Runs after the camera moves; writes a transform and nothing React has to render. */
export function OutpostGuideTracker({ nodes, elements, locks, focusedId }: { nodes: readonly PlanetNode[]; elements: Flags; locks: Locks; focusedId: string | null }) {
  const project = useMemo(createSignalGuideProjection, []);
  const target = useMemo(() => new Vector3(), []);
  const screen = useMemo(() => new Vector3(), []);
  useVisualFrame(({ camera, size }) => {
    for (const node of nodes) {
      if (!node.firstHunt) continue;
      const flag = elements.current.get(node.id);
      const lock = locks.current.get(node.id);
      // An open outpost has its own label over it; the flag and the lock step aside for it.
      const placement = node.id === focusedId ? null : project(target.set(...node.position), camera, size);
      // The lock rides the world's disc while it is on the screen; off it, the flag at the edge points the way.
      const across = placement && !placement.offscreen ? Math.max(LOCK_MIN_PX, 2 * LOCK_MARGIN * screenPixels(node.radius, target, camera, size.height)) : 0;
      if (lock) {
        lock.style.display = across > 0 ? 'block' : 'none';
        if (across > 0) {
          screen.copy(target).project(camera);
          lock.style.width = lock.style.height = `${String(across)}px`;
          lock.style.transform = `translate3d(${String((screen.x + 1) * size.width / 2)}px,${String((1 - screen.y) * size.height / 2)}px,0) translate(-50%,-50%)`;
        }
      }
      if (!flag) continue;
      flag.style.visibility = placement ? 'visible' : 'hidden';
      if (!placement) continue;
      flag.dataset.offscreen = String(placement.offscreen);
      if (placement.offscreen) {
        const y = Math.min(placement.y, size.height - FLAG_FLOOR);
        flag.style.transform = `translate3d(${String(placement.x)}px,${String(y)}px,0) translate(-50%,-50%)`;
        flag.style.setProperty('--outpost-guide-angle', `${String(placement.angle)}rad`);
      } else {
        screen.copy(target).project(camera);
        const x = (screen.x + 1) * size.width / 2;
        const y = (1 - screen.y) * size.height / 2;
        // Clear above the lock, so the flag never covers the world it names.
        flag.style.transform = `translate3d(${String(x)}px,${String(y)}px,0) translate(-50%,-100%) translateY(${String(-across / 2 - 2)}px)`;
      }
    }
  });
  return null;
}
