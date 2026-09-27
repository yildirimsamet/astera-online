import { useEffect, useState } from 'react';

/** One cover per launch. It opens on the first complete frame or after the hard deadline. */
export function useOpeningCover(ready: boolean, deadlineMs = 5_000): boolean {
  const [covered, setCovered] = useState(true);
  useEffect(() => {
    const deadline = window.setTimeout(() => { setCovered(false); }, deadlineMs);
    return () => { window.clearTimeout(deadline); };
  }, [deadlineMs]);
  useEffect(() => {
    if (!ready) return;
    const handoff = window.setTimeout(() => { setCovered(false); }, 450);
    return () => { window.clearTimeout(handoff); };
  }, [ready]);
  return covered;
}
