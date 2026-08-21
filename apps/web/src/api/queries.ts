import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { engagementEndsAt } from '@astera/rules';
import type { Fleet, BuildingId, HullId, InstrumentId, SatelliteId } from '@astera/rules';
import type { z } from 'zod';
import type { Contact, MiningRun, PendingThread, PlanetView, notificationsSchema } from './schemas.js';
import { useApi } from './context.js';
import { keys } from './keys.js';
import { serverNow } from '../lib/clock.js';
import { worksAt } from '../lib/projection.js';
import {
  predictBuild,
  predictCollect,
  predictInstrument,
  predictSatellite,
  predictUpgrade,
} from '../lib/predict.js';

/**
 * Re-exported so the fifteen call sites that read `keys` from here keep working.
 * It lives in `keys.ts` now — see that file for why it had to leave this one.
 */
export { keys };

type NotificationList = z.infer<typeof notificationsSchema>;


/**
 * READ POLICY — a galaxy that is LIVE, not one that is correct on request. D53.
 *
 * THREE MECHANISMS, IN ORDER OF PRECISION, and the shortest one is not the timer.
 *
 *   1. THE INSTANT THE PAYLOAD ALREADY NAMES. Every flight carries its own arrival,
 *      so nothing is ever polled for to find out when it lands — `useArrivals` and
 *      `useRefetchOnArrival` simply wake up on it.
 *   2. THE STREAM. Anything that happens to THIS commander arrives immediately, and
 *      since D53 so does anything that happens IN THIS GALAXY — a neighbour's fleet
 *      leaving, a rival's Prospector going out, a raid resolving, a world growing.
 *      That second family is the one no event could ever announce before, and it is
 *      what made the disc read as a photograph: a player sitting on the galaxy was
 *      looking at a world up to thirty seconds old and could not tell.
 *   3. THE TIMER, which is now a SAFETY NET and nothing else. It is what runs the
 *      galaxy if the live channel is down — a proxy that dropped the socket, a
 *      restart, a phone that lost signal and has not reconnected. Sixty seconds
 *      across the board, because a net is meant to be under the thing, not to be
 *      the thing.
 *
 * The policy used to be "anything that can change because of somebody else carries
 * a timer, and the timer is as short as the thing it watches deserves" — twenty
 * seconds on `traffic`, thirty on `mining` and `galaxy`. That bought liveness with
 * a poll from every client forever, whether or not anything had happened, and it
 * still could not do better than its own interval. The broadcast is both faster
 * and cheaper: at fifty commanders the old floor was a hundred and fifty requests
 * a minute standing still, and the new one is fifty plus one burst per real event.
 *
 * `/health` reports whether the live channel is actually up, because a dead bus and
 * a quiet galaxy look identical from the outside and only one of them is fine.
 *
 * `READ` is what is left: the surfaces that only change because YOU changed them,
 * where an event or a mutation is genuinely the whole story.
 */

/**
 * The safety net, for every read that a broadcast keeps live.
 *
 * One number rather than four, because there is no longer a per-payload judgement
 * to make: the reason a read polls at all is that the channel might be down, and
 * that reason is the same for all of them.
 */
const NET_MS = 60_000;
const READ = { staleTime: 15_000, refetchOnWindowFocus: true } as const;

/**
 * The galaxy's clock — and, since D60, how many people are in it.
 *
 * FIVE MINUTES WAS RIGHT WHILE THIS PAYLOAD WAS STATIC. The seed, the shard and
 * `endsAt` do not move, so nothing here needed asking for often. `online` does
 * move, and it is counted over a five-minute window on the server — so a
 * five-minute cache on top of it put a figure on the disc that could be ten
 * minutes behind the galaxy. On a real-time game (D63) that is the one number on
 * screen that must not be stale.
 *
 * A minute costs one small request and makes the count honest.
 */
export function useSeason() {
  const api = useApi();
  return useQuery({ queryKey: keys.season, queryFn: api.season, staleTime: NET_MS });
}

