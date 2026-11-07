import { useTranslation } from 'react-i18next';
import { durationPrecise, useNow } from '../../lib/time.js';
import { Icon } from '../../v2/icons.js';
import { repairWait } from './script.js';
import { useStarterGoal } from './visualGoal.js';

/** The running job and its next reward, beside the machines rather than a future price. */
export function StarterWaitLine({ queue }: { queue: readonly {subject:string;stage:number;startedAt:Date;readyAt:Date}[] }) {
  const goal = useStarterGoal();
  const now = useNow(1_000);
  const { t } = useTranslation();
  if (goal?.kind !== 'step' || goal.step !== 'wait') return null;
  const wait = repairWait(goal.id, queue);
  if (!wait) return null;
  const next = goal.id === 'waitAntenna' ? 'probe' : 'crate';
  return <div data-testid="starter-wait-line" className="mx-3 flex items-center justify-center gap-2 rounded-control border border-v2-self/40 bg-v2-self/10 px-2 py-1.5 text-caption text-v2-self">
    <Icon id="i-hourglass" className="size-4 animate-[ember_1.8s_ease-in-out_infinite]"/>
    <span className="font-v2-mono">{wait.until.getTime() > now ? durationPrecise((wait.until.getTime()-now)/60_000) : t('starter.inQueue')}</span>
    <Icon id="i-chev" className="size-3"/>
    <span aria-label={t(`starter.visual.${next}`)} className="flex items-center gap-1"><Icon id={next === 'probe' ? 'i-probe' : 'i-gift'} className="size-4"/>{t(`starter.visual.${next}`)}</span>
  </div>;
}
