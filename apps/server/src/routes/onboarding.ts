import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { START } from '@astera/rules';
import { registerBody } from '../auth/credentials.js';
import { missions, planets, units } from '../db/schema.js';
import { authenticate, registerAccount } from '../services/account.js';
import { buildUnits, upgradeBuilding } from '../services/build.js';
import { launchAttack } from '../services/mission.js';
import { GameError } from '../services/planet.js';
import { planetView } from '../services/planetView.js';
import { joinSeason } from '../services/player.js';
import { currentPlacement, listServers, resolveJoinTarget } from '../services/servers.js';
import { openSession } from './auth.js';

/**
 * CLAIMING THE WORLD YOU HAVE ALREADY BEEN PLAYING. D56.
 *
 * The rehearsal ends with a fleet on the pad and a target chosen, and this is the
 * one call that turns all of it into a season: an account, a seat in the frontier
 * galaxy, and every decision the visitor made, replayed. One request, because the
 * alternative is a player who has just committed watching four round trips before
 * their world appears — and the moment the wall is crossed is the moment the game
 * has the least credit to spend.
 *
 * THE REHEARSAL DECIDED NOTHING. Every intent below goes through the ordinary
 * service — `upgradeBuilding`, `buildUnits`, `launchAttack` — with the ordinary
 * locks, the ordinary rules and the ordinary refusals. The client computed the
 * same answers locally out of `@astera/rules` so the screen could keep up with a
 * finger, and that is a PREDICTION; this is the outcome. Principle 1 is intact.
 *
 * A REFUSED INTENT NEVER COSTS THE PLAYER THEIR ACCOUNT. The account and the
 * planet commit first and separately; the opening is replayed afterwards, step by
 * step, and each step reports for itself. A target that crossed out of the tier
 * band while the visitor was typing a password is one line in `applied` and a
 * launch sheet on the way in — not a claim that fails and a person who leaves.
 */

/** What the visitor did during the rehearsal, in the order they did it. */
const intent = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('upgrade'),
    building: z.enum(['CORE', 'REFINERY', 'EXTRACTOR', 'VAULT', 'SHIPYARD']),
  }),
  z.object({
    kind: z.literal('build'),
    hull: z.enum(['WASP', 'LANCE', 'BULWARK', 'HAULER', 'BASTION', 'THORN', 'PROSPECTOR']),
    count: z.number().int().min(1).max(100),
  }),
  z.object({
    kind: z.literal('launch'),
    targetPlanetId: z.string().uuid(),
    fleet: z.record(z.enum(['WASP', 'LANCE', 'BULWARK', 'HAULER']), z.number().int().min(0)),
  }),
]);

/**
 * A CAP, BECAUSE THIS LIST ARRIVES FROM A CLIENT THAT IS NOT SIGNED IN.
 *
 * The scripted opening is six steps — three upgrades, one build and one launch,
 * with room to spare. Twelve is generous for anything a rehearsal can produce and
 * small enough that nobody can hand an unauthenticated endpoint a thousand
 * transactions to run.
 */
const claimBody = registerBody.extend({
  intents: z.array(intent).max(12).default([]),
});

type Intent = z.infer<typeof intent>;

/** What became of one replayed decision. */
type Applied =
  | { kind: Intent['kind']; ok: true }
  | { kind: Intent['kind']; ok: false; error: string; params?: Record<string, string | number> };

export function registerOnboardingRoutes(app: FastifyInstance): void {
  app.post('/api/onboarding/claim', async (req, reply) => {
    const body = claimBody.parse(req.body ?? {});

    const account = await claimAccount(app, body.username, body.password);

    /**
     * The frontier, resolved at CLAIM TIME rather than taken from the client.
     *
     * The rehearsal ran against whichever galaxy was open when it started, and a
     * galaxy can fill in the two minutes a person spends on it. Re-deriving here
     * means the worst case is a world in the next galaxy along — which is the
     * correct answer — instead of a refusal.
     */
    const placement = await currentPlacement(app.db, account.id);
    const seated = placement
      ? await seatIn(app, account.id, placement.shardCode)
      : await seatOnFrontier(app, account.id);
    const { target, joined } = seated;

    const applied = (await untouched(app, joined.planetId))
      ? await replay(app, joined.planetId, body.intents)
      : /**
         * A RETRY, AND THE PLANET HAS ALREADY LIVED. Idempotency without a key.
         *
         * The one thing a repeated claim must never do is raise the Core twice or
         * launch a second fleet, and the honest test for "has this opening already
         * been applied" is the planet itself: a world nobody has acted on holds
         * exactly the opening grant, a Command Core at 1, no ships and no missions.
         * `request_log` is the wrong tool here — it exists for the launch path,
         * where one player legitimately makes many similar calls and only a key can
         * tell them apart. A claim happens once per account, ever, and deriving
         * the answer from state cannot go stale the way a stored key can (A5).
         */
        body.intents.map((i) => ({ kind: i.kind, ok: false as const, error: 'ALREADY_OPENED' }));

    const session = await openSession(app, reply, account);

    return {
      ...session,
      placement: {
        shard: target.shardCode,
        shardName: target.shardName,
        planetId: joined.planetId,
        planetName: await nameOf(app, joined.planetId),
      },
      applied,
      /**
       * The whole planet, built in the same request that made it.
       *
       * Every mutation in this game answers with the planet view (D53) so the
       * interface never has to ask a second time for the consequence of a tap. The
       * one call that creates a planet is the last place that should make an
       * exception.
       */
      planet: await app.db.transaction(async (tx) =>
        planetView(tx, joined.planetId, app.clock),
      ),
    };
  });
}

/* ── identity ───────────────────────────────────────────────── */

