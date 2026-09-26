import { useEffect, useState } from 'react';

/** The opening is a one-time cover, not a loading state for every later refetch. */
export function useOpeningCover(ready: boolean, resumed: boolean): boolean {
  const [covered, setCovered] = useState(!resumed);
  useEffect(() => {
    if (ready) setCovered(false);
  }, [ready]);
  return covered;
}
