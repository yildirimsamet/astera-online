import { z } from 'zod';
import type { Tactic, TeamView } from '@astera/rules/arena';
import { arenaUrl } from './origin.js';
import { teamSchema } from './deskSchemas.js';

export { teamSchema };

export type TeamAction = { kind: 'read' | 'create' } | { kind: 'join' | 'leave' | 'start' | 'claim'; teamId: string }
  | { kind: 'ready'; teamId: string; ready: boolean; tactic: Tactic } | { kind: 'remove'; teamId: string; playerId: string };
export type TeamAnswer = { ok: true; view: TeamView } | { ok: false; error: string };

/** The server supplies every identity, loadout, charge and share. The browser sends only the named action. */
export async function askTeam(token: string | null, action: TeamAction, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<TeamAnswer> {
  if (!token) return { ok: false, error: 'auth' };
  const { kind, ...body } = action;
  try {
    const response = await fetcher(arenaUrl(kind === 'read' ? '/arena/team' : `/arena/team/${kind}`), { method: kind === 'read' ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${token}`, ...(kind === 'read' ? {} : { 'content-type': 'application/json' }) },
      ...(kind === 'read' ? {} : { body: JSON.stringify(body) }), ...(signal ? { signal } : {}) });
    const value: unknown = await response.json();
    if (!response.ok) {
      const error = z.object({ error: z.string().max(64) }).safeParse(value);
      return { ok: false, error: error.success ? error.data.error : 'TEAM_UNAVAILABLE' };
    }
    const parsed = teamSchema.safeParse(value);
    return parsed.success ? { ok: true, view: parsed.data } : { ok: false, error: 'TEAM_UNAVAILABLE' };
  } catch { return { ok: false, error: 'TEAM_UNAVAILABLE' }; }
}
