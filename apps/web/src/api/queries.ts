import { useEffect, useMemo, useRef } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { TRAFFIC, engagementEndsAt } from '@astera/rules';
import type {
  Fleet,
  BuildingId,
  HullId,
  InstrumentId,
  ResearchProjectId,
  SatelliteId,
  SensorSphere,
} from '@astera/rules';
import type { z } from 'zod';
import type {
  ClanChatPage,
  ChatPage,
  AnnouncementsPage,
  Contact,
  MiningFieldView,
  MiningLaunchResult,
  MiningRun,
  MiningStatusView,
  MiningView,
  PendingThread,
  PlanetView,
  PlanetsView,
  SeasonInfo,
  notificationsSchema,
  FeedbackKind,
} from './schemas.js';
import type { ClanAidInput } from './client.js';
import { useApi } from './context.js';
import { keys } from './keys.js';
import { serverNow } from '../lib/clock.js';
import { worksAt } from '../lib/projection.js';
import {
  predictBuild,
  predictCollect,
  predictInstrument,
  predictResearch,
  predictSatellite,
  predictUpgrade,
} from '../lib/predict.js';
import { useWorld } from './world.js';
import { nextCrossing } from '../galaxy/crossing.js';

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
 * and cheaper: at 300 commanders the old floor would be nine hundred requests a
 * minute standing still, and the new one is three hundred plus one burst per real event.
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
/** SSE is primary; this only heals a missed global event after a broken connection. */
const ANNOUNCEMENT_FALLBACK_MS = 5 * 60_000;
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
 *
 * AND A `staleTime` ALONE NEVER ASKS AGAIN. That was the bug the paragraph above
 * describes and did not fix: staleness only decides whether a refetch that is
 * already happening may be served from cache, so with nothing to trigger one this
 * query was fetched on mount and then never again. The disc read the population
 * of the galaxy at the moment the tab was opened, for as long as it stayed open,
 * and a manual reload was the only way to move it — which is exactly how it was
 * reported.
 *
 * IT IS THE ONE READ WHERE THE TIMER IS THE MECHANISM AND NOT THE NET. Everything
 * else on this screen is refetched from a broadcast, because everything else
 * changes at a MOMENT the server can point at. Presence has no such moment:
 * `lastActiveAt` is stamped at most once a minute per commander (see
 * `services/presence.ts`) and the count is a five-minute trailing window, so
 * nobody arrives and nobody leaves — the figure simply drifts. Broadcasting it
 * would mean a shard event per commander per minute, three hundred a minute on a
 * full galaxy, to move a number in a corner. `SHARD` events that refetch this
 * payload (a rollover) still do, and they still should.
 */
export function useSeason() {
  const api = useApi();
  return useQuery({
    queryKey: keys.season,
    queryFn: api.season,
    staleTime: NET_MS,
    refetchInterval: NET_MS,
    refetchOnWindowFocus: true,
  });
}

