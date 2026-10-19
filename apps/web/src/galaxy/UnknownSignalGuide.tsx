import { useMemo, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Vector3 } from 'three';
import type { UnknownSignalView } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { useNow } from '../lib/time.js';
import { toWorld } from './scene.js';
import { createSignalGuideProjection } from './signalGuide.js';
import { markHit } from './tap.js';
import { useVisualFrame } from './visualFrame.js';
import './unknownSignal.css';

interface GuideProps {
  signals: readonly UnknownSignalView[];
  element: RefObject<HTMLButtonElement | null>;
}

/** This DOM sibling of Canvas is never clipped or hidden when its target is behind the camera. */
export function UnknownSignalGuide({ signals, element, onSelect }: GuideProps & { onSelect: (id: string) => void }) {
  const { t } = useTranslation();
  const now = useNow();
  const signal = signals.find(row => row.status === 'open' && row.expiresAt.getTime() > now);
  if (!signal) return null;
  return <button ref={element} type="button" aria-label={t('unknownSignal.readSignal')} title={t('unknownSignal.title')}
    data-unknown-signal-guide={signal.id} className="unknown-signal-guide text-v2-crystal"
    style={{ transform: 'translate3d(-9999px,-9999px,0)' }}
    onPointerDown={event => { event.stopPropagation(); }}
    onClick={event => { event.stopPropagation(); markHit(); onSelect(signal.id); }}>
    <span className="unknown-signal-guide-bearing">
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="unknown-signal-guide-glyph">
        <path d="M24 4 40 36 24 29 8 36 24 4Z" fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m24 9 9 19-9-4-9 4 9-19Z" fill="currentColor" />
        <path d="m24 10 3 9-3-2-3 2 3-9Z" fill="#ecfeff" />
        <path d="M19 36h10m-7 5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".65" />
      </svg>
    </span>
  </button>;
}

/** Runs after camera/view-offset updates; writes only a transform, never a React render per frame. */
export function UnknownSignalGuideTracker({ signals, element }: GuideProps) {
  const signal = signals.find(row => row.status === 'open');
  const target = useMemo(() => new Vector3(...toWorld(signal?.at ?? { x: 0, y: 0, z: 0 })), [signal?.at.x, signal?.at.y, signal?.at.z]);
  const project = useMemo(createSignalGuideProjection, []);
  useVisualFrame(({ camera, size }) => {
    const button = element.current;
    if (!button) return;
    const placement = signal && signal.expiresAt.getTime() > serverNow() ? project(target, camera, size) : null;
    button.style.visibility = placement ? 'visible' : 'hidden';
    if (!placement) return;
    button.style.transform = `translate3d(${String(placement.x)}px,${String(placement.y)}px,0) translate(-50%,-50%)`;
    button.style.setProperty('--signal-guide-angle', `${String(placement.angle)}rad`);
    button.dataset.offscreen = String(placement.offscreen);
  });
  return null;
}
