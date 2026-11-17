import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { VesselView } from '../api/starterSchemas.js';
import { Banner, Glyph } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { holdFullDue, rememberHoldFull } from './hold.js';

/**
 * THE HOLD FILLS (plan 2026-11-13 §4.5, a medium moment): the cargo hatches close on the ship, a short
 * sound and a knock, and one card. From here on what the ship earns does not go down with it; staying is
 * still the player's choice, so the card offers a look at the jump (not from the jump panel itself) and
 * closes without one. Once a ship, and never over a system's own card: it waits until that one has been
 * announced.
 */
export function HoldFullMoment({ vessel, onLook }: { vessel: VesselView; onLook?: () => void }) {
  const { t } = useTranslation();
  const due = vessel.unlockToAnnounce === null && holdFullDue(vessel);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!due) return undefined;
    // Not under the loading cover: the hatches and the card are for the player to see.
    let timer = 0;
    const fire = () => {
      if (document.querySelector('[data-loading-screen]')) { timer = window.setTimeout(fire, 250); return; }
      rememberHoldFull(vessel.id);
      playSound('cargo');
      haptic('thunk');
      setOpen(true);
    };
    fire();
    return () => { window.clearTimeout(timer); };
  }, [due, vessel.id]);
  if (!open) return null;
  return (
    <div data-testid="hold-full-moment" className="gk hold-full-moment">
      {/* At 350 px the words keep the width; the way to the jump is a line under them, the close at the side. */}
      <Banner tone="warn" glyph="crate" title={t('starter.holdMoment.title')}
        body={(
          <>
            {t('starter.holdMoment.body')}
            {onLook && (
              <button type="button" onClick={() => { playSound('tap'); haptic('tap'); setOpen(false); onLook(); }}
                className="-mb-2 flex min-h-11 items-center gap-1 font-semibold text-v2-self">
                {t('starter.holdMoment.look')}<Glyph id="next" className="gk-glyph size-3.5" />
              </button>
            )}
          </>
        )}
        action={(
          <button type="button" aria-label={t('starter.holdMoment.close')} onClick={() => { playSound('tap'); haptic('tap'); setOpen(false); }}
            className="-my-2 -mr-1 grid size-11 shrink-0 place-items-center text-v2-ink-2">
            <Glyph id="close" className="gk-glyph size-4" />
          </button>
        )} />
    </div>
  );
}
