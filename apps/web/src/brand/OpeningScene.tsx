import { memo, useLayoutEffect, useRef } from 'react';
import artwork from './opening-art.html?raw';
const sceneMarkup = { __html: artwork };

/**
 * Progress must never recreate this DOM: that restarts every CSS animation.
 * Both the memoized component and its trusted raw markup remain stable.
 */
export const OpeningScene = memo(function OpeningScene() {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Keep the same apparent phase across bootstrap/session/screen handoffs.
    // Only runs on mount: progress never rewrites the scene or its animation clock.
    const elapsed = performance.now();
    root.current?.style.setProperty('--opening-elapsed', `${String(elapsed)}ms`);
  }, []);
  return <div ref={root} className="brand-opening" aria-hidden="true" dangerouslySetInnerHTML={sceneMarkup} />;
});
