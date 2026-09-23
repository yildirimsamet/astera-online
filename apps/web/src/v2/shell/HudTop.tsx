import {
  useGalaxyEvents,
  useMining,
  useNotifications,
  usePending,
  usePlanet,
  useRewards,
  useSeason,
  useTraffic,
} from '../../api/queries.js';
import { useWorld } from '../../api/world.js';
import { bellState } from '../../lib/bell.js';
import { nowEntries } from '../../lib/nowLine.js';
import { useProjected } from '../../lib/projection.js';
import { useNow } from '../../lib/time.js';
import { NowLine } from '../hud/NowLine.js';
import { TopBar } from '../hud/TopBar.js';

export interface HudTopProps {
  commander: string;
  /** The commander chip: the Commander page (today's menu). */
  onCommander: () => void;
  /** The world mark: the Worlds sheet. */
  onWorlds: () => void;
  /** A resource meter: the economy detail. */
  onEconomy: () => void;
  onBell: () => void;
}

/**
 * THE TOP OF THE v2 SHELL, WIRED. Spec B1, B2 (docs/ui-v2/gozlemevi.md).
 *
 * Reads the active world, the season's shield, the feed, the flights and the
 * galaxy's events, and hands them to the top bar and the Now line — the two
 * presentational pieces never fetch. The stores are projected so the meters move
 * between fetches the way the old header's did.
 */
export function HudTop({ commander, onCommander, onWorlds, onEconomy, onBell }: HudTopProps) {
  const now = useNow(1_000);
  const { activePlanetId, capitalPlanetId, worlds } = useWorld();
  const planet = usePlanet();
  const held = useProjected(planet.data?.planet, planet.dataUpdatedAt, 5_000);
  const season = useSeason().data;
  const notifications = useNotifications().data?.notifications ?? [];
  const rewards = useRewards().data?.claimable ?? 0;
  const threads = usePending().data?.pending ?? [];
  const runs = useMining().data?.runs ?? [];
  const events = useGalaxyEvents().data?.events ?? [];
  const contacts = useTraffic().data?.contacts ?? [];

  const data = planet.data;
  const active = worlds.find((world) => world.planet.id === activePlanetId) ?? null;
  const shieldUntil = season?.shieldUntil ?? null;
  const boostUntil = data?.planet.productionBoostUntil ?? null;

  const entries = nowEntries({
    now,
    threads,
    runs,
    builds: [...(data?.queues?.CONSTRUCTION ?? []), ...(data?.queues?.YARD ?? [])],
    research: data?.researchQueue ?? [],
    events,
    shieldUntil,
  });

  return (
    <div className="shrink-0">
      <TopBar
        commander={commander}
        shield={shieldUntil ? { until: shieldUntil.getTime(), kind: season?.shieldKind ?? 'NEWCOMER' } : null}
        now={now}
        world={worlds.length > 1 && active ? { capital: active.planet.id === capitalPlanetId, name: active.planet.name } : null}
        stock={{
          alloy: { value: held.alloy, cap: data?.planet.alloyCap ?? 0 },
          crystal: { value: held.crystal, cap: data?.planet.crystalCap ?? 0 },
          deuterium: { value: held.deuterium, cap: data?.planet.deuteriumCap ?? 0 },
        }}
        bell={bellState(notifications, now)}
        rewards={rewards}
        boosted={boostUntil !== null && boostUntil.getTime() > now}
        onCommander={onCommander}
        onWorld={onWorlds}
        onResource={onEconomy}
        onBell={onBell}
      />
      <NowLine entries={entries} now={now} contacts={contacts} />
    </div>
  );
}
