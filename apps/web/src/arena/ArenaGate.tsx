import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingScreen } from '../shell/LoadingScreen.js';
import { suppressMusic } from '../lib/music.js';
import { retryArenaImport } from './loading.js';
import { observe, ANALYTICS_READY_EVENT } from '../lib/playerAnalytics/runtime.js';
import { isAppActive, watchAppActivity } from '../platform/activity.js';

class ArenaBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  override render(): ReactNode { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** No Three.js import crosses this boundary before the pilot enters. */
export function ArenaGate({ onLeave, credential }: { onLeave: () => void; credential?: () => Promise<string | null> }) {
  const { t } = useTranslation();
  const [attempt, setAttempt] = useState(0);
  const [Arena, setArena] = useState(() => lazy(() => retryArenaImport(() => import('./Sandbox.js'))));
  useEffect(() => suppressMusic(), []);
  useEffect(() => {
    const capture = () => {
      observe('load_phase', { phase: 'arena' }, 'arena');
      if (isAppActive()) observe('surface_visible', { surface: 'arena_entry' }, 'arena');
    };
    capture(); const stop = watchAppActivity(capture);
    window.addEventListener(ANALYTICS_READY_EVENT, capture);
    return () => { stop(); window.removeEventListener(ANALYTICS_READY_EVENT, capture); };
  }, []);
  return <ArenaBoundary key={attempt} fallback={
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-v2-void px-8 text-center font-v2-ui text-v2-ink">
      <p>{t('arena.loadError')}</p>
      <button className="rounded border border-v2-self px-6 py-3" onClick={() => {
        setArena(() => lazy(() => retryArenaImport(() => import('./Sandbox.js'))));
        setAttempt(n => n + 1);
      }}>{t('arena.retry')}</button>
      <button className="p-3 text-v2-ink-2" onClick={onLeave}>{t('arena.leave')}</button>
    </main>
  }>
    <Suspense fallback={<LoadingScreen caption={t('arena.loadingCode')} />}>
      <Arena onLeave={onLeave} {...(credential ? { credential } : {})} />
    </Suspense>
  </ArenaBoundary>;
}
