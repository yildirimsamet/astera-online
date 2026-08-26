import { keys } from '../api/keys.js';

/**
 * WHAT A GALAXY-WIDE EVENT MEANS TO THIS CLIENT. D53.
 *
 * The stream now carries two families. A PLAYER event is something that happened
 * to this commander and refreshes everything, because almost anything can have
 * moved. A SHARD event is something that happened to SOMEBODY ELSE in the same
 * galaxy — a fleet leaving, a raid resolving, a drill going out, a world growing
 * — and it is the half that used to arrive on a twenty-to-thirty-second poll.
 *
 * The server says what HAPPENED; this file decides what to read because of it.
 * That split is deliberate: which query holds which fact is a client concern, and
 * putting the mapping on the wire would mean a payload shape to keep in step with
 * every refactor of the query keys.
 *
 * NOTHING HERE IS A STATE UPDATE. A shard event carries a kind and nothing else —
 * no id, no owner, no position — so the only thing it can do is send the client
 * to a payload it was already entitled to read. Every fog rule is still enforced
 * in the query it points at, exactly as it was when a timer pointed at the same
 * query thirty seconds later.
 */

/** The prefix the server namespaces shard kinds with. Must match `bus.ts`. */
export const SHARD_PREFIX = 'shard:';

export const isShardEvent = (kind: string): boolean => kind.startsWith(SHARD_PREFIX);

/**
 * Which reads a galaxy-wide event moves.
 *
 * DELIBERATELY NARROW, and `galaxy` is the reason. It is the most expensive read
 * in the game — it carries a telescope reading for every world the caller watches
 * and it provokes a `lastConfirmedAt` write — so it is refetched only for the one
 * kind that can actually change it. `launch`, `arrival` and `mining` cannot: a
 * craft in the air appears in `traffic` and in `mining`, and the galaxy payload
 * publishes a world's silhouette, its orbit and its dome, none of which a flight
 * touches.
 *
 * An unknown kind maps to nothing. A newer server publishing a kind this client
 * has never heard of must be inert here, not a crash and not a blanket refetch —
 * the same reason the client parses a notification kind as a string and never as
 * an enum.
 */
export function readsForShardEvent(kind: string): readonly (readonly string[])[] {
  switch (kind.slice(SHARD_PREFIX.length)) {
    /** Somebody's craft left a world. It is in the air, so it is in `traffic`. */
    case 'launch':
      return [keys.traffic];
    /**
     * A flight ended. `traffic` loses the contact — and `mining` gains whatever a
     * battle left behind, because a debris field is published on that payload.
     */
    case 'arrival':
      return [keys.traffic, keys.miningField];
    case 'transfer':
      return [keys.traffic, keys.pending, keys.planet, keys.planets];
    case 'impact':
      return [keys.traffic, keys.galaxy, keys.planet, keys.pending];
    case 'control':
      return [keys.traffic, keys.galaxy, keys.planet, keys.planets, keys.pending, keys.leaderboard];
    case 'recovery':
    case 'protection':
      return [keys.galaxy, keys.planet];
    /**
     * A mining or salvage run started, turned for home, or landed. The shard-wide
     * half refreshes only the common rock/wreck field and public traffic. The one
     * owner receives a player event (or their launch response) for private runs,
     * research and orbit; making everybody query those rows was the D99 fan-out.
     */
    case 'mining':
      return [keys.miningField, keys.traffic];
    /** A world changed shape or gained hardware — the only public change to a world. */
    case 'world':
      return [keys.galaxy, keys.leaderboard];
    /** A battle changed at least one rounded-chip Dominion score. */
    case 'score':
      return [keys.leaderboard, keys.galaxy];
    /** A season-scoped message changed both the open conversation and closed dot. */
    case 'chat':
      return [keys.chatMessages, keys.chatUnread];
    /** A public moment was committed to the galaxy's 24-hour memory. */
    case 'chronicle':
      return [keys.chronicle];
    /** The deadline landed: freeze controls, standings and the permanent recap. */
    case 'season':
      return [keys.season, keys.planet, keys.pending, keys.leaderboard];
    /** Public clan identity or score moved; private state has its own player event. */
    case 'clan':
      return [keys.galaxy, keys.leaderboard, ['clan', 'directory'], keys.clanLeaderboard];
    default:
      return [];
  }
}

