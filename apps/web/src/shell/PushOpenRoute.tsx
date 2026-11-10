import { useEffect, useRef } from 'react';
import { useWorld } from '../api/world.js';
import { onPushOpened, type PushDestination } from '../platform/push.js';

/**
 * A TAPPED RAID ALERT OPENS ITS WORLD (owner 2026-11-10), through the same door a tapped
 * in-game notice uses. It takes taps only once the commander's worlds are loaded: a tap that
 * opened the app waits in `platform/push` until then, or the attacked colony could not be
 * selected and the capital would open in its place.
 */
export function PushOpenRoute({ onOpen }: { onOpen: (to: PushDestination) => void }) {
  const loaded = useWorld().worlds.length > 0;
  const open = useRef(onOpen);
  useEffect(() => { open.current = onOpen; });
  useEffect(() => {
    if (!loaded) return;
    return onPushOpened((to) => { open.current(to); });
  }, [loaded]);
  return null;
}
