import { WELCOME_WEEK } from '@astera/rules';
import { useTranslation } from 'react-i18next';
import { useOpenWelcome, useWelcome } from '../api/queries.js';
import { Glyph } from '../game-ui/index.js';
import { useNow, duration } from '../lib/time.js';
import { CrateBay } from '../starter/CrateBay.js';
import { describe, useToast } from '../ui/Toast.js';

/**
 * NEW COMMANDER 7 DAYS (plan 2026-11-06 §7.2). The day's box is a crate in the bay, lifted with the
 * crate's own hold; while the next one waits, one quiet line says which box and when. No streak to keep:
 * the box waits however long the commander is away. `waiting` off: only a ready box, for a crowded screen.
 */
export function WelcomeBox({ waiting = true }: { waiting?: boolean }) {
  const { t } = useTranslation();
  const say = useToast();
  const now = useNow(30_000);
  const state = useWelcome().data?.welcome;
  const open = useOpenWelcome();
  if (state?.box == null || !state.preview || !state.readyAt) return null;
  const name = t('rewards.welcome.title', { box: state.box, of: WELCOME_WEEK.boxes });
  if (state.readyAt.getTime() > now) {
    if (!waiting) return null;
    return (
      <p data-testid="welcome-box" className="gk-inote">
        <Glyph id="crate" />
        <span data-testid="welcome-wait">{t('rewards.welcome.wait', { name, time: duration((state.readyAt.getTime() - now) / 60_000) })}</span>
      </p>
    );
  }
  const crate = { id: `welcome-${String(state.box)}`, module: 'REFINERY' as const, stage: 0, fact: null, alloy: state.preview.alloy, crystal: state.preview.crystal, state: 'ready' as const };
  return (
    <div data-testid="welcome-box">
      <CrateBay crates={[crate]} title={name} guide="welcome"
        onOpen={() => { open.mutate(undefined, { onError: (error) => { say(describe(error), 'error'); } }); }} />
    </div>
  );
}
