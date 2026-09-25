import { useClanBadge, useMining, useNotifications, usePending, usePlanet } from '../../api/queries.js';
import { dockBadges, isReportSignal, type DockTab } from '../../lib/dock.js';
import { useNow } from '../../lib/time.js';
import { Dock } from '../hud/Dock.js';

/**
 * THE DOCK, WIRED. Spec B4 (docs/ui-v2/gozlemevi.md).
 *
 * Base: a fault nobody has paid to repair (one being repaired already has its clock
 * and needs nothing) — the works are read on the top bar, where they are collected. Fleet: your own craft up and
 * the soonest landing. Intel: unseen battle and probe reports. Clan: the clan's
 * own attention count, the same figure the old disc mark read.
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

  const badges = dockBadges({
    now,
    threads,
    runs,
    faults: (planet.data?.faults ?? []).filter((fault) => fault.repair === null).length,
    unseenReports: notifications.filter((note) => !note.seen && isReportSignal(note.kind)).length,
    clanAttention: clan?.attentionCount ?? 0,
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
