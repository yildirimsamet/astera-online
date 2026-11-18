import { useEffect, useState } from 'react';
import { haptic } from '../../lib/haptics.js';
import { playSound } from '../../lib/sound.js';
import type { TutorialAnswer } from './script.js';

/** The instrument a line of the guide is about. The radar is shown in its own scene (item 28), not by a line. */
export function sightLesson(answer: TutorialAnswer | null): 'telescope' | null {
  if (answer?.kind !== 'step' || answer.nav) return null;
  // The Prospector goes out inside the ring that showed its rock.
  return answer.id === 'telescopeLook' || answer.id === 'zoomRock' || answer.id === 'findRock' || answer.id === 'mine' ? 'telescope' : null;
}

/** The line names the button in the rock's sheet, so the sheet is not left folded over it. */
export const rockSheetStaysOpen = (answer: TutorialAnswer | null): boolean =>
  answer?.kind === 'step' && (answer.id === 'findRock' || answer.id === 'mine');

/**
 * The rocks in the ring wear a soft ring from the moment they land (play-test 2026-11-13: framed to the
 * whole ring, a rock is a few pixels and the first look found a dark field) until the player has one.
 */
export const rockMarks = (answer: TutorialAnswer | null): boolean =>
  answer?.kind === 'step' && !answer.nav && (answer.id === 'telescopeLook' || answer.id === 'zoomRock' || answer.id === 'findRock');

/** While the player is asked to come closer, a rock is not yet to be touched (owner playtest 2026-11-09). */
export const rocksHeld = (answer: TutorialAnswer | null): boolean =>
  answer?.kind === 'step' && answer.id === 'zoomRock' && !answer.nav;

/** The ring takes 1.4 s to spread; the rocks land as it ends (owner playtest 2026-11-09) and the fleets a second later. */
export const REVEAL_ROCKS_MS = 1_400;
export const REVEAL_FLEETS_MS = 2_400;
/** The officer speaks once the sky has filled, so the first look goes to the sky. */
export const CARD_AFTER_REVEAL_MS = 3_000;

export interface TelescopeReveal { rocks: boolean; fleets: boolean }
const ALL: TelescopeReveal = { rocks: true, fleets: true };

/** What the sky may show on the telescope's first opening. Any other moment of the game shows it all. */
export function telescopeReveal(answer: TutorialAnswer | null, sinceMs: number): TelescopeReveal {
  if (answer?.kind !== 'step') return ALL;
  // The rocks are read as the telescope comes in; they wait for the ring they belong to.
  if (answer.id === 'waitTelescope') return { rocks: false, fleets: true };
  if (answer.id !== 'telescopeLook') return ALL;
  if (answer.nav) return { rocks: false, fleets: false };
  return { rocks: sinceMs >= REVEAL_ROCKS_MS, fleets: sinceMs >= REVEAL_FLEETS_MS };
}

/** The reveal on the clock, each arrival with its chime. */
export function useTelescopeReveal(answer: TutorialAnswer | null): TelescopeReveal {
  const looking = answer?.kind === 'step' && answer.id === 'telescopeLook' && !answer.nav;
  const [since, setSince] = useState(0);
  useEffect(() => {
    if (!looking) return undefined;
    const rocks = window.setTimeout(() => { setSince(REVEAL_ROCKS_MS); playSound('confirm'); haptic('tap'); }, REVEAL_ROCKS_MS);
    const fleets = window.setTimeout(() => { setSince(REVEAL_FLEETS_MS); playSound('tap'); haptic('tap'); }, REVEAL_FLEETS_MS);
    return () => { window.clearTimeout(rocks); window.clearTimeout(fleets); };
  }, [looking]);
  return telescopeReveal(answer, since);
}
