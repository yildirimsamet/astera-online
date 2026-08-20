import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { engagementEndsAt } from '@blindspace/rules';
import type { Fleet, BuildingId, HullId, InstrumentId, SatelliteId } from '@blindspace/rules';
import type { z } from 'zod';
import type { MiningRun, PendingThread, notificationsSchema } from './schemas.js';
import { useApi } from './context.js';
import { serverNow } from '../lib/clock.js';

type NotificationList = z.infer<typeof notificationsSchema>;

export const keys = {
  servers: ['servers'],
  season: ['season'],
  planet: ['planet'],
  galaxy: ['galaxy'],
  intel: ['intel'],
  leaderboard: ['leaderboard'],
  notifications: ['notifications'],
  unlocks: ['unlocks'],
  pending: ['pending'],
  traffic: ['traffic'],
  reports: ['reports'],
  mining: ['mining'],
} as const;

/**
 * READ POLICY — a galaxy that is LIVE, not one that is correct on request.
 *
 * The rule here used to be "nothing polls": the world only changes when an event
 * resolves, the stream says when that happened, so the client refetches on an event
 * or on focus and otherwise sits still. It is a good rule for a database and the
 * wrong one for this product. The stream fires only for what happens TO YOU, and
 * most of what makes the disc feel inhabited is what happens to SOMEBODY ELSE — a
 * neighbour's fleet leaving, a rival's Prospector reaching a rock first, a raid
 * landing on a world across the disc. None of that will ever produce an event for
 * you, so under the old rule a player sitting on the galaxy was looking at a
 * photograph and did not know it.
 *
 * So the policy is now: ANYTHING THAT MOVES OR CAN CHANGE BECAUSE OF SOMEBODY ELSE
 * CARRIES A TIMER, and the timer is as short as the thing it watches deserves.
 * `traffic` at twenty seconds, `mining` and `galaxy` at thirty, `pending` at sixty.
 * Events and arrival wake-ups still do the precise work — a timer is a floor under
 * liveness, never the mechanism for an instant the payload already names.
 *
 * `READ` is what is left: the surfaces that only change because YOU changed them,
 * where an event or a mutation is genuinely the whole story.
 */
const READ = { staleTime: 15_000, refetchOnWindowFocus: true } as const;

export function useSeason() {
  const api = useApi();
  return useQuery({ queryKey: keys.season, queryFn: api.season, staleTime: 5 * 60_000 });
}

/**
 * The galaxies and how full they are. D21.
 *
 * THE ONE READ WITH A TIMER ON IT, and the only place a poll is right in this
 * codebase: the numbers on this screen — worlds taken, commanders in game — are
 * exactly the numbers that change because of somebody else while you sit looking at
 * them, and a player choosing where to spend two weeks is entitled to a live figure.
 * It stops the moment they are placed, because this query is only mounted by the
 * landing and server screens.
 *
 * Also the only read that works signed OUT: the landing page shows the population
 * before anyone has an account.
 */
