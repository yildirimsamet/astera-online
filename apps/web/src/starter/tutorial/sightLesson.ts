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
  if (id === 'radarContact') return live.find(contact=>contact.kind==='unknown');
  const known = live.filter(contact=>contact.kind!=='unknown');
  if (id === 'telescopeTrack') return known.find(contact=>sensor && distance(contact.from,sensor.at)>sensor.identify) ?? known[0];
  if (id === 'telescopeTraffic') return known.find(contact=>!sensor || distance(contact.from,sensor.at)<=sensor.identify);
  return undefined;
}
