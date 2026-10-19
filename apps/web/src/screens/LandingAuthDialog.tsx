import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PasswordResetSheet } from './PasswordResetSheet.js';
import { useOwnPress } from '../ui/kit/index.js';
import { useNativeBack } from '../platform/nativeBack.js';
import { Button as V2Button } from '../v2/kit/Surface.js';
import { Icon } from '../v2/icons.js';
import { describeError } from '../i18n/errors.js';
import type { Mode } from './LandingScreen.js';

/**
 * Sign-in only. A new commander goes through training before ClaimDialog asks
 * for credentials; registering here bypassed both teaching and opening orders.
 */
export function AuthDialog({
  onBegin,
  onClose,
  onSubmit,
  securityNotice,
  loginEmail,
}: {
  onBegin: () => void;
  onClose: () => void;
  onSubmit: (mode: Mode, username: string, password: string) => Promise<void>;
  securityNotice?: 'email' | 'password' | 'expired' | undefined;
  loginEmail?: string | undefined;
}) {
  const { t } = useTranslation();
  const [resetOpen, setResetOpen] = useState(false);
  const [username, setUsername] = useState(loginEmail ?? '');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [problemField, setProblemField] = useState<'name' | 'password' | null>(null);
  const [busy, setBusy] = useState(false);
  const nameId = useId();
  const passwordId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useNativeBack(panel, onClose);
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // The form is why the sheet opened, so it starts focused. Autofocus via the DOM
  // rather than the attribute: React's `autoFocus` is unreliable inside a portal
  // that mounts and animates.
  useEffect(() => {
    if (loginEmail) passwordRef.current?.focus();
    else nameRef.current?.focus();
  }, [loginEmail]);

  // Escape closes it. Anything modal that traps a player is worse than no modal.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !resetOpen) onClose();
      if (event.key !== 'Tab' || resetOpen) return;
      const controls = panel.current?.querySelectorAll<HTMLElement>('form button:not(:disabled), form input:not(:disabled), form a[href]');
      const first = controls?.[0]; const last = controls?.[controls.length - 1];
      if (!first || !last) return;
      if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, resetOpen]);

  const check = (): { message: string; field: 'name' | 'password' } | null => {
    if (username.trim().length === 0) return { message: t('accountSecurity.identifierRequired'), field: 'name' };
    if (password.length === 0) return { message: t('landing.form.noPassword'), field: 'password' };
    return null;
  };

  const submit = (): void => {
    if (busy) return;
    const bad = check();
    if (bad) {
      setProblem(bad.message);
      setProblemField(bad.field);
      return;
    }
    setProblem(null);
    setProblemField(null);
    setBusy(true);
    void (async () => {
      try {
        await onSubmit('login', username.trim(), password);
      } catch (err) {
        // The session hook has already set the phase back; this is the part the
        // form owns — say what happened without discarding what was typed.
        setProblem(describeError(err));
        setProblemField(null);
        setBusy(false);
      }
    })();
  };

  // Same shape as the sheet scrim (D109a): a dismiss control must not answer the
  // tail of the gesture that opened the thing it dismisses.
  const dismiss = useOwnPress(onClose);
  const closePress = useOwnPress(onClose);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-4"
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={t('landing.form.labelLogin')}
    >
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className="absolute inset-0 bg-v2-void/70"
        {...dismiss}
      />

      <form
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto border border-b-0 border-v2-line bg-v2-panel px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 font-v2-ui text-v2-ink shadow-2xl sm:rounded-sheet sm:border-b sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <span aria-hidden="true" className="mx-auto mb-4 block h-1 w-9 rounded-full bg-v2-line-hi sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3">
              {t('landing.form.eyebrowLogin')}
            </p>
            <h2 className="mt-1 text-figure font-semibold leading-tight text-v2-ink">
              {t('landing.form.headingLogin')}
            </h2>
          </div>
          <button type="button" aria-label={t('landing.form.close')} className="grid size-9 shrink-0 place-items-center rounded-control border border-v2-line bg-v2-raise text-v2-ink-2 hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-v2-self" {...closePress}>
            <Icon id="i-close" className="size-4" />
          </button>
        </div>

        {securityNotice ? <p role="status" className="mt-4 rounded-control border border-v2-self/40 bg-v2-self/10 p-3 text-caption leading-relaxed text-v2-ink">{t(securityNotice === 'email' ? 'accountSecurity.emailNotice' : securityNotice === 'password' ? 'accountSecurity.passwordNotice' : 'accountSecurity.expiredNotice')}</p> : null}
        <p className="mt-4 text-caption text-v2-ink-2">{t('accountSecurity.loginHint')}</p>
        <button type="button" className="mt-2 min-h-10 text-caption text-v2-self" onClick={() => { setResetOpen(true); }}>{t('accountSecurity.forgot')}</button>
        {resetOpen ? <PasswordResetSheet onClose={() => { setResetOpen(false); }} /> : null}
        <label className="mt-5 block text-micro font-semibold uppercase tracking-wide text-v2-ink-2" htmlFor={nameId}>
          {t('accountSecurity.loginLabel')}
        </label>
        <input
          id={nameId}
          ref={nameRef}
          className={`mt-1.5 min-h-12 w-full rounded-control border bg-v2-deep px-3 font-v2-ui text-title text-v2-ink placeholder:text-v2-ink-3 outline-none focus-visible:border-v2-self focus-visible:ring-1 focus-visible:ring-v2-self/30 ${problemField === 'name' ? 'border-v2-hostile' : 'border-v2-line-hi'}`}
          aria-invalid={problemField === 'name'}
          value={username}
          onChange={(event) => {
            setUsername(event.target.value);
            setProblem(null);
            setProblemField(null);
          }}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={254}
          placeholder={t('accountSecurity.loginLabel')}
        />

        <label className="mt-4 block text-micro font-semibold uppercase tracking-wide text-v2-ink-2" htmlFor={passwordId}>
          {t('landing.form.passwordLabel')}
        </label>
        <input
          id={passwordId}
          ref={passwordRef}
          className={`mt-1.5 min-h-12 w-full rounded-control border bg-v2-deep px-3 font-v2-ui text-title text-v2-ink outline-none focus-visible:border-v2-self focus-visible:ring-1 focus-visible:ring-v2-self/30 ${problemField === 'password' ? 'border-v2-hostile' : 'border-v2-line-hi'}`}
          aria-invalid={problemField === 'password'}
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setProblem(null);
            setProblemField(null);
          }}
          autoComplete="current-password"
          maxLength={200}
        />

        {problem !== null && (
          <p className="mt-3 text-caption text-v2-hostile" role="alert">
            {problem}
          </p>
        )}

        {/* No onClick: the form's own submit handler is the single entry point.
            Wiring both would run `submit` twice per press, and the `busy` guard
            cannot stop that — React has not re-rendered between the two calls. */}
        <V2Button type="submit" variant="primary" size="lg" full disabled={busy} className="mt-5">
          {busy
            ? t('landing.form.submitBusy')
            : t('landing.form.submitLogin')}
        </V2Button>

        <button
          type="button"
          className="mt-3 min-h-10 w-full rounded-control text-center text-caption text-v2-ink-2 underline decoration-v2-ink-3/50 underline-offset-4 hover:text-v2-ink focus-visible:outline-2 focus-visible:outline-v2-self"
          onClick={() => {
            onBegin();
          }}
        >
          {t('landing.form.switchToRegister')}
        </button>
      </form>
    </div>
  );
}
