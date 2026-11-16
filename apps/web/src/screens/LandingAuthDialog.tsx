import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PasswordResetSheet } from './PasswordResetSheet.js';
import { useOwnPress } from '../ui/kit/index.js';
import { useNativeBack } from '../platform/nativeBack.js';
import { Banner, GameButton, RoundButton } from '../game-ui/index.js';
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
        className="gk-authsheet__scrim"
        {...dismiss}
      />

      <form
        className="gk gk-authsheet"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <span aria-hidden="true" className="gk-authsheet__grab" />
        <div className="gk-authsheet__head">
          <div>
            <p className="gk-label">{t('landing.form.eyebrowLogin')}</p>
            <h2 className="gk-display gk-authsheet__title">{t('landing.form.headingLogin')}</h2>
          </div>
          <RoundButton glyph="close" label={t('landing.form.close')} onPress={onClose} />
        </div>

        {securityNotice ? <div role="status"><Banner tone="good" glyph="shield" title={t(securityNotice === 'email' ? 'accountSecurity.emailNotice' : securityNotice === 'password' ? 'accountSecurity.passwordNotice' : 'accountSecurity.expiredNotice')} /></div> : null}
        <p className="gk-sub gk-authsheet__hint">{t('accountSecurity.loginHint')}</p>
        <GameButton tone="ghost" size="sm" className="gk-authsheet__forgot" onPress={() => { setResetOpen(true); }}>{t('accountSecurity.forgot')}</GameButton>
        {resetOpen ? <PasswordResetSheet onClose={() => { setResetOpen(false); }} /> : null}
        <div className="gk-field">
          <label className="gk-label" htmlFor={nameId}>{t('accountSecurity.loginLabel')}</label>
          <input
            id={nameId}
            ref={nameRef}
            className="gk-field__input"
            {...(problemField === 'name' ? { 'data-invalid': '' } : {})}
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
        </div>

        <div className="gk-field">
          <label className="gk-label" htmlFor={passwordId}>{t('landing.form.passwordLabel')}</label>
          <input
            id={passwordId}
            ref={passwordRef}
            className="gk-field__input"
            {...(problemField === 'password' ? { 'data-invalid': '' } : {})}
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
        </div>

        {problem !== null && <Banner tone="hostile" role="alert" title={problem} />}

        {/* The form's own submit handler is the single entry point: the press only submits it.
            Wiring both would run `submit` twice per press, and the `busy` guard cannot stop
            that — React has not re-rendered between the two calls. */}
        <GameButton submit tone="action" size="lg" wide glyph="rocket" pending={busy} onPress={() => undefined}>
          {busy ? t('landing.form.submitBusy') : t('landing.form.submitLogin')}
        </GameButton>

        <GameButton tone="ghost" wide onPress={onBegin}>{t('landing.form.switchToRegister')}</GameButton>
      </form>
    </div>
  );
}
