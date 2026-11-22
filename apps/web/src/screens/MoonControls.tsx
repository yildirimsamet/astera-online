import { crackLimit, type MoonRarity, type WorldBody } from '@astera/rules';
import type { ProbeMoon } from '../api/schemas.js';
import { useMoonT } from '../i18n/moon.js';
import { playSound } from '../lib/sound.js';

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
    <div className="rounded-plate border border-slate-800 bg-slate-900/60 p-2.5 text-slate-100">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label font-semibold text-slate-300">{t('body.targetLabel')}</span>
        <div className="flex rounded-control border border-slate-700 bg-slate-950 p-0.5 text-micro">
          {(['PLANET', 'MOON'] as const).map((body) => (
            <button
              key={body}
              type="button"
              data-testid={`body-opt-${body}`}
              onClick={() => {
                playSound('tap');
                onChange(body);
              }}
              className={`rounded-chip px-2.5 py-1 font-medium transition ${
                value === body ? 'bg-sky-500/25 text-sky-200' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {body === 'PLANET' ? t('body.PLANET') : t('body.MOON')}
            </button>
          ))}
        </div>
      </div>
      {value === 'MOON' && showAttackHint && (
        <p data-testid="moon-attack-hint" className="mt-1.5 text-micro text-amber-200/90">
          {t('body.attackHint')}
        </p>
      )}
      {value === 'MOON' && !knownRarity && (
        <p data-testid="moon-unknown-rarity" className="mt-1 text-micro text-slate-400">
          {t('body.unknownRarityHint')}
        </p>
      )}
      {value === 'MOON' && knownRarity && (
        <p className="mt-1 text-micro text-sky-300">
          {t(RARITY_KEY[knownRarity])}
        </p>
      )}
    </div>
  );
}

export function OriginBodyPicker({
  value,
  hasMoonShips,
  onChange,
}: {
  readonly value: WorldBody;
  readonly hasMoonShips: boolean;
  readonly onChange: (body: WorldBody) => void;
}) {
  const t = useMoonT();
  if (!hasMoonShips) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-plate border border-slate-800 bg-slate-900/60 p-2 text-slate-100">
      <span className="text-label font-semibold text-slate-300">{t('body.originLabel')}</span>
      <div className="flex rounded-control border border-slate-700 bg-slate-950 p-0.5 text-micro">
        {(['PLANET', 'MOON'] as const).map((body) => (
          <button
            key={body}
            type="button"
            data-testid={`origin-opt-${body}`}
            onClick={() => {
              playSound('tap');
              onChange(body);
            }}
            className={`rounded-chip px-2.5 py-1 font-medium transition ${
              value === body ? 'bg-sky-500/25 text-sky-200' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {body === 'PLANET' ? t('body.PLANET') : t('body.MOON')}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MoonProbeSection({ moon }: { readonly moon: ProbeMoon }) {
  const t = useMoonT();
  return (
    <div
      data-testid="probe-moon-section"
      className="mt-2 rounded-plate border border-slate-700/70 bg-slate-950/70 p-2 text-micro text-slate-200"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sky-300">{t('body.probeSection')}</span>
        <span>
          {t(RARITY_KEY[moon.rarity])} · {t('status.cracks')} {moon.cracks}/{crackLimit(moon.rarity)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-300">
        <span>{t('body.probeFleet', { low: moon.fleetSize.low, high: moon.fleetSize.high })}</span>
        {moon.hopping && (
          <span data-testid="probe-moon-hopping" className="rounded-chip bg-amber-400/20 px-1.5 py-0.5 text-amber-300">
            {t('body.probeHopping')}
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
    <span data-testid="watch-moon-badge" className="text-micro text-slate-300">
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
        playSound('switch');
        onRetarget(missionId, nextBody);
      }}
      className="rounded-control border border-amber-400/50 bg-amber-500/15 px-2.5 py-1 text-micro font-semibold text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-50"
    >
      {nextBody === 'MOON' ? t('body.retargetToMoon') : t('body.retargetToPlanet')}
    </button>
  );
}
