import { useEffect, useRef } from 'react';
import { observe, analyticsRecording, ANALYTICS_READY_EVENT } from './runtime.js';
import { isAppActive, watchAppActivity } from '../../platform/activity.js';
import { beginTrainingEntry, failTrainingEntry } from './trainingEntry.js';

/** Click intent is emitted before loading begins; consent never reconstructs earlier clicks. */
export function useLandingTelemetry(surface: 'public_landing' | 'native_landing') {
  const shown = useRef(false);
  useEffect(() => {
    const capture = () => {
      if (!shown.current && isAppActive() && analyticsRecording()) {
        shown.current = true; observe('landing_visible', { surface }, 'live');
      }
    };
    const restart = () => { shown.current = false; capture(); };
    capture(); const stop = watchAppActivity(capture);
    window.addEventListener(ANALYTICS_READY_EVENT, restart);
    return () => { stop(); window.removeEventListener(ANALYTICS_READY_EVENT, restart); };
  }, [surface]);
  return {
    play: async (start: () => Promise<void>): Promise<void> => {
      if (!analyticsRecording()) return start();
      const attemptId = beginTrainingEntry(surface);
      try { await start(); }
      catch (error) { if (attemptId) failTrainingEntry(attemptId); throw error; }
    },
    login: () => { observe('login_clicked', { surface }, 'live'); },
  };
}