/** Active-only event state; lifecycle SSE is primary and this interval heals a missed event. */
export function useGalaxyEvents() {
  const api = useApi();
  return useQuery({
    queryKey: keys.galaxyEvents,
    queryFn: api.galaxyEvents,
    staleTime: NET_MS,
    refetchInterval: NET_MS,
    refetchOnWindowFocus: true,
  });
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
  const { activePlanetId } = useWorld();
  return useQuery({
    queryKey: activePlanetId ? keys.planetById(activePlanetId) : keys.planet,
    queryFn: () => api.planet(activePlanetId ?? undefined),
    ...READ,
  });
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
  return useQuery({
    queryKey: keys.intel,
    queryFn: api.intel,
    ...READ,
    // Telescope uncertainty and ages move with time even in a quiet galaxy.
    refetchInterval: NET_MS,
  });
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
/**
 * AND IT IS THE ONE READ WHOSE INTERVAL IS NOT A SAFETY NET.
 *
 * Every other payload here polls at `NET_MS` because the live channel might be
 * down. Traffic has a second job that no event can do for it.
 *
 * Under the three-zone model a craft OUTSIDE the caller's circles is not in this
 * payload at all — that is the point of `NONE`. So when it crosses in, the client
 * holds no record to solve a crossing instant from: `useContactWindows` can only
 * arm boundaries for craft it already has. A launch inside the circles is covered
 * (`shard:launch` fires and the craft is visible from its first instant, now that
 * the departure shroud is gone); a craft arriving from outside is not.
 *
 * The server cannot announce it either, and deliberately: "something will enter
 * your radar in twelve seconds" is advance warning no radar operator has, and
 * publishing it would be a new leak in place of a fixed one.
 *
 * IT IS THE SAME FIGURE THE SERVER FLOORS A PUBLISHED WINDOW AT, and that is why
 * it is imported rather than typed here. The server's floor exists so a craft
 * never freezes between reads — "one refetch" — and it used to be a flat sixty
 * seconds written on the other side of the wire from the interval it described.
 * They drifted, and every probe in the game published its destination. One number.
 *
 * It is CHEAPER than it looks: the payload shrank when the zones landed — it used
 * to carry every craft in the galaxy as an anonymous return and now carries only
 * what the caller can actually see — and the snapshot behind it is built once per
 * shard and shared across every commander on the replica.
 */
const TRAFFIC_MS = TRAFFIC.refreshMs;

export function useTraffic() {
  const api = useApi();
  return useQuery({
    queryKey: keys.traffic,
    queryFn: api.traffic,
    staleTime: TRAFFIC_MS,
    refetchInterval: TRAFFIC_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * The caller's discovered asteroid field, public wreckage, and mining state. D19, D32.
 *
 * A run starting, turning for home or landing is broadcast to the shard, and so is
 * a battle — which is what puts a debris field on this payload. So the two
 * contested things here, the rock and the wreck, are both live now.
 *
 * Asteroid discovery/expiry has no actor to broadcast. The server therefore names
 * the exact next field change, and `useAsteroidFieldWake` refreshes at that instant;
 * ordinary events and reconnect/focus resync cover all state-changing paths.
 */
export function mergeMiningViews(
  field: MiningFieldView | undefined,
  status: MiningStatusView | undefined,
): MiningView | undefined {
  if (!field || !status) return undefined;
  const isotopeById = new Map(
    status.isotopes.map((rock) => [rock.id, rock.deuteriumShare]),
  );
  return {
    ...status,
    asteroids: field.asteroids.map((asteroid) => ({
      ...asteroid,
      // The anomaly signature is visible once the rock itself is discovered; the
      // research-gated response only adds its composition. OR also tolerates the two split requests landing from
      // adjacent snapshots without ever downgrading information already shown.
      isotopeRich: asteroid.isotopeRich || isotopeById.has(asteroid.id),
      deuteriumShare: isotopeById.get(asteroid.id) ?? null,
    })),
    debris: field.debris,
    nextFieldChangeAt: field.nextFieldChangeAt,
  };
}

/**
 * Preserve either independently fetched half on the canvas when the other read
 * fails. Launch calculations still require the complete merged view; no missing
 * private values are replaced with invented zeroes.
 */
export function miningSceneData(
  field: MiningFieldView | undefined,
  status: MiningStatusView | undefined,
): {
  asteroids: MiningFieldView['asteroids'];
  debris: MiningFieldView['debris'];
  runs: MiningStatusView['runs'];
  mining: MiningView | undefined;
} {
  return {
    asteroids: field?.asteroids ?? [],
    debris: field?.debris ?? [],
    runs: status?.runs ?? [],
    mining: mergeMiningViews(field, status),
  };
}

export const FIELD_WAKE_GRACE_MS = 250;

/** Wake once at the exact discovery/expiry instant named by the server. */
export function useAsteroidFieldWake(at: Date | null | undefined): void {
  const client = useQueryClient();
  const firedAt = useRef<number | null>(null);
  const instant = at?.getTime();
  useEffect(() => {
    if (instant === undefined || firedAt.current === instant) return;
    const timer = window.setTimeout(() => {
      firedAt.current = instant;
      void client.invalidateQueries({ queryKey: keys.miningField });
    }, Math.max(0, instant - serverNow()) + FIELD_WAKE_GRACE_MS);
    return () => { window.clearTimeout(timer); };
  }, [client, instant]);
}

export function useMining() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const field = useQuery({
    queryKey: keys.miningField,
    queryFn: api.miningField,
    staleTime: 15_000,
    refetchInterval: NET_MS,
    refetchOnWindowFocus: true,
  });
  const status = useQuery({
    queryKey: activePlanetId ? keys.miningStatusById(activePlanetId) : keys.miningStatus,
    queryFn: () => api.miningStatus(activePlanetId ?? undefined),
    staleTime: 15_000,
    refetchInterval: NET_MS,
    refetchOnWindowFocus: true,
  });
  useAsteroidFieldWake(field.data?.nextFieldChangeAt);
  const data = useMemo(
    () => mergeMiningViews(field.data, status.data),
    [field.data, status.data],
  );
  return {
    ...status,
    data,
    fieldData: field.data,
    statusData: status.data,
    isPending: field.isPending || status.isPending,
    isError: field.isError || status.isError,
    error: status.error ?? field.error,
    refetch: async () => Promise.all([field.refetch(), status.refetch()]),
  };
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
  const { capitalPlanetId } = useWorld();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  const lane = usePlanetMutationLane(capitalPlanetId);
  return useMutation({
    scope: lane.scope,
    mutationFn: (id: string) => api.claimReward(id),
    onMutate: lane.enter,
    onSuccess: async (result) => {
      // Both writes come out of one answer, so both need the same protection.
      await Promise.all([apply(result.planet), client.cancelQueries({ queryKey: keys.rewards })]);
      client.setQueryData(keys.rewards, result.rewards);
      // Wealth moved with the grant, and a store that just crossed a tier changes
      // this world's silhouette on everybody else's disc.
      invalidate(keys.leaderboard, keys.galaxy);
    },
    onSettled: (_data, _error, _id, turn) => { lane.leave(turn); },
  });
}

export function useLeaderboard(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: keys.leaderboard,
    queryFn: api.leaderboard,
    staleTime: 60_000,
    enabled,
  });
}

/* ── clans ─────────────────────────────────────────────────── */

export function useClanBadge(enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: keys.clanBadge, queryFn: api.clanBadge, enabled, ...READ });
}

export function useClanHome(enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: keys.clanHome, queryFn: api.clanHome, enabled, ...READ });
}

export function useClanStrength(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: keys.clanStrength,
    queryFn: api.clanStrength,
    enabled,
    ...READ,
    // Another member can build or lose ships without producing a private event
    // for this commander. The query exists only while this tab is visible, so a
    // one-minute safety refresh keeps the shared total honest at bounded cost.
    refetchInterval: NET_MS,
  });
}

