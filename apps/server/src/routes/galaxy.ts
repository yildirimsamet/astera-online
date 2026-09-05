import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { coreTier, distance } from '@astera/rules';
import type { FastifyInstance } from 'fastify';
import {
  accounts,
  buildings,
  clanMemberships,
  clans,
  planets,
  players,
  seasons,
  shards,
} from '../db/schema.js';
import { GameError } from '../services/planet.js';
import { readTelescopes } from '../services/intel.js';
import {
  projectGalaxyTraffic,
  projectStrategicInterceptionImpacts,
  projectStrategicInterceptions,
} from '../services/traffic.js';
import { discoveredAsteroidIndexes } from '../services/asteroidField.js';
import { discoveredPirateIndexes } from '../services/pirateField.js';
import { sensorHistoryForPlayer } from '../services/sensorHistory.js';
import { readClanPresence } from '../services/clan.js';
import { adminPlayerIdsInSeason } from '../services/admin.js';
import { locationIsKnown } from '../services/locationSight.js';
import { requireAuth } from './auth.js';

/**
 * THE GALAXY, AS EVERYBODY SEES IT PLUS WHAT YOU HAVE EARNED.
 *
 * The public half — every world, its tier, its orbit and whether it has a dome —
 * is `services/publicGalaxy.ts`, because `/api/preview` serves the same projection
 * to a visitor who has no account. What is added here is the half that is yours:
 * which world is yours, and a fleet reading for anything your telescopes are
 * actually watching.
 */

