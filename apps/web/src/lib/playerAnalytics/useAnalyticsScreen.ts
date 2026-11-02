import { useEffect, useRef, useCallback } from 'react';
import { observe, syncAnalyticsIdentity, ANALYTICS_READY_EVENT } from './runtime.js';
import { isAppActive, watchAppActivity } from '../../platform/activity.js';

export function useAnalyticsScreen(phase: string, accountId: string | null, token: () => string | null,
  surface: string | null, replay: boolean): () => void {
  const presented = useRef(false);
  const lastPresentation = useRef<number | null>(null);
  useEffect(() => { if (phase !== 'starting') syncAnalyticsIdentity(accountId, token); }, [accountId, token, phase]);
  useEffect(() => { presented.current = false; lastPresentation.current = null; }, [phase, accountId, replay]);
  const sceneReady = useCallback(() => {
    if (phase === 'ready' && !replay) {
      presented.current = true;
      if (isAppActive() && lastPresentation.current === null) {
        lastPresentation.current = Date.now(); observe('game_ready', {}, 'live');
      }
    }
  }, [phase, replay]);
  useEffect(() => watchAppActivity(() => {
    if (!presented.current || phase !== 'ready' || replay || !isAppActive()) return;
    if (lastPresentation.current === null || Date.now() - lastPresentation.current >= 30 * 60_000) {
      lastPresentation.current = Date.now(); observe('game_ready', {}, 'live');
    }
  }), [phase, replay]);
  useEffect(() => {
    const capture = () => {
      const mode = phase === 'arena' ? 'arena' : replay ? 'replay' : phase === 'rehearsing' ? 'training' : 'live';
      observe('load_phase', { phase }, mode);
      if (phase === 'ready' && !replay && isAppActive()) {
        observe('surface_visible', { surface: surface ?? 'galaxy' }, 'live');
      }
    };
    const restart = () => {
      capture();
      if (presented.current) {
        lastPresentation.current = null;
        if (isAppActive()) { lastPresentation.current = Date.now(); observe('game_ready', {}, 'live'); }
      }
    };
    capture(); window.addEventListener(ANALYTICS_READY_EVENT, restart);
    return () => { window.removeEventListener(ANALYTICS_READY_EVENT, restart); };
  }, [phase, surface, replay]);
  return sceneReady;
}