export function useServers() {
  const api = useApi();
  return useQuery({
    queryKey: keys.servers,
    queryFn: api.servers,
    staleTime: 10_000,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
}

export function usePlanet() {
  const api = useApi();
  return useQuery({ queryKey: keys.planet, queryFn: api.planet, ...READ });
}

/**
 * THE DISC ITSELF — and the one read whose staleness is invisible.
 *
 * It carries three things that change because of SOMEBODY ELSE and can never
 * produce an event for you: how developed each world is (the silhouette), what
 * hardware is in its orbit, and — the expensive one — the telescope reading on
 * every world you watch. On `READ` alone this never refetched at all unless the
 * tab was refocused or something happened TO the player, so a commander who sat
 * looking at the galaxy was reading a photograph: a neighbour's fleet shown HOME
 * long after it left, labelled `live`, which is the single most valuable fact in
 * the game stated wrongly with full confidence.
 *
 * A poll is safe here precisely because of the fog rule that looks like it should
 * forbid one: a telescope read is seeded per `(watchId, timeWindow)`, so asking
 * again inside the same window returns the same answer. Refreshing cannot buy a
 * confirmation — that is what the seeding is for — and it is why `traffic`,
 * `mining` and `pending` already poll.
 *
 * Thirty seconds. Slower than traffic because worlds change more slowly than craft
 * do, fast enough that `live` means live. The write it provokes — `readTelescopes`
 * stamps `lastConfirmedAt` — is throttled to a quarter of a minute on the server
 * for exactly this reason.
 */
export function useGalaxy() {
  const api = useApi();
  return useQuery({
    queryKey: keys.galaxy,
    queryFn: api.galaxy,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useIntel() {
  const api = useApi();
  return useQuery({ queryKey: keys.intel, queryFn: api.intel, ...READ });
}

/**
 * What is still in flight.
 *
 * The one thing that genuinely benefits from a timer: a radar warning can appear
 * without any event reaching this tab, because the fuse is lit server-side at
 * `arriveAt − lead`. A minute is cheap and it is the difference between finding
 * out and finding out too late.
 */
export function usePending() {
  const api = useApi();
  return useQuery({
    queryKey: keys.pending,
    queryFn: api.pending,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * EVERYBODY ELSE'S CRAFT — and the one read nothing can notify you about.
 *
 * The event stream only fires for things that happen TO YOU. A neighbour
 * launching a raid at somebody else is the whole point of this payload and is
 * exactly the case no event will ever announce, so the poll is the only way it
 * arrives.
 *
 * It was sixty seconds, and that is why the disc read as empty. A player opens
 * the game, looks at a galaxy where three fleets are in the air, and sees nothing
 * for up to a minute — by which time a short flight has landed and there was
 * never anything to see. `KNOWN RISKS` puts "the galaxy feels empty" near the top
 * of what kills this game, and a minute of latency manufactures exactly that.
 *
 * Twenty seconds against a payload that is a few hundred bytes and holds no
 * per-player state. The cost is real and small; the thing it buys is the galaxy
 * looking inhabited.
 */
export function useTraffic() {
  const api = useApi();
  return useQuery({
    queryKey: keys.traffic,
    queryFn: api.traffic,
    staleTime: 10_000,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * The asteroid field, and your craft in it. D19.
 *
 * Refetched on a slow timer as well as on events, because rocks appear and expire
 * on the season's own schedule with nothing to notify anyone about — a player who
 * left the tab open should not be looking at a sky that emptied an hour ago.
 */
export function useMining() {
  const api = useApi();
  return useQuery({
    queryKey: keys.mining,
    queryFn: api.mining,
    /**
     * Thirty rather than ninety. Rocks appear and expire on the season's own
     * schedule with nothing to notify anyone about, and this list also carries
     * every wreck field in the galaxy — which decays on a three-hour clock and is
     * contested. A minute and a half of latency on a race is not a race.
     */
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useReports() {
  const api = useApi();
  return useQuery({ queryKey: keys.reports, queryFn: api.reports, ...READ });
}

export function useLeaderboard() {
  const api = useApi();
  return useQuery({ queryKey: keys.leaderboard, queryFn: api.leaderboard, staleTime: 60_000 });
}

export function useUnlocks() {
  const api = useApi();
  return useQuery({ queryKey: keys.unlocks, queryFn: api.unlocks, ...READ });
}

/**
 * `enabled` IS NOT OPTIONAL DECORATION HERE.
 *
 * `useLiveAlerts(ready)` passed its flag to the effect and not to the query, so
 * this ran on every screen in front of the galaxy: once signed out on the landing
 * page (401, plus a refresh attempt that could only fail) and again on the server
 * list after registering but before taking a planet (404 — `/api/notifications`
 * resolves a PLANET, and a commander who has not joined one has none). Three
 * wasted round trips and two errors in the console of every cold start, for a list
 * that is empty by definition until the player is placed.
 */
export function useNotifications(enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: keys.notifications, queryFn: api.notifications, enabled, ...READ });
}

/**
 * READING THE NEWS, AS A MUTATION RATHER THAN A SHOUT INTO THE DARK. D45.
 *
 * `Signals` called `api.markSeen(ids)` directly and dropped the promise. Nothing
 * invalidated the list afterwards, and nothing else was going to: the query is
 * mounted permanently, so React Query had no mount to refetch on, no focus event
 * fires when a sheet closes, and there is no interval. The badge stayed lit with
 * its count intact after the player had read every line in it — until an unrelated
 * stream event happened along. The one control whose entire job is to go to zero
 * could not.
 *
 * Optimistic, because the honest latency here is zero: the player HAS read them,
 * and the server is being informed rather than asked. `onSettled` reconciles
 * whichever way the request went, so a failure puts the badge back rather than
 * leaving the interface lying in the other direction.
 */
export function useMarkSeen() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.markSeen(ids),
    retry: 1,
    onMutate: async (ids: string[]) => {
      await client.cancelQueries({ queryKey: keys.notifications });
      const read = new Set(ids);
      client.setQueryData<NotificationList>(keys.notifications, (current) =>
        current === undefined
          ? current
          : {
              ...current,
              notifications: current.notifications.map((n) =>
                read.has(n.id) ? { ...n, seen: true } : n,
              ),
            },
      );
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.notifications });
    },
  });
}

/** Anything that spends resources moves the planet, the ladder and the map. */
/**
 * REFETCH THE MOMENT A FLIGHT IS DUE, not on the next poll. D48.
 *
 * Every leg in the galaxy is drawn by an interpolation that CLAMPS at its own end,
 * so a craft whose payload has not caught up is not missing — it is PARKED on its
 * destination. On a raid that reads as a squadron hanging over a world; on a
 * mining run it reads as a drill sitting at an empty point in space while the rock
 * it was sent to sails past, which is exactly what it was reported as.
 *
 * Polling faster is the wrong fix: the interesting instant is KNOWN — the payload
 * carries it — so the client can simply wake up on it. One timer per pending
 * arrival, cleared on every change of the list.
 *
 * The extra second is deliberate. Firing exactly on `arriveAt` races the worker,
 * which resolves on its own poll; landing just after it means the refetch sees the
 * new state rather than the old one and needing a second round trip to find out.
 */
function useRefetchOnArrival(moments: readonly number[], ...groups: readonly (readonly string[])[]) {
  const client = useQueryClient();
  // Joined into a primitive so the effect re-arms when the SET of instants
  // changes, rather than on every refetch that returns an equal-but-new array.
  const signature = moments.join(',');
  const targets = useRef(groups);
  targets.current = groups;

  useEffect(() => {
    const now = serverNow();
    const timers = signature
      .split(',')
      .filter((v) => v !== '')
      .map(Number)
      .filter((at) => at > now && at - now < 2_147_483_647)
      .map((at) =>
        setTimeout(
          () => {
            for (const key of targets.current) void client.invalidateQueries({ queryKey: key });
          },
          at - now + 1000,
        ),
      );
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [signature, client]);
}

/**
 * Wake up when one of your own mining craft is due at its rock, or home again.
 *
 * Both edges matter: at the first the run turns for home and the drill must stop
 * being drawn at a point the rock has already left, and at the second the craft
 * lands and the ore arrives.
 */
export function useMiningArrivals(runs: readonly MiningRun[] | undefined): void {
  const moments = useMemo(() => {
    const out: number[] = [];
    for (const run of runs ?? []) {
      if (run.status === 'outbound') out.push(run.arriveAt.getTime());
      if (run.status === 'returning' && run.homeAt) out.push(run.homeAt.getTime());
    }
    return out.sort((a, b) => a - b);
  }, [runs]);
  useRefetchOnArrival(moments, keys.mining, keys.planet, keys.pending, keys.galaxy);
}

/**
 * Wake up when one of your own fleets lands, and again when its battle is settled.
 *
 * A raid is over its target for `COMBAT.engagementSeconds` before anything is
 * decided (D44), so the arrival alone is not the interesting instant — the END of
 * the engagement is. Both are armed: the first is when the bombardment starts, the
 * second is when the squadron should turn for home or be gone.
 */
export function useFleetArrivals(pending: readonly PendingThread[] | undefined): void {
  const moments = useMemo(() => {
    const out: number[] = [];
    for (const thread of pending ?? []) {
      const at = thread.arriveAt.getTime();
      out.push(at);
      if (thread.kind === 'fleet' && thread.leg !== 'return') out.push(engagementEndsAt(at));
    }
    return out.sort((a, b) => a - b);
  }, [pending]);
  useRefetchOnArrival(moments, keys.pending, keys.planet, keys.galaxy, keys.reports, keys.traffic);
}

function useInvalidator() {
  const client = useQueryClient();
  return (...groups: readonly (readonly string[])[]) => {
    for (const key of groups) void client.invalidateQueries({ queryKey: key });
  };
}

export function useUpgrade() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: (type: BuildingId) => api.upgrade(type),
    onSuccess: () => {
      invalidate(keys.planet, keys.galaxy, keys.leaderboard);
    },
  });
}

export function useBuild() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: ({ hull, count }: { hull: HullId; count: number }) => api.build(hull, count),
    onSuccess: () => {
      invalidate(keys.planet, keys.leaderboard);
    },
  });
}

export function useRaiseInstrument() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: (type: InstrumentId) => api.raiseInstrument(type),
    // A new Telescope level changes what every reading is allowed to say.
    onSuccess: () => {
      invalidate(keys.planet, keys.intel, keys.galaxy, keys.leaderboard);
    },
  });
}

