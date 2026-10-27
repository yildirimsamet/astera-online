import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TACTICS } from '@astera/rules/arena';
import { claimTeamLoot, createTeam, housekeepArenaTeams, joinTeam, leaveTeam, readTeam, readyTeam, startTeam } from '../services/arenaTeams.js';

const id = z.string().uuid();
const teamBody = z.object({ teamId: id }).strict();
const actionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('create'), body: z.object({}).strict() }),
  z.object({ kind: z.literal('join'), body: teamBody }), z.object({ kind: z.literal('leave'), body: teamBody }),
  z.object({ kind: z.literal('start'), body: teamBody }), z.object({ kind: z.literal('claim'), body: teamBody }),
  z.object({ kind: z.literal('ready'), body: z.object({ teamId: id, ready: z.boolean(), tactic: z.enum(TACTICS) }).strict() }),
  z.object({ kind: z.literal('remove'), body: z.object({ teamId: id, playerId: id }).strict() }),
]);
const params = z.object({ action: z.string().max(16) });

/** Same seated-pilot admission as the room; no clan, cost, loadout or loot is accepted from a client. */
export function registerArenaTeams(app: FastifyInstance, enabled: boolean,
  identify: (header: string | undefined) => Promise<{ accountId: string } | 'auth' | 'denied'>,
  ensureReady: () => Promise<unknown>): void {
  app.get('/arena/team', async (request, reply) => {
    if (!enabled) return reply.status(403).send({ error: 'denied' });
    const who = await identify(request.headers.authorization);
    if (typeof who === 'string') return reply.status(who === 'auth' ? 401 : 403).send({ error: who });
    await ensureReady(); return readTeam(app.db, app.clock, who.accountId);
  });
  app.post('/arena/team/:action', async (request, reply) => {
    if (!enabled) return reply.status(403).send({ error: 'denied' });
    const who = await identify(request.headers.authorization);
    if (typeof who === 'string') return reply.status(who === 'auth' ? 401 : 403).send({ error: who });
    const route = params.safeParse(request.params);
    const parsed = actionSchema.safeParse({ kind: route.success ? route.data.action : '', body: request.body });
    if (!parsed.success) return reply.status(400).send({ error: 'invalid' });
    await ensureReady(); const action = parsed.data; const account = who.accountId;
    switch (action.kind) {
      case 'create': return createTeam(app.db, app.clock, account);
      case 'join': return joinTeam(app.db, app.clock, account, action.body.teamId);
      case 'leave': return leaveTeam(app.db, app.clock, account, action.body.teamId);
      case 'remove': return leaveTeam(app.db, app.clock, account, action.body.teamId, action.body.playerId);
      case 'ready': return readyTeam(app.db, app.clock, account, action.body);
      case 'start': return startTeam(app.db, app.clock, account, action.body.teamId);
      case 'claim': return claimTeamLoot(app.db, app.clock, account, action.body.teamId);
    }
  });
  // Pure room tests deliberately provide no DB; production always decorates it before registering the arena.
  if (enabled && app.hasDecorator('db')) {
    let pending: Promise<void> | null = null;
    const timer = setInterval(() => {
      if (pending) return;
      pending = ensureReady().then(() => housekeepArenaTeams(app.db, app.clock))
        .catch((error: unknown) => { app.log.error({ err: error }, 'arena team housekeeping failed'); }).finally(() => { pending = null; });
    }, 5000);
    app.addHook('onClose', async () => { clearInterval(timer); await pending; });
  }
}
