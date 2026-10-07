import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCollect,
  useGalaxyEvents,
  useMining,
  useNotifications,
  usePending,
  useMonuments,
  usePlanet,
  useRewards,
  useSeason,
  useTraffic,
} from '../../api/queries.js';
import { hpRadiationApplies } from '@astera/rules';
import { useWorld } from '../../api/world.js';
import { bellState } from '../../lib/bell.js';
import { collectState, worksOutlook } from '../../lib/collect.js';
import { compact } from '../../lib/format.js';
import { haptic } from '../../lib/haptics.js';
import { nowEntries } from '../../lib/nowLine.js';
import { monumentPendingThreads } from '../../lib/monumentFlights.js';
import type { FlightFocus } from '../../lib/flights.js';
import { useProjected } from '../../lib/projection.js';
import { useNow } from '../../lib/time.js';
import { describe, useToast } from '../../ui/Toast.js';
import { NowLine } from '../hud/NowLine.js';
import { TopBar, type CollectionTransfer } from '../hud/TopBar.js';

export interface HudTopProps {
  commander: string;
  /** The commander chip: the Commander page (today's menu). */
  onCommander: () => void;
  /** The gift: open claimable rewards directly. */
  onRewards: () => void;
  /** The world mark: the Worlds sheet. */
  onWorlds: () => void;
  /** A resource meter: the economy detail. */
  onEconomy: () => void;
  onBell: () => void;
  /** The Now line's timers sheet, held by the shell. */
  nowOpen: boolean;
  onNow: (open: boolean) => void;
  onFocusCraft: (focus: FlightFocus) => void;
  /** E11: the desk tab bar, drawn in the top bar (the shell decides when). */
  tabs?: ReactNode;
}

/**
 * THE TOP OF THE v2 SHELL, WIRED. Spec B1, B2 (docs/ui-v2/gozlemevi.md).
 *
 * Reads the active world, the season's shield, the feed, the flights and the
 * galaxy's events, and hands them to the top bar and the Now line — the two
 * presentational pieces never fetch. The stores are projected so the meters move
 * between fetches the way the old header's did.
 */
