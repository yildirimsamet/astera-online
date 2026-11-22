import { useEffect, useMemo, useState } from 'react';
import {
  MOBILE_HULLS,
  MOON,
  MOON_RARITIES,
  crackLimit,
  distance,
  fleetCount,
  gateCapacity,
  gateChargeMs,
  hullBulk,
  jumpCapacity,
  jumpFuel,
  scanPierces,
  scanRange,
  type Fleet,
  type MobileHullId,
  type MoonRarity,
  type Vec3,
} from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { PlanetMoon, PlanetView } from '../api/schemas.js';
import {
  Banner,
  Choices,
  CostLine,
  Fold,
  GameButton,
  GameHold,
  GameTabs,
  Glyph,
  InfoPeek,
  Picker,
  Plate,
  RoomGauge,
  SectionTag,
  Well,
} from '../game-ui/index.js';
import { hullName } from '../i18n/names.js';
import { useMoonT } from '../i18n/moon.js';
import { compact, full } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { countdown, duration, useNow } from '../lib/time.js';
import { HULL_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { describe } from '../ui/Toast.js';

export interface OtherOwnedMoon {
  readonly planetId: string;
  readonly name: string;
  readonly position: Vec3;
  readonly rarity: MoonRarity;
  /** Authoritative free dock room on the destination moon, when loaded from `/api/planets`. */
  readonly dockFree?: number;
  readonly dockCapacity?: number;
  readonly gateReadyAt?: Date | null;
  readonly closedUntil?: Date | null;
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
  /** Full galaxy world id -> name map so Gözcü routes always resolve to real names. */
  readonly worldNames?: ReadonlyMap<string, string>;
  readonly onRefresh?: () => void;
  readonly onOpenResearch?: () => void;
  readonly onOrderMoon?: (planetId: string) => Promise<unknown>;
  readonly onHop?: (planetId: string, direction: 'UP' | 'DOWN', fleet: Fleet) => Promise<unknown>;
  readonly onJump?: (planetId: string, toPlanetId: string, fleet: Fleet) => Promise<unknown>;
  readonly onScan?: (planetId: string, targetPlanetId: string) => Promise<MoonScanResult>;
  /** Fires after a successful gate jump so the galaxy view can close the sheet and play the private warp VFX. */
  readonly onJumpStarted?: (fromPlanetId: string, toPlanetId: string, fleet: Fleet) => void;
  /** Fires after a successful Gözcü scan so the galaxy view can play the scan VFX and route arcs. */
  readonly onScanVisual?: (
    fromPlanetId: string,
    targetPlanetId: string,
    pierced: boolean,
    routes?: readonly { readonly fromPlanetId: string; readonly toPlanetId: string; readonly cloaked?: boolean | undefined }[],
  ) => void;
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

const CRACK_HEAL_MS = MOON.crackHealHours * 3_600_000;

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

function subtractFleets(from: Fleet, reserved: Fleet): Fleet {
  const out: Fleet = {};
  for (const hull of MOBILE_HULLS) {
    const left = Math.max(0, (from[hull] ?? 0) - (reserved[hull] ?? 0));
    if (left > 0) out[hull] = left;
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

/** Arm a one-shot refresh shortly after the soonest moon timer elapses so counters never stick at 0s. */
function useMoonExpiryWakeup(deadlines: readonly (Date | null | undefined)[], now: number, onRefresh?: () => void) {
  const soonestMs = useMemo(() => {
    let min = Number.POSITIVE_INFINITY;
    for (const d of deadlines) {
      if (!d) continue;
      const ms = d.getTime();
      if (ms > now && ms < min) min = ms;
    }
    return Number.isFinite(min) ? min : null;
  }, [deadlines, now]);

  useEffect(() => {
    if (soonestMs === null || !onRefresh) return;
    const delay = Math.max(250, soonestMs - Date.now() + 400);
    const timer = window.setTimeout(() => {
      onRefresh();
    }, delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [soonestMs, onRefresh]);
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
            className="inline-flex items-center gap-1 rounded-chip border border-white/10 bg-white/[0.04] px-2 py-0.5 text-caption text-slate-100"
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

function RarityComparisonTable({ current }: { readonly current?: MoonRarity }) {
  const mt = useMoonT();
  return (
    <Fold glyph="moon" title={mt('guide.rarityTableTitle')}>
      <div className="overflow-x-auto pt-1">
        <table className="w-full border-collapse text-left text-caption">
          <thead>
            <tr className="border-b border-white/10 text-slate-400">
              <th className="py-1.5 pr-2 font-medium">{mt('guide.colTier')}</th>
              <th className="py-1.5 px-2 font-medium">{mt('guide.colDock')}</th>
              <th className="py-1.5 px-2 font-medium">{mt('guide.colGate')}</th>
              <th className="py-1.5 px-2 font-medium">{mt('guide.colScan')}</th>
              <th className="py-1.5 pl-2 font-medium">{mt('guide.colCracks')}</th>
            </tr>
          </thead>
          <tbody>
            {MOON_RARITIES.map((tier) => {
              const active = tier === current;
              const style = RARITY_STYLE[tier];
              return (
                <tr
                  key={tier}
                  className={`border-b border-white/5 last:border-b-0 ${active ? 'bg-white/[0.06]' : ''}`}
                >
                  <td className={`py-1.5 pr-2 font-semibold ${style.text}`}>
                    {mt(RARITY_KEY[tier])}
                    {scanPierces(tier) && (
                      <span className="ml-1.5 rounded-chip bg-amber-400/20 px-1.5 py-0.5 text-caption text-amber-200">
                        {mt('guide.pierceShort')}
                      </span>
                    )}
                  </td>
                  <td className="gk-num py-1.5 px-2 text-slate-200">{compact(gateCapacity(tier))}</td>
                  <td className="gk-num py-1.5 px-2 text-slate-200">{duration(gateChargeMs(tier) / 60_000)}</td>
                  <td className="gk-num py-1.5 px-2 text-slate-200">{full(scanRange(tier))}</td>
                  <td className="gk-num py-1.5 pl-2 text-slate-200">{crackLimit(tier)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Fold>
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
  onOpenResearch,
  onRefresh,
  now,
}: {
  readonly planet: PlanetView;
  readonly onOrderMoon?: (planetId: string) => Promise<unknown>;
  readonly onOpenResearch?: () => void;
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

  useMoonExpiryWakeup([pendingOrder?.finishesAt], now, onRefresh);

  const handleBuild = async () => {
    if (!onOrderMoon || !canBuild) return;
    setBusy(true);
    setErr(null);
    try {
      await onOrderMoon(planet.planet.id);
      playSound('tap');
      onRefresh?.();
    } catch (e) {
      setErr(describe(e));
    } finally {
      setBusy(false);
    }
  };

  const planetMobile = useMemo(() => fitMobileFleet(planet.fleet, Number.MAX_SAFE_INTEGER), [planet.fleet]);

  return (
    <div data-testid="moon-panel-empty" className="gk flex flex-col gap-3 px-3 pb-4">
      <Plate className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <img
            src="/images/premium/moon/moon-gate-v1.webp"
            alt=""
            className="size-16 shrink-0 rounded-control border border-white/10 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="text-title font-semibold text-white">{mt('build.title')}</div>
            <p className="mt-0.5 text-caption text-slate-300">{mt('build.subtitle')}</p>
            <div className="mt-2">
              <CostLine
                cost={{ alloy: MOON.build.cost.alloy, crystal: MOON.build.cost.crystal }}
                held={{ alloy: planet.planet.alloy, crystal: planet.planet.crystal }}
                time={duration(MOON.build.minutes)}
              />
            </div>
          </div>
        </div>

        {pendingOrder ? (
          <Banner
            tone="info"
            glyph="clock"
            title={mt('build.queued')}
            {...(pendingOrder.finishesAt ? { body: countdown(pendingOrder.finishesAt.getTime() - now) } : {})}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {!hasResearch && (
              <Banner
                tone="warn"
                glyph="lock"
                title={mt('build.needResearch')}
                {...(onOpenResearch ? {
                  action: (
                    <GameButton size="sm" glyph="star" onPress={onOpenResearch}>
                      {mt('guide.openResearch')}
                    </GameButton>
                  ),
                } : {})}
              />
            )}
            {hasResearch && !hasResources && (
              <Banner tone="hostile" title={mt('build.needResources')} />
            )}
            {err && <Banner tone="hostile" role="alert" title={err} />}
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
      </Plate>

      {/* 3 Ways to Acquire a Moon + Rarity Comparison Table (always accessible without leaving the tab) */}
      <Fold glyph="moon" title={mt('guide.waysTitle')} open>
        <ul className="flex flex-col gap-1.5 pt-1 text-caption text-slate-300">
          <li>{mt('guide.wayBuild')}</li>
          <li>{mt('guide.wayBattle')}</li>
          <li>{mt('guide.wayCapture')}</li>
        </ul>
      </Fold>

      <RarityComparisonTable />

      {/* Show planet mobile fleet even before a moon exists so the commander sees what can later dock here. */}
      <Plate className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between text-caption">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-200">
            <Glyph id="home" className="size-3.5 text-sky-300" />
            {mt('fleetSplit.planet')}
          </span>
          <span className="gk-num text-slate-400">
            {mt('fleetSplit.ships', { count: fleetCount(planetMobile) })}
          </span>
        </div>
        <FleetChips fleet={planetMobile} emptyLabel={mt('fleetSplit.emptyPlanet')} />
      </Plate>
    </div>
  );
}

function ActiveMoonCard({
  planet,
  moon,
  otherMoons,
  scanTargets,
  worldNames,
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
  readonly worldNames?: ReadonlyMap<string, string>;
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
  const [subTab, setSubTab] = useState<'dock' | 'gate' | 'scan'>('dock');
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
  const crackHealMs = moon.cracks > 0 && moon.lastHitAt
    ? Math.max(0, moon.lastHitAt.getTime() + CRACK_HEAL_MS - now)
    : 0;

  // Automatically wake up and refresh when any active move, gate charge, or closure expires.
  const deadlines = useMemo(
    () => [
      moon.gateReadyAt,
      moon.closedUntil,
      ...moon.moves.map((m) => m.arriveAt),
      ...otherMoons.flatMap((m) => [m.gateReadyAt, m.closedUntil]),
    ],
    [moon.gateReadyAt, moon.closedUntil, moon.moves, otherMoons],
  );
  useMoonExpiryWakeup(deadlines, now, onRefresh);

  // Ships reserved by a pending 10s Gate JUMP cannot be hopped or jumped again (§4.1).
  const reservedJumpFleet = useMemo(() => {
    const out: Fleet = {};
    for (const mv of moon.moves) {
      if (mv.kind !== 'JUMP' || mv.fromPlanetId !== planet.planet.id) continue;
      for (const hull of MOBILE_HULLS) {
        const n = mv.fleet[hull] ?? 0;
        if (n > 0) out[hull] = (out[hull] ?? 0) + n;
      }
    }
    return out;
  }, [moon.moves, planet.planet.id]);

  const planetMobile = useMemo(() => fitMobileFleet(planet.fleet, Number.MAX_SAFE_INTEGER), [planet.fleet]);
  const moonAllMobile = useMemo(() => fitMobileFleet(moon.fleet, Number.MAX_SAFE_INTEGER), [moon.fleet]);
  const moonMobile = useMemo(() => subtractFleets(moonAllMobile, reservedJumpFleet), [moonAllMobile, reservedJumpFleet]);

  const planetShipCount = fleetCount(planetMobile);
  const planetShipBulk = fleetBulk(planetMobile);
  const moonShipCount = fleetCount(moonMobile);

  // Hop source & clamped selection
  const hopPendingKind = hopDir === 'UP' ? 'HOP_UP' : 'HOP_DOWN';
  const hopAlreadyMoving = moon.moves.some(
    (mv) => mv.kind === hopPendingKind && mv.fromPlanetId === planet.planet.id && mv.arriveAt.getTime() > now,
  );
  const hopSource = hopDir === 'UP' ? planetMobile : moonMobile;
  const hopFleet = useMemo(() => clampSelection(hopPick, hopSource), [hopPick, hopSource]);
  const hopCount = fleetCount(hopFleet);
  const hopBulk = fleetBulk(hopFleet);
  const hopOverDock = hopDir === 'UP' && hopBulk > moon.dockFree;
  const hopSourceCount = fleetCount(hopSource);
  const canHop =
    !hopAlreadyMoving &&
    hopCount > 0 &&
    !hopOverDock &&
    busy === null &&
    Boolean(onHop) &&
    !(hopDir === 'UP' && moon.dockFree <= 0);

  // Gate destination & clamped selection (authoritative dockFree & gate status)
  const effectiveDestId = otherMoons.some((m) => m.planetId === destId)
    ? destId
    : (otherMoons[0]?.planetId ?? '');
  const destMoon = otherMoons.find((m) => m.planetId === effectiveDestId) ?? null;
  const destClosedMs = destMoon?.closedUntil ? Math.max(0, destMoon.closedUntil.getTime() - now) : 0;
  const destChargingMs = destMoon?.gateReadyAt ? Math.max(0, destMoon.gateReadyAt.getTime() - now) : 0;
  const destReady = destMoon !== null && destClosedMs <= 0 && destChargingMs <= 0;
  const destDockFree = destMoon ? (destMoon.dockFree ?? MOON.gateCapacity[destMoon.rarity]) : 0;
  const gateCap = destMoon ? jumpCapacity(moon.rarity, destDockFree) : 0;
  const gateFleet = useMemo(() => clampSelection(gatePick, moonMobile), [gatePick, moonMobile]);
  const gateCount = fleetCount(gateFleet);
  const gateBulk = fleetBulk(gateFleet);
  const gateOverCap = gateCap > 0 ? gateBulk > gateCap : gateBulk > 0;
  const destDist = destMoon ? distance(planet.planet.position, destMoon.position) : 0;
  const fuelNeeded = gateCount > 0 && destMoon ? jumpFuel(gateFleet, destDist) : 0;
  const hasFuel = planet.planet.deuterium >= fuelNeeded;
  const canJump =
    gateReady &&
    destReady &&
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
    const map = new Map<string, string>(worldNames);
    for (const s of scanTargets) if (!map.has(s.planetId)) map.set(s.planetId, s.name);
    for (const m of otherMoons) if (!map.has(m.planetId)) map.set(m.planetId, m.name);
    map.set(planet.planet.id, planet.planet.name);
    return map;
  }, [worldNames, scanTargets, otherMoons, planet.planet.id, planet.planet.name]);

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
      setErr(describe(e));
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
      setErr(describe(e));
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
      playSound('arc');
      onRefresh?.();
      onScanVisual?.(
        planet.planet.id,
        effectiveScanId,
        res.pierced,
        res.rows.map((r) => ({
          fromPlanetId: r.direction === 'IN' ? r.otherPlanetId : effectiveScanId,
          toPlanetId: r.direction === 'IN' ? effectiveScanId : r.otherPlanetId,
          cloaked: res.pierced,
        })),
      );
    } catch (e) {
      setErr(describe(e));
    } finally {
      setBusy(null);
    }
  };

  const destOptions = useMemo(() => otherMoons.map((m) => {
    const d = Math.round(distance(planet.planet.position, m.position));
    const free = m.dockFree ?? MOON.gateCapacity[m.rarity];
    const mClosed = m.closedUntil && m.closedUntil.getTime() > now ? m.closedUntil.getTime() - now : 0;
    const mCharging = m.gateReadyAt && m.gateReadyAt.getTime() > now ? m.gateReadyAt.getTime() - now : 0;
    const statusSub = mClosed > 0
      ? mt('gate.destClosed', { time: countdown(mClosed) })
      : mCharging > 0
        ? mt('gate.destCharging', { time: countdown(mCharging) })
        : mt('gate.destDockFree', { free: compact(free) });
    return {
      id: m.planetId,
      label: `${m.name} (${mt(RARITY_KEY[m.rarity])})`,
      sub: `${full(d)} · ${statusSub}`,
    };
  }), [otherMoons, planet.planet.position, now, mt]);

  const scanOptions = useMemo(() => scanTargets.map((s) => ({
    id: s.planetId,
    label: s.name,
    sub: full(Math.round(s.distance)),
  })), [scanTargets]);

  return (
    <div
      data-testid="moon-panel-active"
      data-moon-rarity={moon.rarity}
      className="gk flex flex-col gap-3 px-3 pb-6"
    >
      {/* 1. Compact Moon Status & Dock Header */}
      <Plate className="flex flex-col gap-3 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span data-testid="moon-rarity" className={`inline-flex items-center gap-1 rounded-chip border ${style.ring} ${style.bg} ${style.text} px-2 py-0.5 text-caption font-semibold`}>
              <Glyph id="moon" className="size-3.5" />
              {mt(RARITY_KEY[moon.rarity])}
            </span>
            <span className="text-caption text-slate-400">{mt(ORIGIN_KEY[moon.origin])}</span>
            {moon.scanPierces && (
              <span data-testid="moon-pierce-badge" className="rounded-chip bg-amber-400/15 px-1.5 py-0.5 text-caption font-medium text-amber-300">
                {mt('scan.pierces')}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-caption">
            <span data-testid="moon-cracks" className="text-slate-300 gk-num">
              {mt('status.cracks')}: {moon.cracks}/{moon.crackLimit}
            </span>
            {crackHealMs > 0 && (
              <span className="gk-num text-slate-400">
                ({mt('status.healsIn', { time: countdown(crackHealMs) })})
              </span>
            )}
            {isClosed && (
              <span className="rounded-chip bg-rose-500/20 px-2 py-0.5 font-medium text-rose-300 gk-num">
                {mt('status.closed')} ({countdown(moon.closedUntil!.getTime() - now)})
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

        <InfoPeek
          about={mt('guide.howItWorks')}
          lead={<Glyph id="moon" />}
          fact={<span className="text-caption text-slate-200">{mt('guide.howItWorks')}</span>}
          rule={<p className="gk-sub">{mt('guide.headerRule')}</p>}
        />

        {/* Active in-transit hops / jumps */}
        {moon.moves.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {moon.moves.map((mv) => (
              <Well
                key={mv.id}
                className="flex items-center justify-between px-2.5 py-1.5 text-caption text-sky-200"
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
                  {countdown(mv.arriveAt.getTime() - now)}
                </span>
              </Well>
            ))}
          </div>
        )}
      </Plate>

      {/* Collapsible 4-tier rarity comparison table */}
      <RarityComparisonTable current={moon.rarity} />

      {/* 2. Sub-Tab Navigation (Dock | Moon Gate | Gözcü) — matches PlanetScreen's stacked GameTabs */}
      <GameTabs
        stacked
        label={mt('tabs.label')}
        value={subTab}
        onChange={setSubTab}
        tabs={[
          { id: 'dock', label: mt('tabs.dock'), glyph: { id: 'bay' } },
          {
            id: 'gate',
            label: mt('tabs.gate'),
            glyph: { id: 'speed_up' },
            ...(!gateReady ? { mark: { glyph: 'clock' as const, hint: isClosed ? mt('status.closed') : mt('status.charging') } } : {}),
          },
          { id: 'scan', label: mt('tabs.scan'), glyph: { id: 'eye' } },
        ]}
      />

      {/* TAB 1: DOCK & PLANET <-> MOON TRANSFER */}
      {subTab === 'dock' && (
        <div data-testid="moon-tab-dock" className="flex flex-col gap-3">
          {/* Fleet Split Overview: equal neutral wells so neither card feels "selected" */}
          <Plate className="flex flex-col gap-2.5 p-3">
            <div data-testid="moon-fleet-split" className="flex flex-col gap-2.5">
              <SectionTag as="h3">{mt('fleetSplit.title')}</SectionTag>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Well className="flex flex-col gap-2 p-2.5">
                  <div data-testid="moon-split-planet" className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 text-caption">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-100">
                        <Glyph id="home" className="size-3.5 text-sky-300" />
                        {mt('fleetSplit.planet')}
                      </span>
                      <span className="gk-num text-slate-300">
                        {mt('fleetSplit.ships', { count: planetShipCount })} · {mt('fleetSplit.bulk', { bulk: compact(planetShipBulk) })}
                      </span>
                    </div>
                    <FleetChips fleet={planetMobile} emptyLabel={mt('fleetSplit.emptyPlanet')} />
                  </div>
                </Well>

                <Well className="flex flex-col gap-2 p-2.5">
                  <div data-testid="moon-split-moon" className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 text-caption">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-100">
                        <Glyph id="moon" className="size-3.5 text-amber-300" />
                        {mt('fleetSplit.moon')}
                      </span>
                      <span className="gk-num text-slate-300">
                        {mt('fleetSplit.ships', { count: moonShipCount })} · {mt('fleetSplit.bulk', { bulk: compact(moon.dockUsed) })}
                      </span>
                    </div>
                    <FleetChips fleet={moonMobile} emptyLabel={mt('fleetSplit.emptyMoon')} />
                  </div>
                </Well>
              </div>
            </div>
          </Plate>

          {/* Planet ↔ Moon Short Hop (90s, free) with Per-Hull Picker */}
          <Plate className="flex flex-col gap-3 p-3.5">
            <div data-testid="moon-hop-card" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-body font-semibold text-white">{mt('hop.title')}</div>
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

              <InfoPeek
                about={mt('guide.howItWorks')}
                lead={<Glyph id="bay" />}
                fact={<span className="text-caption text-slate-300">{mt('hop.subtitle')}</span>}
                rule={<p className="gk-sub">{mt('guide.dockRule')}</p>}
              />

              {hopSourceCount > 0 ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-caption">
                    <span className={`gk-num ${hopOverDock ? 'text-rose-300 font-semibold' : 'text-slate-300'}`}>
                      {hopDir === 'UP'
                        ? mt('picker.selectedLimit', { ships: hopCount, bulk: compact(hopBulk), cap: compact(moon.dockFree) })
                        : mt('picker.selected', { ships: hopCount, bulk: compact(hopBulk) })}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        {...OWN_SOUND}
                        data-testid="moon-hop-select-all"
                        onClick={() => {
                          playSound('tap');
                          haptic('tap');
                          setHopPick(
                            hopDir === 'UP'
                              ? fitMobileFleet(hopSource, moon.dockFree)
                              : { ...hopSource },
                          );
                        }}
                        className="gk-hit"
                      >
                        <span className="gk-chip" data-on="">{mt('picker.selectAll')}</span>
                      </button>
                      {hopCount > 0 && (
                        <button
                          type="button"
                          {...OWN_SOUND}
                          data-testid="moon-hop-clear"
                          onClick={() => {
                            playSound('tap');
                            haptic('tap');
                            setHopPick({});
                          }}
                          className="gk-hit"
                        >
                          <span className="gk-chip">{mt('picker.clear')}</span>
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
                <Well className="px-3 py-2 text-caption text-slate-400">
                  {mt('hop.noShips')}
                </Well>
              )}

              <GameButton
                data-testid="moon-hop-submit"
                tone="action"
                size="md"
                wide
                disabledReason={
                  !canHop
                    ? (hopAlreadyMoving
                      ? mt('hop.alreadyMoving')
                      : hopSourceCount === 0
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
          </Plate>
        </div>
      )}

      {/* TAB 2: MOON GATE JUMP (10s) */}
      {subTab === 'gate' && (
        <Plate className="flex flex-col gap-3 p-3.5">
          <div data-testid="moon-gate-card" className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <img
                src="/images/premium/moon/moon-gate-v1.webp"
                alt=""
                className="size-12 shrink-0 rounded-control border border-white/10 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body font-semibold text-white">{mt('gate.title')}</span>
                  <span className={`gk-num text-caption font-medium ${gateReady ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {isClosed
                      ? mt('status.closed')
                      : gateReady
                        ? mt('status.ready')
                        : `${mt('status.charging')} (${countdown(gateChargingMs)})`}
                  </span>
                </div>
              </div>
            </div>

            <InfoPeek
              about={mt('guide.howItWorks')}
              lead={<Glyph id="speed_up" />}
              fact={<span className="text-caption text-slate-300">{mt('gate.subtitle')}</span>}
              rule={<p className="gk-sub">{mt('guide.gateRule')}</p>}
            />

            {otherMoons.length === 0 ? (
              <Banner tone="info" glyph="moon" title={mt('gate.noOtherMoons')} />
            ) : (
              <>
                <Picker
                  label={mt('gate.destination')}
                  value={effectiveDestId}
                  options={destOptions}
                  onChange={(id) => { setDestId(id); }}
                />

                {destClosedMs > 0 && (
                  <Banner tone="warn" title={mt('gate.destClosed', { time: countdown(destClosedMs) })} />
                )}
                {destClosedMs <= 0 && destChargingMs > 0 && (
                  <Banner tone="warn" glyph="clock" title={mt('gate.destCharging', { time: countdown(destChargingMs) })} />
                )}

                {moonShipCount > 0 ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-caption">
                      <span className={`gk-num ${gateOverCap ? 'text-rose-300 font-semibold' : 'text-slate-300'}`}>
                        {mt('picker.selectedLimit', {
                          ships: gateCount,
                          bulk: compact(gateBulk),
                          cap: compact(gateCap),
                        })}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          {...OWN_SOUND}
                          data-testid="moon-gate-fill"
                          onClick={() => {
                            playSound('tap');
                            haptic('tap');
                            setGatePick(fitMobileFleet(moonMobile, gateCap));
                          }}
                          className="gk-hit"
                        >
                          <span className="gk-chip" data-on="">{mt('picker.fillGate')}</span>
                        </button>
                        {gateCount > 0 && (
                          <button
                            type="button"
                            {...OWN_SOUND}
                            onClick={() => {
                              playSound('tap');
                              haptic('tap');
                              setGatePick({});
                            }}
                            className="gk-hit"
                          >
                            <span className="gk-chip">{mt('picker.clear')}</span>
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
                      <div className={`text-caption gk-num ${hasFuel ? 'text-sky-200' : 'text-rose-300 font-medium'}`}>
                        {mt('gate.fuel', { fuel: full(Math.ceil(fuelNeeded)) })}
                        {' · '}
                        <span className="text-slate-400">
                          ({full(Math.floor(planet.planet.deuterium))} D)
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <Well className="px-3 py-2 text-caption text-slate-400">
                    {mt('gate.noShips')}
                  </Well>
                )}

                <GameHold
                  weight="spends"
                  label={gateCount > 0 ? `${mt('gate.holdLabel')} (${gateCount})` : mt('gate.holdLabel')}
                  {...(gateCount > 0 ? { detail: mt('gate.fuel', { fuel: full(Math.ceil(fuelNeeded)) }) } : {})}
                  disabledReason={
                    !canJump
                      ? (isClosed
                        ? mt('status.closed')
                        : !gateReady
                          ? `${mt('status.charging')} (${countdown(gateChargingMs)})`
                          : destClosedMs > 0
                            ? mt('gate.destClosed', { time: countdown(destClosedMs) })
                            : destChargingMs > 0
                              ? mt('gate.destCharging', { time: countdown(destChargingMs) })
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
        </Plate>
      )}

      {/* TAB 3: GÖZCÜ ROUTE SCANNER */}
      {subTab === 'scan' && (
        <Plate className="flex flex-col gap-3 p-3.5">
          <div data-testid="moon-scan-card" className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <img
                src="/images/premium/moon/moon-gozcu-v1.webp"
                alt=""
                className="size-12 shrink-0 rounded-control border border-white/10 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-body font-semibold text-white">{mt('scan.title')}</span>
                  {moon.scanPierces && (
                    <span className="rounded-chip bg-amber-400/20 px-1.5 py-0.5 text-caption font-medium text-amber-300">
                      {mt('scan.pierces')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <InfoPeek
              about={mt('guide.howItWorks')}
              lead={<Glyph id="eye" />}
              fact={<span className="text-caption text-slate-300">{mt('scan.subtitle', { range: full(moon.scanRange) })}</span>}
              rule={<p className="gk-sub">{mt('guide.scanRule')}</p>}
            />

            {scanTargets.length === 0 ? (
              <Banner tone="info" title={mt('scan.noTargets')} />
            ) : (
              <div className="flex flex-col gap-2">
                <Picker
                  label={mt('scan.target')}
                  value={effectiveScanId}
                  options={scanOptions}
                  onChange={(id) => { setScanTargetId(id); }}
                />
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
              <Well className="p-2.5 text-caption">
                <div data-testid="moon-scan-result" className="flex flex-col gap-1.5">
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
                          {countdown(row.arriveAt.getTime() - now)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </Well>
            )}
          </div>
        </Plate>
      )}

      {err && <Banner tone="hostile" role="alert" title={err} />}
    </div>
  );
}

export function MoonPanel(props: MoonPanelProps) {
  const now = useNow(1_000);
  if (!props.moonsEnabled) return null;

  if (!props.planet.moon) {
    return (
      <NoMoonCard
        key={props.planet.planet.id}
        planet={props.planet}
        {...(props.onOrderMoon ? { onOrderMoon: props.onOrderMoon } : {})}
        {...(props.onOpenResearch ? { onOpenResearch: props.onOpenResearch } : {})}
        {...(props.onRefresh ? { onRefresh: props.onRefresh } : {})}
        now={now}
      />
    );
  }

  return (
    <ActiveMoonCard
      key={props.planet.planet.id}
      planet={props.planet}
      moon={props.planet.moon}
      otherMoons={props.otherMoons}
      scanTargets={props.scanTargets}
      {...(props.worldNames ? { worldNames: props.worldNames } : {})}
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
