import { jumpWindowOpen, type VesselProgress } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { Icon } from '../v2/icons.js';
import type { TutorialStepId } from './tutorial/script.js';
import './jumpCall.css';

/** The guide's own steps about the jump: while it speaks of them the call is the thing to press. */
const JUMP_STEPS: readonly TutorialStepId[] = ['jumpAsk', 'jumpGo'];

/**
 * ONE ORDER AT A TIME (owner phone playtest 2026-11-18, items 24 and 27). While the guide leads elsewhere
 * (the player chose to grow first) the call is quiet: an option, not an order. Without the guide, or with
 * the guide on the jump or done, it calls.
 */
export const jumpCallQuiet = (goal: { guided: boolean; step: { id: TutorialStepId } | null } | null): boolean =>
  goal !== null && goal.guided && goal.step !== null && !JUMP_STEPS.includes(goal.step.id);

/**
 * THE WAY OUT, WHERE THE PLAYER IS (owner playtest 2026-11-09). Once the first loop is done the drive
 * runs for one jump (plan 2026-11-13 §4.3); the call says so over the galaxy, at the thumb, and opens
 * the ship. When to go stays the player's: there is no countdown.
 */
export function JumpCall({ progress, onOpen, quiet = false }: { progress: VesselProgress; onOpen: () => void; quiet?: boolean }) {
  const { t } = useTranslation();
  if (!jumpWindowOpen(progress)) return null;
  return (
    <button
      type="button"
      data-jump-call=""
      data-quiet={quiet ? '' : undefined}
      onClick={() => { playSound('tap'); haptic('commit'); onOpen(); }}
      className="jump-call pointer-events-auto relative mb-2 flex w-full items-center gap-2.5 overflow-hidden rounded-control border border-v2-self/70 bg-v2-panel/90 px-2.5 py-2 text-left font-v2-ui"
    >
      <span aria-hidden="true" className="jump-call-beacon relative grid size-9 shrink-0 place-items-center rounded-full border border-v2-self/60 bg-v2-self/15 text-v2-self">
        <Icon id="i-galaxy" className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-caption font-bold uppercase tracking-label text-v2-self">{t('starter.jumpCall.title')}</span>
        <span className="block truncate text-micro text-v2-ink-2">{t(quiet ? 'starter.jumpCall.later' : 'starter.jumpCall.line')}</span>
      </span>
      <Icon id="i-chev" className="size-4 shrink-0 text-v2-self" />
    </button>
  );
}
