import { useSyncExternalStore } from 'react';
import { serverNow } from '../lib/clock.js';

/**
 * THE PLANNED MAINTENANCE GATE. Scaling plan F0.9.
 *
 * While nginx holds the maintenance flag every API answer is 503 MAINTENANCE with the
 * reopening; nothing else on screen can work, so the shell swaps to the maintenance
 * screen instead of a request error. The app cannot always read that answer (it is
 * not the API's, so no CORS), and the window it last read from the public notice
 * covers that case: a lost server inside the planned window is the window.
 */
const EVENT = 'astera:maintenance';
let state: { endsAt: string | null } | null = null;
let known: { startsAt: Date; endsAt: Date } | null = null;

export function reportMaintenance(endsAt: string | null): void {
  if (state?.endsAt === endsAt) return;
  state = { endsAt };
  window.dispatchEvent(new Event(EVENT));
}

export function clearMaintenance(): void {
  if (state === null) return;
  state = null;
  window.dispatchEvent(new Event(EVENT));
}

/** The window the public notice last named; null once none is planned. */
export function noteMaintenanceWindow(window: { startsAt: Date; endsAt: Date } | null): void { known = window; }

/** An unreachable server inside the planned window is the maintenance itself. */
export function reportIfInsideWindow(): void {
  const now = serverNow();
  if (known && known.startsAt.getTime() <= now && now < known.endsAt.getTime()) reportMaintenance(known.endsAt.toISOString());
}

const subscribe = (listener: () => void): (() => void) => {
  window.addEventListener(EVENT, listener);
  return () => { window.removeEventListener(EVENT, listener); };
};

export const useMaintenance = (): { endsAt: string | null } | null => useSyncExternalStore(subscribe, () => state, () => null);
