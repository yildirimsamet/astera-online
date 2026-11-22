import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MOBILE_HULLS,
  MOON,
  distance,
  fleetCount,
  hullBulk,
  jumpCapacity,
  jumpFuel,
  type Fleet,
  type MoonRarity,
  type Vec3,
} from '@astera/rules';
import type { PlanetMoon, PlanetView } from '../api/schemas.js';
import { GameButton, GameHold, RoomGauge } from '../game-ui/index.js';
import { hullName } from '../i18n/names.js';
import { playSound } from '../lib/sound.js';

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
    const bulk = hullBulk(hull);
    const take = Math.min(held, Math.floor(left / bulk));
    if (take <= 0) continue;
    out[hull] = take;
    left -= take * bulk;
  }
  return out;
}

function formatRemaining(target: Date | null, nowMs: number): string | null {
  if (!target) return null;
  const sec = Math.ceil((target.getTime() - nowMs) / 1_000);
  if (sec <= 0) return null;
  const h = Math.floor(sec / 3_600);
  const m = Math.floor((sec % 3_600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function MoonPanel({
  planet,
  moonsEnabled,
  otherMoons,
  scanTargets,
  onRefresh,
  onOrderMoon,
  onHop,
  onJump,
  onScan,
}: MoonPanelProps) {
  const { t } = useTranslation('moon');
  const [busy, setBusy] = useState(false);
  const [hopDir, setHopDir] = useState<'UP' | 'DOWN'>('UP');
  const [jumpTargetId, setJumpTargetId] = useState<string>(otherMoons[0]?.planetId ?? '');
  const [scanTargetId, setScanTargetId] = useState<string>(scanTargets[0]?.planetId ?? '');
  const [lastScan, setLastScan] = useState<MoonScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const moon: PlanetMoon | null = planet.moon ?? null;
  const nowMs = Date.now();

  const hasLunarCapture = useMemo(
    () => planet.research.some((r) => r.id === 'LUNAR_CAPTURE' && (r.level ?? 0) > 0),
    [planet.research],
  );
  const moonOrder = useMemo(
    () => planet.queues?.CONSTRUCTION.find((order) => order.kind === 'MOON') ?? null,
    [planet.queues],
  );

  if (!moonsEnabled && !moon) return null;

  const canAffordBuild =
    planet.planet.alloy >= MOON.build.cost.alloy && planet.planet.crystal >= MOON.build.cost.crystal;

  const handleOrderMoon = async () => {
    if (!onOrderMoon) return;
    setBusy(true);
    setError(null);
    try {
      await onOrderMoon(planet.planet.id);
      playSound('confirm');
      onRefresh?.();
    } catch (err) {
      playSound('refuse');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (!moon) {
    const disabledReason = moonOrder
      ? t('build.queued')
      : !hasLunarCapture
        ? t('build.needResearch')
        : !canAffordBuild
          ? t('build.needResources')
          : null;
    return (
      <section className="rounded-xl border border-slate-700/60 bg-slate-950/75 p-3.5 text-slate-100">
        <div className="flex items-start gap-3">
          <img
            src="/images/premium/research/lunar-capture-v1.webp"
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg border border-slate-700/70 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold tracking-wide text-slate-100">
                {t('build.title')}
              </h3>
              <span className="rounded-chip bg-slate-800 px-1.5 py-0.5 text-micro text-slate-300">
                {t('build.duration')}
              </span>
            </div>
            <p className="mt-1 text-xs leading-snug text-slate-400">{t('build.subtitle')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span>{MOON.build.cost.alloy.toLocaleString()} Alloy</span>
              <span className="text-slate-600">·</span>
              <span>{MOON.build.cost.crystal.toLocaleString()} Crystal</span>
            </div>
            {disabledReason && (
              <p className="mt-1.5 text-xs text-amber-300/90">{disabledReason}</p>
            )}
            <div className="mt-3">
              <button
                type="button"
                data-testid="moon-build-btn"
                disabled={busy || disabledReason !== null}
                onClick={() => void handleOrderMoon()}
                className="w-full rounded-lg border border-sky-400/50 bg-sky-500/20 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800/60 disabled:text-slate-500"
              >
                {moonOrder ? t('build.queued') : t('build.action')}
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
          </div>
        </div>
      </section>
    );
  }

  const rarityStyle = RARITY_STYLE[moon.rarity];
  const closedLeft = formatRemaining(moon.closedUntil, nowMs);
  const gateChargeLeft = formatRemaining(moon.gateReadyAt, nowMs);
  const healAt = moon.lastHitAt
    ? new Date(moon.lastHitAt.getTime() + MOON.crackHealHours * 3_600_000)
    : null;
  const healLeft = moon.cracks > 0 ? formatRemaining(healAt, nowMs) : null;

  const hopWing = hopDir === 'UP'
    ? fitMobileFleet(planet.fleet, moon.dockFree)
    : fitMobileFleet(moon.fleet, Number.MAX_SAFE_INTEGER);
  const canHop = fleetCount(hopWing) > 0 && !busy;

  const selectedDest = otherMoons.find((m) => m.planetId === jumpTargetId) ?? otherMoons[0] ?? null;
  const jumpWing = selectedDest
    ? fitMobileFleet(moon.fleet, jumpCapacity(moon.rarity, MOON.gateCapacity[selectedDest.rarity]))
    : {};
  const jumpDist = selectedDest ? distance(planet.planet.position, selectedDest.position) : 0;
  const jumpFuelCost = selectedDest && fleetCount(jumpWing) > 0 ? Math.ceil(jumpFuel(jumpWing, jumpDist)) : 0;
  const gateDisabledReason = !selectedDest
    ? t('gate.noOtherMoons')
    : closedLeft
      ? `${t('status.closed')} (${closedLeft})`
      : gateChargeLeft
        ? `${t('status.charging')} (${gateChargeLeft})`
        : fleetCount(jumpWing) === 0
          ? t('gate.noShips')
          : planet.planet.deuterium < jumpFuelCost
            ? t('gate.noFuel')
            : null;

  const selectedScanTarget = scanTargets.find((s) => s.planetId === scanTargetId) ?? scanTargets[0] ?? null;
  const canScan =
    !busy &&
    !closedLeft &&
    selectedScanTarget !== null &&
    planet.planet.deuterium >= MOON.scanCost.deuterium;

  const handleHop = async () => {
    if (!canHop || !onHop) return;
    setBusy(true);
    setError(null);
    try {
      await onHop(planet.planet.id, hopDir, hopWing);
      playSound('launch');
      onRefresh?.();
    } catch (err) {
      playSound('refuse');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleJump = async () => {
    if (!selectedDest || gateDisabledReason || !onJump) return;
    setBusy(true);
    setError(null);
    try {
      await onJump(planet.planet.id, selectedDest.planetId, jumpWing);
      onRefresh?.();
    } catch (err) {
      playSound('refuse');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleScan = async () => {
    if (!canScan || !onScan) return;
    setBusy(true);
    setError(null);
    try {
      const result = await onScan(planet.planet.id, selectedScanTarget.planetId);
      playSound('confirm');
      setLastScan(result);
      onRefresh?.();
    } catch (err) {
      playSound('refuse');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const standingEntries = (Object.entries(moon.fleet) as [keyof Fleet, number][]).filter(([, n]) => n > 0);

  return (
    <section className={`flex flex-col gap-3 rounded-xl border ${rarityStyle.ring} bg-slate-950/80 p-3.5 text-slate-100`}>
      {/* Header: rarity, origin, cracks, operational status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            data-testid="moon-rarity"
            className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${rarityStyle.ring} ${rarityStyle.bg} ${rarityStyle.text}`}
          >
            {t(RARITY_KEY[moon.rarity])}
          </span>
          <span className="text-xs text-slate-400">{t(ORIGIN_KEY[moon.origin])}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span data-testid="moon-cracks" className={moon.cracks > 0 ? 'font-semibold text-rose-300' : 'text-slate-400'}>
            {t('status.cracks')}: {moon.cracks}/{moon.crackLimit}
          </span>
          {healLeft && <span className="text-micro text-slate-400">({t('status.healsIn', { time: healLeft })})</span>}
        </div>
      </div>

      {/* Dock meter & standing moon fleet */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
        <RoomGauge
          label={t('dock.label')}
          total={moon.dockCapacity}
          home={moon.dockUsed}
          away={0}
          queued={Math.max(0, moon.dockCapacity - moon.dockUsed - moon.dockFree)}
        />
        {standingEntries.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {standingEntries.map(([hull, count]) => (
              <span key={hull} className="rounded-chip bg-slate-800/90 px-2 py-0.5 text-micro text-slate-200">
                {hullName(hull) ?? hull} ×{count}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-xs text-slate-500">{t('dock.empty')}</p>
        )}
        {moon.moves.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 border-t border-slate-800 pt-2">
            {moon.moves.map((move) => (
              <div key={move.id} className="flex items-center justify-between text-xs text-sky-300">
                <span>
                  {move.kind === 'HOP_UP'
                    ? t('hop.movingUp')
                    : move.kind === 'HOP_DOWN'
                      ? t('hop.movingDown')
                      : t('gate.jumping')}
                </span>
                <span>{formatRemaining(move.arriveAt, nowMs) ?? '0s'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Planet ↔ Moon 90s free hop */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-slate-100">{t('hop.title')}</h4>
            <p className="text-micro text-slate-400">{t('hop.subtitle')}</p>
          </div>
          <div className="flex rounded-control border border-slate-700 bg-slate-950 p-0.5 text-micro">
            <button
              type="button"
              onClick={() => { setHopDir('UP'); }}
              className={`rounded-chip px-2 py-1 ${hopDir === 'UP' ? 'bg-sky-500/25 text-sky-200' : 'text-slate-400'}`}
            >
              {t('hop.toMoon')}
            </button>
            <button
              type="button"
              onClick={() => { setHopDir('DOWN'); }}
              className={`rounded-chip px-2 py-1 ${hopDir === 'DOWN' ? 'bg-sky-500/25 text-sky-200' : 'text-slate-400'}`}
            >
              {t('hop.toPlanet')}
            </button>
          </div>
        </div>
        <div className="mt-2.5">
          <GameButton
            wide
            disabledReason={!canHop ? (hopDir === 'UP' && moon.dockFree <= 0 ? t('hop.dockFull') : t('hop.noShips')) : null}
            onPress={() => void handleHop()}
            tone="action"
            size="md"
            marks={{ 'data-testid': 'moon-hop-submit' }}
          >
            {hopDir === 'UP' ? t('hop.submitUp') : t('hop.submitDown')}
          </GameButton>
        </div>
      </div>

      {/* Moon Gate (hold 0.6s) */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
        <div className="flex items-start gap-2.5">
          <img
            src="/images/premium/moon/moon-gate-v1.webp"
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg border border-slate-700/70 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-slate-100">{t('gate.title')}</h4>
              <span className="text-micro text-slate-400">
                {closedLeft
                  ? `${t('status.closed')} (${closedLeft})`
                  : gateChargeLeft
                    ? `${t('status.charging')} (${gateChargeLeft})`
                    : t('status.ready')}
              </span>
            </div>
            <p className="text-micro text-slate-400">{t('gate.subtitle')}</p>
            {otherMoons.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2">
                <select
                  aria-label={t('gate.destination')}
                  value={selectedDest?.planetId ?? ''}
                  onChange={(e) => { setJumpTargetId(e.target.value); }}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
                >
                  {otherMoons.map((m) => (
                    <option key={m.planetId} value={m.planetId}>
                      {m.name} ({t(RARITY_KEY[m.rarity])})
                    </option>
                  ))}
                </select>
                <GameHold
                  label={t('gate.holdLabel')}
                  detail={jumpFuelCost > 0 ? t('gate.fuel', { fuel: jumpFuelCost.toLocaleString() }) : undefined}
                  weight="reversible"
                  commitSound="warp"
                  disabledReason={gateDisabledReason}
                  onCommit={() => void handleJump()}
                />
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">{t('gate.noOtherMoons')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Gözcü Route Scanner */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
        <div className="flex items-start gap-2.5">
          <img
            src="/images/premium/moon/moon-gozcu-v1.webp"
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg border border-slate-700/70 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-slate-100">{t('scan.title')}</h4>
              {moon.scanPierces && (
                <span
                  data-testid="moon-pierce-badge"
                  className="rounded-chip bg-amber-400/20 px-1.5 py-0.5 text-micro font-semibold text-amber-300"
                >
                  {t('scan.pierces')}
                </span>
              )}
            </div>
            <p className="text-micro text-slate-400">
              {t('scan.subtitle', { range: moon.scanRange.toLocaleString() })}
            </p>
            {scanTargets.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2">
                <select
                  aria-label={t('scan.target')}
                  value={selectedScanTarget?.planetId ?? ''}
                  onChange={(e) => { setScanTargetId(e.target.value); }}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
                >
                  {scanTargets.map((target) => (
                    <option key={target.planetId} value={target.planetId}>
                      {target.name} ({Math.round(target.distance)})
                    </option>
                  ))}
                </select>
                <GameButton
                  wide
                  disabledReason={!canScan ? (closedLeft ? t('status.closed') : t('gate.noFuel')) : null}
                  onPress={() => void handleScan()}
                  tone="steel"
                  size="md"
                  marks={{ 'data-testid': 'moon-scan-submit' }}
                >
                  {t('scan.action')}
                </GameButton>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-slate-500">{t('scan.noTargets')}</p>
            )}
            {lastScan && (
              <div className="mt-2 rounded border border-slate-800 bg-slate-950/70 p-2 text-xs">
                {lastScan.rows.length === 0 ? (
                  <p className="text-slate-400">{t('scan.noRoutes')}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {lastScan.rows.map((row, idx) => (
                      <li key={`${row.otherPlanetId}-${idx}`} className="flex items-center justify-between gap-2 text-slate-200">
                        <span>
                          {row.direction === 'IN' ? t('scan.dirIn') : t('scan.dirOut')} · {t(SIZE_KEY[row.size])}
                        </span>
                        <span className="text-slate-400">{row.arriveAt.toLocaleTimeString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}
    </section>
  );
}
