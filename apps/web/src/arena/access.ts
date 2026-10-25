import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Api } from '../api/client.js';

type TokenSource = Pick<Api, 'accessToken' | 'restore'>;

/** Seconds until a JWT's `exp`; anything unreadable counts as already expired. */
export function tokenSecondsLeft(token: string, nowMs = Date.now()): number {
  const part = token.split('.')[1];
  if (!part) return 0;
  try {
    const parsed = z.object({ exp: z.number() }).safeParse(JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))));
    return parsed.success ? Math.max(0, parsed.data.exp - nowMs / 1000) : 0;
  } catch { return 0; }
}

/**
 * A token still valid when the hello lands. Access tokens live minutes and a pilot
 * reconnects long after entering, so one about to lapse is refreshed first.
 */
export async function arenaCredential(api: TokenSource, nowMs = Date.now()): Promise<string | null> {
  const token = api.accessToken;
  if (token && tokenSecondsLeft(token, nowMs) > 60) return token;
  try { await api.restore(); } catch { /* The room refuses the hello and the HUD says why. */ }
  return api.accessToken;
}

const accessSchema = z.object({ allowed: z.boolean() });

/** Only an explicit yes from the arena process opens the door. */
export async function probeArenaAccess(token: string | null, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!token) return false;
  try {
    const response = await fetcher('/arena/access', { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) return false;
    const parsed = accessSchema.safeParse(await response.json());
    return parsed.success && parsed.data.allowed;
  } catch { return false; }
}

/**
 * The private playtest's reference pack: the arena sets a short cookie scoped to `/__ref/`
 * for a seated pilot. Anything but its 204 keeps the procedural set.
 */
export async function openReferenceSession(token: string | null, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!token) return false;
  try {
    const response = await fetcher('/arena/ref-session', { method: 'POST', credentials: 'same-origin', headers: { authorization: `Bearer ${token}` } });
    return response.status === 204;
  } catch { return false; }
}

/** Asked once per signed-in session; the arena list changes only with a deploy. */
export function useArenaAccess(api: TokenSource, enabled: boolean): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void arenaCredential(api).then(probeArenaAccess).then(value => { if (live) setAllowed(value); });
    return () => { live = false; };
  }, [api, enabled]);
  return enabled && allowed;
}