export function useClanDirectory(search: string, enabled = true) {
  const api = useApi();
  const normalised = search.trim();
  return useInfiniteQuery({
    queryKey: keys.clanDirectory(normalised),
    queryFn: ({ pageParam }) => api.clans(normalised, pageParam, 30),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((total, page) => total + page.clans.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useClanLeaderboard(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: keys.clanLeaderboard,
    queryFn: api.clanLeaderboard,
    enabled,
    staleTime: 30_000,
  });
}

export function useClanDepot(enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: keys.clanDepot, queryFn: api.clanDepot, enabled, ...READ });
}

export function useClanAid(enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: keys.clanAid, queryFn: api.clanAid, enabled, ...READ });
}

export function useClanEvents(enabled = true) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: keys.clanEvents,
    queryFn: ({ pageParam }) => api.clanEvents(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextBefore,
    enabled,
    staleTime: 30_000,
  });
}

export function useClanChat(enabled = true) {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: keys.clanChat,
    queryFn: ({ pageParam }) => api.clanChat(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextBefore,
    enabled,
    staleTime: 15_000,
  });
}

/**
 * All clan writes share one invalidation grammar. They are infrequent, explicit
 * decisions; prefix invalidation keeps the independently mounted tabs coherent.
 */
export function useClanActions() {
  const api = useApi();
  const client = useQueryClient();
  const applyPlanet = useApplyPlanet();
  const refreshClan = (): void => {
    void client.invalidateQueries({ queryKey: ['clan'] });
  };
  const refreshPublicClan = (): void => {
    refreshClan();
    void client.invalidateQueries({ queryKey: keys.galaxy });
    void client.invalidateQueries({ queryKey: keys.leaderboard });
  };

  const create = useMutation({
    mutationFn: (input: Parameters<typeof api.createClan>[0]) => api.createClan(input),
    onSuccess: async (result) => {
      await applyPlanet(result.planet);
      refreshPublicClan();
    },
  });
  const apply = useMutation({
    mutationFn: (clanId: string) => api.applyToClan(clanId),
    onSuccess: refreshClan,
  });
  const invite = useMutation({
    mutationFn: (playerId: string) => api.inviteToClan(playerId),
    onSuccess: refreshClan,
  });
  const accept = useMutation({
    mutationFn: ({ requestId, acknowledgeHostile }: { requestId: string; acknowledgeHostile: boolean }) =>
      api.acceptClanRequest(requestId, acknowledgeHostile),
    onSuccess: refreshPublicClan,
  });
  const reject = useMutation({
    mutationFn: (requestId: string) => api.rejectClanRequest(requestId),
    onSuccess: refreshClan,
  });
  const withdraw = useMutation({
    mutationFn: (requestId: string) => api.withdrawClanRequest(requestId),
    onSuccess: refreshClan,
  });
  const leave = useMutation({ mutationFn: () => api.leaveClan(), onSuccess: refreshPublicClan });
  const kick = useMutation({
    mutationFn: (memberId: string) => api.kickClanMember(memberId),
    onSuccess: refreshPublicClan,
  });
  const leadership = useMutation({
    mutationFn: (memberId: string) => api.transferClanLeadership(memberId),
    onSuccess: refreshPublicClan,
  });
  const settings = useMutation({
    mutationFn: ({ description, recruiting }: { description: string; recruiting: boolean }) =>
      api.updateClanSettings(description, recruiting),
    onSuccess: refreshPublicClan,
  });
  const aidPolicy = useMutation({
    mutationFn: (enabled: boolean) => api.setClanAidPolicy(enabled),
    onSuccess: refreshClan,
  });
  const disband = useMutation({ mutationFn: () => api.disbandClan(), onSuccess: refreshPublicClan });
  const claimDepot = useMutation({
    mutationFn: () => api.claimClanDepot(),
    onSuccess: async (result) => {
      await applyPlanet(result.planet);
      refreshClan();
      void client.invalidateQueries({ queryKey: keys.leaderboard });
    },
  });
  const quoteAid = useMutation({ mutationFn: (input: ClanAidInput) => api.quoteClanAid(input) });
  const launchAid = useMutation({
    mutationFn: (input: ClanAidInput) => api.launchClanAid(input),
    onSuccess: async (result) => {
      await applyPlanet(result.planet);
      refreshClan();
      void client.invalidateQueries({ queryKey: keys.pending });
      void client.invalidateQueries({ queryKey: keys.traffic });
    },
  });
  const postChat = useMutation({
    mutationFn: (body: string) => api.postClanChat(body),
    onMutate: async () => {
      await client.cancelQueries({ queryKey: keys.clanChat });
    },
    onSuccess: ({ message }) => {
      client.setQueryData<InfiniteData<ClanChatPage, string | null>>(keys.clanChat, (current) => {
        if (!current) {
          return { pages: [{ messages: [message], nextBefore: null }], pageParams: [null] };
        }
        const first = current.pages[0];
        if (!first || first.messages.some((row) => row.id === message.id)) return current;
        return {
          ...current,
          pages: [{ ...first, messages: [...first.messages, message] }, ...current.pages.slice(1)],
        };
      });
      void client.invalidateQueries({ queryKey: keys.clanBadge });
    },
  });
  const readChat = useMutation({
    mutationFn: (messageId: string) => api.markClanChatRead(messageId),
    retry: 1,
    onMutate: async () => {
      await client.cancelQueries({ queryKey: keys.clanBadge });
      const previous = client.getQueryData(keys.clanBadge);
      client.setQueryData(keys.clanBadge, (current: unknown) => {
        if (!current || typeof current !== 'object' || !('clanChatUnread' in current)) return current;
        const badge = current as {
          clanChatUnread: number;
          attentionCount: number;
          attention: boolean;
        };
        const attentionCount = Math.max(0, badge.attentionCount - badge.clanChatUnread);
        return { ...badge, clanChatUnread: 0, attentionCount, attention: attentionCount > 0 };
      });
      return { previous };
    },
    onError: (_error, _messageId, context) => {
      if (context?.previous !== undefined) client.setQueryData(keys.clanBadge, context.previous);
    },
    onSettled: () => { void client.invalidateQueries({ queryKey: keys.clanBadge }); },
  });
  const seen = useMutation({
    mutationFn: () => api.markClanSeen(),
    onSuccess: () => { void client.invalidateQueries({ queryKey: keys.clanBadge }); },
  });

  return {
    create,
    apply,
    invite,
    accept,
    reject,
    withdraw,
    leave,
    kick,
    leadership,
    settings,
    aidPolicy,
    disband,
    claimDepot,
    quoteAid,
    launchAid,
    postChat,
    readChat,
    seen,
  };
}

