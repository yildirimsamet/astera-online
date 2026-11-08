import { useMemo, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Vector3 } from 'three';
import { haptic } from '../lib/haptics.js';
import type { PlanetNode } from './scene.js';
import { createSignalGuideProjection } from './signalGuide.js';
import { markHit } from './tap.js';
import { useVisualFrame } from './visualFrame.js';
import './outpostGuide.css';

type Flags = RefObject<Map<string, HTMLButtonElement>>;

/** How far above the screen's foot a flag waits: the objective line and the tab bar hold the rest. */
export const FLAG_FLOOR = 170;

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
export function OutpostGuides({ nodes, elements, onSelect }: { nodes: readonly PlanetNode[]; elements: Flags; onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  return nodes.filter(node => node.firstHunt).map(node => (
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
    </button>
  ));
}

/** Runs after the camera moves; writes a transform and nothing React has to render. */
export function OutpostGuideTracker({ nodes, elements, focusedId }: { nodes: readonly PlanetNode[]; elements: Flags; focusedId: string | null }) {
  const project = useMemo(createSignalGuideProjection, []);
  const target = useMemo(() => new Vector3(), []);
  const screen = useMemo(() => new Vector3(), []);
  useVisualFrame(({ camera, size }) => {
    for (const node of nodes) {
      const flag = node.firstHunt ? elements.current.get(node.id) : undefined;
      if (!flag) continue;
      // An open outpost has its own label over it; the flag steps aside for it.
      const placement = node.id === focusedId ? null : project(target.set(...node.position), camera, size);
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
        flag.style.transform = `translate3d(${String(x)}px,${String(y)}px,0) translate(-50%,-100%) translateY(-10px)`;
      }
    }
  });
  return null;
}
