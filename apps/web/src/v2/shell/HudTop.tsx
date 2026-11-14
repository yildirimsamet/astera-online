import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCollect,
  useGalaxyEvents,
  useMaintenanceNotice,
  useMining,
  usePending,
  useMonuments,
  usePlanet,
  useRewards,
  useSeason,
  useTraffic,
} from '../../api/queries.js';
import { hpRadiationApplies } from '@astera/rules';
import { useWorld } from '../../api/world.js';
import { collectState } from '../../lib/collect.js';
import { compact } from '../../lib/format.js';
import { haptic } from '../../lib/haptics.js';
import { nowEntries } from '../../lib/nowLine.js';
import { monumentPendingThreads } from '../../lib/monumentFlights.js';
import type { FlightFocus } from '../../lib/flights.js';
import { useProjected } from '../../lib/projection.js';
import { useNow } from '../../lib/time.js';
import { describe, useToast } from '../../ui/Toast.js';
import { RoundButton, artIconSrc } from '../../game-ui/index.js';
import { NowLine } from '../hud/NowLine.js';
import { StatusLine } from '../hud/StatusLine.js';
import { TopBar, type CollectionTransfer } from '../hud/TopBar.js';
import { capabilities } from '../../platform/runtime.js';
import { useSchoolPresentation } from '../../onboarding/flightSchool/presentation.js';
import { gateOf } from '../../starter/gate.js';

/** A commander's initials for the medallion: the first letters of two words, or the first two of one. */
export function initials(name: string, language: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  const letters = words.length > 1
    ? words.slice(0, 2).map((word) => Array.from(word)[0] ?? '')
    : Array.from(words[0] ?? '').slice(0, 2);
  return letters.join('').toLocaleUpperCase(language);
}

export interface HudTopProps {
  commander: string;
  /** The medallion at the end of the top bar: the menu. */
  onCommander: () => void;
  /** The shop's own painted door on the floating row, where the web sells (owner, 2026-11-14). */
  onShop?: () => void;
  /** The gift: open claimable rewards directly. */
  onRewards: () => void;
  /** The world mark: the Worlds sheet. */
  onWorlds: () => void;
  /** A resource meter: the economy detail. */
  onEconomy: () => void;
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
export function HudTop({ commander, onShop, onCommander, onRewards, onWorlds, onEconomy, nowOpen, onNow, onFocusCraft, tabs }: HudTopProps) {
  const { t, i18n } = useTranslation();
  const now = useNow(1_000);
  const school = useSchoolPresentation();
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
  const float = useRef<HTMLDivElement>(null);
  /*
    How far the status line and the Now line float over the galaxy (`--v2-float-h`): the
    galaxy's top corners start under them, so neither covers the other.
  */
  useEffect(() => {
    const node = float.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const root = document.documentElement.style;
    const observer = new ResizeObserver(() => { root.setProperty('--v2-float-h', `${String(node.offsetHeight)}px`); });
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.removeProperty('--v2-float-h');
    };
  }, []);
  const season = useSeason().data;
  const rewards = useRewards().data?.claimable ?? 0;
  const pending = usePending().data?.pending ?? [];
  const monuments = useMonuments(hpRadiationApplies(planet.data?.rulesetVersion ?? 0)).data;
  const threads = [...pending.map(thread => school?.pausedIncoming && thread.kind === 'incoming'
    ? { ...thread, arriveAt: new Date(now + school.legSeconds * 1000) } : thread), ...monumentPendingThreads(monuments, now)];
  const runs = useMining().data?.runs ?? [];
  const events = useGalaxyEvents().data?.events ?? [];
  const maintenance = useMaintenanceNotice();
  const contacts = useTraffic().data?.contacts ?? [];

  const data = planet.data;
  const active = worlds.find((world) => world.planet.id === activePlanetId) ?? null;
  const shieldUntil = season?.shieldUntil ?? null;
  const boostUntil = data?.planet.productionBoostUntil ?? null;
  const signalUntil = data?.planet.signalBoostUntil ?? null;

