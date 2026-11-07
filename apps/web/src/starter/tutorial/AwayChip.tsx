import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { durationPrecise } from '../../lib/time.js';

/**
 * THE NPC, STEPPED ASIDE (owner playtest 2026-11-07). Through a long wait the commander roams; the NPC
 * waits in the corner with the time left, and a tap brings its line back. It returns on its own when
 * the work is done.
 */
export function AwayChip({ until, onOpen }: { until: Date; onOpen: () => void }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => { setNow(Date.now()); }, 1_000);
    return () => { window.clearInterval(timer); };
  }, []);
  const left = Math.max(0, until.getTime() - now) / 60_000;
  return (
    <button
      type="button"
      data-school-away
      onClick={onOpen}
      aria-label={t('starter.tutorial.reopen')}
      // Up in the logo row, where the NPC's portrait stood (owner playtest 2026-11-07: at the foot it sat
      // on a focus panel's title). That row carries no control, so nothing is covered.
      className="fixed right-2 top-[calc(env(safe-area-inset-top)+1px)] z-[60] flex h-6 items-center gap-1.5 rounded-pill border border-v2-self/45 bg-v2-deep/95 pl-0.5 pr-2.5 font-v2-ui shadow-[0_6px_18px_rgba(0,0,0,0.5),0_0_12px_-4px_var(--color-v2-self)]"
    >
      <span className="relative size-5 shrink-0 overflow-hidden rounded-full border border-v2-self/60 bg-v2-panel">
        <img src="/assets/images/general/tutorial-npc.png" alt="" draggable={false} className="size-full object-cover object-top" />
        <span aria-hidden="true" className="absolute inset-0 rounded-full ring-1 ring-inset ring-v2-self/30 animate-[ember_1.6s_ease-in-out_infinite]" />
      </span>
      <span className="font-v2-mono text-caption text-v2-ink">{t('starter.tutorial.back', { time: durationPrecise(left) })}</span>
    </button>
  );
}
