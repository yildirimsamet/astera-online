import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../v2/kit/Surface.js';
import { publisherUrl } from '../lib/publisherPages.js';
import { capabilities } from '../platform/runtime.js';
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
export function ConsentNotice({ inlineHost }: { inlineHost?: HTMLElement | null } = {}) {
  const platform = capabilities();
  if (!platform.webAds && !platform.webAnalytics) return null;
  return inlineHost ? createPortal(<WebConsentNotice inlineHost={inlineHost} />, inlineHost) : <WebConsentNotice />;
}

function WebConsentNotice({ inlineHost }: { inlineHost?: HTMLElement } = {}) {
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
      inlineHost?.scrollIntoView({ block: 'center' });
    };
    window.addEventListener(CONSENT_EVENT, reopen);
    return () => {
      window.removeEventListener(CONSENT_EVENT, reopen);
    };
  }, [inlineHost]);

  /*
    ITS HEIGHT, FOR WHATEVER ELSE OWNS THE BOTTOM EDGE (owner, 2026-10-20). The claim sheet
    stood under the bar with its Continue hidden; it now reads `--consent-h` and stands on top.
  */
  const bar = useRef<HTMLDivElement>(null);
  const open = state?.open === true;
  useLayoutEffect(() => {
    const root = document.documentElement;
    const element = bar.current;
    if (!open || !element) return undefined;
    const publish = (): void => { root.style.setProperty('--consent-h', `${String(element.offsetHeight)}px`); };
    publish();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(publish) : null;
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      root.style.removeProperty('--consent-h');
    };
  }, [open]);

  if (!state?.open) return null;

  const answer = (decision: ConsentDecision): void => {
    recordConsent(decision);
    setState({ open: false, answered: true });
  };

  return (
    <div
      ref={bar}
      role="dialog"
      data-consent-notice=""
      aria-labelledby="consent-title"
      // Public landing supplies a normal-flow host; game retains its safe-area bar.
      className="fixed inset-x-0 bottom-0 z-50 border-t border-v2-line bg-v2-panel pb-[max(0.5rem,env(safe-area-inset-bottom))] font-v2-ui text-v2-ink"
    >
      <div className="mx-auto w-full max-w-md space-y-2 px-3 pt-2.5">
        {/* Title and the rule, on one row: the detail is one tap, not a wall. */}
        <div className="flex items-baseline gap-2">
          <h2 id="consent-title" className="consent-heading flex-1 text-caption font-semibold text-v2-ink">
            {t('consent.title')}
          </h2>
          <a
            className="shrink-0 text-micro text-v2-self underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-v2-self"
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
              className="text-micro text-v2-ink-2 underline-offset-4 hover:text-v2-ink hover:underline focus-visible:outline-2 focus-visible:outline-v2-self"
              onClick={() => {
                setState({ open: false, answered: true });
              }}
            >
              {t('consent.close')}
            </button>
          )}
        </div>

        {/* What is kept whatever they choose, then what the choice controls. */}
        <p className="consent-copy text-micro leading-relaxed text-v2-ink-2">{t('consent.essentials')} {t('consent.optional')}</p>

        {/*
          EQUAL WEIGHT, SIDE BY SIDE, SAME SIZE. Refusing has to be exactly as
          easy as accepting; the KVKK cookie guidance treats a buried or
          lighter-weight refusal as a defect rather than a styling choice. The
          accent on "allow" is the kit's affirmative-action rule, not a thumb on
          the scale — the two controls are the same shape and the same height.
        */}
        <div className="flex gap-2 pt-0.5">
          <Button
            size="md"
            full
            onClick={() => {
              answer('denied');
            }}
          >
            {t('consent.refuse')}
          </Button>
          <Button
            size="md"
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