/**
 * The galaxies and how full they are. D21.
 *
 * The numbers on this screen — worlds taken, commanders in game — change because
 * of somebody else while you sit looking at them, and a player choosing where to
 * spend two weeks is entitled to a live figure. It stops the moment they are
 * placed, because this query is only mounted by the landing and server screens.
 *
 * This used to claim to be the only read in the codebase with a timer on it, and
 * the only place a poll was right. Five reads poll now, for the reason the policy
 * above gives, and the note directly under this one was the first to break the
 * rule it was quoting.
 *
 * It is still the only read that works signed OUT: the landing page shows the
 * population before anyone has an account.
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
 * THE DISC ITSELF — and the most expensive read in the game.
 *
 * It carries three things that change because of SOMEBODY ELSE: how developed each
 * world is (the silhouette), what hardware is in its orbit, and — the expensive
 * one — the telescope reading on every world the caller watches. Under the old
 * policy it polled at thirty seconds and a commander sitting on the galaxy read a
 * neighbour's fleet as HOME long after it left, labelled `live`, which is the
 * single most valuable fact in the game stated wrongly with full confidence.
 *
 * It is now driven by `shard:world`, which the server publishes ONLY when a
 * world's public shape actually changed — a Core crossing a tier boundary, a
 * satellite going up. A flight does not touch this payload and does not refetch
 * it, which is why the broadcast is cheaper than the poll it replaced despite
 * being faster.
 *
 * Refetching more often is safe here precisely because of the fog rule that looks
 * like it should forbid it: a telescope read is seeded per `(watchId, timeWindow)`,
 * so asking again inside the same window returns the same answer and a refresh
 * cannot buy a confirmation. The write it provokes — `readTelescopes` stamps
 * `lastConfirmedAt` — is throttled to a quarter of a minute on the server, which
 * caps it whatever the client does.
 */
export function useGalaxy() {
  const api = useApi();
  return useQuery({
    queryKey: keys.galaxy,
    queryFn: api.galaxy,
    staleTime: 15_000,
    refetchInterval: NET_MS,
    refetchOnWindowFocus: true,
  });
}

export function useIntel() {
  const api = useApi();
  return useQuery({ queryKey: keys.intel, queryFn: api.intel, ...READ });
}

/**
 * What is still in flight — yours, and what is coming for you.
 *
 * Untouched by D53, and deliberately: everything on this payload is about the
 * caller, so the PLAYER stream already carries it. A radar warning fires
 * server-side at `arriveAt − lead` and writes a notification, which is an event
 * addressed to this commander and arrives immediately.
 *
 * The interval is the same net as everywhere else, and it is why the number did
 * not have to move: sixty seconds was already the right answer for a read whose
 * every real change is announced.
 */
