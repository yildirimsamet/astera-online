import { distance, type SensorSphere } from '@astera/rules';
import type { Contact } from '../../api/schemas.js';
import type { TutorialAnswer, TutorialLineId } from './script.js';

export function sightLesson(answer: TutorialAnswer | null): 'telescope' | 'radar' | null {
  if (answer?.kind !== 'step' || answer.nav) return null;
  if (answer.id.startsWith('telescope')) return 'telescope';
  return answer.id.startsWith('radar') || answer.id === 'sightTrio' ? 'radar' : null;
}

/** Published contacts only. An empty sky stays empty; a hidden fleet is never manufactured for a lesson. */
export function lessonContact(id: TutorialLineId | undefined, contacts: readonly Contact[], sensor?: SensorSphere): Contact | undefined {
  const live = contacts.filter(contact=>contact.effectOnly !== true);
  if (id === 'radarRing' || id === 'radarContact') return live.find(contact=>contact.kind==='unknown');
  const known = live.filter(contact=>contact.kind!=='unknown');
  if (id === 'telescopeTrack') return known.find(contact=>sensor && distance(contact.from,sensor.at)>sensor.identify) ?? known[0];
  if (id === 'telescopeRing' || id === 'telescopeTraffic' || id === 'sightTrio') return known.find(contact=>!sensor || distance(contact.from,sensor.at)<=sensor.identify);
  return undefined;
}

/** What the live sky holds for a sensor lesson (plan F6): each lesson waits for its own subject. */
export interface SightNow {
  /** A craft named inside the telescope's ring. */
  traffic: boolean;
  /** A craft named once and followed out past the ring. */
  tracked: boolean;
  /** A radar return nobody has named yet. */
  unknown: boolean;
}

export const NOTHING_IN_SIGHT: SightNow = { traffic: false, tracked: false, unknown: false };

export function sightNow(contacts: readonly Contact[], sensor: SensorSphere | undefined): SightNow {
  if (!sensor) return NOTHING_IN_SIGHT;
  const known = contacts.filter(contact=>contact.effectOnly !== true && contact.kind!=='unknown');
  return {
    traffic: lessonContact('telescopeTraffic', contacts, sensor) !== undefined,
    tracked: known.some(contact=>distance(contact.from,sensor.at)>sensor.identify),
    unknown: lessonContact('radarContact', contacts, sensor) !== undefined,
  };
}
