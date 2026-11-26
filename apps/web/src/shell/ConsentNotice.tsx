import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Banner, GameButton, Plate, RoundButton } from '../game-ui/index.js';
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
 * TWO FACES (owner, 2026-11-27).
 *
 *   · THE FIRST VISIT gets a thin note with one close button: only the essentials
 *     are on, measurement and personalised ads are off, and the menu is where they
 *     are turned on. Closing it — or touching anything else on the page, which is
 *     the owner's "if they play on, it goes away" — keeps exactly that and is
 *     remembered. The owner asked for "a touch means yes" first and chose this
 *     instead once told KVKK does not count carrying on as consent: the note asks
 *     no decision because nothing non-essential happens until one is made.
 *   · REOPENED FROM THE MENU it is the full choice, allow and refuse side by side
 *     and the same size, because that is the one place a yes is given.
 *
 * THE FOUR QUESTIONS (CLAUDE.md). What does it mean — the note says what is on and
 * what is off. What happens if I press it — Close keeps it so; the reopened choice's
 * "Refuse" says ads keep running without personalisation. Where is the rule — the
 * cookie policy is one tap deeper, in the reader's own language. What does it cost —
 * nothing: the first touch on the game puts it away and still does what it was for.
 */
export function ConsentNotice({ inlineHost, onVisibilityChange }: { inlineHost?: HTMLElement | null; onVisibilityChange?: (visible: boolean) => void } = {}) {
  const platform = capabilities();
  if (!platform.webAds && !platform.webAnalytics) return null;
  return inlineHost ? createPortal(<WebConsentNotice inlineHost={inlineHost} onVisibilityChange={onVisibilityChange} />, inlineHost) : <WebConsentNotice onVisibilityChange={onVisibilityChange} />;
}

function WebConsentNotice({ inlineHost, onVisibilityChange }: { inlineHost?: HTMLElement; onVisibilityChange?: (visible: boolean) => void } = {}) {
  const { t, i18n } = useTranslation();
  /**
   * `null` until the first effect has run.
   *
   * The decision depends on `window`, and reading it during render would make
   * the component's first output depend on browser state that React's double
   * render in StrictMode reads twice. One effect, one answer, no flicker.
   *
   * `notice` is the first visit's note; `choice` is the full choice the menu reopens.
   */
  const [state, setState] = useState<{ open: boolean; mode: 'notice' | 'choice' } | null>(null);

  useEffect(() => {
    if (!consentMatters() || googleCmpGoverns()) {
      setState({ open: false, mode: 'notice' });
      return;
    }
    const stored = readConsent();
    // A stored answer is re-applied on every load: leaving the defaults denied
    // for someone who already said yes is not privacy, it is ignoring them.
    applyStoredConsent();
    setState({ open: stored === null, mode: 'notice' });
  }, []);

  /**
   * The menu's way back in. Listening unconditionally — including where the
   * notice decided not to show itself — so the row can still reopen the choice
   * for a visitor who answered months ago.
   */
  useEffect(() => {
    const reopen = (): void => {
      setState({ open: true, mode: 'choice' });
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
  const mode = state?.mode ?? 'notice';
  useEffect(() => { onVisibilityChange?.(open); }, [open, onVisibilityChange]);
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

  /** Put away: the first visit's note keeps only the essentials; a reopened choice keeps whatever stands. */
  const putAway = useCallback((): void => {
    if (mode === 'notice') recordConsent('denied');
    setState({ open: false, mode });
  }, [mode]);

  /*
    ANY TOUCH ELSEWHERE PUTS IT AWAY (owner, 2026-11-27). Captured on the document so a
    control that stops its own event still counts, and never prevented: the touch that
    puts the note away still pulls the breaker or turns the galaxy it was meant for.
  */
  useEffect(() => {
    if (!open) return undefined;
    const elsewhere = (event: PointerEvent): void => {
      if (event.target instanceof Node && bar.current?.contains(event.target)) return;
      putAway();
    };
    document.addEventListener('pointerdown', elsewhere, true);
    return () => {
      document.removeEventListener('pointerdown', elsewhere, true);
    };
  }, [open, putAway]);

  if (!state?.open) return null;

  const answer = (decision: ConsentDecision): void => {
    recordConsent(decision);
    setState({ open: false, mode });
  };
  const policy = (
    <a className="consent-policy text-v2-self underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-v2-self" href={publisherUrl('cookies', i18n.resolvedLanguage)}>
      {t('consent.policy')}
    </a>
  );

  return (
    <div
      ref={bar}
      role="dialog"
      data-consent-notice=""
      data-consent-mode={mode}
      aria-labelledby="consent-title"
      // Public landing supplies a normal-flow host; game retains its safe-area bar. The frame lets
      // touches through around the note, so a touch beside it reaches the game and puts it away.
      className="gk pointer-events-none fixed inset-x-0 bottom-0 z-50 px-2 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto mx-auto w-full max-w-md">
        {mode === 'notice' ? (
          <Banner
            variant="strip"
            glyph="shield"
            title={<span id="consent-title">{t('consent.notice')}</span>}
            body={<>{t('consent.noticeBody')} {policy}</>}
            action={<RoundButton glyph="close" small label={t('consent.close')} onPress={putAway} />}
          />
        ) : (
          <Plate className="space-y-2 p-2.5">
            {/* Title and the rule, on one row: the detail is one tap, not a wall. */}
            <div className="flex items-center gap-2">
              <h2 id="consent-title" className="consent-heading flex-1 text-caption font-semibold text-v2-ink">{t('consent.title')}</h2>
              <span className="shrink-0 text-micro">{policy}</span>
              {/* Reopened, the stored answer stands and closing changes nothing. */}
              <RoundButton glyph="close" small label={t('consent.close')} onPress={putAway} />
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
            <div className="grid grid-cols-2 gap-2">
              <GameButton wide onPress={() => { answer('denied'); }}>{t('consent.refuse')}</GameButton>
              <GameButton wide tone="action" onPress={() => { answer('granted'); }}>{t('consent.accept')}</GameButton>
            </div>
          </Plate>
        )}
      </div>
    </div>
  );
}