export function useSetRival() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (planetId: string | null) => api.setRival(planetId),
    onSuccess: async ({ rivalPlanetId, rivalPlayerId }) => {
      await client.cancelQueries({ queryKey: keys.season });
      client.setQueryData<SeasonInfo>(keys.season, (current) =>
        current
          ? { ...current, rivalPlanetId, rivalPlayerId: rivalPlayerId ?? null }
          : current,
      );
    },
  });
}

export function useChatMessages() {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: keys.chatMessages,
    queryFn: ({ pageParam }) => api.chatMessages(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextBefore,
    staleTime: 15_000,
  });
}

export function useChatUnread(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: keys.chatUnread,
    queryFn: api.chatUnread,
    enabled,
    ...READ,
  });
}

export function useChronicle() {
  const api = useApi();
  return useInfiniteQuery({
    queryKey: keys.chronicle,
    queryFn: ({ pageParam }) => api.chronicle(pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextBefore,
    staleTime: 60_000,
  });
}

export function useAnnouncements(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: keys.announcements,
    queryFn: api.announcements,
    enabled,
    staleTime: 30_000,
    refetchInterval: ANNOUNCEMENT_FALLBACK_MS,
    refetchOnWindowFocus: true,
  });
}

export function useMarkAnnouncementsRead() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.markAnnouncementsRead(ids),
    retry: 1,
    onMutate: async (ids) => {
      await client.cancelQueries({ queryKey: keys.announcements });
      const read = new Set(ids);
      client.setQueryData<AnnouncementsPage>(keys.announcements, (current) => current
        ? {
            announcements: current.announcements.map((announcement) =>
              read.has(announcement.id) ? { ...announcement, seen: true } : announcement),
          }
        : current);
    },
    onSettled: () => { void client.invalidateQueries({ queryKey: keys.announcements }); },
  });
}

export function useSendFeedback() {
  const api = useApi();
  return useMutation({
    mutationFn: ({ kind, message }: { kind: FeedbackKind; message: string }) =>
      api.sendFeedback(kind, message),
  });
}

export function useAdminFeedback(enabled = true) {
  const api = useApi();
  return useQuery({ queryKey: keys.adminFeedback, queryFn: api.adminFeedback, enabled, ...READ });
}

export function usePublishAnnouncement() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ title, bodyHtml }: { title: string; bodyHtml: string }) =>
      api.publishAnnouncement(title, bodyHtml),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.announcements });
    },
  });
}

export function usePostChat() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.postChat(content),
    onMutate: async () => {
      // A GET started before Send cannot be allowed to land after the
      // authoritative POST response and erase the new message from the cache.
      await client.cancelQueries({ queryKey: keys.chatMessages });
    },
    onSuccess: ({ message }) => {
      client.setQueryData<InfiniteData<ChatPage, string | null>>(keys.chatMessages, (current) => {
        if (!current) {
          return { pages: [{ messages: [message], nextBefore: null }], pageParams: [null] };
        }
        const first = current.pages[0];
        if (!first || first.messages.some((row) => row.id === message.id)) return current;
        return {
          ...current,
          pages: [{ ...first, messages: [...first.messages, message] }, ...current.pages.slice(1)],
        };
      });
      void client.invalidateQueries({ queryKey: keys.chatUnread });
    },
  });
}

export function useMarkChatRead() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (messageId: string) => api.markChatRead(messageId),
    retry: 1,
    onMutate: async () => {
      await client.cancelQueries({ queryKey: keys.chatUnread });
      client.setQueryData(keys.chatUnread, { count: 0 });
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: keys.chatUnread });
    },
  });
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
const ARRIVAL_SETTLE_OFFSETS = [1000] as const;
const CONTACT_WINDOW_SETTLE_OFFSETS = [50, 750, 2500, 6000] as const;

