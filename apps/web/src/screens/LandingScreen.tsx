import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PublicLandingScreen } from '../landing/public/PublicLandingScreen.js';
import { AuthDialog } from './LandingAuthDialog.js';
import { runtime } from '../platform/runtime.js';
import { LANDING_ASSETS, usePreload, type Loader } from '../lib/preload.js';
import { LoadingScreen } from '../shell/LoadingScreen.js';
import { useOpeningCover } from '../lib/openingCover.js';
import { Banner, GameButton } from '../game-ui/index.js';
import { LanguageSwitch } from '../ui/LanguageSwitch.jsx';
import { AsteraSigil, AsteraWordmark } from '../brand/Identity.js';
import { FrontDoorArt } from '../landing/FrontDoorArt.js';
import { commanderKnownHere } from '../lib/returning.js';
import { publisherUrl, publisherWikiUrl } from '../lib/publisherPages.js';
import { capabilities } from '../platform/runtime.js';
import { useLandingTelemetry } from '../lib/playerAnalytics/useLandingTelemetry.js';

/**
 * THE FRONT DOOR. D21.
 *
 * One screen with two jobs, in this order:
 *
 *   1. STATE THE PREMISE. You command a protected capital, can win colonies, and
 *      cannot see what rivals hold. Somebody who reads nothing else must still know
 *      what kind of game this is.
 *   2. GET OUT OF THE WAY. Two controls, one form, no marketing.
 *
 * No live player count, and no request for one (owner, 2026-11-28).
 *
 * The guest door is gone. A commander is a name and a password now, because a
 * fourteen-day season kept in one browser's cookie jar is a season you lose by
 * opening your laptop.
 */
