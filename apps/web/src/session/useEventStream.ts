import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '../api/context.js';
import { keys } from '../api/queries.js';
import {
  isPrivateEvent,
  isShardEvent,
  readsForPrivateEvent,
  shardCoalescer,
} from './shardEvents.js';

/** How long a connection must last before it counts as one that worked. */
const HEALTHY_MS = 5000;

/**
 * A deploy can return every open tab to the stream at once. The socket should
 * reconnect promptly so new events are live again, but replaying the missed read
 * set from every tab in the same instant turns recovery into an API stampede.
 * Spread only that catch-up pass; ordinary player and shard events stay immediate.
 */
export const RECONNECT_RESYNC_MAX_MS = 5000;

/**
 * Every read a player event can move — and the same set a RECONNECTION moves.
 *
 * A craft is drawn from whichever of these carries it: your own fleets from
 * `pending`, your mining and harvest runs from `mining`, and everybody else's from
 * `traffic`. Every leg is interpolated between two timestamps and CLAMPS at the
 * end, so a craft whose list has not been refetched does not vanish or turn round —
 * it SITS on its target, motionless, until something else happens to refresh it.
 *
 * An omission here does not fail loudly. It renders a stopped world.
 *
 * `rewards` is here because reward progress is COUNTED off the world rather than
 * accumulated, so what moves it is a flight ENDING — exactly the moment a tap
 * cannot cover, because the player made the decision minutes ago.
 */
const LIVE_READS = [
  keys.planet,
  keys.planets,
  keys.galaxy,
  keys.intel,
  keys.notifications,
  keys.pending,
  keys.reports,
  keys.traffic,
  keys.miningField,
  keys.miningStatus,
  keys.rewards,
  keys.chatMessages,
  keys.chatUnread,
  keys.chronicle,
  keys.clanBadge,
  keys.clanHome,
  keys.clanStrength,
  keys.clanEvents,
  keys.clanDepot,
  keys.clanAid,
  keys.clanChat,
] as const;

/** Full jitter, capped. A shard restarting must not be hit by 200 synchronised retries. */
const backoffMs = (attempt: number): number =>
  Math.random() * Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));

/**
 * The only realtime surface in the game.
 *
 * It carries no state — just "something happened". Everything else is refetched,
 * which keeps the server authoritative and the payload a few hundred bytes an
 * hour. Fleet motion is derived from timestamps, never streamed.
 *
 * TWO FAMILIES ARRIVE ON IT. D53.
 *
 *   · A PLAYER event happened TO THIS COMMANDER — a battle resolving, a scan
 *     detected, a fleet inbound. Almost anything can have moved, so it refreshes
 *     everything, immediately.
 *   · A SHARD event happened to SOMEBODY ELSE in the same galaxy, and it is the
 *     half no event could ever announce before: a neighbour launching, a rival's
 *     drill reaching a rock first, a raid landing on a world across the disc. It
 *     is namespaced `shard:` on the wire and goes through a coalescer, because
 *     three hundred clients hearing one launch must not become three hundred simultaneous reads.
 *
 * The second used to be a timer. The timers are still there as a floor, at sixty
 * seconds — see the read policy in `queries.ts`.
 *
 * AND A RECONNECTION IS A THIRD THING, WHICH NOTHING USED TO HANDLE. D72.
 *
 * Nothing on this channel is replayable: no cursor, no backlog, no ids. Whatever
 * was published while the socket was down is gone, and no payload says so — so a
 * dropped socket left the disc reading a world up to a minute old, with craft
 * parked on their destinations, until the safety net came round. Every open after
 * the first re-reads `LIVE_READS`; see the loop below for why the first is exempt.
 */
