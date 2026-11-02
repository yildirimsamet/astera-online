import { useEffect, useRef } from 'react';
import { analyticsRecording, observe, ANALYTICS_READY_EVENT } from './runtime.js';
import { isAppActive, watchAppActivity } from '../../platform/activity.js';
import { analyticsAvailable } from './preference.js';

/** A shown requirement is evidence of presentation, never evidence of a click. */
export function useVisibleTelemetry<Element extends HTMLElement = HTMLDivElement>(surface: string, subject: string, blocker: string | null) {
  const ref = useRef<Element>(null), seen = useRef(new Set<string>()), scope = useRef('');
  useEffect(() => {
    if (!analyticsAvailable()) return;
    const element = ref.current;
    if (!element) return;
    const key = `${surface}:${subject}`;
    if (scope.current !== key) { scope.current = key; seen.current.clear(); }
    let mounted = true, intersecting = false;
    const fallback = () => {
      const bounds = element.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < innerHeight && bounds.right > 0 && bounds.left < innerWidth;
    };
    const capture = () => {
      if (!mounted) return;
      if (!isAppActive() || !intersecting) { seen.current.clear(); return; }
      if (!analyticsRecording()) return;
      if (!seen.current.has('surface')) { seen.current.add('surface'); observe('surface_visible', { surface, subject }); }
      if (blocker && !seen.current.has(blocker)) { seen.current.add(blocker); observe('blocker_visible', { surface, subject, code: blocker }); }
    };
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      intersecting = entries.some(entry => entry.target === element && entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0); capture();
    }) : null;
    if (observer) observer.observe(element);
    else { intersecting = fallback(); capture(); }
    const stop = watchAppActivity(capture);
    const restart = () => { seen.current.clear(); capture(); };
    window.addEventListener(ANALYTICS_READY_EVENT, restart);
    return () => { mounted = false; stop(); observer?.disconnect(); window.removeEventListener(ANALYTICS_READY_EVENT, restart); };
  }, [surface, subject, blocker]);
  return ref;
}
