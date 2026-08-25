import { useEffect, useId, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useServers } from '../api/queries.js';
import { LandingScene } from '../landing/LandingScene.jsx';
import { full } from '../lib/format.js';
import { MIN_PASSWORD, USERNAME_PATTERN } from '../lib/credentials.js';
import { LANDING_ASSETS, usePreload, type Loader } from '../lib/preload.js';
import { LoadingScreen } from '../shell/LoadingScreen.js';
import { Button, useOwnPress } from '../ui/kit/index.js';
import { LanguageSwitch } from '../ui/LanguageSwitch.jsx';
import { Wordmark } from '../ui/Wordmark.jsx';
import { commanderKnownHere } from '../lib/returning.js';

/**
 * THE FRONT DOOR. D21.
 *
 * One screen with three jobs, in this order:
 *
 *   1. STATE THE PREMISE. You command a protected capital, can win colonies, and
 *      cannot see what rivals hold. Somebody who reads nothing else must still know
 *      what kind of game this is.
 *   2. SHOW THAT SOMEBODY IS IN THERE. `KNOWN RISKS` puts the empty shard second on
 *      the project's list, and the front page is where a visitor decides whether
 *      this world is inhabited. The live count is read from the public server list
 *      and shown before anyone has an account.
 *   3. GET OUT OF THE WAY. Two controls, one form, no marketing.
 *
 * The guest door is gone. A commander is a name and a password now, because a
 * fourteen-day season kept in one browser's cookie jar is a season you lose by
 * opening your laptop.
 */
