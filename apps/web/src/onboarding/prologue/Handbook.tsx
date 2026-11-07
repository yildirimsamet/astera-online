import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ATMOSPHERE } from '../../ui/atmosphere.js';
import { Icon, type IconId } from '../../v2/icons.js';
import { Prologue } from './Prologue.js';

const ENTRIES: readonly { id: 'repairs' | 'crates' | 'holds' | 'sight' | 'fleets' | 'jump'; icon: IconId }[] = [
  { id: 'repairs', icon: 'i-base' },
  { id: 'crates', icon: 'i-collect' },
  { id: 'holds', icon: 'i-collect' },
  { id: 'sight', icon: 'i-radar' },
  { id: 'fleets', icon: 'i-fleet' },
  { id: 'jump', icon: 'i-spark' },
];

/**
 * THE MENU'S ACADEMY PAGE, once ships are open. Plan §3.9: the lessons now spread over days of play, so
 * what is left here is a page to check a rule on, and the prologue for whoever wants to see it again.
 */
export function Handbook({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [replaying, setReplaying] = useState(false);
  if (replaying) {
    return <Prologue replay onClaim={() => Promise.reject(new Error('REPLAY_ONLY'))} onSignIn={() => { setReplaying(false); }} onLeave={() => { setReplaying(false); }} />;
  }
  return (
    <main data-testid="handbook" className="flex h-dvh w-full flex-col overflow-y-auto bg-v2-void font-v2-ui">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="relative flex h-24 items-end overflow-hidden rounded-control border border-v2-line">
          <img src={ATMOSPHERE.academy.src} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-v2-void to-transparent" />
          <h1 className="relative p-2 text-title font-semibold text-v2-ink">{t('starter.handbook.title')}</h1>
          <button type="button" onClick={onClose} className="absolute right-2 top-2 min-h-8 rounded-chip bg-v2-void/70 px-2 text-micro font-semibold text-v2-ink">{t('starter.prologue.close')}</button>
        </header>
        <ul className="flex flex-col gap-1.5">
          {ENTRIES.map(entry => (
            <li key={entry.id} className="flex gap-2 rounded-control border border-v2-line bg-v2-panel px-2 py-1.5">
              <span aria-hidden="true" className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-v2-line-hi text-v2-self"><Icon id={entry.icon} className="size-3.5" /></span>
              <div className="min-w-0">
                <h2 className="text-caption font-semibold text-v2-ink">{t(`starter.handbook.${entry.id}.title`)}</h2>
                <p className="text-micro leading-snug text-v2-ink-2">{t(`starter.handbook.${entry.id}.body`)}</p>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" data-testid="handbook-replay" onClick={() => { setReplaying(true); }} className="min-h-10 rounded-control border border-v2-line-hi px-3 text-caption font-semibold text-v2-ink">{t('starter.handbook.replay')}</button>
      </div>
    </main>
  );
}
