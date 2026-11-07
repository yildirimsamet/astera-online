import { REPAIR_LADDER, VESSEL_SYSTEMS, nextRequiredStep, systemProgress, type VesselProgress, type VesselSystem } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import type { VesselView } from '../api/starterSchemas.js';
import { haptic } from '../lib/haptics.js';
import { Icon } from '../v2/icons.js';
import { SYSTEM_ICON } from './shipScreen.js';

type Chapter = 'POWER' | VesselSystem;
type ChapterState = 'done' | 'now' | 'ahead';

const progressOf = (vessel: VesselView): VesselProgress => ({ modules: vessel.modules, facts: vessel.facts, parts: vessel.parts, fuel: vessel.fuel });

/** Which system the next required repair belongs to, the queue counted as run; the Drive at the end. */
function current(vessel: VesselView): VesselSystem {
  const queued = vessel.queue.filter(order => order.queue === 'CONSTRUCTION')
    .flatMap(order => REPAIR_LADDER.find(s => s.module === order.subject && s.stage === order.stage) ?? []);
  return nextRequiredStep(progressOf(vessel), queued)?.step.system ?? 'DRIVE';
}

const TONE: Record<ChapterState, string> = {
  done: 'border-v2-self/60 bg-v2-self/15 text-v2-self',
  now: 'border-v2-warn bg-v2-warn/15 text-v2-warn shadow-[0_0_12px_-2px_var(--color-v2-warn)]',
  ahead: 'border-v2-line-hi bg-v2-void/60 text-v2-ink-3',
};

/**
 * THE SHIP'S LOG (owner 2026-11-06: "menüde yönerge yok"). The story in chapters, in the order the
 * ship comes back to life: what each is for, how far it is, and a way to the one that is now.
 */
export function ShipLog({ vessel, onOpenShip }: { vessel: VesselView; onOpenShip: () => void }) {
  const { t } = useTranslation();
  const progress = progressOf(vessel);
  const now = current(vessel);
  const chapters: { id: Chapter; state: ChapterState; count: string | null }[] = [
    { id: 'POWER', state: 'done', count: null },
    ...VESSEL_SYSTEMS.map(system => {
      const { done, total } = systemProgress(progress, system);
      const state: ChapterState = done >= total ? 'done' : system === now ? 'now' : 'ahead';
      return { id: system, state, count: `${String(done)}/${String(total)}` };
    }),
  ];
  return (
    <section data-testid="ship-log" className="flex flex-col gap-2">
      <h3 className="v2-legend text-v2-ink-2">{t('starter.log.title')}</h3>
      <ol className="relative flex flex-col">
        <span aria-hidden="true" className="absolute bottom-4 left-[15px] top-4 w-px bg-gradient-to-b from-v2-self/60 via-v2-line-hi to-v2-line" />
        {chapters.map(chapter => (
          <li key={chapter.id} data-testid="log-chapter" data-chapter={chapter.id} data-state={chapter.state}
            className={`relative flex items-start gap-3 rounded-control py-1.5 pr-1 ${chapter.state === 'now' ? 'bg-v2-warn/5' : ''}`}>
            <span className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full border ${TONE[chapter.state]} ${chapter.state === 'now' ? 'animate-[ember_1.8s_ease-in-out_infinite]' : ''}`}>
              {chapter.state === 'done'
                ? <Icon id="i-check" className="size-4" />
                : <Icon id={chapter.id === 'POWER' ? 'i-spark' : SYSTEM_ICON[chapter.id]} className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className={`text-caption font-semibold ${chapter.state === 'ahead' ? 'text-v2-ink-2' : 'text-v2-ink'}`}>{t(`starter.log.chapter.${chapter.id}.title`)}</span>
                {chapter.count && <span className="font-v2-mono text-micro tabular-nums text-v2-ink-3">{chapter.count}</span>}
                {chapter.state === 'now' && <span className="v2-legend text-v2-warn">{t('starter.log.now')}</span>}
              </span>
              <span className="block text-micro leading-snug text-v2-ink-2">{t(`starter.log.chapter.${chapter.id}.line`)}</span>
            </span>
            {chapter.state === 'now' && (
              <button type="button" data-testid="log-go" onClick={() => { haptic('tap'); onOpenShip(); }}
                className="flex min-h-8 shrink-0 items-center gap-1 self-center rounded-control border border-v2-warn/60 px-2.5 text-micro font-semibold text-v2-warn">
                {t('starter.log.go')}<Icon id="i-chev" className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