export function LandingScreen({
  onAuthenticate,
  onBegin,
  open,
  error,
  loadAsset,
  knownCommander,
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
  error?: string;
  /**
   * How one asset is fetched. Overridden only under test.
   *
   * jsdom does not load subresources, so a real `Image` never fires either of its
   * events there and the door would sit behind the deadline for six seconds in
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
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode | null>(open ?? null);
  /**
   * Read ONCE, at mount, and never again. This screen is remounted every time the
   * app returns to `landing`, so there is nothing to subscribe to — and a value
   * that changed mid-render would swap the button under the player's thumb.
   */
  const [returning] = useState(() => (knownCommander ?? commanderKnownHere)());
  /** True while the frontier galaxy is being read. The page stays; the door waits. */
  const [opening, setOpening] = useState(false);
  const servers = useServers();
  /**
   * THE SCREEN IS A COVER, NOT A GATE. Owner decision.
   *
   * This page is a 3D scene with a form on top of it, and the visitor used to meet
   * a black rectangle that then had hulls and rocks pop into it one at a time
   * while they were typing a password. The first thirty seconds of a game are not
   * the place for that.
   *
   * The first fix held the page back until the assets were in, and that was the
   * wrong shape: the scene could not start decoding until the wait was over, so
   * the wait made the very stutter it was hiding arrive later. The loading screen
   * is now an OVERLAY. Everything below it mounts and loads at once — canvas,
   * models, form — and the cover comes off when the scene is ready to be smooth.
   * What the player waits through is the jank, not the loading.
   *
   * The bar is a real fraction of a real list of files, and `usePreload` lifts the
   * cover on a deadline regardless, so a slow network delays the sky and never the
   * game.
   */
  const assets = usePreload(LANDING_ASSETS, loadAsset ? { load: loadAsset } : {});

  const commanders = servers.data?.servers.reduce((sum, s) => sum + s.planets, 0) ?? null;
  const online = servers.data?.servers.reduce((sum, s) => sum + s.online, 0) ?? null;


  return (
    <main className="relative min-h-dvh overflow-hidden bg-void">
      <LandingScene />

      {/**
       * The copy sits in its own stacking context above the canvas, over a scrim
       * that is dark at the two ends and clear through the middle.
       *
       * NOT A FLAT TINT AND NOT A SIMPLE TOP-TO-BOTTOM FADE. The scene moves and
       * the text does not, so legibility cannot depend on what happens to be behind
       * a line at a given second — a craft crossing under "you cannot see what they
       * hold" must not take the sentence with it. The two stops that matter are
       * where the words are; the clear band between them is the whole reason there
       * is a 3D scene at all.
       */}
      {/**
       * THE COPY OWNS THE TOP AND THE BOTTOM, AND THE MIDDLE IS THE GAME.
       *
       * The scrim is dark at the two ends and clear through the middle. NOT a flat
       * tint and not a simple top-to-bottom fade: the scene moves and the text does
       * not, so legibility cannot depend on what happens to be behind a line at a
       * given second. The clear band between the two stops is the whole reason
       * there is a 3D scene at all, and it is wider now than it was — the premise
       * paragraphs that used to fill it have gone, because a stranger reads the
       * picture first and the sentence second, and the sentence was crowding the
       * picture out.
       */}
      <div className="relative z-10 flex min-h-dvh flex-col justify-between bg-[linear-gradient(180deg,rgb(4_6_12/0.92)_0%,rgb(4_6_12/0.72)_16%,rgb(4_6_12/0.10)_34%,rgb(4_6_12/0.06)_58%,rgb(4_6_12/0.78)_82%,rgb(4_6_12/0.97)_100%)] px-6 pb-[calc(28px+env(safe-area-inset-bottom))] pt-[calc(30px+env(safe-area-inset-top))]">
        {/*
          THE SWITCHER IS ON THE FRONT DOOR, not only in the commander sheet: a
          visitor who has landed in the wrong language has no account yet, so the
          sheet that holds that control does not exist for them.

          Top right, and small enough to be furniture. It sat under the wordmark
          competing with the one decision this page asks for; up here it is
          findable by anyone looking for it and invisible to everyone else.
        */}
        {/*
          THE TOP GROUP. The switcher and the lockup travel together so that the
          column between them and the footer is EMPTY — that gap is the picture,
          and it is the argument this page is making. Grouped rather than left as
          two flex children, which would have shared the space equally and parked
          the wordmark in the dead centre.
        */}
        <div>
          <div className="flex justify-end">
            <LanguageSwitch compact />
          </div>

          <header className="w-full">
            {/* The painted lockup rather than type. It is the first thing anyone
                sees of this game, and with the middle cleared it sits high and
                lets the sky underneath do the talking. */}
            <h1>
              <Wordmark width={288} className="mx-auto mt-2" />
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
        <footer className="mx-auto w-full max-w-md">
          <Population commanders={commanders} online={online} />

          {error !== undefined && mode === null && (
            <p className="mb-3 text-body text-threat-ink" role="alert">
              {error}
            </p>
          )}

          {/**
           * THE TWO DOORS SWAP FOR SOMEBODY WHO HAS BEEN HERE. Owner-reported bug.
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
           * So on a device that has held a commander the weights invert: signing
           * in becomes the loud control and the rehearsal becomes the quiet line.
           * Both doors stay open — a shared phone, or somebody making a second
           * commander deliberately, must still be able to get through — and the
           * flag is a HINT that decides emphasis, never a gate. See
           * `lib/returning.ts`.
           */}
          <p className="legend mb-3 text-center text-crystal/90">
            {returning ? t('landing.welcomeBack') : t('landing.ready')}
          </p>

          {returning ? (
            <>
              <button
                type="button"
                className="enter font-display uppercase"
                onClick={() => {
                  setMode('login');
                }}
              >
                <span className="enter-orbit" aria-hidden />
                <span className="text-title tracking-label">
                  {t('landing.signInPrimary')}
                </span>
                <span aria-hidden className="text-title text-crystal">
                  &rarr;
                </span>
              </button>

              <p className="mt-3 text-center text-label text-faint">
                {t('landing.returningHint')}
              </p>

              <div className="mt-2 text-center">
                <button
                  type="button"
                  disabled={opening}
                  className="text-caption text-dim underline decoration-dim/40 underline-offset-4 transition-colors hover:text-bone hover:decoration-bone/60"
                  onClick={() => {
                    if (opening) return;
                    setOpening(true);
                    void onBegin().catch(() => {
                      setOpening(false);
                    });
                  }}
                >
                  {opening ? t('landing.opening') : t('landing.newCommander')}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                className="enter font-display uppercase"
                disabled={opening}
                onClick={() => {
                  if (opening) return;
                  setOpening(true);
                  void onBegin().catch(() => {
                    // The session hook has already put the reason on this page.
                    setOpening(false);
                  });
                }}
              >
                <span className="enter-orbit" aria-hidden />
                <span className="text-title tracking-label">
                  {opening ? t('landing.opening') : t('landing.register')}
                </span>
                <span aria-hidden className="text-title text-crystal">
                  &rarr;
                </span>
              </button>

              <p className="mt-3 text-center text-label text-faint">
                {t('landing.reassurance')}
              </p>

              <div className="mt-2 text-center">
                <button
                  type="button"
                  className="text-caption text-dim underline decoration-dim/40 underline-offset-4 transition-colors hover:text-bone hover:decoration-bone/60"
                  onClick={() => {
                    setMode('login');
                  }}
                >
                  {t('landing.signIn')}
                </button>
              </div>
            </>
          )}
        </footer>
      </div>

      {mode !== null && (
        <AuthDialog
          mode={mode}
          onMode={setMode}
          onClose={() => {
            setMode(null);
          }}
          onSubmit={onAuthenticate}
        />
      )}

      {/* Over everything, including the form — the page underneath is live and
          loading the whole time it is up. */}
      {!assets.ready && (
        <LoadingScreen caption={t('landing.cover')} progress={assets.progress} />
      )}
    </main>
  );
}

export type Mode = 'login' | 'register';

/**
 * How busy the world is, stated before anyone signs up.
 *
 * Silent until it knows. A hard zero while the request is in flight would say the
 * one thing that stops a visitor dead, and say it wrongly.
 */
function Population({ commanders, online }: { commanders: number | null; online: number | null }) {
  if (commanders === null || commanders === 0) return null;
  return (
    <p className="mb-4 text-caption text-faint">
      {/*
        `Trans` rather than two fragments of a sentence: which side of the figure
        the noun sits on is a property of the language, and splitting the string
        here would decide that in JSX for every language at once. The tinted span
        is the `<0>` in the resource.
      */}
      <Trans
        i18nKey="landing.populationHeld"
        values={{ amount: full(commanders) }}
        components={[<span key="n" className="text-dim" />]}
      />
      {online !== null && online > 0 && (
        <>
          {' · '}
          <Trans
            i18nKey="landing.populationOnline"
            values={{ amount: full(online) }}
            components={[<span key="n" className="text-opportunity" />]}
          />
        </>
      )}
    </p>
  );
}

/* ── the form ───────────────────────────────────────────────── */


/**
 * Sign in, or become somebody.
 *
 * ONE COMPONENT FOR BOTH. The two forms differ by a heading, a verb and one
 * validation rule; splitting them would mean two copies of the focus handling, the
 * error handling and the keyboard behaviour, and those are the parts that actually
 * go wrong.
 *
 * VALIDATION IS CLIENT-SIDE FOR SPEED AND SERVER-SIDE FOR TRUTH. The rules here
 * mirror `auth/credentials.ts` so a player is told about a three-character name
 * without a round trip; the server checks again regardless, and its refusal —
 * including the one this cannot know, that the name is taken — is what is shown.
 */
function AuthDialog({
  mode,
  onMode,
  onClose,
  onSubmit,
}: {
  mode: Mode;
  onMode: (mode: Mode) => void;
  onClose: () => void;
  onSubmit: (mode: Mode, username: string, password: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameId = useId();
  const passwordId = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  // The form is why the sheet opened, so it starts focused. Autofocus via the DOM
  // rather than the attribute: React's `autoFocus` is unreliable inside a portal
  // that mounts and animates.
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Escape closes it. Anything modal that traps a player is worse than no modal.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const register = mode === 'register';

  const check = (): string | null => {
    if (register && !USERNAME_PATTERN.test(username.trim())) {
      return t('landing.form.badName');
    }
    if (username.trim().length === 0) return t('landing.form.noName');
    if (register && password.length < MIN_PASSWORD) {
      return t('landing.form.shortPassword', { count: MIN_PASSWORD });
    }
    if (password.length === 0) return t('landing.form.noPassword');
    return null;
  };

  const submit = (): void => {
    if (busy) return;
    const bad = check();
    if (bad) {
      setProblem(bad);
      return;
    }
    setProblem(null);
    setBusy(true);
    void (async () => {
      try {
        await onSubmit(mode, username.trim(), password);
      } catch (err) {
        // The session hook has already set the phase back; this is the part the
        // form owns — say what happened without discarding what was typed.
        setProblem(err instanceof Error ? err.message : t('landing.form.failed'));
        setBusy(false);
      }
    })();
  };

  // Same shape as the sheet scrim (D109a): a dismiss control must not answer the
  // tail of the gesture that opened the thing it dismisses.
  const dismiss = useOwnPress(onClose);

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={register ? t('landing.form.labelRegister') : t('landing.form.labelLogin')}
    >
      <button
        type="button"
        aria-label={t('landing.form.close')}
        className="absolute inset-0 bg-void/70"
        {...dismiss}
      />

      <form
        className="plate plate-cut relative w-full max-w-md p-6 pb-[calc(24px+env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="legend">
          {register ? t('landing.form.eyebrowRegister') : t('landing.form.eyebrowLogin')}
        </p>
        <h2 className="headline text-figure mt-2 text-bone">
          {register ? t('landing.form.headingRegister') : t('landing.form.headingLogin')}
        </h2>

        <label className="legend mt-6 block" htmlFor={nameId}>
          {t('landing.form.nameLabel')}
        </label>
        <input
          id={nameId}
          ref={nameRef}
          className={`field mt-2 ${problem !== null ? 'field-bad' : ''}`}
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setProblem(null);
          }}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={16}
          placeholder={t('landing.form.namePlaceholder')}
        />

        <label className="legend mt-4 block" htmlFor={passwordId}>
          {t('landing.form.passwordLabel')}
        </label>
        <input
          id={passwordId}
          className={`field mt-2 ${problem !== null ? 'field-bad' : ''}`}
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setProblem(null);
          }}
          autoComplete={register ? 'new-password' : 'current-password'}
          maxLength={200}
          placeholder={register ? t('landing.form.passwordPlaceholder', { count: MIN_PASSWORD }) : ''}
        />

        {problem !== null && (
          <p className="mt-3 text-body text-threat-ink" role="alert">
            {problem}
          </p>
        )}

        {/* No onClick: the form's own submit handler is the single entry point.
            Wiring both would run `submit` twice per press, and the `busy` guard
            cannot stop that — React has not re-rendered between the two calls. */}
        <Button type="submit" variant="primary" size="lg" full disabled={busy} className="mt-6">
          {busy
            ? t('landing.form.submitBusy')
            : register
              ? t('landing.form.submitRegister')
              : t('landing.form.submitLogin')}
        </Button>

        <button
          type="button"
          className="mt-4 w-full text-center text-caption text-dim underline decoration-dim/40 underline-offset-4 transition-colors hover:text-bone hover:decoration-bone/60"
          onClick={() => {
            setProblem(null);
            onMode(register ? 'login' : 'register');
          }}
        >
          {register ? t('landing.form.switchToLogin') : t('landing.form.switchToRegister')}
        </button>
      </form>
    </div>
  );
}