function useRefetchOnArrival(
  moments: readonly number[],
  groups: readonly (readonly string[])[],
  settleOffsets: readonly number[] = ARRIVAL_SETTLE_OFFSETS,
) {
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
      .flatMap((at) => settleOffsets.map((offset) =>
        setTimeout(
          () => {
            for (const key of targets.current) void client.invalidateQueries({ queryKey: key });
          },
          at - now + offset,
        ),
      ));
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [signature, client, settleOffsets]);
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
  useRefetchOnArrival(moments, [keys.mining, keys.planet, keys.pending, keys.galaxy]);
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
export function useContactWindows(
  contacts: readonly Contact[] | undefined,
  /**
   * The caller's own sensor posts, so a boundary crossing can be woken for. D125.
   *
   * The zone a contact is in is decided by the server per request, so a craft that
   * crosses one of these circles mid-window would otherwise keep its old
   * appearance until the next scheduled read and then pop — and the crossing is
   * the one moment the ladder exists to sell. Solving for the instant and asking
   * again exactly then puts the transition on the right second without the server
   * sending anything early.
   */
  sensors: readonly SensorSphere[] = [],
): void {
  const moments = useMemo(() => {
    const out: number[] = [];
    for (const contact of contacts ?? []) {
      out.push(contact.endAt.getTime());
      // This is a public event anchored to the target centre, not a published
      // craft window. Its synthetic point must never participate in a sensor
      // crossing solve; the engagement end above is the only wake it needs.
      if (contact.effectOnly === true) continue;
      /**
       * ONE SOLVE, BOTH CIRCLES, EVERY KIND OF CRAFT.
       *
       * This used to run two solves against two hand-built arrays and skip
       * everything that was not a fleet, a probe or an unknown — on the reasoning
       * that mining and strategic contacts were published galaxy-wide and so could
       * not change at a boundary. Under the three-zone model EVERY craft changes
       * at a boundary, including a drill: outside the circles it is not published
       * at all. `nextCrossing` reads the same `sensorZone` the server does.
       */
      const crossing = nextCrossing(contact, sensors);
      if (crossing) out.push(crossing.getTime());
    }
    // One timer chain only. Its refetch replaces all bearing windows and this
    // effect then arms the next boundary, avoiding contacts × sensors × retries
    // timers on a busy full galaxy.
    const next = out.sort((a, b) => a - b).find((at) => at > serverNow());
    return next === undefined ? [] : [next];
  }, [contacts, sensors]);
  // The first read is immediate because traffic is projected, not worker-owned.
  // The bounded follow-ups cover a stale replica/cache without parking the craft.
  useRefetchOnArrival(moments, [keys.traffic], CONTACT_WINDOW_SETTLE_OFFSETS);
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
  useRefetchOnArrival(moments, [keys.pending, keys.planet, keys.galaxy, keys.reports, keys.traffic]);
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
  const { activePlanetId } = useWorld();
  return async (planet: PlanetView) => {
    const id = planet.planet.id;
    const explicitKey = keys.planetById(id);
    await Promise.all([
      client.cancelQueries({ queryKey: explicitKey }),
      ...(activePlanetId === null
        ? [client.cancelQueries({ queryKey: keys.planet })]
        : []),
    ]);
    client.setQueryData(explicitKey, planet);
    // The legacy capital alias exists only when no WorldProvider selected an id.
    // A capital-only mutation (rewards) must never overwrite a selected colony.
    if (activePlanetId === null) client.setQueryData(keys.planet, planet);
    client.setQueryData(keys.planets, (current: PlanetsView | undefined) =>
      current
        ? { ...current, planets: current.planets.map((world) => world.planet.id === id ? planet : world) }
        : current);
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
interface MutationTurn {
  release: () => void;
}

interface Rollback extends MutationTurn {
  key: readonly unknown[];
  previous: PlanetView | undefined;
  optimistic: PlanetView | undefined;
}

/**
 * One client may send many kinds of write to the same world. The database orders
 * them under the planet lock; the browser must preserve that order too, otherwise
 * an older whole-planet response can overwrite a newer one.
 *
 * TanStack's mutation scope serialises mutation functions, but deliberately runs
 * every `onMutate` immediately. That is wrong for stacked snapshots: the second
 * rollback can restore the first mutation's optimistic frame after both requests
 * failed. This small turnstile includes prediction and reconciliation in the same
 * lane, while keeping unrelated planets independent.
 */
const mutationTurns = new WeakMap<QueryClient, Map<string, Promise<void>>>();

async function enterMutationTurn(client: QueryClient, id: string): Promise<MutationTurn> {
  let lanes = mutationTurns.get(client);
  if (!lanes) {
    lanes = new Map();
    mutationTurns.set(client, lanes);
  }
  const ahead = lanes.get(id) ?? Promise.resolve();
  let open!: () => void;
  const gate = new Promise<void>((resolve) => { open = resolve; });
  const tail = ahead.then(() => gate);
  lanes.set(id, tail);
  await ahead;

  let released = false;
  return {
    release: () => {
      if (released) return;
      released = true;
      open();
      void tail.then(() => {
        if (lanes.get(id) === tail) lanes.delete(id);
      });
    },
  };
}

function usePlanetMutationLane(planetId: string | null) {
  const client = useQueryClient();
  const id = `planet:${planetId ?? 'capital'}`;
  return {
    scope: { id },
    enter: () => enterMutationTurn(client, id),
    leave: (turn: MutationTurn | undefined): void => { turn?.release(); },
  };
}

function useOptimisticPlanet() {
  const client = useQueryClient();
  const { activePlanetId } = useWorld();
  const key = activePlanetId ? keys.planetById(activePlanetId) : keys.planet;
  const lane = usePlanetMutationLane(activePlanetId);
  return {
    scope: lane.scope,
    predict: async (of: (view: PlanetView) => PlanetView | null): Promise<Rollback> => {
      const turn = await lane.enter();
      try {
        await client.cancelQueries({ queryKey: key });
        const previous = client.getQueryData<PlanetView>(key);
        if (!previous) return { ...turn, key, previous: undefined, optimistic: undefined };
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
        const fetchedAt = client.getQueryState(key)?.dataUpdatedAt ?? Date.now();
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
        if (!predicted) return { ...turn, key, previous: undefined, optimistic: undefined };
        const optimistic = client.setQueryData<PlanetView>(key, predicted);
        /**
         * AND THE UNDO IS THE SETTLED VIEW, NOT THE ONE THAT CAME OUT OF THE CACHE.
         *
         * Rolling back writes too, which re-anchors `dataUpdatedAt` again — so
         * restoring the pre-settlement figure would put the dip back on the way
         * out. The settled view is the honest world to return to: the same planet,
         * with production that really did happen counted.
         */
        return { ...turn, key, previous: settled, optimistic };
      } catch (error) {
        turn.release();
        throw error;
      }
    },
    rollback: (context: Rollback | undefined): void => {
      if (!context?.previous || !context.optimistic) return;
      client.setQueryData<PlanetView>(context.key, (current) =>
        current === context.optimistic ? context.previous : current);
    },
    settle: lane.leave,
  };
}

export function useUpgrade() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  const { scope, predict, rollback, settle } = useOptimisticPlanet();
  return useMutation({
    scope,
    mutationFn: (type: BuildingId) => activePlanetId
      ? api.upgrade(activePlanetId, type)
      : api.upgrade(type),
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
    onSettled: (_data, _error, _type, context) => { settle(context); },
  });
}

export function useBuild() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  const { scope, predict, rollback, settle } = useOptimisticPlanet();
  return useMutation({
    scope,
    mutationFn: ({ hull, count }: { hull: HullId; count: number }) => activePlanetId
      ? api.build(activePlanetId, hull, count)
      : api.build(hull, count),
    onMutate: ({ hull, count }: { hull: HullId; count: number }) =>
      predict((view) => predictBuild(view, hull, count)),
    onError: (_error, _vars, context) => {
      rollback(context);
    },
    onSuccess: async (result) => {
      await apply(result.planet);
      invalidate(keys.leaderboard);
    },
    onSettled: (_data, _error, _vars, context) => { settle(context); },
  });
}

