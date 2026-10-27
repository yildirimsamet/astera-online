import { z } from 'zod';
import { CLAN } from '@astera/rules';
import { SHIP_CLASSES, TACTICS, type Tactic, type TeamView } from '@astera/rules/arena';

const resources = z.object({ alloy: z.number().int().nonnegative(), crystal: z.number().int().nonnegative(), deuterium: z.number().int().nonnegative() });
export const teamSchema = z.object({
  playerId: z.string().uuid(), clanId: z.string().uuid().nullable(), capacity: z.number().int().positive().max(120), canCreate: z.boolean(),
  team: z.object({ id: z.string().uuid(), state: z.enum(['forming', 'flying']), leaderId: z.string().max(64), joined: z.boolean(),
    members: z.array(z.object({ playerId: z.string().uuid(), name: z.string().max(80), ready: z.boolean(), tactic: z.enum(TACTICS),
      outcome: z.string().max(32).nullable(), blocked: z.string().max(64).nullable(),
      ship: z.object({ class: z.enum(SHIP_CLASSES), level: z.number().int().min(1).max(20), fuel: z.number().nonnegative(), fuelMax: z.number().positive(), readyAt: z.string().datetime().nullable() }).nullable(),
    })).max(CLAN.maxMembers),
  }).nullable(),
  claims: z.array(z.object({ teamId: z.string().uuid(), share: resources, finishedAt: z.string().datetime(), autoAt: z.string().datetime() })).max(20),
  receipt: z.object({ deposit: resources, overflow: resources }).optional(),
});
export type TeamAction = { kind: 'read' | 'create' } | { kind: 'join' | 'leave' | 'start' | 'claim'; teamId: string }
  | { kind: 'ready'; teamId: string; ready: boolean; tactic: Tactic } | { kind: 'remove'; teamId: string; playerId: string };
export type TeamAnswer = { ok: true; view: TeamView } | { ok: false; error: string };

/** The server supplies every identity, loadout, charge and share. The browser sends only the named action. */
export async function askTeam(token: string | null, action: TeamAction, fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<TeamAnswer> {
  if (!token) return { ok: false, error: 'auth' };
  const { kind, ...body } = action;
  try {
    const response = await fetcher(kind === 'read' ? '/arena/team' : `/arena/team/${kind}`, { method: kind === 'read' ? 'GET' : 'POST',
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
