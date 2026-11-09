import { useEffect, useState } from 'react';

/**
 * After a jump the view opens this soon after its data: the player is on their own world, close, and
 * the far views keep warming behind it (owner, 2026-11-09: the whole deadline on the last frame).
 */
export const JUMP_OPEN_GRACE_MS = 1_500;

/**
 * One cover per launch. It opens on the first complete frame or after the hard deadline, or a `grace`
 * after the caller says so (null: no grace).
 */
export function useOpeningCover(ready: boolean, deadlineMs = 7_000, grace: number | null = null): boolean {
  const [covered, setCovered] = useState(true);
  useEffect(() => {
    const deadline = window.setTimeout(() => { setCovered(false); }, deadlineMs);
    return () => { window.clearTimeout(deadline); };
  }, [deadlineMs]);
  useEffect(() => {
    if (grace === null) return;
    const early = window.setTimeout(() => { setCovered(false); }, grace);
    return () => { window.clearTimeout(early); };
  }, [grace]);
  useEffect(() => {
    if (!ready) return;
    setCovered(false);
  }, [ready]);
  return covered;
}
