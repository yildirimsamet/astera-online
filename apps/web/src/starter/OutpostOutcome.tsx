import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useMarkSeen, useNotifications } from '../api/queries.js';
import type { NotificationView } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { compact } from '../lib/format.js';
import { galaxyCover, watchGalaxyCover } from '../lib/galaxyCover.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { Icon } from '../v2/icons.js';

const raid = z.object({
  grade: z.enum(['DECISIVE', 'PARTIAL', 'REPELLED']),
  attacking: z.literal(true),
  opponent: z.string(),
  opponentKind: z.literal('OUTPOST'),
  loot: z.object({ alloy: z.number(), crystal: z.number(), deuterium: z.number() }),
  lost: z.number().default(0),
  firstVictory: z.boolean().optional(),
  beatenBy: z.string().optional(),
});
type Raid = z.infer<typeof raid>;
type Mood = Raid['grade'] | 'BEATEN';

/** The weight of each ending, in sound, in the hand and in colour: a win rings, a loss lands. */
const FEEL = {
  DECISIVE: { sound: 'claim', buzz: 'commit', ink: 'text-v2-self', tone: 'border-v2-self/60 text-v2-self', glow: 'shadow-[0_0_28px_-6px_var(--color-v2-self)]', bar: 'bg-v2-self' },
  PARTIAL: { sound: 'confirm', buzz: 'tap', ink: 'text-v2-alloy', tone: 'border-v2-alloy/60 text-v2-alloy', glow: 'shadow-[0_0_22px_-8px_var(--color-v2-alloy)]', bar: 'bg-v2-alloy' },
  REPELLED: { sound: 'impact', buzz: 'thunk', ink: 'text-v2-hostile', tone: 'border-v2-hostile/60 text-v2-hostile', glow: 'shadow-[0_0_22px_-8px_var(--color-v2-hostile)]', bar: 'bg-v2-hostile' },
  BEATEN: { sound: 'confirm', buzz: 'tap', ink: 'text-v2-warn', tone: 'border-v2-warn/60 text-v2-warn', glow: 'shadow-[0_0_22px_-8px_var(--color-v2-warn)]', bar: 'bg-v2-warn' },
} as const;

/** Each result is rung once, however often the list is read again. */
const rung = new Set<string>();

/** The newest unread raid of this ship's on an outpost that ended after the galaxy opened. */
function latest(notes: readonly NotificationView[] | undefined, since: number): Outcome | null {
  for (const note of [...notes ?? []].sort((a, b) => b.at.getTime() - a.at.getTime())) {
    if (note.kind !== 'BATTLE_REPORT' || note.seen || note.at.getTime() < since) continue;
    const read = raid.safeParse(note.payload);
    if (read.success) return { id: note.id, reportId: note.refId ?? null, raid: read.data };
  }
  return null;
}

/** One result: its notification, the report it names, and what the signal said. */
export interface Outcome { id: string; reportId: string | null; raid: Raid }

/**
 * THE RESULT, HELD BY THE GALAXY (plan §5.6, F4f). The newest unread raid on an outpost that ended
 * after the galaxy opened; what ended before is the away card's to tell, so it is never told twice.
 * Held here and not in the card, because following the fleet or reading a sheet takes the bottom of
 * the screen: a result that lands then waits for the card instead of being forgotten with it.
 */
export function useOutpostOutcome(): { current: Outcome | null; dismiss: (id: string) => void } {
  const [since] = useState(serverNow);
  const notes = useNotifications().data?.notifications;
  const seen = useMarkSeen();
  const [closed, setClosed] = useState<string | null>(null);
  const found = latest(notes, since);
  const dismiss = (id: string): void => {
    setClosed(id);
    seen.mutate([id]);
  };
  return { current: found && found.id !== closed ? found : null, dismiss };
}

/**
 * THE RESULT, WHEN IT LANDS. Told over the galaxy: the grade in its colour, a sound and a buzz of the
 * same weight as it comes into sight, what came of it, and one tap to what is next (the crate after
 * the first win, else the report). Under a sheet it waits, as the unlock note does.
 */