export function HudTop({ commander, onCommander, onRewards, onWorlds, onEconomy, onBell, nowOpen, onNow, onFocusCraft, tabs }: HudTopProps) {
  const { t } = useTranslation();
  const now = useNow(1_000);
  const { activePlanetId, capitalPlanetId, worlds } = useWorld();
  const planet = usePlanet();
  // Every second: the works fill while the player watches, and the planet query has no poll.
  const held = useProjected(planet.data?.planet, planet.dataUpdatedAt, 1_000);
  const collect = useCollect();
  const [transfer, setTransfer] = useState<(CollectionTransfer & { planetId: string }) | null>(null);
  useEffect(() => {
    if (transfer === null) return;
    const timer = window.setTimeout(() => { setTransfer(null); }, 1_200);
    return () => { window.clearTimeout(timer); };
  }, [transfer]);
  const say = useToast();
  const season = useSeason().data;
  const notifications = useNotifications().data?.notifications ?? [];
  const rewards = useRewards().data?.claimable ?? 0;
  const pending = usePending().data?.pending ?? [];
  const monuments = useMonuments(hpRadiationApplies(planet.data?.rulesetVersion ?? 0)).data;
  const threads = [...pending, ...monumentPendingThreads(monuments, now)];
  const runs = useMining().data?.runs ?? [];
  const events = useGalaxyEvents().data?.events ?? [];
  const contacts = useTraffic().data?.contacts ?? [];

  const data = planet.data;
  const active = worlds.find((world) => world.planet.id === activePlanetId) ?? null;
  const shieldUntil = season?.shieldUntil ?? null;
  const boostUntil = data?.planet.productionBoostUntil ?? null;

  /*
    THE WORKS, ON THE TOP BAR (owner, 2026-09-25): the same reading, request and toast the
    collect bubble and the Base's pool used — both gone, this is where the works are read.
  */
  const world = data?.planet;
  const works = world ? (() => {
    const caps = { alloy: world.bufferAlloyCap, crystal: world.bufferCrystalCap, deuterium: world.bufferDeuteriumCap };
    const vessels = { alloy: held.bufferAlloy, crystal: held.bufferCrystal, deuterium: held.bufferDeuterium };
    const outlook = worksOutlook({
      caps,
      works: vessels,
      rates: { alloy: world.alloyPerHour, crystal: world.crystalPerHour, deuterium: world.deuteriumPerHour ?? 0 },
    });
    return {
      state: collectState({
        caps,
        works: vessels,
        store: { alloy: held.alloy, crystal: held.crystal, deuterium: held.deuterium },
        storeCaps: { alloy: world.alloyCap, crystal: world.crystalCap, deuterium: world.deuteriumCap },
      }),
      fill: outlook.fill,
      fullInMinutes: outlook.fullInMinutes,
      pending: collect.isPending,
      onCollect: () => {
        haptic('commit');
        collect.mutate(undefined, {
          onSuccess: (result) => {
            setTransfer({
              id: Date.now(),
              planetId: result.planet.planet.id,
              each: {
                alloy: { from: result.planet.planet.alloy - result.moved.alloy, to: result.planet.planet.alloy },
                crystal: { from: result.planet.planet.crystal - result.moved.crystal, to: result.planet.planet.crystal },
                deuterium: { from: result.planet.planet.deuterium - result.moved.deuterium, to: result.planet.planet.deuterium },
              },
            });
            const moved = Math.round(result.moved.alloy + result.moved.crystal + result.moved.deuterium);
            const kept = Math.round(result.blocked.alloy + result.blocked.crystal + result.blocked.deuterium);
            say(
              kept > 0
                ? t('statusBar.works.collectedPartly', { moved: compact(moved), held: compact(kept) })
                : t('statusBar.works.collected', { amount: compact(moved) }),
              kept > 0 ? 'error' : undefined,
            );
          },
          onError: (error) => { say(describe(error), 'error'); },
        });
      },
      // A store that can take none of it is raised where the Vault is built.
      onOpenBase: onEconomy,
    };
  })() : undefined;

  const timers = {
    now,
    threads,
    contacts,
    runs,
    builds: [...(data?.queues?.CONSTRUCTION ?? []), ...(data?.queues?.YARD ?? [])],
    research: data?.researchQueue ?? [],
    events,
    shieldUntil,
  };
  const entries = nowEntries(timers);
  // The sheet under the line lists the whole work queue (owner, 2026-10-06).
  const sheet = nowEntries(timers, 'sheet');

  return (
    <div className="relative shrink-0">
      <TopBar
        commander={commander}
        shield={shieldUntil ? { until: shieldUntil.getTime(), kind: season?.shieldKind ?? 'NEWCOMER' } : null}
        now={now}
        world={worlds.length > 1 && active ? { capital: active.planet.id === capitalPlanetId, name: active.planet.name } : null}
        stock={{
          alloy: { value: held.alloy, cap: data?.planet.alloyCap ?? 0, safe: data?.planet.vaultProtected.alloy ?? 0 },
          crystal: { value: held.crystal, cap: data?.planet.crystalCap ?? 0, safe: data?.planet.vaultProtected.crystal ?? 0 },
          deuterium: { value: held.deuterium, cap: data?.planet.deuteriumCap ?? 0, safe: data?.planet.vaultProtected.deuterium ?? 0 },
        }}
        bell={bellState(notifications, now)}
        rewards={rewards}
        boosted={boostUntil !== null && boostUntil.getTime() > now}
        {...(works ? { works } : {})}
        transfer={transfer?.planetId === data?.planet.id ? transfer : null}
        onCommander={onCommander}
        onRewards={onRewards}
        onWorld={onWorlds}
        onResource={onEconomy}
        onBell={onBell}
        {...(tabs === undefined ? {} : { tabs })}
      />
      <NowLine
        floating
        entries={entries}
        sheet={sheet}
        now={now}
        contacts={contacts}
        open={nowOpen}
        onOpen={() => { onNow(true); }}
        onClose={() => { onNow(false); }}
        onFocus={onFocusCraft}
      />
    </div>
  );
}