  /*
    THE WORKS, ON THE TOP BAR (owner, 2026-09-25): the same reading, request and toast the
    collect bubble and the Base's pool used — both gone, this is where the works are read.
  */
  const world = data?.planet;
  const works = world ? {
    state: collectState({
      caps: { alloy: world.bufferAlloyCap, crystal: world.bufferCrystalCap, deuterium: world.bufferDeuteriumCap },
      works: { alloy: held.bufferAlloy, crystal: held.bufferCrystal, deuterium: held.bufferDeuterium },
      store: { alloy: held.alloy, crystal: held.crystal, deuterium: held.deuterium },
      storeCaps: { alloy: world.alloyCap, crystal: world.crystalCap, deuterium: world.deuteriumCap },
    }),
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
            kept > 0 ? 'warn' : undefined,
          );
        },
        onError: (error) => { say(describe(error), 'error'); },
      });
    },
  } : undefined;

  const timers = {
    now,
    threads,
    contacts,
    runs,
    builds: data?.vacationUntil ? [] : [...(data?.queues?.CONSTRUCTION ?? []), ...(data?.queues?.YARD ?? [])],
    research: data?.vacationUntil ? [] : data?.researchQueue ?? [],
    events,
    shieldUntil,
    // D212: one figure per commander, published on every world's view.
    silentSpaceAt: data?.silentSpaceAt ?? null,
    maintenance: maintenance.data?.window ?? null,
  };
  const entries = nowEntries(timers);
  // The sheet under the line lists the whole work queue (owner, 2026-10-06).
  const sheet = nowEntries(timers, 'sheet');

  return (
    <div className="relative shrink-0">
      {/*
        The brand strip that stood above the bar went (owner, 2026-11-14): the name lives on
        the loading screen and in the menu, and the bar takes the notch inset itself.
      */}
      <TopBar
        {...(gateOf(data?.vessel).open('deuterium') ? {} : { hidden: ['deuterium'] as const })}
        stock={{
          alloy: { value: held.alloy, cap: data?.planet.alloyCap ?? 0, safe: data?.planet.vaultProtected.alloy ?? 0 },
          crystal: { value: held.crystal, cap: data?.planet.crystalCap ?? 0, safe: data?.planet.vaultProtected.crystal ?? 0 },
          deuterium: { value: held.deuterium, cap: data?.planet.deuteriumCap ?? 0, safe: data?.planet.vaultProtected.deuterium ?? 0 },
        }}
        {...(works ? { works } : {})}
        transfer={transfer?.planetId === data?.planet.id ? transfer : null}
        commander={{ initials: initials(commander, i18n.language), name: commander }}
        onResource={onEconomy}
        onCommander={onCommander}
        {...(tabs === undefined ? {} : { tabs })}
      />
      {/* Over the galaxy, under the bar: what holds over your worlds, then the timers. It costs the scene no row. */}
      <div ref={float} data-now-float="" className="pointer-events-none absolute inset-x-0 top-full z-20 pt-1">
        <div className="flex items-start">
          <div className="min-w-0 flex-1">
            <StatusLine
              now={now}
              world={worlds.length > 1 && active ? { capital: active.planet.id === capitalPlanetId, name: active.planet.name } : null}
              shield={shieldUntil ? { until: shieldUntil.getTime(), kind: season?.shieldKind ?? 'NEWCOMER' } : null}
              recoveryUntil={boostUntil?.getTime() ?? null}
              signalUntil={signalUntil?.getTime() ?? null}
              vacationUntil={data?.vacationUntil?.getTime() ?? null}
              rewards={rewards}
              onWorld={onWorlds}
              onRewards={onRewards}
              onHint={(text) => { say(text); }}
            />
          </div>
          {/* The shop's own door, where the web sells and never aboard a colony ship. */}
          {onShop && !data?.vessel && capabilities().webCheckout && (
            <div className="pointer-events-auto shrink-0 pr-1">
              <RoundButton art={artIconSrc('menu-shop')} label={t('menu.skinsShopLabel')} onPress={onShop} />
            </div>
          )}
        </div>
        <NowLine
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
    </div>
  );
}
