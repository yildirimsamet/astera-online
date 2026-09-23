import { useTranslation } from 'react-i18next';
import type { MissionPace } from '@astera/rules';

/**
 * THE FLIGHT-SPEED RUNGS, ONE SHAPE ON EVERY LAUNCH THAT TAKES A PACE. Owner decision, 2026-09-21.
 *
 * The raid sheet had it first; the transfer sheet needs the same control for a different reason —
 * a raid is slowed to land on time, a transfer to stay in the air — so the rungs are shared and the
 * sentence under them is the caller's, because that sentence is the part that says what it buys.
 *
 * Renders nothing when only full speed is legal: a single locked rung is a control that teaches
 * nothing.
 */
export function PaceRow({
  paces,
  pace,
  onChange,
  hint,
  ...data
}: {
  paces: readonly MissionPace[];
  pace: MissionPace;
  onChange: (pace: MissionPace) => void;
  hint: string;
} & Record<`data-${string}`, boolean>) {
  const { t } = useTranslation();
  if (paces.length <= 1) return null;
  return (
    <div {...data} className="grid gap-1 font-v2-ui">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-v2-ink-2">{t('launch.pace')}</span>
        <div role="radiogroup" aria-label={t('launch.pace')} className="flex gap-0.5 rounded-control border border-v2-line bg-v2-panel p-0.5">
          {paces.map((rung) => (
            <button
              key={rung}
              type="button"
              role="radio"
              aria-checked={rung === pace}
              onClick={() => { onChange(rung); }}
              className={`rounded-chip px-2 py-1 font-v2-mono text-micro tabular-nums ${
                rung === pace ? 'bg-v2-raise text-v2-ink ring-1 ring-v2-line-hi' : 'text-v2-ink-3'
              }`}
            >
              {rung === 1 ? t('launch.paceFull') : `${String(Math.round(rung * 100))}%`}
            </button>
          ))}
        </div>
      </div>
      <p className="text-micro leading-snug text-v2-ink-3">{hint}</p>
    </div>
  );
}
