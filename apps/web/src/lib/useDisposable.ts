import { useEffect, useState, type DependencyList } from 'react';

/**
 * An object the component owns and must dispose (a flame batch, a GPU buffer): made in an effect, so the
 * one handed out is always alive. A memoised one is disposed by strict mode's extra cleanup and kept.
 * `null` on the first render, until the effect has made it.
 */
export function useDisposable<T extends { dispose: () => void }>(make: () => T, deps: DependencyList): T | null {
  const [owned, setOwned] = useState<T | null>(null);
  useEffect(() => {
    const made = make();
    setOwned(made);
    return () => { made.dispose(); };
    // The caller's deps decide when it is made again, as with useMemo.
  }, deps);
  return owned;
}