/** Cancelling is authoritative because the refund and queue reflow are one transaction. */
export function useCancelBuildOrder() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  const lane = usePlanetMutationLane(activePlanetId);
  return useMutation({
    scope: lane.scope,
    mutationFn: (orderId: string) => activePlanetId
      ? api.cancelBuildOrder(activePlanetId, orderId)
      : api.cancelBuildOrder(orderId),
    onMutate: lane.enter,
    onSuccess: async (result) => {
      await apply(result.planet);
      invalidate(keys.leaderboard);
    },
    onSettled: (_data, _error, _orderId, turn) => { lane.leave(turn); },
  });
}

/** Discovery is history-derived, so only placement of an already-visible project is predicted. */
export function useCompleteResearch() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  const { scope, predict, rollback, settle } = useOptimisticPlanet();
  return useMutation({
    scope,
    mutationFn: (projectId: ResearchProjectId) => activePlanetId
      ? api.completeResearch(activePlanetId, projectId)
      : api.completeResearch(projectId),
    onMutate: (projectId: ResearchProjectId) =>
      predict((view) => predictResearch(view, projectId)),
    onError: (_error, _projectId, context) => {
      rollback(context);
    },
    onSuccess: async (result) => {
      await apply(result.planet);
      invalidate(keys.mining, keys.leaderboard);
    },
    onSettled: (_data, _error, _projectId, context) => { settle(context); },
  });
}

export function useRaiseInstrument() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  const { scope, predict, rollback, settle } = useOptimisticPlanet();
  return useMutation({
    scope,
    mutationFn: (type: InstrumentId) => activePlanetId
      ? api.raiseInstrument(activePlanetId, type)
      : api.raiseInstrument(type),
    onMutate: (type: InstrumentId) => predict((view) => predictInstrument(view, type)),
    onError: (_error, _type, context) => {
      rollback(context);
    },
    // A new Telescope level changes what every reading is allowed to say.
    onSuccess: async (result) => {
      await apply(result.planet);
      invalidate(keys.intel, keys.galaxy, keys.leaderboard);
    },
    onSettled: (_data, _error, _type, context) => { settle(context); },
  });
}

export function useInstallSatellite() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  const { scope, predict, rollback, settle } = useOptimisticPlanet();
  return useMutation({
    scope,
    mutationFn: (type: SatelliteId) => activePlanetId
      ? api.installSatellite(activePlanetId, type)
      : api.installSatellite(type),
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
    onSettled: (_data, _error, _type, context) => { settle(context); },
  });
}

export function useWatch() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const invalidate = useInvalidator();
  return useMutation({
    mutationFn: ({ targetPlanetId, slot }: { targetPlanetId: string; slot: number }) =>
      api.watch(targetPlanetId, slot, activePlanetId ?? undefined),
    onSuccess: () => {
      invalidate(keys.intel, keys.galaxy, keys.unlocks);
    },
  });
}

