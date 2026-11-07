import { STARTER, type StarterFeature, type VesselSystem } from '@astera/rules';
import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { VesselView } from '../api/starterSchemas.js';
import { galaxyCover, watchGalaxyCover } from '../lib/galaxyCover.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { describe, useToast } from '../ui/Toast.js';
import { useMarkUnlockSeen } from './queries.js';
import { unlockHeld, watchUnlockHold } from './tutorial/unlockHold.js';

/** The system whose repair brought the feature back: the bay that lights up on the ship. */
export const FEATURE_SYSTEM: Record<StarterFeature, VesselSystem> = {
  production: 'REFINERY', intel: 'SURVEY', fleet: 'CARGO', chat: 'SURVEY', salvage: 'CARGO', research: 'CARGO',
  telescope: 'DEFENCE', radar: 'DEFENCE', defence: 'DEFENCE', attack: 'DEFENCE', deuterium: 'REFINERY',
  drive: 'DRIVE', migration: 'DRIVE',
};

/** Only what can be tried there and then gets a "Try it": the works, and a probe at the nearest ship. */
const heard = new Set<string>();

const TRY: readonly StarterFeature[] = ['production', 'intel'];

/**
 * A SYSTEM HAS JUST COME BACK (onboarding design §5.3). A switch thrown somewhere aboard: a thunk, a
 * card that names the system, and the bay itself lights up on the ship. "Try it" takes the player
 * to it at once; "Later" leaves it. Never a modal stack: a player who was away while several opened
 * sees one, and the next arrives after this one (the server hands out one at a time).
 *
 * On the galaxy it waits while a sheet stands over it (player test, 2026-11-05): beside "While you
 * were away" it still showed, and its button's tap landed on the sheet's scrim instead.
 */
export function UnlockMoment({ vessel, overGalaxy = false, onAwaken, onTry }: {
  vessel: VesselView;
  overGalaxy?: boolean;
  /** The ship turns to face the camera and the bay pulses. */
  onAwaken?: (system: VesselSystem) => void;
  /** "Try it": the galaxy takes the player to it (the nearest ship, for a probe). */
  onTry?: (feature: StarterFeature) => void;
}) {
  const { t } = useTranslation();
  const say = useToast();
  const seen = useMarkUnlockSeen();
  const covered = useSyncExternalStore(watchGalaxyCover, () => galaxyCover() !== null);
  const held = useSyncExternalStore(watchUnlockHold, unlockHeld);
  const feature = vessel.unlockToAnnounce;
  const shown = feature !== null && !(overGalaxy && covered) && !held;
  const system = feature ? FEATURE_SYSTEM[feature] : null;
  useEffect(() => {
    if (!shown || !system) return;
    // Not under the loading cover: the switch and the lit bay are for the player to see.
    let timer = 0;
    const fire = () => {
      if (document.querySelector('[data-loading-screen]')) { timer = window.setTimeout(fire, 250); return; }
      const key = `${vessel.id}:${feature}`;
      if (!heard.has(key)) {
        heard.add(key);
        playSound('switch');
        haptic('thunk');
      }
      onAwaken?.(system);
    };
    fire();
    return () => { window.clearTimeout(timer); };
  }, [shown, system, onAwaken, vessel.id, feature]);
  if (!feature || !shown || !system) return null;
  const tryable = TRY.includes(feature);
  const close = () => {
    seen.mutate(feature, { onError: (error) => { say(describe(error), 'error'); } });
  };
  return (
    <aside
      data-testid="unlock-moment"
      data-system={system}
      className="relative overflow-hidden rounded-control border border-v2-self/60 bg-v2-deep/95 px-3 pb-2 pt-2.5 font-v2-ui shadow-[0_0_28px_-6px_var(--color-v2-self)] animate-[unlock-in_0.6s_cubic-bezier(.2,1.4,.4,1)_both]"
    >
      <style>{`
        @keyframes unlock-in {0%{opacity:0;transform:translateY(10px) scale(.96)} 100%{opacity:1;transform:none}}
        @keyframes unlock-bar {0%{transform:scaleX(0)} 100%{transform:scaleX(1)}}
      `}</style>
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 origin-left bg-v2-self shadow-[0_0_10px_var(--color-v2-self)] animate-[unlock-bar_0.7s_ease-out_both]" />
      <p className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-v2-self shadow-[0_0_8px_var(--color-v2-self)] animate-[ember_1.4s_ease-in-out_infinite]" />
        <span className="v2-legend text-v2-self">{t('starter.unlock.online', { system: t(`starter.system.${system}`) })}</span>
      </p>
      <p className="mt-1 text-caption leading-snug text-v2-ink">{t(`starter.feature.${feature}.line`, { count: STARTER.parts.needed })}</p>
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          disabled={seen.isPending}
          data-guide="unlock-dismiss"
          onClick={() => { close(); }}
          className="min-h-8 rounded-control border border-v2-line-hi px-3 text-micro font-semibold text-v2-ink-2"
        >
          {t('starter.unlock.later')}
        </button>
        {tryable && (
          <button
            type="button"
            disabled={seen.isPending}
            data-guide="unlock-try"
            onClick={() => { haptic('tap'); close(); onTry?.(feature); }}
            className="min-h-8 rounded-control border border-v2-self bg-v2-self/15 px-4 text-micro font-semibold text-v2-self"
          >
            {t('starter.unlock.try')}
          </button>
        )}
      </div>
    </aside>
  );
}
