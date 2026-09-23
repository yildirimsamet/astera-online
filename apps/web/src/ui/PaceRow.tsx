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
    <div {...data} className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-dim">{t('launch.pace')}</span>
        <div role="radiogroup" aria-label={t('launch.pace')} className="flex gap-1">
          {paces.map((rung) => (
            <button
              key={rung}
              type="button"
              role="radio"
              aria-checked={rung === pace}
              onClick={() => { onChange(rung); }}
              className={`rounded-cell px-2 py-1 text-micro tabular-nums ${
                rung === pace ? 'bg-accent/20 text-bright' : 'bg-black/20 text-faint'
              }`}
            >
              {rung === 1 ? t('launch.paceFull') : `${String(Math.round(rung * 100))}%`}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-micro text-faint">{hint}</p>
    </div>
  );
}
