import { useEffect, useRef } from 'react';
import { useClanBadge, useMarkSeen, useMining, useNotifications, usePending, usePlanet } from '../../api/queries.js';
import { dockBadges, isReportSignal, type DockTab } from '../../lib/dock.js';
import { useNow } from '../../lib/time.js';
import { Dock } from '../hud/Dock.js';

/**
 * THE DOCK, WIRED. Spec B4 (docs/ui-v2/gozlemevi.md).
 *
 * Base: a fault nobody has paid to repair (one being repaired already has its clock
 * and needs nothing) — the works are read on the top bar. Fleet: your own craft up
 * and the soonest landing. Intel: unseen battle and probe reports, cleared on entry.
 * Clan: requests and resources needing action; unread clan chat stays on Chat.
 */
export function HudDock({ active, onSelect, over = false, bar = false }: {
  active: DockTab | null;
  onSelect: (tab: DockTab) => void;
  /** A page is open over the galaxy: the dock backs itself (see `Dock`). */
  over?: boolean;
  /** The desk's tab bar in the top bar (E11). */
  bar?: boolean;
}) {
  const now = useNow(1_000);
  const planet = usePlanet();
  const threads = usePending().data?.pending ?? [];
  const runs = useMining().data?.runs ?? [];
  const notifications = useNotifications().data?.notifications ?? [];
  const clan = useClanBadge().data;
  const markSeen = useMarkSeen();
  const requested = useRef<Set<string>>(new Set());

  // Visiting Intel reads its report signals, even if the feed arrives after the page opens.
  // Keep other signals unread for the bell. A failed write is reconciled by useMarkSeen;
  // leaving and reopening Intel retries those ids.
  useEffect(() => {
    if (active !== 'intel') {
      requested.current.clear();
      return;
    }
    const fresh = notifications
      .filter((note) => !note.seen && isReportSignal(note.kind) && !requested.current.has(note.id))
      .map((note) => note.id);
    if (fresh.length === 0) return;
    fresh.forEach((id) => { requested.current.add(id); });
    markSeen.mutate(fresh);
  }, [active, notifications, markSeen.mutate]);

  const badges = dockBadges({
    now,
    threads,
    runs,
    faults: (planet.data?.faults ?? []).filter((fault) => fault.repair === null).length,
    // The page itself is the read action, so its badge clears on the same tap,
    // before the optimistic mutation has finished.
    unseenReports: active === 'intel' ? 0 : notifications.filter((note) => !note.seen && isReportSignal(note.kind)).length,
    // Clan chat has its own unread badge on the chat button; keep the Clan count
    // for requests and unclaimed resources that its page actually shows.
    clanAttention: Math.max(0, (clan?.attentionCount ?? 0) - (clan?.clanChatUnread ?? 0)),
  });

  return (
    <Dock
      active={active}
      badges={badges}
      onSelect={onSelect}
      over={over}
      bar={bar}
      {...(clan?.available === false ? { disabled: ['clan'] } : {})}
    />
  );
}