export function OutpostOutcome({ outcome, onDone, onOpenShip, onOpenReport }: {
  outcome: Outcome;
  onDone: (id: string) => void;
  onOpenShip: () => void;
  /** The report this result names, or the battle list when it names none. */
  onOpenReport: (reportId: string | null) => void;
}) {
  const { t } = useTranslation();
  const covered = useSyncExternalStore(watchGalaxyCover, () => galaxyCover() !== null);
  const { id, raid: told } = outcome;
  const mood: Mood = told.beatenBy ? 'BEATEN' : told.grade;
  useEffect(() => {
    if (covered || rung.has(id)) return;
    rung.add(id);
    playSound(FEEL[mood].sound);
    haptic(FEEL[mood].buzz);
  }, [covered, id, mood]);
  if (covered) return null;
  const feel = FEEL[mood];
  const done = (next?: () => void) => {
    onDone(id);
    haptic('tap');
    next?.();
  };
  const crate = told.firstVictory === true;
  const loot = ([['alloy', told.loot.alloy], ['crystal', told.loot.crystal], ['deuterium', told.loot.deuterium]] as const).filter(([, value]) => value >= 1);
  return (
    <aside
      data-testid="outpost-outcome"
      data-grade={mood}
      className={`relative mb-2 overflow-hidden rounded-control border bg-v2-deep/95 px-3 pb-2 pt-2.5 font-v2-ui ${feel.tone} ${feel.glow} ${mood === 'REPELLED' ? 'animate-[outcome-hit_0.5s_ease-out_both]' : 'animate-[outcome-in_0.6s_cubic-bezier(.2,1.4,.4,1)_both]'}`}
    >
      <style>{`
        @keyframes outcome-in {0%{opacity:0;transform:translateY(10px) scale(.94)} 100%{opacity:1;transform:none}}
        @keyframes outcome-hit {0%{opacity:0;transform:translateX(0)} 20%{opacity:1;transform:translateX(-5px)} 40%{transform:translateX(4px)} 60%{transform:translateX(-2px)} 100%{transform:none}}
        @keyframes outcome-bar {0%{transform:scaleX(0)} 100%{transform:scaleX(1)}}
      `}</style>
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-0.5 origin-left animate-[outcome-bar_0.7s_ease-out_both] ${feel.bar}`} />
      <p className="flex items-center gap-1.5">
        <Icon id="i-attack" className="size-3.5 shrink-0" />
        <span className={`v2-legend ${feel.ink}`}>{t(`starter.outcome.${mood}`)}</span>
        <span className="min-w-0 truncate text-caption font-semibold text-v2-ink">{told.opponent}</span>
      </p>
      <p className="mt-1 text-caption leading-snug text-v2-ink">
        {told.beatenBy ? t('starter.outcome.beaten', { by: told.beatenBy }) : crate ? t('starter.outcome.crate') : t(`starter.outcome.line.${told.grade}`)}
      </p>
      {(loot.length > 0 || told.lost > 0) && (
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-micro text-v2-ink-2">
          {loot.map(([resource, value]) => (
            <span key={resource} className="flex items-center gap-0.5 font-v2-mono text-v2-ink">
              <img src={RESOURCE_ART[resource]} alt={t(`vocabulary.resource.${resource}`)} className="size-3.5 object-contain" />+{compact(value)}
            </span>
          ))}
          {told.lost > 0 && <span className="font-v2-mono text-v2-hostile">{t('starter.outcome.lost', { count: told.lost })}</span>}
          {loot.length > 0 && <span>{t('starter.outcome.lootHome')}</span>}
        </p>
      )}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={() => { done(); }} className="min-h-8 rounded-control border border-v2-line-hi px-3 text-micro font-semibold text-v2-ink-2">
          {t('starter.outcome.ok')}
        </button>
        <button
          type="button"
          onClick={() => { done(crate ? onOpenShip : () => { onOpenReport(outcome.reportId); }); }}
          className={`min-h-8 rounded-control border bg-current/10 px-4 text-micro font-semibold ${feel.tone}`}
        >
          {t(crate ? 'starter.outcome.openCrate' : 'starter.outcome.report')}
        </button>
      </div>
    </aside>
  );
}