export function useEventStream(enabled: boolean, onRollover?: () => void): void {
  const api = useApi();
  const client = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    const shard = shardCoalescer((reads) => {
      for (const key of reads) void client.invalidateQueries({ queryKey: key });
    });

    /**
     * EVERYTHING THAT CAN HAVE MOVED BECAUSE OF SOMETHING THIS CLIENT WAS TOLD.
     *
     * Named because it has two callers now, and they mean the same thing for two
     * different reasons: a player event says "something happened to you", and a
     * reconnection says "something may have happened to you and nobody could tell
     * you about it".
     */
    const resync = (): void => {
      for (const key of LIVE_READS) void client.invalidateQueries({ queryKey: key });
    };

    // Browsers throttle timers and can suspend the event stream while a tab is in
    // the background. Returning to the game is therefore an explicit resync edge,
    // not something left to query staleness or the sixty-second safety net.
    let lifecycleResyncTimer: ReturnType<typeof setTimeout> | null = null;
    let lastLifecycleResync = 0;
    const scheduleLifecycleResync = (): void => {
      if (document.visibilityState === 'hidden' || lifecycleResyncTimer !== null) return;
      lifecycleResyncTimer = setTimeout(() => {
        lifecycleResyncTimer = null;
        const now = Date.now();
        if (!controller.signal.aborted && now - lastLifecycleResync >= 250) {
          lastLifecycleResync = now;
          resync();
        }
      }, 0);
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') scheduleLifecycleResync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', scheduleLifecycleResync);
    window.addEventListener('pageshow', scheduleLifecycleResync);
    window.addEventListener('online', scheduleLifecycleResync);

    // A new capital is rare and changes the most heavily cached public payload.
    // A second, coalesced read closes the cross-replica invalidation race where the
    // first request can reach a replica just before its transaction NOTIFY does.
    let worldConsistencyTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleWorldConsistencyRead = (): void => {
      if (worldConsistencyTimer !== null) return;
      worldConsistencyTimer = setTimeout(() => {
        worldConsistencyTimer = null;
        if (controller.signal.aborted) return;
        void client.invalidateQueries({ queryKey: keys.galaxy });
        void client.invalidateQueries({ queryKey: keys.leaderboard });
      }, 1500);
    };

    let reconnectResyncTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReconnectResync = (): void => {
      // Several short-lived reconnects before the timer fires still describe one
      // gap. The eventual pass catches up through the latest successful open.
      if (reconnectResyncTimer !== null) return;
      reconnectResyncTimer = setTimeout(() => {
        reconnectResyncTimer = null;
        if (!controller.signal.aborted) resync();
      }, Math.random() * RECONNECT_RESYNC_MAX_MS);
    };

    const refresh = (kind: string): void => {
      if (kind === 'shard:rollover') {
        onRollover?.();
        return;
      }
      /**
       * A GALAXY-WIDE EVENT IS NOT ABOUT YOU, AND MUST NOT COST WHAT ONE IS. D53.
       *
       * The blanket refresh below is right for something that happened to this
       * commander, where almost anything can have moved. It is completely wrong
       * for a neighbour launching a fleet: that changes one list, and in a busy
       * galaxy it happens often. Fifty clients each refetching eight payloads on
       * every launch in the shard is how a liveness feature becomes a load
       * problem.
       *
       * So a shard event is routed to the one or two reads it actually moves, and
       * coalesced. See `shardEvents.ts`.
       */
      if (isShardEvent(kind)) {
        shard.note(kind);
        if (kind === 'shard:world') scheduleWorldConsistencyRead();
        return;
      }

      /**
       * A PLAYER-PRIVATE CLAN EVENT NAMES ITS OWN READS. D114.
       *
       * These are the only player events that arrive with a kind precise enough to
       * route, and they arrive often — five sends per ten seconds per clanmate is
       * the chat's own ceiling. An unknown kind falls through to the resync below,
       * which is the safe direction: a newer server saying something this build has
       * never heard of did still happen to this commander.
       */
      if (isPrivateEvent(kind)) {
        const reads = readsForPrivateEvent(kind);
        if (reads) {
          for (const key of reads) void client.invalidateQueries({ queryKey: key });
          return;
        }
      }

      /**
       * EVERY read that a resolved event can change — and `traffic` and `mining`
       * were missing from it.
       *
       * A craft is drawn from whichever of these carries it: your own fleets from
       * `pending`, your mining and harvest runs from `mining`, and everybody
       * else's from `traffic`. `interpolatePosition` clamps at the end of a
       * flight, so a craft whose list has not been refetched does not vanish or
       * turn round — it SITS on its target, motionless, until something else
       * happens to refresh it.
       *
       * An omission here does not fail loudly. It renders a stopped world.
       */
      resync();
    };

    /** Resolves early on abort, so a 30-second backoff cannot outlive the tab. */
    const pause = (ms: number): Promise<void> =>
      new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        controller.signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });

    void (async () => {
      let attempt = 0;
      /**
       * HOW MANY TIMES THIS SOCKET HAS COME UP — and why the first one is different.
       *
       * On the first open the queries have only just mounted and fetched; there is
       * nothing to catch up on and re-reading everything would double the cost of
       * a cold start. Every open AFTER that means the channel was DOWN for a while,
       * and this client heard nothing during it: the stream carries no cursor and
       * no backlog, so a raid that resolved, a neighbour that launched and a world
       * that grew while the socket was dead are all simply missing.
       *
       * Before this, the only thing that closed that gap was the sixty-second
       * safety-net poll — so a proxy dropping the socket, a deploy, or a phone
       * waking from sleep left the disc showing a world up to a minute out of date,
       * with fleets parked on their destinations, and nothing on screen said so.
       */
      let opens = 0;
      while (!controller.signal.aborted) {
        const openedAt = Date.now();
        try {
          await api.stream(refresh, controller.signal, () => {
            opens += 1;
            if (opens > 1) scheduleReconnectResync();
          });
        } catch {
          // Fall through: a connection that threw and one that closed instantly
          // are the same problem, and both are counted below.
        }
        /**
         * A CLEAN CLOSE IS NOT PROOF THE CONNECTION WORKED.
         *
         * `attempt` was reset whenever `stream()` returned normally, which is what
         * a proxy closing the socket the moment it is opened also looks like. The
         * backoff then never grew and the client hammered the server roughly twice
         * a second, per tab, forever. Only a connection that actually held for a
         * while has earned a reset.
         */
        attempt = Date.now() - openedAt > HEALTHY_MS ? 0 : attempt + 1;
        await pause(backoffMs(attempt));
      }
    })();

    return () => {
      controller.abort();
      if (reconnectResyncTimer !== null) clearTimeout(reconnectResyncTimer);
      if (lifecycleResyncTimer !== null) clearTimeout(lifecycleResyncTimer);
      if (worldConsistencyTimer !== null) clearTimeout(worldConsistencyTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', scheduleLifecycleResync);
      window.removeEventListener('pageshow', scheduleLifecycleResync);
      window.removeEventListener('online', scheduleLifecycleResync);
      shard.cancel();
    };
  }, [api, client, enabled, onRollover]);
}
