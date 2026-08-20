import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { pickSpawnSlot } from '@astera/rules';
import { seasons } from '../db/schema.js';
import { GameError } from '../services/planet.js';
import { planetNameFor } from '../services/player.js';
import { publicWorlds } from '../services/publicGalaxy.js';
import { galaxyOf, occupiedSlots } from '../services/season.js';
import { listServers, resolveJoinTarget } from '../services/servers.js';
import { galaxyTraffic } from '../services/traffic.js';

/**
 * THE GALAXY, BEFORE YOU HAVE AN ACCOUNT. D56.
 *
 * This is the one endpoint the rehearsal stands on: a visitor who has pressed
 * nothing but "see your planet" gets the real frontier galaxy, the real worlds in
 * it, the real fleets crossing it, and the slot the server would give them — and
 * NOTHING IS WRITTEN. No account, no player row, no planet, and above all no
 * SEAT: a galaxy holds fifty worlds and fills strictly in order (D21), so handing
 * a seat to somebody who has committed nothing is how the frontier rule — the
 * whole mitigation for the empty-shard risk — gets spent on people who never came
 * back.
 *
 * PUBLIC, AND IT LEAKS NOTHING, because it is the same projection every player
 * already receives about everybody else. `publicWorlds` is shared with
 * `/api/galaxy` precisely so that claim can be checked in one place rather than
 * argued about in two, and the fleet readings `/api/galaxy` adds on top are the
 * part this cannot have: they are earned with a telescope, and there is nobody
 * here to have earned them.
 *
 * THE MOTION IS FREE. Contacts carry their own departure and arrival instants, and
 * every leg on the disc is drawn by interpolating between them against the server
 * clock — so one payload and a clock is a galaxy that keeps moving for as long as
 * the visitor watches it, with no stream, no poll and no session. That is the
 * whole of "show that somebody is in there", bought for one request.
 *
 * WHY THE RESERVED SLOT IS IN HERE. The rehearsal shows the visitor the world they
 * are about to be given, by name, in its real place on the disc. It is a preview
 * and not a reservation — two people onboarding at once are shown the same slot,
 * and whoever claims second lands on the next one. That is honest and invisible:
 * the camera flies to whatever world the claim actually returns.
 */
export function registerPreviewRoutes(app: FastifyInstance): void {
  app.get('/api/preview', async () => {
    const list = await listServers(app.db, app.clock);
    const open = list.find((s) => s.status === 'open');
    /**
     * Every galaxy is full. A real state, not a fault — and the front door has to
     * say so rather than opening a rehearsal that cannot be claimed at the end.
     */
    if (!open) {
      throw new GameError('NO_FRONTIER', 'Every galaxy is full right now', 409);
    }

    // The one authority on which galaxy will take a join, reused rather than
    // re-derived. A rehearsal that runs against a different galaxy than the claim
    // would enter is the interface contradicting itself at the last step.
    const target = await resolveJoinTarget(app.db, open.code, app.clock);

    const [season] = await app.db
      .select()
      .from(seasons)
      .where(eq(seasons.id, target.seasonId))
      .limit(1);
    if (!season) throw new GameError('NO_SEASON', 'That galaxy is not open right now', 409);

    const spec = galaxyOf(target.seasonId, season.seed, target.playerCap);
    const taken = await occupiedSlots(app.db, target.seasonId);
    const slot = pickSpawnSlot(spec.slots, taken);
    if (!slot) throw new GameError('SHARD_FULL', 'This galaxy is full', 409);

    const [worlds, contacts] = await Promise.all([
      publicWorlds(app.db, target.seasonId),
      // Nothing is excluded: the exclusion in `/api/galaxy/traffic` is "what you
      // OWN", and a visitor owns nothing.
      galaxyTraffic(app.db, target.seasonId, null, app.clock.now()),
    ]);

    const reserved = {
      id: RESERVED_ID,
      name: planetNameFor(slot.index),
      slotIndex: slot.index,
      position: { x: slot.x, y: slot.y, z: slot.z },
    };

    return {
      /**
       * Shaped as the three payloads the client already parses, so the rehearsal
       * can answer `/api/season`, `/api/galaxy` and `/api/galaxy/traffic` from one
       * public request with the production schemas and no second set of types.
       */
      season: {
        seasonId: season.id,
        shard: target.shardCode,
        shardName: target.shardName,
        seed: season.seed,
        status: season.status,
        startsAt: season.startsAt,
        endsAt: season.endsAt,
        playerCap: target.playerCap,
        players: open.planets,
      },
      galaxy: {
        you: { planetId: RESERVED_ID, playerId: RESERVED_ID },
        planets: [
          ...worlds.map((world) => ({ ...world, isSelf: false })),
          /**
           * The visitor's world, drawn among the real ones. It has a Command Core
           * at level 1 like every fresh planet, so the tier band it can reach is
           * the real one and the targets the rehearsal lights up are the targets
           * the claim will actually accept.
           */
          {
            id: reserved.id,
            name: reserved.name,
            owner: '',
            position: reserved.position,
            coreTier: 1,
            satellites: [],
            shielded: false,
            isSelf: true,
          },
        ],
      },
      traffic: { contacts },
      reserved,
      /** What the front door already says, so the rehearsal can repeat it truthfully. */
      shard: {
        code: open.code,
        name: open.name,
        planets: open.planets,
        capacity: open.capacity,
        online: open.online,
      },
    };
  });
}

/**
 * The id of a world that does not exist yet.
 *
 * Deliberately not a UUID: every real planet id is one, so this can never collide
 * with a row, and anything that carries it into a query fails loudly on the column
 * type rather than quietly reading somebody else's planet. That is not
 * hypothetical — the first draft handed it to `galaxyTraffic` as the caller's own
 * planet and the driver refused it, which is exactly the protection working.
 */
const RESERVED_ID = 'reserved';