export function useProbe() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const invalidate = useInvalidator();
  const lane = usePlanetMutationLane(activePlanetId);
  return useMutation({
    scope: lane.scope,
    mutationFn: (targetPlanetId: string) => api.probe(targetPlanetId, activePlanetId ?? undefined),
    onMutate: lane.enter,
    onSuccess: () => {
      invalidate(keys.planet, keys.intel, keys.pending);
    },
    onSettled: (_data, _error, _targetPlanetId, turn) => { lane.leave(turn); },
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
  const { activePlanetId } = useWorld();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  const { scope, predict, rollback, settle } = useOptimisticPlanet();
  return useMutation({
    scope,
    mutationFn: () => api.collect(activePlanetId ?? undefined),
    onMutate: () => predict(predictCollect),
    onError: (_error, _vars, context) => {
      rollback(context);
    },
    onSuccess: async (result) => {
      await apply(result.planet);
      invalidate(keys.galaxy, keys.leaderboard);
    },
    onSettled: (_data, _error, _vars, context) => { settle(context); },
  });
}

/**
 * Apply every authoritative view a mining/salvage launch moved. D120.
 *
 * The status key is per selected world, while the old capital-only client still
 * reads the unqualified alias. Always seed the explicit key and seed the alias only
 * when it is the surface this tree is using. Each older GET is cancelled before
 * the POST answer is written, or a pre-launch run list can erase the new craft.
 */
function useApplyMiningLaunch(activePlanetId: string | null) {
  const client = useQueryClient();
  const applyPlanet = useApplyPlanet();
  return async (result: MiningLaunchResult) => {
    const planetId = result.planet.planet.id;
    const statusKey = keys.miningStatusById(planetId);
    await Promise.all([
      applyPlanet(result.planet),
      // Every per-world status carries the commander's complete run roster. An
      // older read for any selected colony must not erase this launch later.
      client.cancelQueries({ queryKey: keys.miningStatus }),
      client.cancelQueries({ queryKey: keys.pending }),
    ]);
    client.setQueriesData<MiningStatusView>(
      { queryKey: keys.miningStatus },
      (current) => current
        ? { ...current, runs: result.mining.runs, isotopes: result.mining.isotopes }
        : current,
    );
    client.setQueryData(statusKey, result.mining);
    if (activePlanetId === null) client.setQueryData(keys.miningStatus, result.mining);
    client.setQueryData(keys.pending, { pending: result.pending });
  };
}

/**
 * THE PIRATES THIS COMMANDER CAN SEE. D150.
 *
 * Keyed by the world it is measured FROM, because `reachMinutes` is a rendezvous
 * solved from that world's coordinates — reusing another world's answer would put
 * a flight time on the screen that no launch from here could keep.
 *
 * A LIVE SIGHT READING, NOT AN ADDRESS BOOK. Unlike the asteroid field, this list
 * SHRINKS: a pirate that leaves the commander's circles stops existing for them,
 * so nothing here may be cached forward or merged with an earlier read.
 */
export function usePirates() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  return useQuery({
    queryKey: activePlanetId ? keys.piratesFrom(activePlanetId) : keys.pirates,
    queryFn: () => api.pirates(activePlanetId ?? undefined),
    staleTime: 5_000,
    refetchInterval: NET_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Send a fleet at a pirate. IRREVERSIBLE — the confirmation is in the UI. P3.
 *
 * The answer carries the strip and the world from inside the launch transaction,
 * so the craft is drawn on the frame the response lands rather than one round trip
 * later, and an older read already in flight cannot land afterwards and erase it.
 */
export function useRaidPirate() {
  const api = useApi();
  const client = useQueryClient();
  const { activePlanetId } = useWorld();
  const invalidate = useInvalidator();
  const applyPlanet = useApplyPlanet();
  const lane = usePlanetMutationLane(activePlanetId);
  return useMutation({
    scope: lane.scope,
    mutationFn: ({ pirateId, fleet }: { pirateId: string; fleet: Fleet }) =>
      api.raidPirate(pirateId, fleet, activePlanetId ?? undefined),
    onMutate: lane.enter,
    onSuccess: async (result) => {
      await Promise.all([
        applyPlanet(result.planet),
        client.cancelQueries({ queryKey: keys.pending }),
      ]);
      client.setQueryData(keys.pending, { pending: result.pending });
      // The lane the raid flew at is one fewer target and one fewer bay.
      invalidate(keys.pirates, keys.galaxy);
    },
    onSettled: (_data, _error, _vars, turn) => { lane.leave(turn); },
  });
}

/**
 * SEND A CONVOY TO THE MERCHANT. D156 · D53.
 *
 * The same lane, the same cancel and the same three invalidations `useTransfer`
 * uses, because a convoy is a launch like any other: craft leave a world, its
 * store drops by the offer AND by both legs of fuel, and a flight bay closes.
 *
 * `applyPlanet` plus `setQueryData(keys.pending)` are what put the convoy on the
 * disc on the frame the response lands rather than one round trip later — and the
 * `cancelQueries` is what stops an older pending read, already in the air when the
 * button was pressed, landing afterwards and erasing it.
 */
export function useLaunchTrade(originPlanetId: string) {
  const api = useApi();
  const client = useQueryClient();
  const apply = useApplyPlanet();
  const invalidate = useInvalidator();
  const lane = usePlanetMutationLane(originPlanetId);
  return useMutation({
    scope: lane.scope,
    mutationFn: ({ occurrenceId, fleet, give, want }: {
      occurrenceId: string;
      fleet: Fleet;
      give: { alloy: number; crystal: number; deuterium: number };
      want: { alloy: number; crystal: number; deuterium: number };
    }) => api.trade(occurrenceId, fleet, give, want, originPlanetId),
    onMutate: lane.enter,
    onSuccess: async (result) => {
      await Promise.all([
        apply(result.planet),
        client.cancelQueries({ queryKey: keys.pending }),
      ]);
      client.setQueryData(keys.pending, { pending: result.pending });
      invalidate(keys.traffic, keys.galaxy, keys.planets);
    },
    onSettled: (_data, _error, _vars, turn) => { lane.leave(turn); },
  });
}

export function useMine() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const apply = useApplyMiningLaunch(activePlanetId);
  const lane = usePlanetMutationLane(activePlanetId);
  return useMutation({
    scope: lane.scope,
    mutationFn: ({ asteroidId, craft }: { asteroidId: string; craft: number }) =>
      api.mine(asteroidId, craft, activePlanetId ?? undefined),
    onMutate: lane.enter,
    onSuccess: apply,
    onSettled: (_data, _error, _vars, turn) => { lane.leave(turn); },
  });
}

/** Send craft to a wreck field. Invalidates the same things a mining run does. */
export function useHarvest() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const apply = useApplyMiningLaunch(activePlanetId);
  const lane = usePlanetMutationLane(activePlanetId);
  return useMutation({
    scope: lane.scope,
    mutationFn: ({ fieldId, craft }: { fieldId: string; craft: number }) =>
      api.harvest(fieldId, craft, activePlanetId ?? undefined),
    onMutate: lane.enter,
    onSuccess: apply,
    onSettled: (_data, _error, _vars, turn) => { lane.leave(turn); },
  });
}

/** IRREVERSIBLE. The confirmation lives in the UI; the server has no recall. */
export function useLaunch() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const client = useQueryClient();
  const invalidate = useInvalidator();
  const apply = useApplyPlanet();
  const lane = usePlanetMutationLane(activePlanetId);
  return useMutation({
    scope: lane.scope,
    mutationFn: ({ targetPlanetId, fleet }: { targetPlanetId: string; fleet: Fleet }) =>
      activePlanetId
        ? api.launch(activePlanetId, targetPlanetId, fleet)
        : api.launch(targetPlanetId, fleet),
    onMutate: lane.enter,
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
    onSettled: (_data, _error, _vars, turn) => { lane.leave(turn); },
  });
}

