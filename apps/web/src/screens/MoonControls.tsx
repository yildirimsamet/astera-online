import { crackLimit, type MoonRarity, type WorldBody } from '@astera/rules';
import type { ProbeMoon } from '../api/schemas.js';
import { Glyph } from '../game-ui/index.js';
import { useMoonT } from '../i18n/moon.js';
import { serverNow } from '../lib/clock.js';
import { playSound } from '../lib/sound.js';
import { countdown } from '../lib/time.js';

const RARITY_KEY = {
  COMMON: 'rarity.COMMON',
  RARE: 'rarity.RARE',
  EPIC: 'rarity.EPIC',
  LEGENDARY: 'rarity.LEGENDARY',
} as const;

const WATCH_MOON_KEY = {
  HOME: 'body.watchMoon.HOME',
  EMPTY: 'body.watchMoon.EMPTY',
  HOP: 'body.watchMoon.HOP',
  NONE: 'body.watchMoon.NONE',
  UNKNOWN: 'body.watchMoon.UNKNOWN',
} as const;

function BodySegment({
  value,
  onChange,
  testPrefix,
  planetCount,
  moonCount,
  moonBadge,
}: {
  readonly value: WorldBody;
  readonly onChange: (body: WorldBody) => void;
  readonly testPrefix: 'origin-opt' | 'body-opt';
  readonly planetCount?: number | undefined;
  readonly moonCount?: number | undefined;
  readonly moonBadge?: string | undefined;
}) {
  const t = useMoonT();
  return (
    <div
      role="radiogroup"
      className="grid grid-cols-2 gap-1 rounded-control border border-white/10 bg-slate-950/85 p-0.5"
    >
      {(['PLANET', 'MOON'] as const).map((body) => {
        const active = value === body;
        const count = body === 'PLANET' ? planetCount : moonCount;
        return (
          <button
            key={body}
            type="button"
            role="radio"
            aria-checked={active}
            data-testid={`${testPrefix}-${body}`}
            onClick={() => {
              if (!active) {
                playSound('tap');
                onChange(body);
              }
            }}
            className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-chip px-2.5 py-1.5 text-caption font-semibold transition ${
              active
                ? body === 'MOON'
                  ? 'border border-amber-400/50 bg-amber-400/15 text-amber-200 shadow-sm'
                  : 'border border-sky-400/50 bg-sky-400/15 text-sky-200 shadow-sm'
                : 'border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            <Glyph id={body === 'PLANET' ? 'home' : 'moon'} className="size-3.5 shrink-0" />
            <span>{body === 'PLANET' ? t('body.PLANET') : t('body.MOON')}</span>
            {count !== undefined && (
              <span className="gk-num text-caption opacity-80">({count})</span>
            )}
            {body === 'MOON' && moonBadge && count === undefined && (
              <span className="text-caption opacity-80">· {moonBadge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TargetBodyPicker({
  value,
  hasMoon,
  knownRarity,
  onChange,
  showAttackHint = true,
}: {
  readonly value: WorldBody;
  readonly hasMoon: boolean;
  readonly knownRarity?: MoonRarity | undefined;
  readonly onChange: (body: WorldBody) => void;
  readonly showAttackHint?: boolean;
}) {
  const t = useMoonT();
  if (!hasMoon) return null;
  return (
    <div data-testid="target-body-picker" className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="gk-label">{t('body.targetLabel')}</span>
        {value === 'MOON' && !knownRarity && (
          <span data-testid="moon-unknown-rarity" className="text-caption text-slate-400">
            {t('body.unknownRarityHint')}
          </span>
        )}
      </div>
      <BodySegment
        value={value}
        onChange={onChange}
        testPrefix="body-opt"
        moonBadge={knownRarity ? t(RARITY_KEY[knownRarity]) : undefined}
      />
      {value === 'MOON' && showAttackHint && (
        <p data-testid="moon-attack-hint" className="gk-inote" data-tone="warn">
          <Glyph id="moon" />
          {t('body.attackHint')}
        </p>
      )}
    </div>
  );
}

export function OriginBodyPicker({
  value,
  hasMoonShips,
  planetCount,
  moonCount,
  onChange,
}: {
  readonly value: WorldBody;
  readonly hasMoonShips: boolean;
  readonly planetCount?: number | undefined;
  readonly moonCount?: number | undefined;
  readonly onChange: (body: WorldBody) => void;
}) {
  const t = useMoonT();
  if (!hasMoonShips) return null;
  return (
    <div data-testid="origin-body-picker" className="flex flex-col gap-1.5">
      <span className="gk-label">{t('body.originLabel')}</span>
      <BodySegment
        value={value}
        onChange={onChange}
        testPrefix="origin-opt"
        planetCount={planetCount}
        moonCount={moonCount}
      />
    </div>
  );
}

export function MoonProbeSection({ moon }: { readonly moon: ProbeMoon }) {
  const t = useMoonT();
  const now = serverNow();
  const closedMs = moon.closedUntil ? moon.closedUntil.getTime() - now : 0;
  const gateMs = moon.gateReadyAt ? moon.gateReadyAt.getTime() - now : 0;
  return (
    <div
      data-testid="probe-moon-section"
      className="gk-well mt-2 flex flex-col gap-1.5 text-caption text-slate-200"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-sky-300">
          <Glyph id="moon" className="size-3.5 shrink-0" />
          {t('body.probeSection')}
        </span>
        <span className="gk-num text-slate-300">
          {t(RARITY_KEY[moon.rarity])} · {t('status.cracks')} {Math.max(0, crackLimit(moon.rarity) - moon.cracks)}/{crackLimit(moon.rarity)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-slate-300">
        <span>{t('body.probeFleet', { low: moon.fleetSize.low, high: moon.fleetSize.high })}</span>
        {moon.hopping && (
          <span data-testid="probe-moon-hopping" className="rounded-chip bg-amber-400/20 px-1.5 py-0.5 text-amber-300">
            {t('body.probeHopping')}
          </span>
        )}
        {closedMs > 0 ? (
          <span className="rounded-chip bg-rose-500/20 px-1.5 py-0.5 text-rose-200 gk-num">
            {t('body.probeClosed', { time: countdown(closedMs) })}
          </span>
        ) : gateMs > 0 ? (
          <span className="rounded-chip bg-amber-400/15 px-1.5 py-0.5 text-amber-200 gk-num">
            {t('body.probeGateCharging', { time: countdown(gateMs) })}
          </span>
        ) : (
          <span className="rounded-chip bg-emerald-400/15 px-1.5 py-0.5 text-emerald-200">
            {t('body.probeGateReady')}
          </span>
        )}
      </div>
    </div>
  );
}

export function WatchMoonBadge({ status }: { readonly status: 'HOME' | 'EMPTY' | 'HOP' | 'NONE' | 'UNKNOWN' }) {
  const t = useMoonT();
  if (status === 'NONE') return null;
  return (
    <span data-testid="watch-moon-badge" className="text-caption text-slate-300">
      {t(WATCH_MOON_KEY[status])}
    </span>
  );
}

export function RetargetButton({
  missionId,
  currentBody,
  disabled = false,
  onRetarget,
}: {
  readonly missionId: string;
  readonly currentBody: WorldBody;
  readonly disabled?: boolean;
  readonly onRetarget: (missionId: string, body: WorldBody) => void;
}) {
  const t = useMoonT();
  const nextBody: WorldBody = currentBody === 'PLANET' ? 'MOON' : 'PLANET';
  return (
    <button
      type="button"
      data-testid="retarget-body-btn"
      disabled={disabled}
      onClick={() => {
        playSound('tap');
        onRetarget(missionId, nextBody);
      }}
      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-control border border-sky-400/40 bg-sky-500/15 px-3 py-1.5 text-caption font-semibold text-sky-200 transition hover:bg-sky-500/25 disabled:opacity-40"
    >
      <Glyph id={nextBody === 'MOON' ? 'moon' : 'home'} className="size-3.5 shrink-0" />
      {nextBody === 'MOON' ? t('body.retargetToMoon') : t('body.retargetToPlanet')}
    </button>
  );
}
