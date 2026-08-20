import i18n from './index.js';
import { ApiError } from '../api/client.js';
import { en } from './locales/en/index.js';
import { hullName, instrumentName } from './names.js';

/**
 * A REFUSAL, IN THE PLAYER'S LANGUAGE, WITH ITS FIGURES INTACT.
 *
 * Every refusal a player sees comes through here, so none of them leak a stack —
 * and none of them arrive in the wrong language either.
 *
 * WHY THE SERVER STILL SENDS A SENTENCE. Three reasons, and each one is a real
 * failure this fallback prevents:
 *
 *   · A SERVER AHEAD OF THIS BUILD. A new code deploys, a phone has not reloaded,
 *     and the client has no entry for it. The English sentence is worse than a
 *     translation and enormously better than a blank toast or the literal string
 *     `errors.WHATEVER_IT_WAS`.
 *   · A CODE THAT NEVER MEANT TO BE READ. `STREAM_FAILED` and the transport-level
 *     failures are diagnostics, not game rules.
 *   · SOMETHING THAT IS NOT AN `ApiError` AT ALL — a `TypeError` from a broken
 *     fetch, a Zod parse failure on a payload the server malformed.
 *
 * WHY IT IS NOT ENOUGH ON ITS OWN. The server's sentence has its numbers already
 * baked in, so it cannot be translated after the fact — "All 4 flight bays are in
 * use" is a finished English string. The code plus `params` is the same fact in a
 * form that can still be said in another language, which is why the API carries
 * both.
 */

const CATALOGUE = en.errors;

/** The three entries that are not server codes. */
const NOT_A_CODE = new Set(['unknown', 'unreachable', 'streamFailed']);

const isKnown = (code: string): code is keyof typeof CATALOGUE =>
  code in CATALOGUE && !NOT_A_CODE.has(code);

/**
 * NAMED THINGS ARRIVE AS IDS AND ARE RESOLVED HERE.
 *
 * `hull` and `instrument` are `WASP` and `TELESCOPE` on the wire, because the
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
    if (isKnown(err.code)) {
      // `context` rides in with the params, so a code with two wordings — a
      // locked galaxy with or without a frontier to point at — resolves to
      // `SERVER_LOCKED_frontier` without a branch here.
      return i18n.t(`errors.${err.code}`, resolve(err.params ?? {}));
    }
    // Unknown code: the server's own sentence, which is at least true.
    return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return i18n.t('errors.unknown');
}
