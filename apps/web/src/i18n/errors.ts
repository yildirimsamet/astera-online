import i18n from './index.js';
import { ApiError } from '../api/client.js';
import { en } from './locales/en/index.js';
import { hullName, instrumentName } from './names.js';

/**
 * A REFUSAL, IN THE PLAYER'S LANGUAGE, WITH ITS FIGURES INTACT.
 *
 * Known codes and their params explain verified game rules in the active locale.
 * Unknown codes, JavaScript errors and incomplete older-server params use a
 * neutral localised message. Raw diagnostics cannot establish a safe next action
 * or a transaction's outcome and do not belong in player-facing copy.
 */

const CATALOGUE = en.errors;

/** The queue names a `QUEUE_FULL` refusal carries, as the screens call them. */
const QUEUE_NAME: Record<string, 'planet.queue.construction' | 'planet.queue.yard' | 'repairStation.queue'> = {
  construction: 'planet.queue.construction',
  yard: 'planet.queue.yard',
  repair: 'repairStation.queue',
};

/** The three entries that are not server codes. */
const NOT_A_CODE = new Set(['unknown', 'unreachable', 'streamFailed']);

const isKnown = (code: string): code is keyof typeof CATALOGUE =>
  Object.hasOwn(CATALOGUE, code) && !NOT_A_CODE.has(code);

/**
 * NAMED THINGS ARRIVE AS IDS AND ARE RESOLVED HERE.
 *
 * `hull` and `instrument` are `DART` and `TELESCOPE` on the wire, because the
 * server has no business holding a Turkish name for a Wasp — `packages/rules` is
 * the shared source of truth and it is deliberately language-free. Resolving them
 * at the last moment is what lets one refusal read "Evde yeterli Atmaca yok" and
 * "Not enough Wasp at home" from the same payload.
 */
function resolve(params: Record<string, string | number>): Record<string, string | number> {
  const out = { ...params };
  if (typeof out.hull === 'string') out.hull = hullName(out.hull) ?? out.hull;
  if (typeof out.instrument === 'string') {
    out.instrument = instrumentName(out.instrument) ?? out.instrument;
  }
  // A full queue is named in words; the server sends its lower-cased id.
  if (typeof out.queue === 'string') {
    const lane = QUEUE_NAME[out.queue];
    if (lane) out.queue = i18n.t(lane);
  }
  return out;
}

/**
 * @param err anything a mutation or a query can reject with.
 * @returns one sentence, ready to put in a toast.
 */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'UNREACHABLE') return i18n.t('errors.unreachable');
    if (err.code === 'STREAM_FAILED') return i18n.t('errors.streamFailed');
    if (err.code === 'PERSONAL_RAID_COOLDOWN') {
      const until = err.params?.until;
      const at = typeof until === 'string' ? Date.parse(until) : NaN;
      if (!Number.isFinite(at)) return i18n.t('errors.unknown');
      return i18n.t('errors.PERSONAL_RAID_COOLDOWN', {
        until: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'medium' }).format(at),
      });
    }
    // F0.9: the window in the player's own clock, the day named on its start.
    if (err.code === 'MAINTENANCE_LANDING' || err.code === 'MAINTENANCE_IN_FLIGHT') {
      const from = typeof err.params?.startsAt === 'string' ? Date.parse(err.params.startsAt) : NaN;
      const to = typeof err.params?.endsAt === 'string' ? Date.parse(err.params.endsAt) : NaN;
      if (!Number.isFinite(from) || !Number.isFinite(to)) return i18n.t('errors.unknown');
      return i18n.t(`errors.${err.code}`, {
        from: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(from),
        to: new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(to),
      });
    }
    if (isKnown(err.code)) {
      // `context` rides in with the params, so a code with two wordings — a
      // locked galaxy with or without a frontier to point at — resolves to
      // `SERVER_LOCKED_frontier` without a branch here.
      const message = i18n.t(`errors.${err.code}`, resolve(err.params ?? {}));
      return message.includes('{{') ? i18n.t('errors.unknown') : message;
    }
  }
  return i18n.t('errors.unknown');
}
