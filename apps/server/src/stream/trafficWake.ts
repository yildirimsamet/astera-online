import { discoveredAsteroidIndexes } from '../services/asteroidField.js';
import type { CommanderTopology } from '../services/ownership.js';
import { discoveredPirateIndexes } from '../services/pirateField.js';
import type { Projections } from '../services/projections.js';
import {
  projectGalaxyTraffic,
  projectStrategicInterceptionImpacts,
  projectStrategicInterceptions,
} from '../services/traffic.js';

/** What one commander's `/api/galaxy/traffic` answers. One function, so the wake can never disagree with the read. */
export async function readTrafficView(projections: Projections, self: CommanderTopology, now: Date) {
  // Both from the same generation of the caller's world list: the horizon and
  // the ownership filter must never disagree about which worlds are theirs.
  const [snapshot, sensors, mining, epochs, pirates] = await Promise.all([
    projections.trafficSnapshot(self.seasonId, now),
    projections.sensorsFor(self.playerId, self.seasonId, self.planetIds),
    projections.miningSnapshot(self.seasonId, now),
    projections.historyFor(self.playerId, self.seasonId),
    projections.pirateSnapshot(self.seasonId, now),
  ]);
  return {
    contacts: projectGalaxyTraffic(
      snapshot,
      self.capitalPlanetId,
      now,
      self.playerId,
      self.planetIds,
      sensors,
      // Traffic needs discovery only for rocks with actual flights. Solving
      // every retained orbit for every caller repeats the field endpoint's work.
      discoveredAsteroidIndexes(mining, epochs, now, new Set(snapshot.miningRows.flatMap(({ run }) =>
        run.asteroidIndex === null ? [] : [run.asteroidIndex]))),
      pirates,
      discoveredPirateIndexes(pirates, epochs, now),
    ),
    interceptions: projectStrategicInterceptions(snapshot, self.playerId, sensors),
    interceptionImpacts: projectStrategicInterceptionImpacts(snapshot, self.playerId, sensors, now),
  };
}

interface TrafficPicture {
  contacts: readonly object[];
  interceptions: readonly object[];
  interceptionImpacts: readonly object[];
}

/**
 * The picture, without what moves on its own. A contact's window slides with every read
 * and the client coasts along it until it ends, so a flight carrying on is not news.
 */
export function trafficSignature(view: TrafficPicture): string {
  const contacts = view.contacts.map(contact => JSON.stringify(contact, (key, value: unknown) =>
    key === 'from' || key === 'to' || key === 'startAt' || key === 'endAt' || key === 'minutesRemaining' ? undefined : value));
  return `${contacts.sort().join('\n')}|${JSON.stringify(view.interceptions)}|${JSON.stringify(view.interceptionImpacts)}`;
}

/** A commit is readable once the event arrives; this spreads the readers and lets a burst gather. */
const ACTIVITY_SETTLE_MS = 500;

/**
 * Ask on the clock a client used to poll on, and wake it when the answer moved.
 *
 * Woken twice for a change: the read can reach a replica whose shared snapshot has not
 * caught up with the one that noticed, and nothing else would ask again for minutes.
 * The first read falls anywhere in the interval, so a redeploy does not ask all at once.
 * `failed` and `recovered` are for the client, which must poll for itself meanwhile.
 *
 * `soon` is for galaxy activity, which no longer sends the client to read for itself. It
 * brings the next read forward instead of adding one: the clock restarts after it, so a
 * craft in sight shows within a moment and a busy galaxy costs what the clock costs.
 */
export function watchTraffic(options: {
  read: () => Promise<string>;
  everyMs: number;
  timeoutMs: number;
  wake: () => void;
  failed: (error: unknown) => void;
  recovered: () => void;
}): { stop: () => void; soon: () => void } {
  const { read, everyMs, timeoutMs, wake, failed, recovered } = options;
  let known: string | null = null;
  let settling = false;
  let failing = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let deadline: ReturnType<typeof setTimeout> | null = null;
  let nextAt = 0;
  let asking = false;
  let askAgain = false;
  // Half of it random: every connection heard the same event at the same instant.
  const afterActivity = (): number => ACTIVITY_SETTLE_MS * (1 + Math.random());

  const bounded = (): Promise<string> => new Promise<string>((resolve, reject) => {
    deadline = setTimeout(() => { reject(new Error('traffic read timed out')); }, timeoutMs);
    deadline.unref();
    read().then(resolve, reject);
  }).finally(() => {
    if (deadline) clearTimeout(deadline);
  });
  const nextAfter = (ms: number): void => {
    if (timer) clearTimeout(timer);
    nextAt = Date.now() + ms;
    timer = setTimeout(() => { void tick(); }, ms);
    timer.unref();
  };
  const tick = async (): Promise<void> => {
    asking = true;
    try {
      const answer = await bounded();
      if (stopped) return;
      const back = failing;
      failing = false;
      if (back) recovered();
      const moved = answer !== known;
      if (moved || settling || back) wake();
      settling = moved && known !== null;
      known = answer;
    } catch (error) {
      if (stopped) return;
      if (!failing) failed(error);
      failing = true;
    }
    asking = false;
    nextAfter(askAgain ? afterActivity() : everyMs);
    askAgain = false;
  };
  nextAfter(everyMs * Math.random());
  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (deadline) clearTimeout(deadline);
    },
    soon: () => {
      if (stopped || failing) return;
      // That read may have been answered before this commit.
      if (asking) {
        askAgain = true;
        return;
      }
      const ms = afterActivity();
      if (Date.now() + ms < nextAt) nextAfter(ms);
    },
  };
}
