import { useTranslation } from 'react-i18next';
import { countdown } from '../lib/time.js';

export function SignalBoostNote({ until, recoveryUntil, now }: { until?: Date | null; recoveryUntil?: Date | null; now: number }) {
  const { t } = useTranslation();
  if (!until || until.getTime() <= now) return null;
  const factor = recoveryUntil && recoveryUntil.getTime() > now ? 2.5 : 2;
  return <div role="status" data-signal-boost="" className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 border-b border-v2-crystal/15 bg-v2-crystal/5 px-3 py-1 font-v2-ui text-micro text-v2-crystal">
    <span className="font-semibold">{t('unknownSignal.boost', { factor })}</span>
    <span className="text-v2-ink-2">{t('unknownSignal.boostDetail', { time: countdown(until.getTime() - now) })}</span>
  </div>;
}
