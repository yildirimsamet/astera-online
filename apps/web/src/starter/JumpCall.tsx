import { jumpWindowOpen, type VesselProgress } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { Icon } from '../v2/icons.js';
import './jumpCall.css';

/**
 * THE WAY OUT, WHERE THE PLAYER IS (owner playtest 2026-11-09). Once the first loop is done the drive
 * runs for one jump (plan 2026-11-13 §4.3); the call says so over the galaxy, at the thumb, and opens
 * the ship. When to go stays the player's: there is no countdown.
 */
export function JumpCall({ progress, onOpen }: { progress: VesselProgress; onOpen: () => void }) {
  const { t } = useTranslation();
  if (!jumpWindowOpen(progress)) return null;
  return (
    <button
      type="button"
      data-jump-call=""
      onClick={() => { playSound('tap'); haptic('commit'); onOpen(); }}
      className="jump-call pointer-events-auto relative mb-2 flex w-full items-center gap-2.5 overflow-hidden rounded-control border border-v2-self/70 bg-v2-panel/90 px-2.5 py-2 text-left font-v2-ui"
    >
      <span aria-hidden="true" className="jump-call-beacon relative grid size-9 shrink-0 place-items-center rounded-full border border-v2-self/60 bg-v2-self/15 text-v2-self">
        <Icon id="i-galaxy" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-caption font-bold uppercase tracking-label text-v2-self">{t('starter.jumpCall.title')}</span>
        <span className="block truncate text-micro text-v2-ink-2">{t('starter.jumpCall.line')}</span>
      </span>
      <Icon id="i-chev" className="size-4 shrink-0 text-v2-self" />
    </button>
  );
}
