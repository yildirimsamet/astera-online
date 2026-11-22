import { useMemo, useState } from 'react';
import {
  MOBILE_HULLS,
  MOON,
  distance,
  fleetCount,
  hullBulk,
  jumpCapacity,
  jumpFuel,
  type Fleet,
  type MobileHullId,
  type MoonRarity,
  type Vec3,
} from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { PlanetMoon, PlanetView } from '../api/schemas.js';
import { Choices, GameButton, GameHold, Glyph, RoomGauge, SectionTag } from '../game-ui/index.js';
import { hullName } from '../i18n/names.js';
import { useMoonT } from '../i18n/moon.js';
import { compact } from '../lib/format.js';
import { playSound } from '../lib/sound.js';
import { useNow } from '../lib/time.js';
import { HULL_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';

export interface OtherOwnedMoon {
  readonly planetId: string;
  readonly name: string;
  readonly position: Vec3;
  readonly rarity: MoonRarity;
}

export interface MoonScanTarget {
  readonly planetId: string;
  readonly name: string;
  readonly distance: number;
}

export interface MoonScanResult {
  readonly id: string;
  readonly scannedAt: Date;
  readonly pierced: boolean;
  readonly rows: readonly {
    readonly direction: 'IN' | 'OUT';
    readonly otherPlanetId: string;
    readonly arriveAt: Date;
    readonly size: 'LIGHT' | 'MEDIUM' | 'HEAVY';
  }[];
}

export interface MoonPanelProps {
  readonly planet: PlanetView;
  readonly moonsEnabled: boolean;
  readonly otherMoons: readonly OtherOwnedMoon[];
  readonly scanTargets: readonly MoonScanTarget[];
  readonly onRefresh?: () => void;
  readonly onOrderMoon?: (planetId: string) => Promise<unknown>;
  readonly onHop?: (planetId: string, direction: 'UP' | 'DOWN', fleet: Fleet) => Promise<unknown>;
  readonly onJump?: (planetId: string, toPlanetId: string, fleet: Fleet) => Promise<unknown>;
  readonly onScan?: (planetId: string, targetPlanetId: string) => Promise<MoonScanResult>;
  /** Fires after a successful gate jump so the galaxy view can close the sheet and play the private warp VFX. */
  readonly onJumpStarted?: (fromPlanetId: string, toPlanetId: string, fleet: Fleet) => void;
  /** Fires after a successful Gözcü scan so the galaxy view can play the scan VFX. */
  readonly onScanVisual?: (fromPlanetId: string, targetPlanetId: string, pierced: boolean) => void;
  /** Optional action to close the sheet and pan the camera to a scanned target. */
  readonly onWatchTarget?: (targetPlanetId: string) => void;
}

const RARITY_STYLE: Record<MoonRarity, { ring: string; text: string; bg: string }> = {
  COMMON: { ring: 'border-slate-400/50', text: 'text-slate-200', bg: 'bg-slate-400/15' },
  RARE: { ring: 'border-sky-400/60', text: 'text-sky-300', bg: 'bg-sky-400/15' },
  EPIC: { ring: 'border-purple-400/60', text: 'text-purple-300', bg: 'bg-purple-400/15' },
  LEGENDARY: { ring: 'border-amber-400/70', text: 'text-amber-300', bg: 'bg-amber-400/15' },
};

const RARITY_KEY = {
  COMMON: 'rarity.COMMON',
  RARE: 'rarity.RARE',
  EPIC: 'rarity.EPIC',
  LEGENDARY: 'rarity.LEGENDARY',
} as const;

const ORIGIN_KEY = {
  SEED: 'origin.SEED',
  BUILT: 'origin.BUILT',
  BATTLE: 'origin.BATTLE',
} as const;

const SIZE_KEY = {
  LIGHT: 'scan.size.LIGHT',
  MEDIUM: 'scan.size.MEDIUM',
  HEAVY: 'scan.size.HEAVY',
} as const;

function fitMobileFleet(source: Fleet, maxBulk: number): Fleet {
  if (maxBulk <= 0) return {};
  const out: Fleet = {};
  let left = maxBulk;
  for (const hull of MOBILE_HULLS) {
    const held = source[hull] ?? 0;
    if (held <= 0) continue;
    const each = hullBulk(hull);
    const take = each > 0 ? Math.min(held, Math.floor(left / each)) : held;
    if (take > 0) {
      out[hull] = take;
      left -= take * each;
    }
  }
  return out;
}

function fleetBulk(fleet: Fleet): number {
  let sum = 0;
  for (const hull of MOBILE_HULLS) {
    const n = fleet[hull] ?? 0;
    if (n > 0) sum += n * hullBulk(hull);
  }
  return sum;
}

function clampSelection(selected: Fleet, available: Fleet): Fleet {
  const out: Fleet = {};
  for (const hull of MOBILE_HULLS) {
    const held = available[hull] ?? 0;
    const picked = Math.min(held, Math.max(0, Math.floor(selected[hull] ?? 0)));
    if (picked > 0) out[hull] = picked;
  }
  return out;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSec = Math.ceil(ms / 1_000);
  const h = Math.floor(totalSec / 3_600);
  const m = Math.floor((totalSec % 3_600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function FleetChips({ fleet, emptyLabel }: { readonly fleet: Fleet; readonly emptyLabel: string }) {
  const present = MOBILE_HULLS.filter((h) => (fleet[h] ?? 0) > 0);
  if (present.length === 0) {
    return <p className="text-caption text-slate-400">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {present.map((hull) => {
        const art = HULL_ART[hull];
        return (
          <span
            key={hull}
            className="inline-flex items-center gap-1 rounded-chip border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-caption text-slate-100"
          >
            {art ? (
              <img src={art} alt="" aria-hidden width={18} height={18} className="size-[18px] object-contain" />
            ) : (
              <HullMark hull={hull} className="size-4" />
            )}
            <span>{hullName(hull) ?? hull}</span>
            <span className="gk-num font-semibold text-sky-200">×{fleet[hull]}</span>
          </span>
        );
      })}
    </div>
  );
}

function HullPickerRows({
  available,
  selected,
  onChange,
  testPrefix,
}: {
  readonly available: Fleet;
  readonly selected: Fleet;
  readonly onChange: (hull: MobileHullId, count: number) => void;
  readonly testPrefix: string;
}) {
  const { t } = useTranslation();
  const hulls = MOBILE_HULLS.filter((id) => (available[id] ?? 0) > 0);
  if (hulls.length === 0) return null;
  return (
    <div className="gk-ledger">
      {hulls.map((id) => {
        const held = available[id] ?? 0;
        const picked = selected[id] ?? 0;
        const art = HULL_ART[id];
        const label = hullName(id) ?? id;
        return (
          <div
            key={id}
            data-testid={`${testPrefix}-row-${id}`}
            data-chosen={picked > 0 ? '' : undefined}
            className="gk-lrow gk-lrow--tight"
          >
            <span data-art className="gk-lrow__art">
              {art ? (
                <img src={art} alt="" aria-hidden width={34} height={34} loading="lazy" />
              ) : (
                <HullMark hull={id} className="gk-lrow__mark" />
              )}
            </span>
            <span className="gk-lrow__name">{label}</span>
            <span className="gk-sub gk-num gk-lrow__info">
              {picked}<span className="gk-lrow__of">/{held}</span>
            </span>
            <QuantityStepper
              value={picked}
              min={0}
              max={held}
              onChange={(value) => { onChange(id, value); }}
              decreaseLabel={t('launch.fewer', { name: label })}
              increaseLabel={t('launch.more', { name: label })}
              valueLabel={t('launch.quantity', { name: label })}
              maxLabel={t('launch.max', { name: label })}
              maxText={t('launch.maxShort')}
            />
          </div>
        );
      })}
    </div>
  );
}

function NoMoonCard({
  planet,
  onOrderMoon,
  onRefresh,
  now,
}: {
  readonly planet: PlanetView;
  readonly onOrderMoon?: (planetId: string) => Promise<unknown>;
  readonly onRefresh?: () => void;
  readonly now: number;
}) {
  const mt = useMoonT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const research = planet.research.find((r) => r.id === 'LUNAR_CAPTURE');
  const hasResearch = (research?.level ?? 0) >= 1;
  const pendingOrder = planet.queues?.CONSTRUCTION.find((q) => q.kind === 'MOON');
  const hasResources =
    planet.planet.alloy >= MOON.build.cost.alloy &&
    planet.planet.crystal >= MOON.build.cost.crystal;
  const canBuild = !pendingOrder && hasResearch && hasResources && !busy && Boolean(onOrderMoon);
  const buildDisabledReason = pendingOrder
    ? mt('build.queued')
    : !hasResearch
      ? mt('build.needResearch')
      : !hasResources
        ? mt('build.needResources')
        : busy
          ? mt('build.queued')
          : !onOrderMoon
            ? mt('build.action')
            : null;

  const handleBuild = async () => {
    if (!onOrderMoon || !canBuild) return;
    setBusy(true);
    setErr(null);
    try {
      await onOrderMoon(planet.planet.id);
      playSound('tap');
      onRefresh?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const planetMobile = useMemo(() => fitMobileFleet(planet.fleet, Number.MAX_SAFE_INTEGER), [planet.fleet]);

  return (
    <div data-testid="moon-panel-empty" className="gk flex flex-col gap-3 px-3 pb-4">
      <div className="rounded-xl border border-white/10 bg-slate-900/75 p-4">
        <div className="flex items-start gap-3">
          <img
            src="/images/premium/moon/moon-gate-v1.webp"
            alt=""
            className="size-16 shrink-0 rounded-lg border border-white/10 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">{mt('build.title')}</div>
            <p className="mt-0.5 text-xs text-slate-300">{mt('build.subtitle')}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-200">
              <span>{MOON.build.cost.alloy.toLocaleString()} Alloy</span>
              <span>{MOON.build.cost.crystal.toLocaleString()} Crystal</span>
              <span className="text-slate-400">{mt('build.duration')}</span>
            </div>
          </div>
        </div>

        {pendingOrder ? (
          <div className="mt-3 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">
            {mt('build.queued')}
            {pendingOrder.finishesAt ? ` · ${formatCountdown(pendingOrder.finishesAt.getTime() - now)}` : ''}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {!hasResearch && (
              <div className="text-xs text-amber-300">{mt('build.needResearch')}</div>
            )}
            {hasResearch && !hasResources && (
              <div className="text-xs text-rose-300">{mt('build.needResources')}</div>
            )}
            {err && <div className="text-xs text-rose-300">{err}</div>}
            <GameButton
              data-testid="moon-build-btn"
              tone="action"
              size="md"
              wide
              disabledReason={buildDisabledReason}
              onPress={() => { void handleBuild(); }}
            >
              {mt('build.action')}
            </GameButton>
          </div>
        )}
      </div>

      {/* Show planet mobile fleet even before a moon exists so the commander sees what can later dock here. */}
      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200">{mt('fleetSplit.planet')}</span>
          <span className="gk-num text-slate-400">
            {mt('fleetSplit.ships', { count: fleetCount(planetMobile) })}
          </span>
        </div>
        <FleetChips fleet={planetMobile} emptyLabel={mt('fleetSplit.emptyPlanet')} />
      </div>
    </div>
  );
}

function ActiveMoonCard({
  planet,
  moon,
  otherMoons,
  scanTargets,
  onHop,
  onJump,
  onScan,
  onRefresh,
  onJumpStarted,
  onScanVisual,
  onWatchTarget,
  now,
}: {
  readonly planet: PlanetView;
  readonly moon: PlanetMoon;
  readonly otherMoons: readonly OtherOwnedMoon[];
  readonly scanTargets: readonly MoonScanTarget[];
  readonly onHop?: MoonPanelProps['onHop'];
  readonly onJump?: MoonPanelProps['onJump'];
  readonly onScan?: MoonPanelProps['onScan'];
  readonly onRefresh?: () => void;
  readonly onJumpStarted?: MoonPanelProps['onJumpStarted'];
  readonly onScanVisual?: MoonPanelProps['onScanVisual'];
  readonly onWatchTarget?: MoonPanelProps['onWatchTarget'];
  readonly now: number;
}) {
  const mt = useMoonT();
  const [hopDir, setHopDir] = useState<'UP' | 'DOWN'>('UP');
  const [hopPick, setHopPick] = useState<Fleet>({});
  const [gatePick, setGatePick] = useState<Fleet>({});
  const [destId, setDestId] = useState<string>(() => otherMoons[0]?.planetId ?? '');
  const [scanTargetId, setScanTargetId] = useState<string>(() => scanTargets[0]?.planetId ?? '');
  const [scanResult, setScanResult] = useState<MoonScanResult | null>(null);
  const [lastScannedTargetId, setLastScannedTargetId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'hop' | 'jump' | 'scan' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const style = RARITY_STYLE[moon.rarity];
  const isClosed = moon.closedUntil !== null && moon.closedUntil.getTime() > now;
  const gateChargingMs = moon.gateReadyAt !== null ? moon.gateReadyAt.getTime() - now : 0;
  const gateReady = !isClosed && gateChargingMs <= 0;

  const planetMobile = useMemo(() => fitMobileFleet(planet.fleet, Number.MAX_SAFE_INTEGER), [planet.fleet]);
  const moonMobile = useMemo(() => fitMobileFleet(moon.fleet, Number.MAX_SAFE_INTEGER), [moon.fleet]);

  const planetShipCount = fleetCount(planetMobile);
  const planetShipBulk = fleetBulk(planetMobile);
  const moonShipCount = fleetCount(moonMobile);

  // Hop source & clamped selection
  const hopSource = hopDir === 'UP' ? planetMobile : moonMobile;
  const hopFleet = useMemo(() => clampSelection(hopPick, hopSource), [hopPick, hopSource]);
  const hopCount = fleetCount(hopFleet);
  const hopBulk = fleetBulk(hopFleet);
  const hopOverDock = hopDir === 'UP' && hopBulk > moon.dockFree;
  const hopSourceCount = fleetCount(hopSource);
  const canHop =
    hopCount > 0 &&
    !hopOverDock &&
    busy === null &&
    Boolean(onHop) &&
    !(hopDir === 'UP' && moon.dockFree <= 0);

  // Gate destination & clamped selection
  const effectiveDestId = otherMoons.some((m) => m.planetId === destId)
    ? destId
    : (otherMoons[0]?.planetId ?? '');
  const destMoon = otherMoons.find((m) => m.planetId === effectiveDestId) ?? null;
  const gateCap = destMoon ? jumpCapacity(moon.rarity, MOON.gateCapacity[destMoon.rarity]) : 0;
  const gateFleet = useMemo(() => clampSelection(gatePick, moonMobile), [gatePick, moonMobile]);
  const gateCount = fleetCount(gateFleet);
  const gateBulk = fleetBulk(gateFleet);
  const gateOverCap = gateCap > 0 && gateBulk > gateCap;
  const destDist = destMoon ? distance(planet.planet.position, destMoon.position) : 0;
  const fuelNeeded = gateCount > 0 && destMoon ? jumpFuel(gateFleet, destDist) : 0;
  const hasFuel = planet.planet.deuterium >= fuelNeeded;
  const canJump =
    gateReady &&
    destMoon !== null &&
    gateCount > 0 &&
    !gateOverCap &&
    hasFuel &&
    busy === null &&
    Boolean(onJump);

  // Scan target
  const effectiveScanId = scanTargets.some((s) => s.planetId === scanTargetId)
    ? scanTargetId
    : (scanTargets[0]?.planetId ?? '');
  const canScan =
    !isClosed &&
    Boolean(effectiveScanId) &&
    planet.planet.deuterium >= MOON.scanCost.deuterium &&
    busy === null &&
    Boolean(onScan);

  const nameByPlanetId = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of scanTargets) map.set(s.planetId, s.name);
    for (const m of otherMoons) map.set(m.planetId, m.name);
    map.set(planet.planet.id, planet.planet.name);
    return map;
  }, [scanTargets, otherMoons, planet.planet.id, planet.planet.name]);

  const setHopHull = (hull: MobileHullId, count: number) => {
    setHopPick((prev) => ({ ...prev, [hull]: count }));
  };

  const setGateHull = (hull: MobileHullId, count: number) => {
    setGatePick((prev) => ({ ...prev, [hull]: count }));
  };

  const handleHop = async () => {
    if (!onHop || !canHop) return;
    setBusy('hop');
    setErr(null);
    try {
      await onHop(planet.planet.id, hopDir, hopFleet);
      setHopPick({});
      playSound('launch');
      onRefresh?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const handleJump = async () => {
    if (!onJump || !canJump) return;
    setBusy('jump');
    setErr(null);
    const jumpingFleet = { ...gateFleet };
    try {
      await onJump(planet.planet.id, destMoon.planetId, jumpingFleet);
      setGatePick({});
      playSound('launch');
      onRefresh?.();
      onJumpStarted?.(planet.planet.id, destMoon.planetId, jumpingFleet);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const handleScan = async () => {
    if (!onScan || !canScan) return;
    setBusy('scan');
    setErr(null);
    try {
      const res = await onScan(planet.planet.id, effectiveScanId);
      setScanResult(res);
      setLastScannedTargetId(effectiveScanId);
      playSound('tap');
      onRefresh?.();
      onScanVisual?.(planet.planet.id, effectiveScanId, res.pierced);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      data-testid="moon-panel-active"
      data-moon-rarity={moon.rarity}
      className="gk flex flex-col gap-3 px-3 pb-6"
    >
      {/* 1. Moon Status & Dock Header */}
      <div className={`rounded-xl border ${style.ring} bg-slate-950/75 p-3.5 flex flex-col gap-3`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span data-testid="moon-rarity" className={`inline-flex items-center gap-1 rounded-md border ${style.ring} ${style.bg} ${style.text} px-2 py-0.5 text-xs font-semibold`}>
              <Glyph id="moon" className="size-3.5" />
              {mt(RARITY_KEY[moon.rarity])}
            </span>
            <span className="text-xs text-slate-400">{mt(ORIGIN_KEY[moon.origin])}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {isClosed ? (
              <span className="rounded bg-rose-500/20 px-2 py-0.5 font-medium text-rose-300">
                {mt('status.closed')} ({formatCountdown(moon.closedUntil!.getTime() - now)})
              </span>
            ) : (
              <span data-testid="moon-cracks" className="text-slate-300 gk-num">
                {mt('status.cracks')}: {moon.cracks}/{moon.crackLimit}
              </span>
            )}
          </div>
        </div>

        <RoomGauge
          label={mt('dock.label')}
          total={moon.dockCapacity}
          home={moon.dockUsed}
          away={0}
          queued={0}
        />

        {/* Active in-transit hops / jumps */}
        {moon.moves.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {moon.moves.map((mv) => (
              <div
                key={mv.id}
                className="flex items-center justify-between rounded-lg border border-sky-400/25 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-200"
              >
                <span>
                  {mv.kind === 'HOP_UP'
                    ? mt('hop.movingUp')
                    : mv.kind === 'HOP_DOWN'
                      ? mt('hop.movingDown')
                      : mt('gate.jumping')}
                  {' · '}
                  <strong className="gk-num">{fleetCount(mv.fleet)}</strong>
                </span>
                <span className="gk-num font-mono font-semibold">
                  {formatCountdown(mv.arriveAt.getTime() - now)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Fleet Split Overview: Planet Hangar vs Moon Dock */}
      <div data-testid="moon-fleet-split" className="rounded-xl border border-white/10 bg-slate-900/70 p-3 flex flex-col gap-2.5">
        <SectionTag as="h3">{mt('fleetSplit.title')}</SectionTag>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div data-testid="moon-split-planet" className="rounded-lg border border-white/10 bg-slate-950/60 p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-200">
                <Glyph id="home" className="size-3.5" />
                {mt('fleetSplit.planet')}
              </span>
              <span className="gk-num text-caption text-slate-300">
                {mt('fleetSplit.ships', { count: planetShipCount })} · {mt('fleetSplit.bulk', { bulk: compact(planetShipBulk) })}
              </span>
            </div>
            <FleetChips fleet={planetMobile} emptyLabel={mt('fleetSplit.emptyPlanet')} />
          </div>

          <div data-testid="moon-split-moon" className={`rounded-lg border ${style.ring} bg-slate-950/60 p-2.5 flex flex-col gap-2`}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 font-semibold ${style.text}`}>
                <Glyph id="moon" className="size-3.5" />
                {mt('fleetSplit.moon')}
              </span>
              <span className="gk-num text-caption text-slate-300">
                {mt('fleetSplit.ships', { count: moonShipCount })} · {mt('fleetSplit.bulk', { bulk: compact(moon.dockUsed) })}
              </span>
            </div>
            <FleetChips fleet={moonMobile} emptyLabel={mt('fleetSplit.emptyMoon')} />
          </div>
        </div>
      </div>

      {/* 3. Planet ↔ Moon Short Hop (90s, free) with Per-Hull Picker */}
      <div data-testid="moon-hop-card" className="rounded-xl border border-white/10 bg-slate-900/70 p-3.5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-white">{mt('hop.title')}</div>
            <div className="text-xs text-slate-400">{mt('hop.subtitle')}</div>
          </div>
          <Choices
            label={mt('hop.title')}
            value={hopDir}
            onChange={(dir) => {
              setHopDir(dir);
              setHopPick({});
            }}
            options={[
              { id: 'UP', label: mt('hop.toMoon') },
              { id: 'DOWN', label: mt('hop.toPlanet') },
            ]}
          />
        </div>

        {hopSourceCount > 0 ? (
          <>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className={`gk-num ${hopOverDock ? 'text-rose-300 font-semibold' : 'text-slate-300'}`}>
                {hopDir === 'UP'
                  ? mt('picker.selectedLimit', { ships: hopCount, bulk: compact(hopBulk), cap: compact(moon.dockFree) })
                  : mt('picker.selected', { ships: hopCount, bulk: compact(hopBulk) })}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="moon-hop-select-all"
                  onClick={() => {
                    setHopPick(
                      hopDir === 'UP'
                        ? fitMobileFleet(hopSource, moon.dockFree)
                        : { ...hopSource },
                    );
                  }}
                  className="rounded-chip border border-sky-400/40 bg-sky-500/15 px-2 py-1 text-caption font-medium text-sky-200 hover:bg-sky-500/25"
                >
                  {mt('picker.selectAll')}
                </button>
                {hopCount > 0 && (
                  <button
                    type="button"
                    data-testid="moon-hop-clear"
                    onClick={() => { setHopPick({}); }}
                    className="rounded-chip border border-white/15 bg-white/5 px-2 py-1 text-caption text-slate-300 hover:bg-white/10"
                  >
                    {mt('picker.clear')}
                  </button>
                )}
              </div>
            </div>

            <HullPickerRows
              available={hopSource}
              selected={hopFleet}
              onChange={setHopHull}
              testPrefix="moon-hop"
            />
          </>
        ) : (
          <p className="rounded-lg border border-white/5 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
            {mt('hop.noShips')}
          </p>
        )}

        <GameButton
          data-testid="moon-hop-submit"
          tone="action"
          size="md"
          wide
          disabledReason={
            !canHop
              ? (hopSourceCount === 0
                ? mt('hop.noShips')
                : hopDir === 'UP' && moon.dockFree <= 0
                  ? mt('hop.dockFull')
                  : hopOverDock
                    ? mt('picker.overDock')
                    : mt('picker.chooseShips'))
              : null
          }
          onPress={() => { void handleHop(); }}
        >
          {hopDir === 'UP' ? mt('hop.submitUp') : mt('hop.submitDown')}{hopCount > 0 ? ` (${hopCount})` : ''}
        </GameButton>
      </div>

      {/* 4. Moon Gate Jump (10s) with Per-Hull Picker */}
      <div data-testid="moon-gate-card" className="rounded-xl border border-white/10 bg-slate-900/70 p-3.5 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <img
            src="/images/premium/moon/moon-gate-v1.webp"
            alt=""
            className="size-12 shrink-0 rounded-lg border border-white/10 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white">{mt('gate.title')}</span>
              <span className={`text-xs font-medium ${gateReady ? 'text-emerald-300' : 'text-amber-300'}`}>
                {isClosed
                  ? mt('status.closed')
                  : gateReady
                    ? mt('status.ready')
                    : `${mt('status.charging')} (${formatCountdown(gateChargingMs)})`}
              </span>
            </div>
            <div className="text-xs text-slate-400">{mt('gate.subtitle')}</div>
          </div>
        </div>

        {otherMoons.length === 0 ? (
          <p className="text-xs text-slate-400">{mt('gate.noOtherMoons')}</p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              <span>{mt('gate.destination')}</span>
              <select
                value={effectiveDestId}
                onChange={(e) => { setDestId(e.target.value); }}
                className="rounded-lg border border-white/15 bg-slate-950 px-2.5 py-2 text-xs text-white"
              >
                {otherMoons.map((m) => {
                  const d = Math.round(distance(planet.planet.position, m.position));
                  return (
                    <option key={m.planetId} value={m.planetId}>
                      {m.name} ({mt(RARITY_KEY[m.rarity])} · {d.toLocaleString()})
                    </option>
                  );
                })}
              </select>
            </label>

            {moonShipCount > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className={`gk-num ${gateOverCap ? 'text-rose-300 font-semibold' : 'text-slate-300'}`}>
                    {mt('picker.selectedLimit', {
                      ships: gateCount,
                      bulk: compact(gateBulk),
                      cap: compact(gateCap),
                    })}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setGatePick(fitMobileFleet(moonMobile, gateCap)); }}
                      className="rounded-chip border border-sky-400/40 bg-sky-500/15 px-2 py-1 text-caption font-medium text-sky-200 hover:bg-sky-500/25"
                    >
                      {mt('picker.fillGate')}
                    </button>
                    {gateCount > 0 && (
                      <button
                        type="button"
                        onClick={() => { setGatePick({}); }}
                        className="rounded-chip border border-white/15 bg-white/5 px-2 py-1 text-caption text-slate-300 hover:bg-white/10"
                      >
                        {mt('picker.clear')}
                      </button>
                    )}
                  </div>
                </div>

                <HullPickerRows
                  available={moonMobile}
                  selected={gateFleet}
                  onChange={setGateHull}
                  testPrefix="moon-gate"
                />

                {gateCount > 0 && (
                  <div className={`text-xs gk-num ${hasFuel ? 'text-sky-200' : 'text-rose-300 font-medium'}`}>
                    {mt('gate.fuel', { fuel: fuelNeeded.toLocaleString() })}
                    {' · '}
                    <span className="text-slate-400">
                      ({Math.floor(planet.planet.deuterium).toLocaleString()} D)
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p className="rounded-lg border border-white/5 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
                {mt('gate.noShips')}
              </p>
            )}

            <GameHold
              weight="spends"
              label={gateCount > 0 ? `${mt('gate.holdLabel')} (${gateCount})` : mt('gate.holdLabel')}
              {...(gateCount > 0 ? { detail: mt('gate.fuel', { fuel: fuelNeeded.toLocaleString() }) } : {})}
              disabledReason={
                !canJump
                  ? (isClosed
                    ? mt('status.closed')
                    : !gateReady
                      ? `${mt('status.charging')} (${formatCountdown(gateChargingMs)})`
                      : moonShipCount === 0
                        ? mt('gate.noShips')
                        : gateOverCap
                          ? mt('picker.overGate')
                          : gateCount === 0
                            ? mt('picker.chooseShips')
                            : !hasFuel
                              ? mt('gate.noFuel')
                              : mt('gate.holdLabel'))
                  : null
              }
              onCommit={() => { void handleJump(); }}
            />
          </>
        )}
      </div>

      {/* 5. Gözcü Route Scanner */}
      <div data-testid="moon-scan-card" className="rounded-xl border border-white/10 bg-slate-900/70 p-3.5 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <img
            src="/images/premium/moon/moon-gozcu-v1.webp"
            alt=""
            className="size-12 shrink-0 rounded-lg border border-white/10 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white">{mt('scan.title')}</span>
              {moon.scanPierces && (
                <span data-testid="moon-pierce-badge" className="rounded-chip bg-amber-400/20 px-1.5 py-0.5 text-caption font-medium text-amber-300">
                  {mt('scan.pierces')}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400">
              {mt('scan.subtitle', { range: moon.scanRange.toLocaleString() })}
            </div>
          </div>
        </div>

        {scanTargets.length === 0 ? (
          <p className="text-xs text-slate-400">{mt('scan.noTargets')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs text-slate-300">
              <span>{mt('scan.target')}</span>
              <select
                value={effectiveScanId}
                onChange={(e) => { setScanTargetId(e.target.value); }}
                className="rounded-lg border border-white/15 bg-slate-950 px-2.5 py-2 text-xs text-white"
              >
                {scanTargets.map((s) => (
                  <option key={s.planetId} value={s.planetId}>
                    {s.name} ({Math.round(s.distance).toLocaleString()})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <GameButton
                  data-testid="moon-scan-btn"
                  size="md"
                  wide
                  disabledReason={
                    !canScan
                      ? (isClosed
                        ? mt('status.closed')
                        : planet.planet.deuterium < MOON.scanCost.deuterium
                          ? mt('gate.noFuel')
                          : mt('scan.noTargets'))
                      : null
                  }
                  onPress={() => { void handleScan(); }}
                >
                  {mt('scan.action')}
                </GameButton>
              </div>
              {lastScannedTargetId && onWatchTarget && (
                <GameButton
                  tone="action"
                  size="md"
                  glyph="eye"
                  onPress={() => { onWatchTarget(lastScannedTargetId); }}
                >
                  {mt('picker.watchOnMap')}
                </GameButton>
              )}
            </div>
          </div>
        )}

        {scanResult && (
          <div data-testid="moon-scan-result" className="rounded-lg border border-sky-400/25 bg-slate-950/75 p-2.5 text-xs flex flex-col gap-1.5">
            {scanResult.rows.length === 0 ? (
              <div className="text-slate-300">{mt('scan.noRoutes')}</div>
            ) : (
              scanResult.rows.map((row, idx) => (
                <div key={`${row.otherPlanetId}-${idx}`} className="flex items-center justify-between gap-2 text-slate-200">
                  <span>
                    <strong className={row.direction === 'IN' ? 'text-rose-300' : 'text-sky-300'}>
                      {row.direction === 'IN' ? mt('scan.dirIn') : mt('scan.dirOut')}
                    </strong>
                    {' · '}
                    <span>{nameByPlanetId.get(row.otherPlanetId) ?? row.otherPlanetId.slice(0, 8)}</span>
                    {' · '}
                    {mt(SIZE_KEY[row.size])}
                  </span>
                  <span className="gk-num font-mono text-slate-300">
                    {formatCountdown(row.arriveAt.getTime() - now)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {err && (
        <div role="alert" className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
          {err}
        </div>
      )}
    </div>
  );
}

export function MoonPanel(props: MoonPanelProps) {
  const now = useNow(1_000);
  if (!props.moonsEnabled) return null;

  if (!props.planet.moon) {
    return (
      <NoMoonCard
        planet={props.planet}
        {...(props.onOrderMoon ? { onOrderMoon: props.onOrderMoon } : {})}
        {...(props.onRefresh ? { onRefresh: props.onRefresh } : {})}
        now={now}
      />
    );
  }

  return (
    <ActiveMoonCard
      planet={props.planet}
      moon={props.planet.moon}
      otherMoons={props.otherMoons}
      scanTargets={props.scanTargets}
      {...(props.onHop ? { onHop: props.onHop } : {})}
      {...(props.onJump ? { onJump: props.onJump } : {})}
      {...(props.onScan ? { onScan: props.onScan } : {})}
      {...(props.onRefresh ? { onRefresh: props.onRefresh } : {})}
      {...(props.onJumpStarted ? { onJumpStarted: props.onJumpStarted } : {})}
      {...(props.onScanVisual ? { onScanVisual: props.onScanVisual } : {})}
      {...(props.onWatchTarget ? { onWatchTarget: props.onWatchTarget } : {})}
      now={now}
    />
  );
}
