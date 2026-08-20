import { useEffect, useId, useRef, useState } from 'react';
import { useServers } from '../api/queries.js';
import { LandingScene } from '../landing/LandingScene.jsx';
import { LANDING_ASSETS, usePreload, type Loader } from '../lib/preload.js';
import { LoadingScreen } from '../shell/LoadingScreen.js';
import { Button } from '../ui/kit/index.js';
import { Wordmark } from '../ui/Wordmark.jsx';

/**
 * THE FRONT DOOR. D21.
 *
 * One screen with three jobs, in this order:
 *
 *   1. STATE THE PREMISE. "You own one planet in a galaxy of fifty real people. You
 *      cannot see what they hold." Somebody who reads nothing else must still know
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
  error,
  loadAsset,
}: {
  onAuthenticate: (mode: Mode, username: string, password: string) => Promise<void>;
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
}) {
  const [mode, setMode] = useState<Mode | null>(null);
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
      <div className="relative z-10 flex min-h-dvh flex-col justify-between bg-[linear-gradient(180deg,rgb(4_6_12/0.94)_0%,rgb(4_6_12/0.86)_22%,rgb(4_6_12/0.22)_42%,rgb(4_6_12/0.12)_58%,rgb(4_6_12/0.8)_84%,rgb(4_6_12/0.97)_100%)] px-6 pb-[calc(28px+env(safe-area-inset-bottom))] pt-[calc(56px+env(safe-area-inset-top))]">
        {/* A phone-width column, whatever the window is. This is a mobile-first
            game (a locked product constraint), and on a desktop a full-width row
            of two 600px buttons reads as an unfinished web page rather than as a
            deliberately narrow one. The composition behind puts the hero world on
            the right, so a left-aligned column is also the correct half. */}
        <header className="w-full max-w-md">
          {/* The painted lockup rather than type. It is the first thing anyone sees
              of this game and it carries the planet, the streak and the craft — the
              three things the sentence underneath then explains. */}
          <h1>
            <Wordmark width={300} className="mx-auto" />
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-dim">
            You own one planet in a galaxy of fifty real people. You cannot see what they
            hold. They cannot see what you hold.
          </p>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-dim">
            Everything either side does about that is the game.
          </p>
        </header>

        <footer className="w-full max-w-md">
          <Population commanders={commanders} online={online} />

          {error !== undefined && mode === null && (
            <p className="mb-3 text-[13px] text-alert" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              variant="primary"
              size="lg"
              full
              onClick={() => {
                setMode('register');
              }}
            >
              Take a planet
            </Button>
            <Button
              size="lg"
              full
              onClick={() => {
                setMode('login');
              }}
            >
              Sign in
            </Button>
          </div>
          <p className="mt-3 text-center text-[11px] text-faint">
            A name and a password. Your commander follows you to any browser.
          </p>
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
        <LoadingScreen caption="Bringing the sky up" progress={assets.progress} />
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
    <p className="mb-4 text-[12px] text-faint">
      <span className="text-dim">{commanders.toLocaleString()}</span> commanders hold a world
      {online !== null && online > 0 && (
        <>
          {' · '}
          <span className="text-opportunity">{online.toLocaleString()}</span> in game now
        </>
      )}
    </p>
  );
}

/* ── the form ───────────────────────────────────────────────── */

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,16}$/;
const MIN_PASSWORD = 8;

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
      return 'Names are 3-16 letters, numbers or underscores.';
    }
    if (username.trim().length === 0) return 'Enter your commander name.';
    if (register && password.length < MIN_PASSWORD) {
      return `Passwords are at least ${String(MIN_PASSWORD)} characters.`;
    }
    if (password.length === 0) return 'Enter your password.';
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
        setProblem(err instanceof Error ? err.message : 'Could not sign in');
        setBusy(false);
      }
    })();
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={register ? 'Create a commander' : 'Sign in'}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-void/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <form
        className="plate plate-cut relative w-full max-w-md p-6 pb-[calc(24px+env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="legend">{register ? 'New commander' : 'Welcome back'}</p>
        <h2 className="mt-2 font-display text-[24px] uppercase tracking-[0.05em] text-bone">
          {register ? 'Take a planet' : 'Sign in'}
        </h2>

        <label className="legend mt-6 block" htmlFor={nameId}>
          Commander name
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
          placeholder="Vantage"
        />

        <label className="legend mt-4 block" htmlFor={passwordId}>
          Password
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
          placeholder={register ? `At least ${String(MIN_PASSWORD)} characters` : ''}
        />

        {problem !== null && (
          <p className="mt-3 text-[13px] text-alert" role="alert">
            {problem}
          </p>
        )}

        {/* No onClick: the form's own submit handler is the single entry point.
            Wiring both would run `submit` twice per press, and the `busy` guard
            cannot stop that — React has not re-rendered between the two calls. */}
        <Button type="submit" variant="primary" size="lg" full disabled={busy} className="mt-6">
          {busy ? 'Making contact' : register ? 'Create commander' : 'Sign in'}
        </Button>

        <button
          type="button"
          className="mt-4 w-full text-center text-[12px] text-faint underline-offset-4 hover:underline"
          onClick={() => {
            setProblem(null);
            onMode(register ? 'login' : 'register');
          }}
        >
          {register ? 'I already have a commander' : 'I need a commander'}
        </button>
      </form>
    </div>
  );
}
