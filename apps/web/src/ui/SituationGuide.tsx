import { directives, primary, type Directive, type Situation } from '../lib/directives.js';
import { serverNow } from '../lib/clock.js';
import { minutesLeft } from '../lib/time.js';
import { DirectiveCard } from './DirectiveCard.js';

/**
 * One live next action; the galaxy owns navigation and its existing focus path.
 *
 * FOR NEW COMMANDERS ONLY. Owner instruction: *"bunlar sadece yeni oyuncularda
 * bir kez gösterilmeli. Şuanda aktif oynayan userlarda gözükmemeli."*
 *
 * This card is the written half of onboarding, so it belongs to the population
 * onboarding belongs to. A commander a week into a season does not need to be
 * told what a Telescope is, and telling them anyway spends the one piece of
 * screen the galaxy cannot afford to lose.
 *
 * `academyStep` IS THE SERVER'S ANSWER, and that is the whole reason it is used.
 * It is stamped on a world claimed through the Academy and null on every world
 * that existed before it. A device-local flag was the cheaper option and it fails
 * the exact case the instruction names: an established commander opening the game
 * on a new phone would have been handed the beginner's card.
 */
export function SituationGuide({ situation, onAct, now = serverNow() }: {
  situation: Situation;
  onAct: (directive: Directive) => void;
  now?: number;
}) {
  if (situation.planet.academyStep == null) return null;

  // Reuse the host's clock; a cached minutesRemaining must never freeze a warning.
  const next = primary(directives({ ...situation, pending: situation.pending.map((thread) => ({
    ...thread, minutesRemaining: minutesLeft(thread.arriveAt, now),
  })) }));
  return next ? <DirectiveCard directive={next} onAct={onAct} /> : null;
}