/**
 * Register, or recognise a caller who already registered and never heard back.
 *
 * A CLAIM IS RETRIED BY PHONES, and the naive version answers the retry with
 * USERNAME_TAKEN — telling a player that the name they just successfully created
 * belongs to somebody else. Falling through to `authenticate` makes the second
 * attempt land on the account the first one made.
 *
 * IT IS NOT A WAY IN. The fallback verifies the password, so a name that is taken
 * by somebody else still refuses exactly as before; what it costs an attacker is
 * nothing they did not already have at `/api/auth/login`.
 */
async function claimAccount(
  app: FastifyInstance,
  username: string,
  password: string,
): Promise<{ id: string; username: string; displayName: string }> {
  try {
    return await registerAccount(app.db, { username, password });
  } catch (err) {
    if (err instanceof GameError && err.code === 'USERNAME_TAKEN') {
      try {
        return await authenticate(app.db, { username, password });
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

interface Seated {
  target: Awaited<ReturnType<typeof resolveJoinTarget>>;
  joined: Awaited<ReturnType<typeof joinSeason>>;
}

const seatIn = async (
  app: FastifyInstance,
  accountId: string,
  shardCode: string,
): Promise<Seated> => {
  const target = await resolveJoinTarget(app.db, shardCode, app.clock);
  return { target, joined: await joinSeason(app.db, accountId, target.seasonId, app.clock) };
};

/**
 * TAKE A SEAT IN WHICHEVER GALAXY IS OPEN WHEN THE CLAIM LANDS.
 *
 * RE-DERIVED AND RETRIED, because the frontier is a fact about the whole world and
 * two strangers can finish their rehearsals on the same second. The first attempt
 * reads `open`, both callers get the same galaxy, and the database — which is what
 * actually enforces the rule (D21) — hands the last slot to one of them. The loser
 * used to get a 409 and lose two minutes of play on the last press. They belong in
 * the next galaxy along, which is exactly what the frontier rule says.
 *
 * Bounded, because "every galaxy is full" is a real state and not something to spin
 * on: `SERVERS` tops out at ten, and a claim that cannot find a seat in three goes
 * has met a world at capacity rather than a race.
 */
async function seatOnFrontier(app: FastifyInstance, accountId: string): Promise<Seated> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const open = (await listServers(app.db, app.clock)).find((s) => s.status === 'open');
    if (!open) throw new GameError('NO_FRONTIER', 'Every galaxy is full right now', 409);
    try {
      return await seatIn(app, accountId, open.code);
    } catch (err) {
      const raced =
        err instanceof GameError && (err.code === 'SHARD_FULL' || err.code === 'SERVER_LOCKED');
      if (!raced) throw err;
    }
  }
  throw new GameError('NO_FRONTIER', 'Every galaxy is full right now', 409);
}

/* ── replaying the opening ──────────────────────────────────── */

/**
 * Has anything at all happened to this world yet?
 *
 * All four conditions together, because each alone has a way of being true on a
 * planet that has been played: the grant is spent by the first upgrade, the Core
 * is raised by it, ships are the second thing bought, and a mission is the third.
 */
async function untouched(app: FastifyInstance, planetId: string): Promise<boolean> {
  const [row] = await app.db
    .select({ alloy: planets.alloy, crystal: planets.crystal })
    .from(planets)
    .where(eq(planets.id, planetId));
  if (!row) return false;
  if (Math.floor(row.alloy) !== START.alloy || Math.floor(row.crystal) !== START.crystal) {
    return false;
  }

  const [ships] = await app.db.select().from(units).where(eq(units.planetId, planetId)).limit(1);
  if (ships) return false;

  const [flight] = await app.db
    .select()
    .from(missions)
    .where(and(eq(missions.originPlanetId, planetId)))
    .limit(1);
  return !flight;
}

/**
 * Run the opening, one decision at a time, reporting each for itself.
 *
 * SEQUENTIALLY AND IN ORDER, because the opening is a chain: the Core has to be
 * raised before the Refinery may pass it, the Shipyard exists before a hull is
 * built, and the ships exist before they can fly. Each service takes the planet's
 * row lock on its own, which is also why this is not one transaction — holding a
 * lock across five of them would serialise the whole galaxy behind a signup.
 *
 * A REFUSAL STOPS THE REST. Once one step in a chain is refused the ones after it
 * are asking for something that cannot be true, and reporting five failures for
 * one cause is how an interface says nothing at all.
 */
async function replay(
  app: FastifyInstance,
  planetId: string,
  intents: readonly Intent[],
): Promise<Applied[]> {
  const out: Applied[] = [];
  let stopped = false;

  for (const step of intents) {
    if (stopped) {
      out.push({ kind: step.kind, ok: false, error: 'SKIPPED' });
      continue;
    }
    try {
      if (step.kind === 'upgrade') {
        await upgradeBuilding(app.db, planetId, step.building, app.clock);
      } else if (step.kind === 'build') {
        await buildUnits(app.db, planetId, step.hull, step.count, app.clock);
      } else {
        await launchAttack(app.db, planetId, step.targetPlanetId, step.fleet, app.clock);
      }
      out.push({ kind: step.kind, ok: true });
    } catch (err) {
      stopped = true;
      if (err instanceof GameError) {
        out.push({
          kind: step.kind,
          ok: false,
          error: err.code,
          ...(err.params ? { params: err.params } : {}),
        });
        continue;
      }
      throw err;
    }
  }

  return out;
}

async function nameOf(app: FastifyInstance, planetId: string): Promise<string> {
  const [row] = await app.db
    .select({ name: planets.name })
    .from(planets)
    .where(eq(planets.id, planetId));
  return row?.name ?? '';
}
