import { useEffect, useState } from 'react';

/** Resize is reactive: an already open editor becomes a blocking mobile sheet. */
export function useCompactViewport() {
  const [compact, setCompact] = useState(() => window.innerWidth < 700);
  useEffect(() => {
    const resize = () => { setCompact(window.innerWidth < 700); };
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); };
  }, []);
  return compact;
}
