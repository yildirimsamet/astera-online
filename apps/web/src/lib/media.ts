import { useEffect, useState } from 'react';

/** Spec E11 · K10: three columns from here — outline, galaxy, context — and the tabs on top. */
export const DESK_QUERY = '(min-width: 1100px)';

function matches(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

/**
 * Whether the window matches `query` now, following it across a resize. Where there
 * is no `matchMedia` it is false: the phone layout is the one that works everywhere.
 */
export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => matches(query));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const read = (): void => { setMatch(list.matches); };
    read();
    list.addEventListener('change', read);
    return () => { list.removeEventListener('change', read); };
  }, [query]);

  return match;
}