export function usePending() {
  const api = useApi();
  return useQuery({
    queryKey: keys.pending,
    queryFn: api.pending,
    staleTime: 30_000,
    refetchInterval: NET_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * EVERYBODY ELSE'S CRAFT — and the read the broadcast was built for. D53.
 *
 * This is the payload that says the galaxy is inhabited: every fleet, probe, drill
 * and salvage run in the air that is not yours. Until D53 nothing could announce
 * any of it — the stream fired only for what happened TO YOU, and a neighbour
 * raiding somebody else is by definition not that — so it arrived on a poll.
 *
 * The poll went from sixty seconds to twenty for exactly this reason, and twenty
 * was still wrong in the way that matters: a player opens the game, looks at a
 * galaxy where three fleets are in the air, and sees an empty disc for up to a
 * third of a minute. `KNOWN RISKS` puts "the galaxy feels empty" near the top of
 * what kills this game, and any interval at all manufactures some of it.
 *
 * Now a launch and an arrival are both broadcast to the shard the instant they
 * commit, and this refetches within a quarter of a second of either. The interval
 * left behind is the net under a dead channel, not the mechanism.
 */
export function useTraffic() {
  const api = useApi();
  return useQuery({
    queryKey: keys.traffic,
    queryFn: api.traffic,
    staleTime: 10_000,
    refetchInterval: NET_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * The asteroid field, the wreckage, and everyone's craft working both. D19, D32.
 *
 * A run starting, turning for home or landing is broadcast to the shard, and so is
 * a battle — which is what puts a debris field on this payload. So the two
 * contested things here, the rock and the wreck, are both live now.
 *
 * The interval remains for the one thing nothing broadcasts and nothing can: rocks
 * APPEAR AND EXPIRE on the season's own schedule, and a wreck field decays on a
 * three-hour clock. Nobody acts, so there is nothing to publish — a player who left
 * the tab open should simply not be looking at a sky that emptied an hour ago.
 */
export function useMining() {
  const api = useApi();
  return useQuery({
    queryKey: keys.mining,
    queryFn: api.mining,
    staleTime: 15_000,
    refetchInterval: NET_MS,
    refetchOnWindowFocus: true,
  });
}

export function useReports() {
  const api = useApi();
  return useQuery({ queryKey: keys.reports, queryFn: api.reports, ...READ });
}

/**
 * WHAT THE GAME OWES YOU, AND THE ONE READ THAT DOES NOT NEED A TIMER.
 *
 * Everything on this payload moves because YOU moved it — a probe you sent, a
 * level you bought, a run of yours that arrived — so `READ` is the whole policy
 * and a poll would be a request a minute for a number that cannot have changed.
 *
 * The one thing that moves it without a tap is a flight ENDING — a raid
 * resolving, a drill reaching its rock — and that is a player event, which
 * `useEventStream` already invalidates this key for. A hand-written `SOCIAL`
 * grant is not an event at all and is picked up when the panel is opened, which
 * is the only moment it matters.
 */
export function useRewards() {
  const api = useApi();
  return useQuery({ queryKey: keys.rewards, queryFn: api.rewards, ...READ });
}

/**
 * TAKE ONE TIER. Answers with both surfaces it moved, so neither refetches.
 *
 * NOT PREDICTED, and that is the rule rather than an omission: an optimistic
 * predictor DECLINES whenever the answer is not certain (D53), and this one is
 * not. The server re-counts progress under the planet lock and can legitimately
 * refuse a tier this client believes is claimable — a second tab took it, a run
 * this phone has not heard about yet. The flicker of a reward un-happening is
 * exactly the failure D53 forbids, and the round trip it would save is one the
 * player is already watching a number count up through.
 */
export function useClaimReward() {
  const api = useApi();
  const client = useQueryClient();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  return useMutation({
    mutationFn: (id: string) => api.claimReward(id),
    onSuccess: async (result) => {
      // Both writes come out of one answer, so both need the same protection.
      await Promise.all([apply(result.planet), client.cancelQueries({ queryKey: keys.rewards })]);
      client.setQueryData(keys.rewards, result.rewards);
      // Wealth moved with the grant, and a store that just crossed a tier changes
      // this world's silhouette on everybody else's disc.
      invalidate(keys.leaderboard, keys.galaxy);
    },
  });
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
 * A CONTACT'S PUBLISHED WINDOW RUNNING OUT IS NOT AN ARRIVAL.
 *
 * Somebody else's craft carries a BEARING WINDOW — where it is and where it will be
 * a little later — and the client interpolates inside it. When the window ends the
 * client is out of published motion, so it has to ask for the next one, or the
 * craft coasts on a guess and then stops.
 *
 * That wake used to be mixed in with the real arrivals, which refetch nine
 * payloads: the planet, the galaxy, the reports, the notifications. None of those
 * can have moved because a STRANGER'S bearing window expired — the only thing that
 * changed is the window itself. In a busy galaxy every contact has one ending
 * inside the next minute, so the most expensive read in the game was being pulled
 * on a schedule set by other people's traffic.
 *
 * One key, and the same timer mechanism. What the window says is public and the
 * refetch is the same fog-enforced query it always was.
 */
export function useContactWindows(contacts: readonly Contact[] | undefined): void {
  const moments = useMemo(
    () => (contacts ?? []).map((c) => c.endAt.getTime()).sort((a, b) => a - b),
    [contacts],
  );
  useRefetchOnArrival(moments, keys.traffic);
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

/**
 * TAKE THE ANSWER THE SERVER ALREADY GAVE. D53.
 *
 * Every mutation used to end in `invalidate(keys.planet)`, which is a request for a
 * SECOND round trip to learn what the first one did. Construction in this game is
 * instant on payment — no build timers, by design — and the interface was making a
 * player wait twice the network latency to see a decision the design promises is
 * immediate. On a phone that is a visibly dead button after every tap.
 *
 * The server now answers with the whole authoritative view, built inside the same
 * transaction under the same row lock, so it is exactly what the refetch would have
 * returned and there is nothing to go back for. `setQueryData` writes it, every
 * subscriber re-renders on the frame the response lands, and the request count for
 * an upgrade goes from two to one.
 *
 * The other keys still invalidate: they are payloads this action moved that the
 * response does not carry.
 *
 * AND THE WRITE HAS TO WIN AGAINST A READ THAT IS ALREADY IN THE AIR. D72.
 *
 * `setQueryData` puts the authoritative view in the cache; a `GET /api/planet`
 * that was issued BEFORE the tap and lands after it overwrites that view with the
 * pre-tap world, and React Query has no way to know which of the two is newer —
 * the response it is holding is simply the most recent one to arrive.
 *
 * It is not hypothetical. `useArrivals` invalidates `planet` and `pending` every
 * time a flight is due, and a player pressing LAUNCH in that same second sees the
 * fleet appear on the disc and then vanish for up to a minute — the exact "entity
 * spawned and then disappeared" failure, and it needs no network trouble at all to
 * reproduce.
 *
 * `cancelQueries` aborts the outstanding fetch and reverts its state, so the value
 * written here is the last word. `useOptimisticPlanet` already did this on the way
 * IN, for the same reason and with the same comment; the way out was missing it.
 */
function useApplyPlanet() {
  const client = useQueryClient();
  return async (planet: PlanetView) => {
    await client.cancelQueries({ queryKey: keys.planet });
    client.setQueryData(keys.planet, planet);
  };
}

/**
 * WHAT THE PLAYER SEES BETWEEN THE TAP AND THE ANSWER. D53.
 *
 * Answering with the whole view took an action from two round trips to one. This
 * takes the last one out of the player's way: the prediction is written on the
 * tap, the server's own answer overwrites it when it lands, and a refusal puts
 * back exactly what was there before.
 *
 * NOT A DECISION — a prediction, reconciled. See `lib/predict.ts` for what is and
 * is not predicted, and why the list is deliberately short.
 *
 * `cancelQueries` first, because an in-flight `/api/planet` that resolves after
 * this would overwrite the prediction with the pre-tap world and the interface
 * would appear to undo the action.
 */
interface Rollback {
  previous: PlanetView | undefined;
}

function useOptimisticPlanet() {
  const client = useQueryClient();
  return {
    predict: async (of: (view: PlanetView) => PlanetView | null): Promise<Rollback> => {
      await client.cancelQueries({ queryKey: keys.planet });
      const previous = client.getQueryData<PlanetView>(keys.planet);
      if (previous) {
        /**
         * THE WORKS COME FORWARD FIRST, AND MISSING THIS PUT A DIP IN THE METER.
         *
         * The works are not stored, they are PROJECTED: `useProjected` takes the
         * figure in the cache and adds production since `dataUpdatedAt`. Writing
         * here re-anchors `dataUpdatedAt` to now — so a payload carrying a works
         * figure from five minutes ago makes the projection restart from the older
         * number, and the meter visibly drops and is then corrected when the
         * server answers. Small on a new planet and hundreds of alloy on a
         * developed one, and exactly the "number that changes without a cause"
         * `projection.ts` exists to prevent.
         *
         * `/api/planet` does not poll, so `dataUpdatedAt` can be minutes old by the
         * time somebody taps something. Advancing to now first makes the predicted
         * view what the server is about to return, less the spend.
         */
        const fetchedAt = client.getQueryState(keys.planet)?.dataUpdatedAt ?? Date.now();
        const settled: PlanetView = {
          ...previous,
          planet: { ...previous.planet, ...worksAt(previous.planet, fetchedAt, serverNow()) },
        };
        const predicted = of(settled);
        /**
         * `null` is the predictor declining — the server is about to refuse, or the
         * answer is not certain from what this client holds. Nothing is written, so
         * there is nothing to undo either: handing back a rollback here would move
         * `dataUpdatedAt` on a failure for a tap that changed nothing.
         */
        if (!predicted) return { previous: undefined };
        client.setQueryData(keys.planet, predicted);
        /**
         * AND THE UNDO IS THE SETTLED VIEW, NOT THE ONE THAT CAME OUT OF THE CACHE.
         *
         * Rolling back writes too, which re-anchors `dataUpdatedAt` again — so
         * restoring the pre-settlement figure would put the dip back on the way
         * out. The settled view is the honest world to return to: the same planet,
         * with production that really did happen counted.
         */
        return { previous: settled };
      }
      return { previous: undefined };
    },
    rollback: (context: Rollback | undefined): void => {
      if (context?.previous) client.setQueryData(keys.planet, context.previous);
    },
  };
}

export function useUpgrade() {
  const api = useApi();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  const { predict, rollback } = useOptimisticPlanet();
  return useMutation({
    mutationFn: (type: BuildingId) => api.upgrade(type),
    onMutate: (type: BuildingId) => predict((view) => predictUpgrade(view, type)),
    onError: (_error, _type, context) => {
      rollback(context);
    },
    onSuccess: async (result) => {
      await apply(result.planet);
      // The galaxy because a Core crossing a tier changes this world's silhouette
      // for everybody, and the ladder because Wealth moved.
      invalidate(keys.galaxy, keys.leaderboard);
    },
  });
}

export function useBuild() {
  const api = useApi();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  const { predict, rollback } = useOptimisticPlanet();
  return useMutation({
    mutationFn: ({ hull, count }: { hull: HullId; count: number }) => api.build(hull, count),
    onMutate: ({ hull, count }: { hull: HullId; count: number }) =>
      predict((view) => predictBuild(view, hull, count)),
    onError: (_error, _vars, context) => {
      rollback(context);
    },
    onSuccess: async (result) => {
      await apply(result.planet);
      invalidate(keys.leaderboard);
    },
  });
}

export function useRaiseInstrument() {
  const api = useApi();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  const { predict, rollback } = useOptimisticPlanet();
  return useMutation({
    mutationFn: (type: InstrumentId) => api.raiseInstrument(type),
    onMutate: (type: InstrumentId) => predict((view) => predictInstrument(view, type)),
    onError: (_error, _type, context) => {
      rollback(context);
    },
    // A new Telescope level changes what every reading is allowed to say.
    onSuccess: async (result) => {
      await apply(result.planet);
      invalidate(keys.intel, keys.galaxy, keys.leaderboard);
    },
  });
}

export function useInstallSatellite() {
  const api = useApi();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  const { predict, rollback } = useOptimisticPlanet();
  return useMutation({
    mutationFn: (type: SatelliteId) => api.installSatellite(type),
    onMutate: (type: SatelliteId) => predict((view) => predictSatellite(view, type)),
    onError: (_error, _type, context) => {
      rollback(context);
    },
    /**
     * The galaxy too: hardware in orbit is public (D15), so a satellite going up
     * changes what every other player can see around this world — including the
     * body they will watch appear.
     */
    onSuccess: async (result) => {
      await apply(result.planet);
      invalidate(keys.intel, keys.galaxy, keys.leaderboard);
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
  const apply = useApplyPlanet();
  const { predict, rollback } = useOptimisticPlanet();
  return useMutation({
    mutationFn: () => api.collect(),
    onMutate: () => predict(predictCollect),
    onError: (_error, _vars, context) => {
      rollback(context);
    },
    onSuccess: async (result) => {
      await apply(result.planet);
      invalidate(keys.galaxy, keys.leaderboard);
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
  const client = useQueryClient();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  return useMutation({
    mutationFn: ({ targetPlanetId, fleet }: { targetPlanetId: string; fleet: Fleet }) =>
      api.launch(targetPlanetId, fleet),
    onSuccess: async (result) => {
      /**
       * THE SQUADRON IS ON THE DISC BEFORE THE SHEET HAS FINISHED CLOSING. D53.
       *
       * This is the tap the whole game is built around and it had the worst wait
       * in it: the fleet did not exist on screen until a second request came back
       * with it. Both lists are in the answer now, in the shape the cache already
       * holds, so the leg starts interpolating on the frame the response lands.
       */
      await Promise.all([
        apply(result.planet),
        /**
         * AND THE PENDING LIST, WHICH IS THE ONE THAT DRAWS THE SQUADRON.
         *
         * `useArrivals` invalidates this key on every due arrival, so a launch
         * pressed while one of those reads is in the air had its brand new fleet
         * overwritten by a list that predates it — the craft appeared on the disc
         * and then blinked out.
         */
        client.cancelQueries({ queryKey: keys.pending }),
      ]);
      client.setQueryData(keys.pending, { pending: result.pending });
      invalidate(keys.galaxy, keys.intel);
    },
  });
}
