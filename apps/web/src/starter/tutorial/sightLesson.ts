import { distance, type SensorSphere } from '@astera/rules';
import { useEffect, useState } from 'react';
import type { Contact } from '../../api/schemas.js';
import { haptic } from '../../lib/haptics.js';
import { playSound } from '../../lib/sound.js';
import type { TutorialAnswer, TutorialLineId } from './script.js';

export function sightLesson(answer: TutorialAnswer | null): 'telescope' | 'radar' | null {
  if (answer?.kind !== 'step' || answer.nav) return null;
  // The Prospector goes out inside the ring that showed its rock.
  if (answer.id === 'telescopeLook' || answer.id === 'findRock' || answer.id === 'mine') return 'telescope';
  return answer.id.startsWith('radar') || answer.id === 'sightTrio' ? 'radar' : null;
}

/** The line names the button in the rock's sheet, so the sheet is not left folded over it. */
export const rockSheetStaysOpen = (answer: TutorialAnswer | null): boolean =>
  answer?.kind === 'step' && (answer.id === 'findRock' || answer.id === 'mine');

/** Published contacts only. An empty sky stays empty; a hidden fleet is never manufactured for a lesson. */
export function lessonContact(id: TutorialLineId | undefined, contacts: readonly Contact[], sensor?: SensorSphere): Contact | undefined {
  const live = contacts.filter(contact=>contact.effectOnly !== true);
  if (id === 'radarRing' || id === 'radarContact') return live.find(contact=>contact.kind==='unknown');
  const known = live.filter(contact=>contact.kind!=='unknown');
  if (id === 'sightTrio') return known.find(contact=>!sensor || distance(contact.from,sensor.at)<=sensor.identify);
  return undefined;
}

/** What the live sky holds for a sensor lesson (plan F6): each lesson waits for its own subject. */
export interface SightNow {
  /** A craft named inside the telescope's ring. */
  traffic: boolean;
  /** A radar return nobody has named yet. */
  unknown: boolean;
}

export const NOTHING_IN_SIGHT: SightNow = { traffic: false, unknown: false };

export function sightNow(contacts: readonly Contact[], sensor: SensorSphere | undefined): SightNow {
  if (!sensor) return NOTHING_IN_SIGHT;
  return {
    traffic: lessonContact('sightTrio', contacts, sensor) !== undefined,
    unknown: lessonContact('radarContact', contacts, sensor) !== undefined,
  };
}

/** The ring takes 1.4 s to spread; then a second to the rocks and a second to the fleets (owner playtest 2026-11-08). */
export const REVEAL_ROCKS_MS = 2_400;
export const REVEAL_FLEETS_MS = 3_400;
/** The officer speaks once the sky has filled, so the first look goes to the sky. */
export const CARD_AFTER_REVEAL_MS = 4_000;

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
