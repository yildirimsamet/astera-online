import { useClanBadge, useMining, useNotifications, usePending, usePlanet } from '../../api/queries.js';
import { collectState } from '../../lib/collect.js';
import { dockBadges, isReportSignal, type DockTab } from '../../lib/dock.js';
import { useProjected } from '../../lib/projection.js';
import { useNow } from '../../lib/time.js';
import { Dock } from '../hud/Dock.js';

/**
 * THE DOCK, WIRED. Spec B4 (docs/ui-v2/gozlemevi.md).
 *
 * Base: works worth collecting, or a fault nobody has paid to repair (one being
 * repaired already has its clock and needs nothing). Fleet: your own craft up and
 * the soonest landing. Intel: unseen battle and probe reports. Clan: the clan's
 * own attention count, the same figure the old disc mark read.
 */
export function HudDock({ active, onSelect, over = false }: {
  active: DockTab | null;
  onSelect: (tab: DockTab) => void;
  /** A page is open over the galaxy: the dock backs itself (see `Dock`). */
  over?: boolean;
}) {
  const now = useNow(1_000);
  const planet = usePlanet();
  const held = useProjected(planet.data?.planet, planet.dataUpdatedAt, 5_000);
  const threads = usePending().data?.pending ?? [];
  const runs = useMining().data?.runs ?? [];
  const notifications = useNotifications().data?.notifications ?? [];
  const clan = useClanBadge().data;

  const world = planet.data?.planet;
  const ripe = world
    ? collectState({
      caps: { alloy: world.bufferAlloyCap, crystal: world.bufferCrystalCap, deuterium: world.bufferDeuteriumCap },
      works: { alloy: held.bufferAlloy, crystal: held.bufferCrystal, deuterium: held.bufferDeuterium },
      store: { alloy: held.alloy, crystal: held.crystal, deuterium: held.deuterium },
      storeCaps: { alloy: world.alloyCap, crystal: world.crystalCap, deuterium: world.deuteriumCap },
    }).ripe
    : false;

  const badges = dockBadges({
    now,
    threads,
    runs,
    collectRipe: ripe,
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
      {...(clan?.available === false ? { disabled: ['clan'] } : {})}
    />
  );
}
