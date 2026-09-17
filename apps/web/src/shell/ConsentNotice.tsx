import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/kit/index.js';
import { publisherUrl } from '../lib/publisherPages.js';
import {
  CONSENT_EVENT,
  applyStoredConsent,
  consentMatters,
  googleCmpGoverns,
  readConsent,
  recordConsent,
  type ConsentDecision,
} from '../lib/consent.js';

/**
 * THE PRIVACY CHOICE, FOR EVERY VISITOR GOOGLE'S MESSAGE DOES NOT REACH.
 *
 * A BAR, NOT A MODAL, and that is the design decision in this file. The four
 * Consent Mode signals are already `denied` before the ad loader runs — see
 * `public/consent-bootstrap.js` — so nothing non-essential is stored while this
 * is on screen, and there is nothing to protect by blocking the page. The first
 * thing this game shows is a galaxy coming up out of black; a full-screen legal
 * dialog in front of it is the worst first frame the product could have, and it
 * would buy no privacy at all.
 *
 * WHERE IT DOES NOT APPEAR, which is most of the interesting cases:
 *
 *   · No Google tag on the build — a dev server with no measurement id stores
 *     nothing but the session cookie, and asking would be theatre.
 *   · A certified CMP is present. In the EEA, the UK and Switzerland Google's own
 *     message is mandatory and it writes the signals itself. Two notices stacked
 *     on one screen is a worse answer than either alone: whichever the visitor
 *     dismisses, the other still claims to speak for them.
 *   · The visitor already answered. Their answer is re-applied instead, and the
 *     menu row is the way back to it.
 *
 * THE FOUR QUESTIONS (CLAUDE.md). What does it mean — the first line says what is
 * kept whatever they choose, so the session cookie is visibly not part of the
 * bargain. What happens if I press it — "Refuse" says ads keep running without
 * personalisation rather than implying they disappear. Where is the rule — the
 * cookie policy is one tap deeper, in the reader's own language, not reproduced
 * here. What does it cost — two taps at most, ever, on a surface that never
 * covers the galaxy.
 */
export function ConsentNotice() {
  const { t, i18n } = useTranslation();
  /**
   * `null` until the first effect has run.
   *
   * The decision depends on `window`, and reading it during render would make
   * the component's first output depend on browser state that React's double
   * render in StrictMode reads twice. One effect, one answer, no flicker.
   */
  const [state, setState] = useState<{ open: boolean; answered: boolean } | null>(null);

  useEffect(() => {
    if (!consentMatters() || googleCmpGoverns()) {
      setState({ open: false, answered: false });
      return;
    }
    const stored = readConsent();
    // A stored answer is re-applied on every load: leaving the defaults denied
    // for someone who already said yes is not privacy, it is ignoring them.
    applyStoredConsent();
    setState({ open: stored === null, answered: stored !== null });
  }, []);

  /**
   * The menu's way back in. Listening unconditionally — including where the
   * notice decided not to show itself — so the row can still reopen the choice
   * for a visitor who answered months ago.
   */
  useEffect(() => {
    const reopen = (): void => {
      setState((current) => ({ open: true, answered: current?.answered ?? readConsent() !== null }));
    };
    window.addEventListener(CONSENT_EVENT, reopen);
    return () => {
      window.removeEventListener(CONSENT_EVENT, reopen);
    };
  }, []);

  if (!state?.open) return null;

  const answer = (decision: ConsentDecision): void => {
    recordConsent(decision);
    setState({ open: false, answered: true });
  };

  return (
    <div
      role="dialog"
      aria-labelledby="consent-title"
      /*
        FULL-BLEED AND OPAQUE, not a floating card.

        The first version was a `plate`, which is translucent by design — the
        galaxy read straight through the text and the surface looked like
        something that had failed to finish loading. A privacy notice is the one
        surface in this game that has to be legible on the first glance, so it
        gets its own solid ground and a hairline to sit on, the way the status
        bar does. Edge to edge, because a 350px phone has no room for a gutter
        that only makes the words narrower.

        `pb-[max(…,env(safe-area-inset-bottom))]`: on a phone with a home
        indicator the bottom row of a bottom-anchored surface is the one that
        ends up underneath it, and here that row is the two buttons.
      */
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-deep pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2.5"
    >
      <div className="mx-auto w-full max-w-sm space-y-2 px-3">
        {/* Title and the rule, on one row: the detail is one tap, not a wall. */}
        <div className="flex items-baseline gap-2">
          <h2 id="consent-title" className="flex-1 text-label font-semibold text-bone">
            {t('consent.title')}
          </h2>
          <a
            className="text-caption text-crystal underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-crystal"
            href={publisherUrl('cookies', i18n.resolvedLanguage)}
          >
            {t('consent.policy')}
          </a>
          {/*
            ONLY ON A REOPENED NOTICE. A first visit has no answer to fall back
            on, so a close button there would be a third option that silently
            means "no" — a dismissal masquerading as a choice. Reopened, the
            stored answer stands and closing changes nothing.
          */}
          {state.answered && (
            <button
              type="button"
              className="text-caption text-faint underline-offset-4 hover:text-bone hover:underline focus-visible:outline-2 focus-visible:outline-crystal"
              onClick={() => {
                setState({ open: false, answered: true });
              }}
            >
              {t('consent.close')}
            </button>
          )}
        </div>

        {/* What is kept whatever they choose, then what the choice controls. */}
        <p className="text-micro leading-snug text-faint">{t('consent.essentials')}</p>
        <p className="text-caption leading-snug text-dim">{t('consent.optional')}</p>

        {/*
          EQUAL WEIGHT, SIDE BY SIDE, SAME SIZE. Refusing has to be exactly as
          easy as accepting; the KVKK cookie guidance treats a buried or
          lighter-weight refusal as a defect rather than a styling choice. The
          accent on "allow" is the kit's affirmative-action rule, not a thumb on
          the scale — the two controls are the same shape and the same height.
        */}
        <div className="flex gap-2 pt-0.5">
          <Button
            size="sm"
            full
            onClick={() => {
              answer('denied');
            }}
          >
            {t('consent.refuse')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            full
            onClick={() => {
              answer('granted');
            }}
          >
            {t('consent.accept')}
          </Button>
        </div>
      </div>
    </div>
  );
}