export function CompactLandingScreen({
  onAuthenticate,
  onBegin,
  open,
  error,
  loadAsset,
  knownCommander,
  securityNotice,
  loginEmail,
}: {
  onAuthenticate: (mode: Mode, username: string, password: string) => Promise<void>;
  /**
   * The primary door. D56.
   *
   * It no longer opens a form. A stranger is asked for a password AFTER ninety
   * seconds of the real game, not before — the rehearsal costs the galaxy nothing
   * (no account, no seat) and it is the only thing on this page that can answer
   * "is this worth two weeks of my evenings".
   */
  onBegin: () => Promise<void>;
  /** A form to open on arrival, for somebody sent back here to sign in. */
  open?: Mode;
  /** Public startup may defer opening a form until cookie restoration settles. */
  onRequestLogin?: () => boolean;
  /** Retry a failed web connection without replacing the public introduction. */
  onRetry?: () => void;
  securityNotice?: 'email' | 'password' | 'expired';
  loginEmail?: string;
  error?: string;
  /**
   * How one asset is fetched. Overridden only under test.
   *
   * jsdom does not load subresources, so a real `Image` never fires either of its
   * events there and the door would sit behind the deadline for five seconds in
   * every test that touches this screen. The seam is one function, it defaults to
   * the real thing, and the counting it feeds is covered directly in
   * `preload.test.ts`.
   */
  loadAsset?: Loader;
  /**
   * Whether this device has held a commander. Overridden only under test, which
   * is the same seam `loadAsset` uses and for the same reason: the real answer
   * comes from `localStorage`, and a test that has to write to storage to set up
   * a render is a test about storage.
   */
  knownCommander?: () => boolean;
}) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<Mode | null>(open ?? null);
  /**
   * Read ONCE, at mount, and never again. This screen is remounted every time the
   * app returns to `landing`, so there is nothing to subscribe to — and a value
   * that changed mid-render would swap the button under the player's thumb.
   */
  const [returning] = useState(() => (knownCommander ?? commanderKnownHere)());
  /** True while the frontier galaxy is being read. The page stays; the door waits. */
  const [opening, setOpening] = useState(false);
  const telemetry = useLandingTelemetry('native_landing');
  const begin = (): void => {
    if (opening) return;
    setMode(null);
    setOpening(true);
    void telemetry.play(onBegin).catch(() => { setOpening(false); });
  };
  /**
   * THE SCREEN IS A COVER, NOT A GATE. Owner decision.
   *
   * This page is a picture with a form on top of it, and a visitor must never meet
   * a black rectangle the picture then pops into. The first thirty seconds of a game are not
   * the place for that.
   *
   * The loading screen is an OVERLAY: the picture and the form mount at once and the
   * cover comes off when the picture is in. `usePreload` lifts it on a deadline
   * regardless, so a slow network delays the sky and never the game.
   */
  const assets = usePreload(LANDING_ASSETS, loadAsset ? { load: loadAsset } : {});
  const [drawn, setDrawn] = useState(false);
  const covered = useOpeningCover(assets.ready && drawn);

  return (
    <main className="gk gk-frontdoor relative min-h-dvh overflow-hidden">
      <FrontDoorArt onReady={() => { setDrawn(true); }} />

      {/* The picture's calm top holds the name and its quiet bottom holds the doors; the middle stays clear. */}
      <div className="gk-frontdoor__page">
        {/* The language is on the front door: a visitor in the wrong one has no account yet. */}
        <div>
          <div className="flex justify-end">
            <LanguageSwitch compact kit />
          </div>

          <header>
            <h1 className="gk-frontdoor__lockup" aria-label="Astera Online">
              <AsteraSigil className="gk-frontdoor__mark" />
              <AsteraWordmark className="gk-frontdoor__word" />
              <span className="gk-frontdoor__online" aria-hidden="true">ONLINE</span>
            </h1>
          </header>
        </div>

        {/**
         * ONE DOOR, AND IT IS NOT A FORM. D56.
         *
         * This page used to end in two equally weighted buttons, one of which
         * opened a password field. That is the shape of a service you sign up for,
         * and a stranger meeting it has been asked to commit before they have been
         * given a single reason to. The loud control now starts the rehearsal —
         * ninety seconds of the real galaxy, costing the visitor nothing and the
         * shard no seat — and the account is asked for at the end, once there is
         * something worth keeping.
         *
         * SIGNING IN IS A LINE OF TEXT, NOT A SECOND BUTTON. It is for the small
         * minority arriving on a new device; everybody else is restored by the
         * cookie before this page is ever drawn. Given equal weight it competes
         * with the one decision the page is asking for, and it reads to a first-
         * time visitor as a wall.
         */}
        <footer className="gk-frontdoor__foot">
          {error !== undefined && mode === null && <Banner tone="hostile" role="alert" title={error} />}

          {/**
           * A SHARED DEVICE NEEDS BOTH DOORS. Onboarding review, B2.
           *
           * D56's argument is intact and unchanged for a STRANGER: the loud
           * control is ninety seconds of the real galaxy, and the password is
           * asked for at the end once there is something worth keeping.
           *
           * It is the wrong door for a returning player, and that is not a matter
           * of taste — it produced a second account. Signing out landed here, the
           * loud control started the rehearsal, and the dialog at the end of a
           * rehearsal asks you to CREATE a commander. Typing a new name is the
           * obedient thing to do, a new name is a new account, and a new account
           * is entitled to a seat in the frontier galaxy. Nothing refused, because
           * nothing had been broken.
           *
           * Signing in remains first on a device that has held a commander, while
           * training gets the same visible control for a new person sharing it.
           * The flag is a HINT about the device, never proof of identity. See
           * `lib/returning.ts`.
           */}
          <p className="gk-label gk-frontdoor__greet">
            {returning ? t('landing.welcomeBack') : t('landing.ready')}
          </p>

          {returning ? (
            <>
              <GameButton tone="action" size="lg" wide glyph="rocket" marks={{ 'data-testid': 'landing-primary' }}
                onPress={() => {
                  telemetry.login();
                  setMode('login');
                }}>
                {t('landing.signInPrimary')}
              </GameButton>
              <p className="gk-note gk-frontdoor__hint">{t('landing.returningHint')}</p>
              <GameButton tone="steel" size="lg" wide pending={opening} onPress={begin}>
                {opening ? t('landing.opening') : t('landing.newCommander')}
              </GameButton>
            </>
          ) : (
            <>
              <GameButton tone="action" size="lg" wide glyph="rocket" pending={opening} marks={{ 'data-testid': 'landing-primary' }} onPress={begin}>
                {opening ? t('landing.opening') : t('landing.register')}
              </GameButton>
              <p className="gk-note gk-frontdoor__hint">{t('landing.reassurance')}</p>
              <GameButton tone="ghost" size="sm" className="gk-frontdoor__signin"
                onPress={() => {
                  telemetry.login();
                  setMode('login');
                }}>
                {t('landing.signIn')}
              </GameButton>
            </>
          )}

          {/*
            THE PUBLISHER'S OWN PAGES, ON THE ONE SCREEN A CRAWLER CAN READ.

            Everything else in this client is behind a session, so this footer is
            the only navigation Googlebot — and an AdSense site review — ever
            reaches without JavaScript running a login. Each link resolves in the
            reader's own language through `publisherUrl`, because the legal set
            exists twice: `privacy.html` is English and `gizlilik-politikasi.html`
            is Turkish, and pointing a Turkish player at an English policy is the
            same defect as pointing a reviewer at a Turkish one.
          */}
          <nav
            aria-label={t('landing.publicLinksLabel')}
            className="gk-frontdoor__links"
          >
            <a className="gk-frontdoor__link" href={publisherWikiUrl(i18n.resolvedLanguage)}>Wiki</a>
            {(
              [
                ['about', 'landing.aboutLink'],
                ['guide', 'landing.guideLink'],
                ['privacy', 'landing.privacyLink'],
                ['terms', 'landing.termsLink'],
                ['refunds', 'landing.refundsLink'],
                ['pricing', 'landing.pricingLink'],
                ['contact', 'landing.contactLink'],
              ] as const
            ).filter(([page]) => capabilities().webCheckout || (page !== 'pricing' && page !== 'refunds')).map(([page, label]) => (
              <a
                key={page}
                className="gk-frontdoor__link"
                href={publisherUrl(page, i18n.resolvedLanguage)}
              >
                {t(label)}
              </a>
            ))}
          </nav>
        </footer>
      </div>

      {mode !== null && (
        <AuthDialog
          securityNotice={securityNotice}
          loginEmail={loginEmail}
          onBegin={begin}
          onClose={() => {
            setMode(null);
          }}
          onSubmit={onAuthenticate}
        />
      )}

      {/* Over everything, including the form — the page underneath is live and
          loading the whole time it is up. */}
      <LoadingScreen visible={covered} caption={t(assets.ready ? 'loading.raising' : 'landing.cover')} {...(!assets.ready ? { progress: assets.progress } : {})} />
    </main>
  );
}

export type Mode = 'login';

export type LandingProps = Parameters<typeof CompactLandingScreen>[0];

/** Browser marketing is separate from the compact native front door; identity is shared. */
export function LandingScreen(props: LandingProps) {
  return (import.meta.env.VITE_ASTERA_PLATFORM ?? 'web') === 'web' && runtime() === 'web'
    ? <PublicLandingScreen {...props} /> : <CompactLandingScreen {...props} />;
}