export function registerGalaxyRoutes(app: FastifyInstance): void {
  /**
   * Every planet in the season, at the tier of detail this player has earned.
   *
   * THE FOG IS ENFORCED HERE. Fleet status is attached only for planets the caller
   * is actually watching, and only when their clarity permits it. A planet the
   * caller does not watch has no `fleet` key at all — there is nothing in the
   * payload for a modified client to reveal.
   */
  app.get('/api/galaxy', { preHandler: requireAuth }, async (req) => {
    const self = await app.projections.commander(req.accountId!);
    const now = app.clock.now();

    const [allWorlds, watching, sensors, remembered, clanPresence, adminPlayerIds] = await Promise.all([
      app.projections.worlds(self.seasonId, now),
      readTelescopes(app.db, self.playerId, app.clock),
      app.projections.sensorsFor(self.playerId, self.planetIds),
      app.projections.rememberedFor(self.playerId),
      readClanPresence(app.db, self.playerId),
      adminPlayerIdsInSeason(app.db, self.seasonId, app.adminUsernames),
    ]);
    // An operator still needs their own world to enter and test the game, but no
    // other admin-owned world is part of a commander's public galaxy.
    const hiddenAdminPlayerIds = new Set(
      [...adminPlayerIds].filter((playerId) => playerId !== self.playerId),
    );
    const worlds = allWorlds.filter((world) =>
      world.controller.kind !== 'PLAYER'
      || !hiddenAdminPlayerIds.has(world.controller.playerId));
    const mineSet = new Set(self.planetIds);
    const byTarget = new Map(watching.map((w) => [w.targetPlanetId, w]));

    /**
     * THREE STATES, AND THE REDACTION HAPPENS HERE. D127.
     *
     * `publicWorlds` is a SHARED projection cached across every commander on the
     * shard, so it holds the whole truth and always will — narrowing it per caller
     * would serve one player's fog to another. The gate is applied on the way out,
     * which is still server-side enforcement: the unredacted rows never leave this
     * process. Same shape as `sensors` and the telescope overlay beside it.
     *
     * Your own worlds are RESOLVED by construction — they are the centres of your
     * reach. Clanmates' are NOT: D114 excludes shared radar in as many words, and
     * a clan that could see through each other's instruments is that by another
     * name.
     */
    const resolves = (world: (typeof worlds)[number]): boolean =>
      mineSet.has(world.id)
      || sensors.some((post) => distance(post.at, world.position) <= post.identify);

    return {
      you: {
        planetId: self.capitalPlanetId,
        playerId: self.playerId,
        capitalPlanetId: self.capitalPlanetId,
        planetIds: self.planetIds,
      },
      /**
       * WHERE THE CALLER'S OWN EYES ARE. D125.
       *
       * The same posts `/api/galaxy/traffic` filters with, published so the client
       * can do two things it otherwise cannot: DRAW the boundary, and work out for
       * itself the instant a contact will cross it.
       *
       * That second one is what makes the crossing watchable. Traffic arrives as a
       * bearing window a few minutes long and the client interpolates inside it, so
       * a craft that enters reach mid-window would stay "unknown" on screen until
       * the next scheduled read and then pop. Holding the caller's own reach, the
       * client can solve for the crossing instant and ask again exactly then — and
       * the server has still not sent one byte of identity early, because it
       * decides identity per request as it always did.
       *
       * IT DISCLOSES NOTHING. Every figure is the caller's own: their worlds'
       * coordinates, which they already have, and their own Telescope's reach.
       *
       * BOTH RADII ARE ALWAYS NUMBERS. `identify` used to be nullable for the top
       * of the ladder, where `telescopeRange` ended at `Infinity` and JSON has no
       * way to say so. The table states its own ceiling now, so there is no
       * unbounded case left and no null.
       */
      sensors: sensors.map((post) => ({
        /**
         * WHICH OF YOUR OWN WORLDS THESE EYES BELONG TO.
         *
         * The caller's own planet id, which they are holding already — it is in
         * `you.planetIds` in this same payload. Published because the client was
         * matching a post to a world by comparing three floats with `===`, and a
         * lookup that can fail silently in an interface is a feature that
         * disappears with no error anywhere.
         */
        planetId: post.planetId,
        at: post.at,
        /** Whether this post has a working Telescope rather than naked-eye reach. */
        telescope: post.telescope,
        /**
         * THE TWO RADII, UNDER THE NAMES THE MODEL USES. See `@astera/rules/sight`.
         *
         * They were `reach` / `sense` / `warn` on the wire while the same figures
         * were `identify` / `detect` inside the server, and a boundary where one
         * fact has two names is where the client and the server drift apart —
         * which is exactly what happened: `warn` was published for three releases
         * and never drawn by anything, because nothing on the client knew what it
         * was for.
         */
        identify: post.identify,
        detect: post.detect,
      })),
      clanPresence: clanPresence === null
        ? null
        : {
            ...clanPresence,
            members: clanPresence.members.filter((member) =>
              !hiddenAdminPlayerIds.has(member.playerId)),
          },
      planets: worlds.map((world) => {
        const watch = byTarget.get(world.id);

        /**
         * AN UNKNOWN WORLD IS A POINT, AND NOTHING ELSE IS IN THE PAYLOAD. D127.
         *
         * Not nulled fields — ABSENT ones. The fog in this project has always been
         * enforced by omission, because a nulled field is a field a modified client
         * can look for and a shape it can reason about. What is left is an id and
         * a position: something is there, and you have not looked at it.
         */
        if (!resolves(world)) {
          /**
           * TWO THINGS SURVIVE THE FOG, AND THEY ARE BOTH PUBLIC MOMENTS. D127.
           *
           * D52's pillar has never moved: fog hides what is known BEFORE a
           * decision, never a live public event. Two of those are attached to a
           * world rather than to a craft, and dropping them here would have
           * retired features nobody asked to retire.
           *
           *   · A CLAIM WINDOW. D112 makes it public in as many words — "each is
           *     public, begins only after a decisive raid, and goes to the first
           *     valid settlement". A race only the people who already probed the
           *     rock can see is not a race.
           *   · RECOVERY AND OCCUPATION PROTECTION. A Death Star impact is
           *     published to the whole galaxy at its instant (D106) and the
           *     Chronicle records it; the crater is that same event still burning.
           *     Hiding it would mean the galaxy watched a strike land on a world
           *     and then saw the world go back to looking untouched.
           *
           * Neither says anything about how developed the world is, who owns it or
           * what it runs — the facts D127 made private are all still absent.
           */
          const claimOpen =
            world.neutral?.claimUntil !== undefined
            && world.neutral.claimUntil !== null
            && world.neutral.claimUntil.getTime() > now.getTime();
          const publicMoments = {
            state: world.state,
            /**
             * A LIVE CLAIM WINDOW ONLY, AND ONLY ITS CLOCK.
             *
             * Three things were wrong with the first version of this and each one
             * is worth naming, because they are three different mistakes.
             *
             *   · IT SENT `tier`. Tier IS development, and hiding development is
             *     the whole of D127. A partial leak through the one field that was
             *     supposed to be the exception is exactly how a fog rule dies.
             *   · IT SENT EXPIRED WINDOWS. A closed race is not a public moment; it
             *     is a fact about a neutral world, which is a reading. The window
             *     is public while it is OPEN — that is what D112 says and all it
             *     says.
             *   · IT SENT A PARTIAL OBJECT the client could not parse. `neutral`
             *     carried five required fields and this gave two, so `z.coerce.date`
             *     turned a missing `nextReinforcementAt` into an Invalid Date and
             *     the WHOLE GALAXY payload failed to parse. Every world vanished,
             *     including the caller's own. See the contract test.
             */
            ...(claimOpen ? { neutral: { claimUntil: world.neutral!.claimUntil } } : {}),
          };

          const record = remembered.get(world.id);
          if (!record) {
            return {
              id: world.id,
              position: world.position,
              intel: 'UNKNOWN' as const,
              isSelf: false,
              isOwned: false,
              ...publicMoments,
            };
          }
          /**
           * REMEMBERED: THE WORLD STAYS DARK AND GAINS WHAT THE PROBE SAW. D127.
           *
           * Every figure here comes from the SNAPSHOT, never from `world` — that
           * is the whole feature. The target may have built three satellites and
           * two Core levels since; the observer goes on seeing what they went and
           * looked at, until they look again. `seenAt` is published with it,
           * because a record presented as a reading would be the map asserting
           * something false, and the fog hides but never lies.
           */
          return {
            id: world.id,
            position: world.position,
            intel: 'REMEMBERED' as const,
            seenAt: record.seenAt,
            /**
             * The one live field, and it is safe: a world's name is fixed at
             * generation (`planetNameFor`) and never changes, so reading it now or
             * at the probe gives the same string. It is not in the silhouette for
             * that reason.
             */
            name: world.name,
            owner: record.silhouette.owner,
            kind: record.silhouette.kind,
            coreLevel: record.silhouette.coreLevel,
            coreTier: coreTier(record.silhouette.coreLevel),
            satellites: record.silhouette.satellites,
            shielded: record.silhouette.shielded,
            ...(record.silhouette.clan ? { clan: record.silhouette.clan } : {}),
            ...(record.silhouette.controllerPlayerId
              ? {
                  controller: {
                    kind: 'PLAYER' as const,
                    playerId: record.silhouette.controllerPlayerId,
                    displayName: record.silhouette.owner,
                  },
                }
              : {}),
            isSelf: false,
            isOwned: false,
            isCapital: record.silhouette.kind === 'CAPITAL',
            ...publicMoments,
          };
        }

        return {
          ...world,
          intel: 'RESOLVED' as const,
          isSelf: world.id === self.capitalPlanetId,
          isOwned: mineSet.has(world.id),
          isCapital: world.kind === 'CAPITAL',
          // Present only where earned. Absent is not "unknown" — it is "you are
          // not looking at this planet".
          ...(watch
            ? {
                fleet: {
                  status: watch.reading.status,
                  staleMinutes: Math.round(watch.reading.staleMinutes),
                  etaMinutes: watch.reading.etaMinutes,
                  clarity: watch.reading.state,
                },
              }
            : {}),
        };
      }),
    };
  });

  /**
   * Movement in the galaxy, deliberately unattributable.
   *
   * Exists so the 3D surface has life in it without handing away the intel layer:
   * contacts appear mid-flight only, offset by a seeded jitter wider than the
   * planets are spaced, and carry no id, owner, kind or destination. See
   * `services/traffic.ts` for why each of those three rules is load-bearing.
   */
  app.get('/api/galaxy/traffic', { preHandler: requireAuth }, async (req) => {
    const self = await app.projections.commander(req.accountId!);
    const now = app.clock.now();
    // Both from the same generation of the caller's world list: the horizon and
    // the ownership filter must never disagree about which worlds are theirs.
    const [snapshot, sensors, mining, epochs, pirates] = await Promise.all([
      app.projections.trafficSnapshot(self.seasonId, now),
      app.projections.sensorsFor(self.playerId, self.planetIds),
      app.projections.miningSnapshot(self.seasonId, now),
      sensorHistoryForPlayer(app.db, self.playerId),
      app.projections.pirateSnapshot(self.seasonId, now),
    ]);

    return {
      contacts: projectGalaxyTraffic(
        snapshot,
        self.capitalPlanetId,
        now,
        self.playerId,
        self.planetIds,
        sensors,
        discoveredAsteroidIndexes(mining, epochs, now),
        pirates,
        discoveredPirateIndexes(pirates, epochs, now),
      ),
      interceptions: projectStrategicInterceptions(snapshot, self.playerId, sensors),
      interceptionImpacts: projectStrategicInterceptionImpacts(
        snapshot,
        self.playerId,
        sensors,
        now,
      ),
    };
  });

  /** The Dominion ladder. Public by design — competition needs a visible target. */
  app.get('/api/leaderboard', { preHandler: requireAuth }, async (req) => {
    const self = await app.projections.commander(req.accountId!);

    const [[galaxy], sensors, remembered, adminPlayerIds] = await Promise.all([
      app.db
        .select({ capacity: shards.playerCap })
        .from(seasons)
        .innerJoin(shards, eq(seasons.shardId, shards.id))
        .where(eq(seasons.id, self.seasonId)),
      app.projections.sensorsFor(self.playerId, self.planetIds),
      app.projections.rememberedFor(self.playerId),
      adminPlayerIdsInSeason(app.db, self.seasonId, app.adminUsernames),
    ]);
    if (!galaxy) throw new GameError('SEASON_NOT_FOUND', 'Galaxy not found', 404);

    const score = sql<number>`round(${players.dominionTaken} - ${players.dominionLost})`;
    const rows = await app.db
      .select({
        playerId: players.id,
        username: accounts.displayName,
        planetId: planets.id,
        planetName: planets.name,
        coreLevel: buildings.level,
        x: planets.x,
        y: planets.y,
        z: planets.z,
        score,
        clanId: clans.id,
        clanName: clans.name,
        clanTag: clans.tag,
      })
      .from(players)
      .innerJoin(accounts, eq(players.accountId, accounts.id))
      .innerJoin(
        planets,
        and(eq(planets.controllerPlayerId, players.id), eq(planets.kind, 'CAPITAL')),
      )
      .innerJoin(buildings, and(eq(buildings.planetId, planets.id), eq(buildings.type, 'CORE')))
      .leftJoin(
        clanMemberships,
        and(eq(clanMemberships.playerId, players.id), isNull(clanMemberships.leftAt)),
      )
      .leftJoin(
        clans,
        and(eq(clans.id, clanMemberships.clanId), isNull(clans.disbandedAt)),
      )
      .where(eq(players.seasonId, self.seasonId))
      .orderBy(desc(score), asc(players.joinedAt), asc(players.id))
      .limit(galaxy.capacity);

    const visibleRows = rows.filter((entry) =>
      entry.playerId === self.playerId || !adminPlayerIds.has(entry.playerId));
    const ladder = visibleRows.map((entry, i) => {
      const isSelf = entry.playerId === self.playerId;
      const resolved = isSelf || sensors.some((post) => distance(
        post.at,
        { x: entry.x, y: entry.y, z: entry.z },
      ) <= post.identify);
      const memory = remembered.get(entry.planetId);
      const located = locationIsKnown(
        entry.planetId,
        { x: entry.x, y: entry.y, z: entry.z },
        isSelf,
        { sensors, remembered },
      );
      const visibleWorld = resolved
        ? {
            planetId: entry.planetId,
            planetName: entry.planetName,
            coreTier: coreTier(entry.coreLevel),
          }
        : located && memory
          ? {
              planetId: entry.planetId,
              planetName: entry.planetName,
              // A remembered ladder row must freeze with the probe. Publishing
              // the current tier here would bypass D127 through a side channel.
              coreTier: coreTier(memory.silhouette.coreLevel),
            }
          : {};
      return {
        rank: i + 1,
        playerId: entry.playerId,
        username: entry.username,
        ...visibleWorld,
        score: entry.score,
        clan: entry.clanId && entry.clanName && entry.clanTag
          ? { id: entry.clanId, name: entry.clanName, tag: entry.clanTag }
          : null,
      };
    });

    return {
      ladder,
      you: ladder.find((e) => e.playerId === self.playerId) ?? null,
    };
  });
}
