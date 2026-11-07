import { interceptAsteroid, type Vec3 } from '@astera/rules';
import type { AsteroidView } from '../api/schemas.js';
import { asteroidVisualSeed } from '../galaxy/scene.js';
import i18n from '../i18n/index.js';
import { compact, percent } from './format.js';
import { duration } from './time.js';

/**
 * How long a Prospector takes to meet a rock, solved as the server solves it: a rock moves, so a
 * straight line to where it is now is the wrong answer. Null when there is no meeting to be had.
 */
export function rockReachMinutes(home: Vec3 | undefined, speed: number, rock: AsteroidView, minutesNow: number): number | null {
  if (!home || !(speed > 0)) return null;
  const hit = interceptAsteroid(home, speed, { ...rock, index: asteroidVisualSeed(rock.id), deuteriumShare: rock.deuteriumShare ?? 0 }, minutesNow);
  return hit ? hit.flightMinutes : null;
}

/** A rock as the target list states it: what it holds, what share comes back as crystal, how far it is. */
export function rockLine(rock: AsteroidView, reach: number | null): string {
  const holds = i18n.t('galaxy.targetRock', { amount: compact(rock.oreRemaining), crystal: percent(rock.crystalShare) });
  return reach === null ? holds : `${holds} · ${i18n.t('galaxy.targetAway', { duration: duration(reach) })}`;
}
