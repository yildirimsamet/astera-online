import { useTranslation } from 'react-i18next';
import type { MissionPace } from '@astera/rules';
import { full } from '../lib/format.js';
import { durationPrecise } from '../lib/time.js';
import { Choices } from '../game-ui/index.js';

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
    <div {...data} className="gk-pace">
      <div className="gk-pace__head">
        <span className="gk-label">{t('launch.pace')}</span>
        {brief && <span className="gk-sub">{brief}</span>}
      </div>
      {paces.length > 1 && (
        <Choices
          label={t('launch.pace')}
          options={paces.map((rung) => ({ id: String(rung), label: rung === 1 ? t('launch.paceFull') : `${String(Math.round(rung * 100))}%` }))}
          value={String(pace)}
          onChange={(id) => {
            const rung = paces.find((each) => String(each) === id);
            if (rung !== undefined) onChange(rung);
          }}
        />
      )}
      {reset && <p data-pace-reset role="status" className="gk-inote" data-tone="warn">{t('launch.paceReset')}</p>}
      {comparison && (
        <div data-pace-comparison aria-live="polite" aria-atomic="true" className="gk-well gk-pace__trade">
          <dl className="gk-pace__sides">
            <div>
              <dt className="gk-label">{t('launch.fuel')}</dt>
              <dd data-pace-fuel className="gk-num gk-pace__value">{t('launch.paceFuelValue', { amount: full(comparison.fuel) })}</dd>
              <dd data-pace-saving className="gk-pace__notes">
                <span className="gk-pace__base">{t('launch.paceFuelBaseline', { amount: full(comparison.fullFuel) })}</span>
                <span {...(saving > 0 ? { 'data-tone': 'self' } : {})}>{t('launch.paceSaved', { amount: full(saving) })}</span>
              </dd>
            </div>
            <div>
              <dt className="gk-label">{t('launch.paceArrival')}</dt>
              <dd data-pace-time className="gk-num gk-pace__value">{durationPrecise(comparison.minutes)}</dd>
              <dd data-pace-delay className="gk-pace__notes">
                <span className="gk-pace__base">{t('launch.paceTimeBaseline', { duration: durationPrecise(comparison.fullMinutes) })}</span>
                {pace < 1 && <span>{t('launch.paceDelay', { duration: durationPrecise(
                  Math.max(0, Math.round(comparison.minutes * 60) - Math.round(comparison.fullMinutes * 60)) / 60,
                ) })}</span>}
              </dd>
            </div>
          </dl>
          {pace === 1 && paces.length > 1 && <p className="gk-pace__rule">{t('launch.paceBenefit')}</p>}
          {pace < 1 && saving === 0 && <p data-pace-zero-saving className="gk-pace__rule">{t('launch.paceRounding')}</p>}
        </div>
      )}
      {hint && <p className="gk-sub">{hint}</p>}
    </div>
  );
}
