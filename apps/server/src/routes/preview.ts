import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { distance, pickSpawnSlot, sensorSphere } from '@astera/rules';
import { seasons } from '../db/schema.js';
import { GameError } from '../services/planet.js';
import { planetNameFor } from '../services/player.js';
import { galaxyOf, occupiedSlots } from '../services/season.js';
import { listServers, resolveJoinTarget } from '../services/servers.js';
import { projectGalaxyTraffic } from '../services/traffic.js';
import { adminPlayerIdsInSeason } from '../services/admin.js';

/**
 * THE GALAXY, BEFORE YOU HAVE AN ACCOUNT. D56.
 *
 * This is the one endpoint the rehearsal stands on: a visitor who has pressed
 * nothing but "see your planet" gets the real frontier galaxy, the real worlds in
 * it, the real fleets crossing it, and the slot the server would give them — and
 * NOTHING IS WRITTEN. No account, no player row, no planet, and above all no
 * SEAT: a galaxy holds 300 commander seats and fills strictly in order (D99), so handing
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

    const [allWorlds, traffic, adminPlayerIds, pirates] = await Promise.all([
      app.projections.worlds(target.seasonId, app.clock.now()),
      app.projections.trafficSnapshot(target.seasonId, app.clock.now()),
      adminPlayerIdsInSeason(app.db, target.seasonId, app.adminUsernames),
      app.projections.pirateSnapshot(target.seasonId, app.clock.now()),
    ]);
    const worlds = allWorlds.filter((world) =>
      world.controller.kind !== 'PLAYER'
      || !adminPlayerIds.has(world.controller.playerId));
    /**
     * Nothing is excluded: the exclusion in `/api/galaxy/traffic` is "what you
     * OWN", and a visitor owns nothing.
     *
     * THE HORIZON STILL APPLIES, FROM THE SEAT THEY ARE BEING OFFERED. D123. A
     * visitor is shown the neighbourhood of the world they would wake up on, at
     * the naked-eye reach every commander starts with — which is both the honest
     * preview of what the game looks like and the same rule everyone else plays
     * under. Handing a visitor the whole disc's traffic would advertise a fog the
     * product does not have.
     */
    const eyes = {
      // The naked eye, and no radar: a visitor owns no hardware.
      ...sensorSphere({ x: slot.x, y: slot.y, z: slot.z }, 0, 0, RESERVED_ID),
      planetId: RESERVED_ID,
      telescope: false,
      // A visitor owns nothing, so nothing can be aimed at them.
      warn: 0,
      revealsSize: false,
      revealsKind: false,
    };
    const contacts = projectGalaxyTraffic(
      traffic,
      null,
      app.clock.now(),
      null,
      [],
      [eyes],
      new Set(),
      /*
        A VISITOR SEES THE PIRATES TOO, at the naked-eye reach every commander
        starts with. They are the most legible thing on the disc — a target with a
        level and a price, moving — and hiding them from the front door would show
        a quieter galaxy than the one being sold.
      */
      pirates,
    );

    /**
     * THE WORLD FOG APPLIES HERE TOO, AND LEAVING IT OUT WAS A HOLE IN D127.
     *
     * This route is UNAUTHENTICATED and was returning `publicWorlds` whole: every
     * owner, every Core level, every satellite and every dome in a live season, to
     * anybody who asked. A commander who wanted the map D127 had just hidden
     * needed a second browser tab. A fog rule with a public bypass is not a fog
     * rule, which is the same standard `projectGalaxyTraffic` states about its own
     * `sensors` argument two lines above.
     *
     * So a visitor sees exactly what the seat they are being offered would see:
     * the naked-eye neighbourhood resolved, everything beyond it a point. That is
     * also the honest preview — the disc they are shown is the disc they get.
     * There is no REMEMBERED state here because a visitor has never probed
     * anything.
     */
    const visible = worlds.map((world) =>
      distance(eyes.at, world.position) <= eyes.identify
        ? { ...world, intel: 'RESOLVED' as const, isSelf: false }
        : {
            id: world.id,
            position: world.position,
            intel: 'UNKNOWN' as const,
            isSelf: false,
            isOwned: false,
            state: world.state,
          });

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
        you: {
          planetId: RESERVED_ID,
          playerId: RESERVED_ID,
          capitalPlanetId: RESERVED_ID,
          planetIds: [RESERVED_ID],
        },
        /**
         * The rehearsal is the same first view the visitor receives after joining.
         * Publishing the eyes as well as applying them keeps the drawn boundary in
         * step with the server-side fog: without this, worlds and traffic were
         * filtered at 500 units while the starting sensor sphere was absent.
         */
        sensors: [eyes],
        planets: [
          ...visible,
          /**
           * The visitor's world, drawn among the real ones, at Command Core 1 like
           * every fresh planet. It used to say "so the tier band it can reach is
           * the real one"; D127 retired the band, and what the level still has to
           * be right for is the silhouette — a preview that draws the starting
           * world at the wrong size is showing the wrong game.
           */
          {
            id: reserved.id,
            name: reserved.name,
            owner: '',
            kind: 'CAPITAL' as const,
            controller: {
              kind: 'PLAYER' as const,
              playerId: RESERVED_ID,
              displayName: '',
            },
            position: reserved.position,
            coreTier: 1,
            // Level 1 like every fresh planet. It carries no dyson ring and cannot
            // grow one here — those start at Core 9 — but the pair has to stay
            // honest: `coreTier` is `ceil(level / 3)` and a payload where the two
            // disagree is a projection the client is entitled to trust and cannot.
            coreLevel: 1,
            satellites: [],
            shielded: false,
            isSelf: true,
            isOwned: true,
            isCapital: true,
            state: { kind: 'NORMAL' as const },
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
