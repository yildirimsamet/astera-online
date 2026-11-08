import { STARTER_CRATES } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { durationPrecise, useNow } from '../../lib/time.js';
import { Icon } from '../../v2/icons.js';
import { repairWait } from './script.js';
import { useStarterGoal } from './visualGoal.js';

interface Order { queue: string; subject: string; stage: number; startedAt: Date; readyAt: Date }

/**
 * THE RUNNING JOB AND WHAT IT BRINGS, beside the machines rather than a future price (owner item Z2).
 * The repair the guide waits on, or, with the guide quiet, the soonest one when waiting is the next step.
 */
export function StarterWaitLine({ queue }: { queue: readonly Order[] }) {
  const goal = useStarterGoal();
  const now = useNow(1_000);
  const { t } = useTranslation();
  const awaited = goal?.step
    ? (goal.step.step === 'wait' ? repairWait(goal.step.id, queue)?.until : undefined)
    : goal?.choice?.kind === 'wait' ? goal.choice.readyAt : undefined;
  if (!awaited) return null;
  // What ends at that moment, and whether a crate sits behind it.
  const ending = queue.filter(order => order.queue === 'CONSTRUCTION' && order.readyAt.getTime() === awaited.getTime());
  const crate = ending.some(order => STARTER_CRATES.some(c => c.module === order.subject && c.stage === order.stage));
  return <div data-testid="starter-wait-line" className="mx-3 flex items-center justify-center gap-2 rounded-control border border-v2-self/40 bg-v2-self/10 px-2 py-1.5 text-caption text-v2-self">
    <Icon id="i-hourglass" className="size-4 animate-[ember_1.8s_ease-in-out_infinite]"/>
    <span className="font-v2-mono">{awaited.getTime() > now ? durationPrecise((awaited.getTime() - now) / 60_000) : t('starter.inQueue')}</span>
    {crate && <>
      <Icon id="i-chev" className="size-3"/>
      <span aria-label={t('starter.visual.crate')} className="flex items-center gap-1"><Icon id="i-gift" className="size-4"/>{t('starter.visual.crate')}</span>
    </>}
  </div>;
}