export function useInstallSatellite() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: (type: SatelliteId) => api.installSatellite(type),
    /**
     * The galaxy too: hardware in orbit is public (D15), so a satellite going up
     * changes what every other player can see around this world — including the
     * body they will watch appear.
     */
    onSuccess: () => {
      invalidate(keys.planet, keys.intel, keys.galaxy, keys.leaderboard);
    },
  });
}

export function useWatch() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: ({ targetPlanetId, slot }: { targetPlanetId: string; slot: number }) =>
      api.watch(targetPlanetId, slot),
    onSuccess: () => {
      invalidate(keys.intel, keys.galaxy, keys.unlocks);
    },
  });
}

export function useProbe() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: (targetPlanetId: string) => api.probe(targetPlanetId),
    onSuccess: () => {
      invalidate(keys.planet, keys.intel, keys.pending);
    },
  });
}

/**
 * Empty the works. D16.
 *
 * Invalidates the galaxy too: collecting moves Wealth between columns, and Wealth
 * is what the rank floor reads, so it can change who may attack whom.
 */
export function useCollect() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: () => api.collect(),
    onSuccess: () => {
      invalidate(keys.planet, keys.galaxy, keys.leaderboard);
    },
  });
}

export function useMine() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: ({ asteroidIndex, craft }: { asteroidIndex: number; craft: number }) =>
      api.mine(asteroidIndex, craft),
    onSuccess: () => {
      invalidate(keys.mining, keys.planet, keys.pending);
    },
  });
}

/** Send craft to a wreck field. Invalidates the same things a mining run does. */
export function useHarvest() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: ({ fieldId, craft }: { fieldId: string; craft: number }) =>
      api.harvest(fieldId, craft),
    onSuccess: () => {
      invalidate(keys.mining, keys.planet, keys.pending);
    },
  });
}

/** IRREVERSIBLE. The confirmation lives in the UI; the server has no recall. */
export function useLaunch() {
  const api = useApi();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: ({ targetPlanetId, fleet }: { targetPlanetId: string; fleet: Fleet }) =>
      api.launch(targetPlanetId, fleet),
    onSuccess: () => {
      invalidate(keys.planet, keys.galaxy, keys.intel, keys.pending);
    },
  });
}
