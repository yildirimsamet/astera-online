import { useEffect, useRef, useState } from 'react';
import { SchoolTelemetry } from './telemetry.js';
import type { SchoolWorld } from './world.js';
import { observe, analyticsRecording, ANALYTICS_READY_EVENT } from '../../lib/playerAnalytics/runtime.js';
import { isAppActive, watchAppActivity } from '../../platform/activity.js';
import { ANALYTICS_CHOICE_EVENT, analyticsChoice } from '../../lib/playerAnalytics/preference.js';
import { finishTrainingEntry } from '../../lib/playerAnalytics/trainingEntry.js';

export function useSchoolTelemetry(world: SchoolWorld, replay: boolean, resumed: boolean, prepared: boolean) {
  const [observer] = useState(() => new SchoolTelemetry(world.startedAt, replay, resumed, analyticsRecording, (name, properties, mode) => {
    const refId = name === 'training_started' || name === 'training_resumed' ? finishTrainingEntry() : undefined;
    observe(name, refId ? { ...properties, refId } : properties, mode);
  }));
  const latest = useRef({ world, prepared }); latest.current = { world, prepared };
  useEffect(() => {
    const changed = (event: Event) => {
      if (event instanceof CustomEvent && event.detail === 'denied' || analyticsChoice() === 'denied') observer.revoke();
    };
    window.addEventListener(ANALYTICS_CHOICE_EVENT, changed);
    window.addEventListener('storage', changed);
    return () => { window.removeEventListener(ANALYTICS_CHOICE_EVENT, changed); window.removeEventListener('storage', changed); };
  }, [observer]);
  useEffect(() => {
    const capture = () => {
      const { world: current, prepared: ready } = latest.current;
      observer.visible(current.scene, current.pending ? 'order' : current.flight ? 'flight' : current.reach ? 'scene_preparation' : 'text', isAppActive(), ready);
    };
    capture(); const stop = watchAppActivity(capture);
    window.addEventListener(ANALYTICS_READY_EVENT, capture);
    return () => { stop(); window.removeEventListener(ANALYTICS_READY_EVENT, capture); };
  }, [world.scene, world.pending, world.flight, world.reach, prepared, observer]);
  return observer;
}