/** The prefix the server namespaces player-private clan kinds with. Matches `bus.ts`. */
export const PRIVATE_PREFIX = 'private:';

export const isPrivateEvent = (kind: string): boolean => kind.startsWith(PRIVATE_PREFIX);

/**
 * A PRIVATE CLAN EVENT IS ABOUT YOU, AND STILL MUST NOT COST WHAT A RESYNC DOES. D114.
 *
 * `publishPrivate` namespaces five narrow kinds and its docblock calls each one "a
 * narrow invalidation" — but nothing here read the prefix, so every one of them fell
 * through to the blanket player-event resync. One clan chat message therefore sent
 * each of five members to refetch the planet, the galaxy, intel, notifications,
 * pending, reports, traffic, mining, rewards, both chats, the chronicle AND all seven
 * clan reads, five times per ten seconds at the permitted burst. That is the exact
 * fan-out `readsForShardEvent` exists to prevent, arriving through the other door.
 *
 * `null` means "this client does not know that kind" and the caller falls back to the
 * full resync — the safe direction for a newer server, and the opposite of the shard
 * table's inert `[]`, because a private event genuinely did happen to this commander.
 */
export function readsForPrivateEvent(kind: string): readonly (readonly string[])[] | null {
  switch (kind.slice(PRIVATE_PREFIX.length)) {
    /** Joined, left, kicked, promoted, disbanded, or the settings changed. */
    case 'clan-membership':
      return [keys.clanBadge, keys.clanHome, keys.clanStrength, keys.clanEvents];
    /** An application or invitation was raised, withdrawn, rejected or expired. */
    case 'clan-request':
      return [keys.clanBadge, keys.clanHome];
    /** Somebody spoke. The badge carries the unread count the beacon is drawn from. */
    case 'clan-chat':
      return [keys.clanBadge, keys.clanChat];
    /** A share was credited or claimed; the outside view carries the depot too. */
    case 'clan-depot':
      return [keys.clanBadge, keys.clanDepot, keys.clanHome];
    /**
     * A convoy left, landed, turned round or came home. A DELIVERY moves real
     * hardware and real resources on a world, so this one legitimately reaches
     * past the clan surface — leaving it out would park the recipient's gifted
     * ships on a stale planet payload until the sixty-second net came round.
     */
    case 'clan-aid':
      return [keys.clanAid, keys.clanHome, keys.planet, keys.planets, keys.pending, keys.traffic];
    default:
      return null;
  }
}

/**
 * HOW LONG TO GATHER BEFORE ASKING. D53.
 *
 * The thing a broadcast makes possible is also the thing it makes easy to get
 * wrong: three hundred clients hearing the same event and all refetching in the same
 * instant is fifty queries per launch, and a galaxy where four things happen at
 * once is four times that from every one of them.
 *
 * So the events are collected and the reads are done once. A quarter of a second
 * is under the threshold where a person reads a delay as a delay, and it collapses
 * a battle — which publishes an arrival, and whose debris and traffic both move —
 * into a single pass. It is a coalescing window, not a poll: an event on a quiet
 * galaxy still lands within a quarter second of the instant it names.
 */
export const COALESCE_MS = 250;

/**
 * Gathers shard events and flushes them as one set of reads.
 *
 * Deliberately not a React hook: the whole point is that it holds state ACROSS
 * renders and across the stream reconnecting, and it is far easier to assert
 * against as a plain object than through a test renderer.
 */
export function shardCoalescer(
  flush: (reads: readonly (readonly string[])[]) => void,
  windowMs = COALESCE_MS,
) {
  /** Query keys waiting to be read, de-duplicated by their joined name. */
  let waiting = new Map<string, readonly string[]>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    note(kind: string): void {
      const reads = readsForShardEvent(kind);
      // An unknown kind must not arm a timer that will flush nothing.
      if (reads.length === 0) return;
      for (const key of reads) waiting.set(key.join('/'), key);
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        const due = [...waiting.values()];
        waiting = new Map();
        flush(due);
      }, windowMs);
    },
    /** On unmount. A pending flush must not outlive the component that armed it. */
    cancel(): void {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      waiting = new Map();
    },
  };
}
