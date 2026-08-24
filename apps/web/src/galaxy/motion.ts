import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Live OS motion preference for WebGL effects that CSS cannot reach. */
export function useReducedMotionPreference(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const update = (): void => {
      setReduced(media.matches);
    };
    update();
    media.addEventListener('change', update);
    return () => {
      media.removeEventListener('change', update);
    };
  }, []);

  return reduced;
}
