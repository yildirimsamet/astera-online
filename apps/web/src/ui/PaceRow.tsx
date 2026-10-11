import { useTranslation } from 'react-i18next';
import type { MissionPace } from '@astera/rules';
import { full } from '../lib/format.js';
import { durationPrecise } from '../lib/time.js';

/**
 * THE FLIGHT-SPEED RUNGS, ONE SHAPE ON EVERY LAUNCH THAT TAKES A PACE. Owner decision, 2026-09-21.
 *
 * The raid sheet had it first; the transfer sheet needs the same control for a different reason —
 * a raid is slowed to land on time, a transfer to stay in the air — so the rungs are shared and the
 * sentence under them is the caller's, because that sentence is the part that says what it buys.
 *
 * A single legal speed hides the control, except when explaining why a previous
 * slower selection now falls back to full speed.
 */
export function PaceRow({
  paces,
  pace,
  onChange,
  hint,
  brief,
  comparison,
  reset = false,
  ...data
}: {
  paces: readonly MissionPace[];
  pace: MissionPace;
  onChange: (pace: MissionPace) => void;
  /** The rule in a sentence, under the row. */
  hint?: string;
  /** The rule in a phrase, under the label beside the control. */
  brief?: string;
  /** Personal flights opt in; prepaid clan strikes must not promise these savings. */
  comparison?: { fuel: number; fullFuel: number; minutes: number; fullMinutes: number };
  reset?: boolean;
} & Record<`data-${string}`, boolean>) {
  const { t } = useTranslation();
  if (paces.length <= 1 && !reset) return null;
  const saving = comparison ? Math.max(0, comparison.fullFuel - comparison.fuel) : 0;
  return (
    <div {...data} className="grid gap-1 font-v2-ui">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="text-caption text-v2-ink-2">{t('launch.pace')}</span>
          {brief && <span className="text-micro leading-snug text-v2-ink-3">{brief}</span>}
        </span>
        {paces.length > 1 && <div role="radiogroup" aria-label={t('launch.pace')} className="flex shrink-0 gap-0.5 rounded-control border border-v2-line bg-v2-panel p-0.5">
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
        </div>}
      </div>
      {reset && <p data-pace-reset role="status" className="text-micro leading-snug text-v2-warn">{t('launch.paceReset')}</p>}
      {comparison && (
        <div data-pace-comparison aria-live="polite" aria-atomic="true" className="mt-1 rounded-control border border-v2-line bg-v2-panel px-2.5 py-2">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div className="min-w-0">
              <dt className="text-micro text-v2-ink-3">{t('launch.fuel')}</dt>
              <dd data-pace-fuel className="font-v2-mono text-caption tabular-nums text-v2-ink">{t('launch.paceFuelValue', { amount: full(comparison.fuel) })}</dd>
              <dd data-pace-saving className="mt-1 text-micro leading-snug">
                <span className="block text-v2-ink-3">{t('launch.paceFuelBaseline', { amount: full(comparison.fullFuel) })}</span>
                <span className={`block ${saving > 0 ? 'text-v2-self' : 'text-v2-ink-2'}`}>{t('launch.paceSaved', { amount: full(saving) })}</span>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-micro text-v2-ink-3">{t('launch.paceArrival')}</dt>
              <dd data-pace-time className="font-v2-mono text-caption tabular-nums text-v2-ink">{durationPrecise(comparison.minutes)}</dd>
              <dd data-pace-delay className="mt-1 text-micro leading-snug text-v2-ink-3">
                <span className="block">{t('launch.paceTimeBaseline', { duration: durationPrecise(comparison.fullMinutes) })}</span>
                {pace < 1 && <span className="block text-v2-ink-2">{t('launch.paceDelay', { duration: durationPrecise(
                  Math.max(0, Math.round(comparison.minutes * 60) - Math.round(comparison.fullMinutes * 60)) / 60,
                ) })}</span>}
              </dd>
            </div>
          </dl>
          {pace === 1 && paces.length > 1 && <p className="mt-1.5 border-t border-v2-line pt-1.5 text-micro leading-snug text-v2-ink-2">{t('launch.paceBenefit')}</p>}
          {pace < 1 && saving === 0 && <p data-pace-zero-saving className="mt-1.5 border-t border-v2-line pt-1.5 text-micro leading-snug text-v2-ink-2">{t('launch.paceRounding')}</p>}
        </div>
      )}
      {hint && <p className="text-micro leading-snug text-v2-ink-3">{hint}</p>}
    </div>
  );
}