export function useTransfer(originPlanetId: string) {
  const api = useApi();
  const client = useQueryClient();
  const apply = useApplyPlanet();
  const invalidate = useInvalidator();
  const lane = usePlanetMutationLane(originPlanetId);
  return useMutation({
    scope: lane.scope,
    mutationFn: ({ targetPlanetId, fleet, cargo }: {
      targetPlanetId: string;
      fleet: Fleet;
      cargo: { alloy: number; crystal: number; deuterium: number };
    }) => api.transfer(originPlanetId, targetPlanetId, fleet, cargo),
    onMutate: lane.enter,
    onSuccess: async (result) => {
      await Promise.all([
        apply(result.planet),
        client.cancelQueries({ queryKey: keys.pending }),
      ]);
      client.setQueryData(keys.pending, { pending: result.pending });
      invalidate(keys.traffic, keys.galaxy, keys.planets);
    },
    onSettled: (_data, _error, _vars, turn) => { lane.leave(turn); },
  });
}

export function useSettlement() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const client = useQueryClient();
  const apply = useApplyPlanet();
  const invalidate = useInvalidator();
  const lane = usePlanetMutationLane(activePlanetId);
  return useMutation({
    scope: lane.scope,
    mutationFn: (targetPlanetId: string) => api.settle(activePlanetId!, targetPlanetId),
    onMutate: lane.enter,
    onSuccess: async (result) => {
      await Promise.all([
        apply(result.planet),
        client.cancelQueries({ queryKey: keys.pending }),
      ]);
      client.setQueryData(keys.pending, { pending: result.pending });
      invalidate(keys.traffic, keys.galaxy, keys.planets);
    },
    onSettled: (_data, _error, _targetPlanetId, turn) => { lane.leave(turn); },
  });
}

export function useBuildDeathStar() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const apply = useApplyPlanet();
  const invalidate = useInvalidator();
  const lane = usePlanetMutationLane(activePlanetId);
  return useMutation({
    scope: lane.scope,
    mutationFn: () => api.buildDeathStar(activePlanetId!),
    onMutate: lane.enter,
    onSuccess: async (result) => {
      await apply(result.planet);
      invalidate(keys.leaderboard);
    },
    onSettled: (_data, _error, _vars, turn) => { lane.leave(turn); },
  });
}

/**
 * LOAD ONE INTERCEPTION CHARGE. T10, wired in T12.
 *
 * The weapon's own shape, because it is the same asset lifecycle — and it answers
 * with the full planet view (D53), so nothing is refetched to learn the charge is
 * building. No prediction: the server checks an EFFECTIVE Radar rung and a live
 * research row, and D53's rule is that only certain outcomes may be predicted.
 */
export function useBuildInterceptor() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const apply = useApplyPlanet();
  const lane = usePlanetMutationLane(activePlanetId);
  return useMutation({
    scope: lane.scope,
    mutationFn: () => api.buildInterceptor(activePlanetId!),
    onMutate: lane.enter,
    onSuccess: async (result) => { await apply(result.planet); },
    onSettled: (_data, _error, _vars, turn) => { lane.leave(turn); },
  });
}

export function useLaunchDeathStar() {
  const api = useApi();
  const { activePlanetId } = useWorld();
  const client = useQueryClient();
  const apply = useApplyPlanet();
  const invalidate = useInvalidator();
  const lane = usePlanetMutationLane(activePlanetId);
  return useMutation({
    scope: lane.scope,
    mutationFn: (targetPlanetId: string) => api.launchDeathStar(activePlanetId!, targetPlanetId),
    onMutate: lane.enter,
    onSuccess: async (result) => {
      await Promise.all([
        apply(result.planet),
        client.cancelQueries({ queryKey: keys.pending }),
      ]);
      client.setQueryData(keys.pending, { pending: result.pending });
      invalidate(keys.traffic, keys.galaxy, keys.planets, keys.leaderboard);
    },
    onSettled: (_data, _error, _targetPlanetId, turn) => { lane.leave(turn); },
  });
}
