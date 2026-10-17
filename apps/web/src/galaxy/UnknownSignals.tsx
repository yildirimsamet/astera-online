import { Suspense, useEffect } from 'react';
import { Html } from '@react-three/drei';
import { useTranslation } from 'react-i18next';
import type { UnknownSignalView } from '../api/schemas.js';
import { countdown, useNow } from '../lib/time.js';
import { unknownSignalMarkerState } from '../lib/unknownSignal.js';
import { toWorld } from './scene.js';
import { markHit } from './tap.js';
import { prewarmStrategicBlast, StrategicBlast } from './StrategicBlast.js';
import './unknownSignal.css';

/** DOM billboards keep the hit circle fixed in screen pixels and above moving craft. */
export function UnknownSignals({ signals, focusedId, onSelect }: {
  signals: readonly UnknownSignalView[]; focusedId: string | null; onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const outbound = signals.some(signal => signal.status === 'outbound');
  useEffect(() => { if (outbound) prewarmStrategicBlast(); }, [outbound]);
  return <>{signals.map(signal => {
    const state = unknownSignalMarkerState(signal, now);
    if (state.phase === 'hidden') return null;
    const position = toWorld(signal.at);
    if (state.phase === 'pirates') return <Suspense key={signal.id} fallback={null}><StrategicBlast event={{ id: `signal:${signal.id}`, at: signal.arriveAt!.getTime(), position, radius: .4, intensity: .45, kind: 'interception' }} /></Suspense>;
    return <group key={signal.id} position={position} name={`unknown-signal-${signal.id}`}>
      <Html center zIndexRange={[9, 9]} style={{ pointerEvents: 'none' }}>
        <div className={`unknown-signal-marker ${state.phase === 'open' ? 'unknown-signal-pulse' : ''} ${state.phase === 'flash' ? 'unknown-signal-flash' : ''}`}
          style={{ opacity: state.opacity }} data-unknown-signal-marker={signal.id}>
          <button type="button" aria-label={t('unknownSignal.readSignal')} className="unknown-signal-hit"
            onPointerDown={event => { event.stopPropagation(); }} onClick={event => { event.stopPropagation(); markHit(); onSelect(signal.id); }}>
            <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className="size-12 text-v2-crystal">
              <circle cx="24" cy="24" r="2.3" fill="currentColor" />
              {[0, 1, 2].map(i => <circle key={i} cx="24" cy="24" r="7" className="unknown-signal-wave" style={{ animationDelay: `${String(-i * 1.6 / 3)}s` }} stroke="currentColor" strokeWidth=".8" />)}
              {state.phase === 'targeted' && <path d="M11 17v-6h6m14 0h6v6m0 14v6h-6m-14 0h-6v-6" stroke="currentColor" strokeWidth="1.2" />}
            </svg>
          </button>
          <p className={`pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded-control border bg-v2-deep/85 px-2 py-1 text-center font-v2-ui text-micro ${focusedId === signal.id ? 'border-v2-crystal/50 text-v2-crystal' : 'border-v2-crystal/20 text-v2-ink-2'}`}>
            {t(state.phase === 'targeted' ? 'unknownSignal.outbound' : 'unknownSignal.title')}
            {state.phase === 'open' && <span className="ml-1.5 font-v2-mono">{countdown(signal.expiresAt.getTime() - now)}</span>}
          </p>
        </div>
      </Html>
    </group>;
  })}</>;
}
